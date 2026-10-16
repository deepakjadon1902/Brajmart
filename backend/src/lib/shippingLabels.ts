import { dbExecute, dbQuery, withDbTransaction } from './db';
import crypto from 'node:crypto';
import { parseJson } from './dbHelpers';
import { convertReservationToSale } from './inventory';
import { sendShippingUpdate } from './email';
import { merchantOrderWhereSql } from './orderVisibility';

type ShippingLabelStatus = 'Pending' | 'Shipped' | 'Delivered' | 'RTO';

export type ExternalShippingLabel = {
  id: string;
  status: ShippingLabelStatus;
  courier_name: string;
  tracking_id: string;
  order_reference?: string | null;
  raw_courier_status?: string | null;
  tracking_event_description?: string | null;
  tracking_location?: string | null;
  tracking_source?: string | null;
  tracking_provider?: string | null;
  last_successful_sync?: string | null;
  is_delivery_failed?: boolean;
  rto_status?: string | null;
};

type OrderForLabel = {
  id: string | number;
  items: unknown;
  total: number | string;
  status: string;
  customer_name?: string | null;
  customer_email?: string | null;
  shipping_address: unknown;
  payment_method: string;
  tracking_id?: string | null;
  shipping_service?: string | null;
};

const LABELS_APP_URL = 'https://labels.brajmart.com';
const TERMINAL_ORDER_STATUSES = new Set(['delivered', 'cancelled', 'rto']);
const STATUS_RANK: Record<string, number> = {
  pending_payment: 0,
  confirmed: 1,
  processing: 2,
  shipped: 3,
  out_for_delivery: 4,
  delivered: 5,
};

let cachedCookie = '';
let cachedCookieExpiresAt = 0;
let schemaReadyPromise: Promise<void> | null = null;
let schedulerStarted = false;
let schedulerRunning = false;

const clean = (value: unknown) => String(value ?? '').trim();
const isCod = (value: unknown) => ['cod', 'cash on delivery'].includes(clean(value).toLowerCase());

const labelsConfig = () => {
  const appUrl = clean(process.env.SHIPPING_LABELS_APP_URL || LABELS_APP_URL).replace(/\/$/, '');
  const apiUrl = clean(process.env.SHIPPING_LABELS_API_URL || `${appUrl}/api/v1`).replace(/\/$/, '');
  const username = clean(process.env.SHIPPING_LABELS_USERNAME);
  const password = String(process.env.SHIPPING_LABELS_PASSWORD || '');
  const timeoutMs = Math.max(2_000, Number(process.env.SHIPPING_LABELS_TIMEOUT_MS || 15_000));
  return { appUrl, apiUrl, username, password, timeoutMs };
};

export const isShippingLabelsConfigured = () => {
  const config = labelsConfig();
  return Boolean(config.apiUrl && config.username && config.password);
};

const fetchWithTimeout = async (url: string, init: RequestInit = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), labelsConfig().timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const responseJson = async (response: Response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const authenticate = async () => {
  const config = labelsConfig();
  if (!config.username || !config.password) {
    throw Object.assign(new Error('Shipping Labels credentials are not configured'), { status: 503 });
  }
  const response = await fetchWithTimeout(`${config.apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username: config.username, password: config.password }),
  });
  const body = await responseJson(response);
  if (!response.ok) {
    throw Object.assign(new Error(body?.error || 'Shipping Labels authentication failed'), { status: 502 });
  }
  const setCookie = response.headers.get('set-cookie') || '';
  const sessionCookie = setCookie.split(';')[0];
  if (!sessionCookie.includes('=')) {
    throw Object.assign(new Error('Shipping Labels did not return a session cookie'), { status: 502 });
  }
  cachedCookie = sessionCookie;
  cachedCookieExpiresAt = Date.now() + 5 * 60_000;
  return cachedCookie;
};

const labelsRequest = async <T>(path: string, init: RequestInit = {}, retryAuth = true): Promise<T> => {
  const config = labelsConfig();
  const cookie = cachedCookie && cachedCookieExpiresAt > Date.now() ? cachedCookie : await authenticate();
  const response = await fetchWithTimeout(`${config.apiUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      Cookie: cookie,
      ...init.headers,
    },
  });
  if (response.status === 401 && retryAuth) {
    cachedCookie = '';
    cachedCookieExpiresAt = 0;
    await authenticate();
    return labelsRequest<T>(path, init, false);
  }
  const body = await responseJson(response);
  if (!response.ok) {
    throw Object.assign(new Error(body?.error || `Shipping Labels request failed (${response.status})`), {
      status: response.status >= 500 ? 502 : response.status,
    });
  }
  return body as T;
};

export const ensureShippingLabelsSchema = () => {
  if (schemaReadyPromise) return schemaReadyPromise;
  schemaReadyPromise = (async () => {
    await dbExecute(`
    CREATE TABLE IF NOT EXISTS order_shipping_labels (
      order_id BIGINT UNSIGNED NOT NULL,
      external_label_id VARCHAR(80) NOT NULL,
      tracking_id VARCHAR(255) NOT NULL,
      courier_name VARCHAR(120) NOT NULL,
      external_status VARCHAR(40) NULL,
      raw_courier_status VARCHAR(255) NULL,
      last_synced_at DATETIME NULL,
      last_sync_error VARCHAR(500) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (order_id),
      UNIQUE KEY uq_order_shipping_labels_external (external_label_id),
      KEY idx_order_shipping_labels_sync (external_status, last_synced_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

    const columns = await dbQuery<any>("SHOW COLUMNS FROM orders LIKE 'status'");
    const statusType = String(columns[0]?.Type || '').toLowerCase();
    if (statusType.startsWith('enum(') && !statusType.includes("'rto'")) {
      await dbExecute(`
        ALTER TABLE orders MODIFY COLUMN status
        ENUM('pending_payment','confirmed','processing','shipped','out_for_delivery','delivered','rto','cancelled')
        NOT NULL DEFAULT 'confirmed'
      `);
    }
  })().catch((error) => {
    schemaReadyPromise = null;
    throw error;
  });
  return schemaReadyPromise;
};

const courierName = (value: unknown) => {
  const name = clean(value);
  if (/^shree maruti$/i.test(name)) return 'Shree Maruti Courier';
  return name;
};

export const buildShippingLabelPayload = (order: OrderForLabel) => {
  const address = parseJson<any>(order.shipping_address, {});
  const items = parseJson<any[]>(order.items, []);
  const receiverName = clean(address.fullName || order.customer_name);
  const addressLine1 = clean(address.street || address.address || address.addressLine1);
  const addressLine2 = clean(address.addressLine2 || address.line2);
  const city = clean(address.city);
  const state = clean(address.state);
  const pincode = clean(address.pincode).replace(/\s+/g, '');
  const mobile = clean(address.mobile || address.phone).replace(/\s+/g, '');
  const courier = courierName(order.shipping_service);
  const trackingId = clean(order.tracking_id);
  const missing = [
    ['receiver name', receiverName],
    ['address', addressLine1],
    ['city', city],
    ['state', state],
    ['pincode', pincode],
    ['mobile', mobile],
    ['courier', courier],
    ['tracking/AWB', trackingId],
  ].filter(([, value]) => !value).map(([field]) => field);
  if (missing.length) {
    throw Object.assign(new Error(`Cannot create shipping label: missing ${missing.join(', ')}`), { status: 400 });
  }
  if (!/^\d{6}$/.test(pincode)) {
    throw Object.assign(new Error('Cannot create shipping label: destination pincode must be 6 digits'), { status: 400 });
  }

  const status: ShippingLabelStatus = order.status === 'delivered'
    ? 'Delivered'
    : order.status === 'rto'
      ? 'RTO'
      : ['shipped', 'out_for_delivery'].includes(order.status)
        ? 'Shipped'
        : 'Pending';
  const paymentNote = isCod(order.payment_method)
    ? `COD - collect INR ${Number(order.total || 0).toLocaleString('en-IN')}`
    : 'PREPAID';

  return {
    receiver_name: receiverName,
    receiver_address_line1: addressLine1,
    receiver_address_line2: addressLine2 || null,
    receiver_city: city,
    receiver_state: state,
    receiver_pincode: pincode,
    receiver_mobile_1: mobile,
    receiver_mobile_2: null,
    courier_name: courier,
    tracking_id: trackingId,
    order_reference: String(order.id),
    status,
    notes: `${paymentNote} | ${items.reduce((sum, item) => sum + Number(item?.quantity || 1), 0)} item(s)`,
  };
};

export const normalizeShippingLabelStatus = (label: ExternalShippingLabel): string | null => {
  const successfulSyncAt = new Date(String(label.last_successful_sync || '')).getTime();
  const rawStatus = clean(label.raw_courier_status);
  if (!Number.isFinite(successfulSyncAt) || !rawStatus) return null;

  const detail = `${rawStatus} ${label.tracking_event_description || ''}`.toLowerCase();
  if (/\brto\b|return(?:ed)?\s+to\s+(?:origin|shipper)|reverse\s+pickup/.test(detail)) return 'rto';
  if (/\bdelivered\b|delivery\s+successful/.test(detail)) return 'delivered';
  if (/out\s*for\s*del|\bofd\b/.test(detail)) return 'out_for_delivery';
  if (/\bshipped\b|\bin\s*transit\b|picked\s*up|pickup\s*(?:done|complete)|departed\s+(?:facility|origin)/.test(detail)) {
    return 'shipped';
  }
  return null;
};

export const shouldApplyShippingLabelStatus = (current: string, next: string | null) => {
  if (!next || current === next || TERMINAL_ORDER_STATUSES.has(current)) return false;
  if (next === 'rto') return true;
  return (STATUS_RANK[next] || 0) > (STATUS_RANK[current] || 0);
};

const createPrintHandoff = async (labelId: string) => {
  const handoff = await labelsRequest<{ redeem_url?: string; expires_in?: number }>('/auth/print-handoffs', {
    method: 'POST',
    body: JSON.stringify({ label_id: labelId }),
  });
  if (!handoff?.redeem_url) {
    throw Object.assign(new Error('Shipping Labels did not return a print handoff URL'), { status: 502 });
  }

  let redeemUrl: URL;
  try {
    redeemUrl = new URL(handoff.redeem_url);
  } catch {
    throw Object.assign(new Error('Shipping Labels returned an invalid print handoff URL'), { status: 502 });
  }
  const expectedApiOrigin = new URL(labelsConfig().apiUrl).origin;
  if (redeemUrl.origin !== expectedApiOrigin || (redeemUrl.protocol !== 'https:' && redeemUrl.hostname !== 'localhost')) {
    throw Object.assign(new Error('Shipping Labels returned an untrusted print handoff URL'), { status: 502 });
  }
  return redeemUrl.toString();
};

const prepareOrderShippingLabel = async (order: OrderForLabel, forTracking = false) => {
  await ensureShippingLabelsSchema();
  const status = clean(order.status).toLowerCase();
  if (status === 'cancelled' || (!forTracking && ['delivered', 'rto'].includes(status))) {
    throw Object.assign(new Error(`Cannot create a label for an order with status ${order.status}`), { status: 409 });
  }
  const payload = buildShippingLabelPayload(order);
  let existingRows = await dbQuery<any>('SELECT * FROM order_shipping_labels WHERE order_id = ? LIMIT 1', [order.id]);
  let existing = existingRows[0];
  const claimId = `pending:${crypto.randomUUID()}`;
  if (!existing) {
    await dbExecute(
      `INSERT IGNORE INTO order_shipping_labels
        (order_id, external_label_id, tracking_id, courier_name, external_status, last_sync_error)
       VALUES (?, ?, ?, ?, 'Creating', NULL)`,
      [order.id, claimId, payload.tracking_id, payload.courier_name]
    );
    existingRows = await dbQuery<any>('SELECT * FROM order_shipping_labels WHERE order_id = ? LIMIT 1', [order.id]);
    existing = existingRows[0];
  }
  let label: ExternalShippingLabel | undefined;
  let created = false;

  if (existing?.external_label_id && !String(existing.external_label_id).startsWith('pending:')) {
    const unchanged = clean(existing.tracking_id).toLowerCase() === clean(payload.tracking_id).toLowerCase()
      && clean(existing.courier_name).toLowerCase() === clean(payload.courier_name).toLowerCase();
    try {
      label = await labelsRequest<ExternalShippingLabel>(`/labels/${encodeURIComponent(existing.external_label_id)}`,
        unchanged ? {} : { method: 'PATCH', body: JSON.stringify(payload) });
    } catch (error: any) {
      if (error?.status !== 404) throw error;

      // A deleted remote label must not leave this order stuck on its old ID.
      // Claim recovery atomically so concurrent print clicks cannot create duplicates.
      const recovery: any = await dbExecute(
        `UPDATE order_shipping_labels
         SET external_label_id = ?, external_status = 'Creating', last_sync_error = NULL, updated_at = NOW()
         WHERE order_id = ? AND external_label_id = ?`,
        [claimId, order.id, existing.external_label_id]
      );
      if (Number(recovery?.affectedRows || 0) !== 1) {
        throw Object.assign(new Error('This shipping label is already being created. Please try again in a moment.'), { status: 409 });
      }
      existing = { ...existing, external_label_id: claimId };
    }
  }

  if (String(existing?.external_label_id || '').startsWith('pending:')) {
    const labels = await labelsRequest<ExternalShippingLabel[]>('/labels');
    const remoteMatch = labels.find((candidate) => clean(candidate.order_reference) === String(order.id))
      || labels.find((candidate) => !clean(candidate.order_reference)
        && clean(candidate.tracking_id).toLowerCase() === clean(payload.tracking_id).toLowerCase()
        && courierName(candidate.courier_name).toLowerCase() === clean(payload.courier_name).toLowerCase());
    if (remoteMatch) {
      const unchanged = clean(remoteMatch.tracking_id).toLowerCase() === clean(payload.tracking_id).toLowerCase()
        && clean(remoteMatch.courier_name).toLowerCase() === clean(payload.courier_name).toLowerCase()
        && clean(remoteMatch.order_reference) === String(order.id);
      label = unchanged ? remoteMatch : await labelsRequest<ExternalShippingLabel>(`/labels/${encodeURIComponent(remoteMatch.id)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    } else if (existing.external_label_id !== claimId) {
      const claimAgeMs = Date.now() - new Date(existing.updated_at || existing.created_at || 0).getTime();
      if (!Number.isFinite(claimAgeMs) || claimAgeMs < 2 * 60_000) {
        throw Object.assign(new Error('This shipping label is already being created. Please try again in a moment.'), { status: 409 });
      }
      const takeover: any = await dbExecute(
        `UPDATE order_shipping_labels SET external_label_id = ?, updated_at = NOW()
         WHERE order_id = ? AND external_label_id = ?`,
        [claimId, order.id, existing.external_label_id]
      );
      if (Number(takeover?.affectedRows || 0) !== 1) {
        throw Object.assign(new Error('This shipping label is already being created. Please try again in a moment.'), { status: 409 });
      }
      try {
        label = await labelsRequest<ExternalShippingLabel>('/labels', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        created = true;
      } catch (error) {
        await dbExecute(
          'DELETE FROM order_shipping_labels WHERE order_id = ? AND external_label_id = ?',
          [order.id, claimId]
        ).catch(() => {});
        throw error;
      }
    } else {
      try {
        label = await labelsRequest<ExternalShippingLabel>('/labels', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        created = true;
      } catch (error) {
        await dbExecute(
          'DELETE FROM order_shipping_labels WHERE order_id = ? AND external_label_id = ?',
          [order.id, claimId]
        ).catch(() => {});
        throw error;
      }
    }
  }
  if (!label) {
    throw Object.assign(new Error('Unable to reserve this order for label creation'), { status: 409 });
  }

  await dbExecute(
    `INSERT INTO order_shipping_labels
      (order_id, external_label_id, tracking_id, courier_name, external_status, raw_courier_status, last_synced_at, last_sync_error)
     VALUES (?, ?, ?, ?, ?, ?, NOW(), NULL)
     ON DUPLICATE KEY UPDATE
       external_label_id = VALUES(external_label_id), tracking_id = VALUES(tracking_id),
       courier_name = VALUES(courier_name), external_status = VALUES(external_status),
       raw_courier_status = VALUES(raw_courier_status), last_synced_at = NOW(), last_sync_error = NULL`,
    [order.id, label.id, label.tracking_id, label.courier_name, label.status, label.raw_courier_status || null]
  );

  return { label, created };
};

export const createOrUpdateShippingLabel = async (order: OrderForLabel) => {
  const result = await prepareOrderShippingLabel(order);
  const printUrl = await createPrintHandoff(result.label.id);
  return { ...result, printUrl };
};

const syncMappedLabel = async (mapping: any, forceRefresh = true) => {
  try {
    if (forceRefresh) {
      const refreshResult = await labelsRequest<{
        error?: string | null;
        skipped?: boolean;
        success?: boolean;
        ok?: boolean;
        reason?: string;
      }>(`/tracking/labels/${encodeURIComponent(mapping.external_label_id)}/refresh`, { method: 'POST' });
      if (refreshResult?.error || refreshResult?.skipped === true || refreshResult?.success === false || refreshResult?.ok === false) {
        throw Object.assign(
          new Error(refreshResult?.error || refreshResult?.reason || 'The courier refresh did not complete successfully'),
          { status: 502 }
        );
      }
    }
    const label = await labelsRequest<ExternalShippingLabel>(`/labels/${encodeURIComponent(mapping.external_label_id)}`);
    const orderRows = await dbQuery<any>('SELECT * FROM orders WHERE id = ? LIMIT 1', [mapping.order_id]);
    const order = orderRows[0];
    if (!order) throw Object.assign(new Error('Mapped BrajMart order no longer exists'), { status: 404 });

    const nextStatus = normalizeShippingLabelStatus(label);
    const applyStatus = shouldApplyShippingLabelStatus(String(order.status), nextStatus);
    if (applyStatus) {
      const history = parseJson<any[]>(order.status_history, []);
      const detail = [label.status, label.raw_courier_status, label.tracking_location].filter(Boolean).join(' - ');
      history.push({
        status: nextStatus,
        date: new Date().toISOString(),
        note: `Courier verified: ${detail || 'shipment updated'}`,
      });
      await dbExecute('UPDATE orders SET status = ?, status_history = ?, updated_at = NOW() WHERE id = ?', [
        nextStatus,
        JSON.stringify(history),
        order.id,
      ]);

      if (applyStatus && nextStatus === 'delivered') {
        const orderItems = parseJson(order.items, []);
        await withDbTransaction((connection) => convertReservationToSale(connection, Number(order.id), orderItems)).catch(() => {});
      }
      if (applyStatus && order.customer_email) {
        sendShippingUpdate(order.customer_email, {
          orderId: String(order.id),
          status: String(nextStatus),
          trackingId: order.tracking_id || undefined,
        }).catch(() => {});
      }
    }

    await dbExecute(
      `UPDATE order_shipping_labels
       SET tracking_id = ?, courier_name = ?, external_status = ?, raw_courier_status = ?,
           last_synced_at = NOW(), last_sync_error = NULL
       WHERE order_id = ?`,
      [label.tracking_id, label.courier_name, label.status, label.raw_courier_status || null, mapping.order_id]
    );
    return { orderId: String(mapping.order_id), label, orderStatus: applyStatus ? nextStatus : order.status, updated: applyStatus };
  } catch (error: any) {
    await dbExecute(
      'UPDATE order_shipping_labels SET last_synced_at = NOW(), last_sync_error = ? WHERE order_id = ?',
      [clean(error?.message || 'Shipping Labels sync failed').slice(0, 500), mapping.order_id]
    ).catch(() => {});
    throw error;
  }
};

export const syncShippingLabelForOrder = async (orderId: string | number) => {
  await ensureShippingLabelsSchema();
  const orders = await dbQuery<OrderForLabel>(
    `SELECT * FROM orders WHERE id = ? AND ${merchantOrderWhereSql('orders')} LIMIT 1`,
    [orderId]
  );
  if (!orders[0]) throw Object.assign(new Error('Verified paid/COD order not found'), { status: 404 });
  const { label } = await prepareOrderShippingLabel(orders[0], true);
  return syncMappedLabel({ order_id: orders[0].id, external_label_id: label.id }, true);
};

export const syncShippingLabelsBatch = async () => {
  if (!isShippingLabelsConfigured() || schedulerRunning) return { processed: 0, updated: 0, failed: 0 };
  schedulerRunning = true;
  try {
    await ensureShippingLabelsSchema();
    const batchSize = Math.min(100, Math.max(1, Number(process.env.SHIPPING_LABELS_SYNC_BATCH_SIZE || 25)));
    const rows = await dbQuery<any>(
      `SELECT * FROM order_shipping_labels
       WHERE COALESCE(external_status, '') NOT IN ('Delivered', 'RTO')
       ORDER BY COALESCE(last_synced_at, '1970-01-01') ASC
       LIMIT ?`,
      [batchSize]
    );
    let updated = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        const result = await syncMappedLabel(row, true);
        if (result.updated) updated++;
      } catch {
        failed++;
      }
    }
    return { processed: rows.length, updated, failed };
  } finally {
    schedulerRunning = false;
  }
};

export const startShippingLabelsSyncScheduler = () => {
  if (schedulerStarted || !isShippingLabelsConfigured()) return;
  schedulerStarted = true;
  const intervalMs = Math.max(60_000, Number(process.env.SHIPPING_LABELS_SYNC_INTERVAL_MS || 10 * 60_000));
  const run = () => syncShippingLabelsBatch().catch((error) => {
    console.error('Shipping Labels background sync failed:', error?.message || error);
  });
  setTimeout(run, Math.min(30_000, intervalMs));
  const timer = setInterval(run, intervalMs);
  timer.unref?.();
};

