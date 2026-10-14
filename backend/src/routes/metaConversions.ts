import crypto from 'crypto';
import express from 'express';
import { dbExecute, dbQuery, isDbConnected } from '../lib/db';
import { verifyCapturedRazorpayPayment } from '../lib/razorpayVerification';

const router = express.Router();

const DEFAULT_PIXEL_ID = '1824114108557446';
const DEFAULT_API_VERSION = 'v21.0';
const DEFAULT_SITE_URL = 'https://www.brajmart.com';

const ALLOWED_EVENTS = new Set([
  'PageView',
  'ViewContent',
  'Search',
  'Contact',
  'AddToCart',
  'InitiateCheckout',
  'Purchase',
  'AddPaymentInfo',
  'AddToWishlist',
  'Lead',
]);

const EVENT_NAME_MAP: Record<string, string> = {
  AddToWishlist: 'AddToWishlist',
};

const cleanString = (value: unknown) => String(value ?? '').trim();
let metaEventSchemaReady: Promise<void> | null = null;

const ensureMetaEventSchema = () => {
  metaEventSchemaReady ||= (async () => {
    await dbExecute(`
      CREATE TABLE IF NOT EXISTS meta_conversion_events (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        event_id VARCHAR(190) NOT NULL,
        event_name VARCHAR(80) NOT NULL,
        order_id BIGINT UNSIGNED NULL,
        status ENUM('pending','sent','failed','skipped') NOT NULL DEFAULT 'pending',
        attempts INT NOT NULL DEFAULT 0,
        last_error TEXT NULL,
        response JSON NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_meta_conversion_event_id (event_id),
        KEY idx_meta_conversion_order_event (order_id, event_name),
        KEY idx_meta_conversion_status_updated (status, updated_at)
      )
    `);

    await dbExecute(`
      CREATE TABLE IF NOT EXISTS meta_order_contexts (
        order_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
        client_ip VARCHAR(64) NULL,
        client_user_agent TEXT NULL,
        fbp VARCHAR(255) NULL,
        fbc VARCHAR(255) NULL,
        event_source_url TEXT NULL,
        external_id VARCHAR(255) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_meta_order_contexts_updated (updated_at)
      )
    `);
  })();
  return metaEventSchemaReady;
};

const sha256 = (value: string) =>
  crypto.createHash('sha256').update(value).digest('hex');

const hashEmail = (value: unknown) => {
  const email = cleanString(value).toLowerCase();
  if (!email || !email.includes('@')) return '';
  return sha256(email);
};

const hashPhone = (value: unknown) => {
  let digits = cleanString(value).replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10 && /^[6-9]/.test(digits)) digits = `91${digits}`;
  if (digits.length < 7) return '';
  return sha256(digits);
};

const hashExternalId = (value: unknown) => {
  const externalId = cleanString(value).toLowerCase();
  if (!externalId) return '';
  return sha256(externalId);
};

const getClientIp = (req: express.Request) => {
  const forwardedFor = cleanString(req.headers['x-forwarded-for']).split(',')[0]?.trim();
  const ip =
    forwardedFor ||
    cleanString(req.headers['cf-connecting-ip']) ||
    cleanString(req.headers['x-real-ip']) ||
    cleanString(req.socket.remoteAddress);

  return ip.replace(/^::ffff:/, '');
};

const normalizeCustomData = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, unknown> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, raw]) => {
    if (raw === undefined || raw === null || raw === '') return;
    if (Array.isArray(raw)) {
      out[key] = raw
        .map((item) => {
          if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
          const cleaned: Record<string, unknown> = {};
          Object.entries(item as Record<string, unknown>).forEach(([nestedKey, nestedValue]) => {
            if (nestedValue !== undefined && nestedValue !== null && nestedValue !== '') cleaned[nestedKey] = nestedValue;
          });
          return cleaned;
        })
        .filter((item) => item !== undefined && item !== null && item !== '');
      return;
    }
    out[key] = raw;
  });
  return out;
};

const isValidPurchasePayload = (eventId: string, customData: Record<string, unknown>) => {
  const orderId = cleanString(customData.order_id);
  const value = Number(customData.value);
  const contents = Array.isArray(customData.contents) ? customData.contents : [];
  if (!orderId || !/^\d+$/.test(orderId)) return false;
  if (eventId !== `brajmart.Purchase.order.${orderId}`) return false;
  if (!Number.isFinite(value) || value <= 0) return false;
  if (cleanString(customData.currency || 'INR') !== 'INR') return false;
  return contents.some((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const record = item as Record<string, unknown>;
    return Boolean(cleanString(record.id)) && Number(record.quantity || 0) > 0;
  });
};

const parseOrderItems = (value: unknown): Array<Record<string, unknown>> => {
  if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item)));
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return parseOrderItems(parsed);
  } catch {
    return [];
  }
};

const orderItemId = (item: Record<string, unknown>) => {
  const product = item.product && typeof item.product === 'object' && !Array.isArray(item.product)
    ? item.product as Record<string, unknown>
    : item;
  return cleanString(product.productId || product.id || product._id || item.productId || item.id || item._id || product.slug || item.slug || product.name || item.name);
};

const isRazorpayMethod = (value: unknown) => cleanString(value).toLowerCase() === 'razorpay';
const isRazorpayIdentifier = (value: unknown) => /^(order|pay)_[A-Za-z0-9]+$/.test(cleanString(value));

type RazorpayPurchaseVerification =
  | { ok: true; verifiedAt?: unknown }
  | { ok: false; reason: string };

const getVerifiedRazorpayPurchase = async (
  customData: Record<string, unknown>,
  paymentId?: string,
  statusToken?: string
): Promise<RazorpayPurchaseVerification> => {
  if (!isDbConnected()) return { ok: false, reason: 'db_unavailable' };

  const orderId = cleanString(customData.order_id);
  const purchaseValue = Number(customData.value);
  const purchaseContents = Array.isArray(customData.contents) ? customData.contents : [];
  if (!orderId || !Number.isFinite(purchaseValue) || purchaseValue <= 0 || purchaseContents.length === 0) {
    return { ok: false, reason: 'invalid_purchase_payload' };
  }

  const orderRows = await dbQuery<any>('SELECT id, total, items FROM orders WHERE id = ? LIMIT 1', [orderId]);
  const order = orderRows[0];
  if (!order) return { ok: false, reason: 'order_not_found' };

  const orderTotal = Number(order.total || 0);
  if (!Number.isFinite(orderTotal) || Math.round(orderTotal * 100) !== Math.round(purchaseValue * 100)) {
    return { ok: false, reason: 'purchase_total_mismatch' };
  }

  const cleanPaymentId = cleanString(paymentId);
  const cleanStatusToken = cleanString(statusToken);
  const requestedIds = [cleanPaymentId, cleanStatusToken].filter(Boolean);
  if (requestedIds.some((id) => !isRazorpayIdentifier(id))) {
    return { ok: false, reason: 'not_razorpay_verified' };
  }

  const paidRows = await dbQuery<any>(
    `SELECT
        ps.token,
        ps.payment_id,
        ps.amount,
        ps.created_at AS status_created_at,
        ps.updated_at AS status_updated_at,
        p.transaction_id,
        p.amount AS payment_amount,
        p.created_at AS payment_created_at,
        p.updated_at AS payment_updated_at
       FROM payment_status ps
       INNER JOIN payments p
         ON p.order_id = ps.order_id
        AND p.transaction_id = ps.payment_id
        AND p.status = 'paid'
        AND LOWER(COALESCE(p.method, '')) = 'razorpay'
      WHERE ps.order_id = ?
        AND ps.status = 'paid'
        AND LOWER(COALESCE(ps.method, '')) = 'razorpay'
        AND (
          LEFT(ps.token, 6) = 'order_'
          OR LEFT(ps.token, 4) = 'pay_'
          OR LEFT(COALESCE(ps.payment_id, ''), 6) = 'order_'
          OR LEFT(COALESCE(ps.payment_id, ''), 4) = 'pay_'
          OR LEFT(COALESCE(p.transaction_id, ''), 6) = 'order_'
          OR LEFT(COALESCE(p.transaction_id, ''), 4) = 'pay_'
        )
      ORDER BY COALESCE(p.updated_at, ps.updated_at) ASC,
               COALESCE(p.created_at, ps.created_at) ASC
      LIMIT 20`,
    [orderId]
  );
  const paidRow = paidRows.find((row) => {
    if (!/^order_[A-Za-z0-9]+$/.test(cleanString(row.token))) return false;
    if (!/^pay_[A-Za-z0-9]+$/.test(cleanString(row.payment_id))) return false;
    if (cleanString(row.transaction_id) !== cleanString(row.payment_id)) return false;
    if (Math.round(Number(row.amount) * 100) !== Math.round(orderTotal * 100)
      || Math.round(Number(row.payment_amount) * 100) !== Math.round(orderTotal * 100)) return false;
    const rowIds = [
      cleanString(row.token),
      cleanString(row.payment_id),
      cleanString(row.transaction_id),
    ].filter(Boolean);
    if (!rowIds.some(isRazorpayIdentifier)) return false;
    return requestedIds.every((id) => rowIds.includes(id));
  });
  if (!paidRow) return { ok: false, reason: 'not_razorpay_verified' };

  const orderIds = new Set(parseOrderItems(order.items).map(orderItemId).filter(Boolean));
  if (!orderIds.size) return { ok: false, reason: 'order_items_missing' };

  const contentsMatch = purchaseContents.every((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const id = cleanString((item as Record<string, unknown>).id);
    return id && orderIds.has(id);
  });
  if (!contentsMatch) return { ok: false, reason: 'purchase_contents_mismatch' };

  try {
    const payment = await verifyCapturedRazorpayPayment({
      orderId: cleanString(paidRow.token),
      paymentId: cleanString(paidRow.payment_id),
      amount: orderTotal,
      liveOnly: true,
    });
    const createdAt = Number(payment.created_at);
    if (!Number.isSafeInteger(createdAt) || createdAt <= 0) return { ok: false, reason: 'invalid_payment_time' };
    return { ok: true, verifiedAt: new Date(createdAt * 1000) };
  } catch {
    return { ok: false, reason: 'razorpay_verification_failed' };
  }
};

const normalizeSourceUrl = (value: unknown, req: express.Request) => {
  const raw = cleanString(value) || cleanString(req.headers.referer);
  if (/^https?:\/\//i.test(raw)) return raw;

  const siteUrl = cleanString(process.env.FRONTEND_URL || process.env.SITE_URL) || DEFAULT_SITE_URL;
  try {
    return new URL(raw || '/', siteUrl).toString();
  } catch {
    return siteUrl;
  }
};

const readRequestCookie = (req: express.Request, name: string) => {
  const cookieHeader = cleanString(req.headers.cookie);
  if (!cookieHeader) return '';
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${escapedName}=([^;]*)`));
  if (!match) return '';
  try {
    return decodeURIComponent(match[1] || '');
  } catch {
    return match[1] || '';
  }
};

const normalizeMetaContext = (value: unknown, req?: express.Request) => {
  const raw = parseObject(value);
  return {
    clientIp: cleanString(raw.clientIp) || (req ? getClientIp(req) : ''),
    clientUserAgent: cleanString(raw.clientUserAgent) || (req ? cleanString(req.headers['user-agent']) : ''),
    fbp: cleanString(raw.fbp) || (req ? readRequestCookie(req, '_fbp') : ''),
    fbc: cleanString(raw.fbc) || (req ? readRequestCookie(req, '_fbc') : ''),
    eventSourceUrl: req ? normalizeSourceUrl(raw.eventSourceUrl, req) : cleanString(raw.eventSourceUrl),
    externalId: cleanString(raw.externalId),
  };
};

const getMetaConfig = () => ({
  token: cleanString(process.env.META_CONVERSIONS_API_TOKEN),
  pixelId: cleanString(process.env.META_PIXEL_ID || process.env.META_DATASET_ID) || DEFAULT_PIXEL_ID,
  apiVersion: cleanString(process.env.META_CONVERSIONS_API_VERSION) || DEFAULT_API_VERSION,
});

const sendMetaConversionApiEvent = async (input: {
  eventName: string;
  eventId: string;
  customData: Record<string, unknown>;
  userData?: Record<string, unknown>;
  eventSourceUrl?: string;
  eventTime?: number;
}) => {
  const { token, pixelId, apiVersion } = getMetaConfig();
  if (!token || !pixelId) {
    return { ok: false, skipped: true, reason: 'not_configured' };
  }

  const userData = input.userData || {};
  const emailHash = hashEmail(userData.email);
  const phoneHash = hashPhone(userData.phone);
  const externalIdHash = hashExternalId(userData.externalId || userData.email);
  const metaUserData: Record<string, unknown> = {};

  if (cleanString(userData.clientIp)) metaUserData.client_ip_address = cleanString(userData.clientIp);
  if (cleanString(userData.clientUserAgent)) metaUserData.client_user_agent = cleanString(userData.clientUserAgent);
  if (emailHash) metaUserData.em = [emailHash];
  if (phoneHash) metaUserData.ph = [phoneHash];
  if (externalIdHash) metaUserData.external_id = externalIdHash;
  if (cleanString(userData.fbp)) metaUserData.fbp = cleanString(userData.fbp);
  if (cleanString(userData.fbc)) metaUserData.fbc = cleanString(userData.fbc);

  const payload: Record<string, unknown> = {
    data: [{
      event_name: EVENT_NAME_MAP[input.eventName] || input.eventName,
      event_time: input.eventTime || Math.floor(Date.now() / 1000),
      event_id: input.eventId,
      event_source_url: input.eventSourceUrl || DEFAULT_SITE_URL,
      action_source: 'website',
      user_data: metaUserData,
      custom_data: input.customData,
    }],
  };

  const testEventCode = cleanString(process.env.META_TEST_EVENT_CODE);
  if (testEventCode) payload.test_event_code = testEventCode;

  const endpoint = new URL(`https://graph.facebook.com/${apiVersion}/${encodeURIComponent(pixelId)}/events`);
  endpoint.searchParams.set('access_token', token);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(async () => ({ message: await response.text().catch(() => '') }));
  if (!response.ok) {
    console.error('Meta Conversions API error:', data);
    return { ok: false, status: response.status, data };
  }
  return { ok: true, eventId: input.eventId, response: data };
};

const toMetaEventTime = (value: unknown) => {
  const date = value instanceof Date ? value : new Date(String(value || ''));
  const time = Math.floor(date.getTime() / 1000);
  if (!Number.isFinite(time) || time <= 0) return undefined;
  const now = Math.floor(Date.now() / 1000);
  // Meta CAPI accepts reasonably recent website events. Clamp future clock skew
  // and avoid sending very old reconciliations as brand-new purchases.
  if (time > now + 300) return now;
  if (time < now - 7 * 24 * 60 * 60) return undefined;
  return time;
};

const reserveMetaConversionEvent = async (eventId: string, eventName: string, orderId?: string) => {
  await ensureMetaEventSchema();
  const inserted: any = await dbExecute(
    `INSERT IGNORE INTO meta_conversion_events (event_id, event_name, order_id, status, attempts)
     VALUES (?, ?, ?, 'pending', 1)`,
    [eventId, eventName, orderId || null]
  );
  if (Number(inserted?.affectedRows || 0) > 0) return { reserved: true };

  const rows = await dbQuery<any>('SELECT status FROM meta_conversion_events WHERE event_id = ? LIMIT 1', [eventId]);
  const status = cleanString(rows[0]?.status);
  if (status === 'failed') {
    const claimed: any = await dbExecute(
      "UPDATE meta_conversion_events SET status = 'pending', attempts = attempts + 1, last_error = NULL, updated_at = NOW() WHERE event_id = ? AND status = 'failed'",
      [eventId]
    );
    return { reserved: Number(claimed?.affectedRows || 0) > 0, status: 'pending' };
  }
  return { reserved: false, status: status || 'duplicate' };
};

const markMetaConversionEvent = async (eventId: string, status: 'sent' | 'failed' | 'skipped', details?: unknown) => {
  await ensureMetaEventSchema();
  const lastError = status === 'failed' || status === 'skipped' ? cleanString((details as any)?.reason || (details as any)?.message || details) : null;
  const response = details === undefined ? null : JSON.stringify(details).slice(0, 64000);
  await dbExecute(
    'UPDATE meta_conversion_events SET status = ?, last_error = ?, response = ?, updated_at = NOW() WHERE event_id = ?',
    [status, lastError, response, eventId]
  );
};

const parseObject = (value: unknown) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
};

const getOrderPhone = (order: any) => {
  const billing = parseObject(order.billing_address);
  const shipping = parseObject(order.shipping_address);
  return cleanString(billing?.mobile || billing?.phone || shipping?.mobile || shipping?.phone);
};

export const captureMetaOrderContext = async (orderId: number | string, value: unknown, req?: express.Request) => {
  if (!isDbConnected()) return;
  const orderIdString = cleanString(orderId);
  if (!/^\d+$/.test(orderIdString)) return;

  const context = normalizeMetaContext(value, req);
  if (!context.clientIp && !context.clientUserAgent && !context.fbp && !context.fbc && !context.eventSourceUrl && !context.externalId) return;

  await ensureMetaEventSchema();
  await dbExecute(
    `INSERT INTO meta_order_contexts
      (order_id, client_ip, client_user_agent, fbp, fbc, event_source_url, external_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      client_ip = COALESCE(NULLIF(VALUES(client_ip), ''), client_ip),
      client_user_agent = COALESCE(NULLIF(VALUES(client_user_agent), ''), client_user_agent),
      fbp = COALESCE(NULLIF(VALUES(fbp), ''), fbp),
      fbc = COALESCE(NULLIF(VALUES(fbc), ''), fbc),
      event_source_url = COALESCE(NULLIF(VALUES(event_source_url), ''), event_source_url),
      external_id = COALESCE(NULLIF(VALUES(external_id), ''), external_id),
      updated_at = NOW()`,
    [
      orderIdString,
      context.clientIp || null,
      context.clientUserAgent || null,
      context.fbp || null,
      context.fbc || null,
      context.eventSourceUrl || null,
      context.externalId || null,
    ]
  );
};

const getMetaOrderContext = async (orderId: string) => {
  await ensureMetaEventSchema();
  const rows = await dbQuery<any>('SELECT * FROM meta_order_contexts WHERE order_id = ? LIMIT 1', [orderId]);
  const row = rows[0];
  if (!row) return {};
  return {
    clientIp: cleanString(row.client_ip),
    clientUserAgent: cleanString(row.client_user_agent),
    fbp: cleanString(row.fbp),
    fbc: cleanString(row.fbc),
    eventSourceUrl: cleanString(row.event_source_url),
    externalId: cleanString(row.external_id),
  };
};

type VerifiedMetaPurchaseOptions = {
  paymentMethod?: string;
  paymentType?: string;
  eventSourceUrl?: string;
  userData?: Record<string, unknown>;
};

export const sendVerifiedMetaPurchaseForOrder = async (
  orderId: number | string,
  paymentId?: string,
  statusToken?: string,
  options: VerifiedMetaPurchaseOptions = {}
) => {
  if (!isDbConnected()) return { ok: false, skipped: true, reason: 'db_unavailable' };
  const orderIdString = cleanString(orderId);
  if (!/^\d+$/.test(orderIdString)) return { ok: false, skipped: true, reason: 'invalid_order' };

  const orderRows = await dbQuery<any>('SELECT * FROM orders WHERE id = ? LIMIT 1', [orderIdString]);
  const order = orderRows[0];
  if (!order) return { ok: false, skipped: true, reason: 'order_not_found' };

  const total = Number(order.total || 0);
  const orderPaymentMethod = cleanString(order.payment_method);
  const requestedPaymentMethod = cleanString(options.paymentMethod);
  if ((orderPaymentMethod && !isRazorpayMethod(orderPaymentMethod)) || (requestedPaymentMethod && !isRazorpayMethod(requestedPaymentMethod))) {
    return { ok: false, skipped: true, reason: 'not_razorpay_verified' };
  }

  const paymentMethod = 'Razorpay';
  const paymentType = 'Razorpay';
  const items = parseOrderItems(order.items).map((item) => {
    const id = orderItemId(item);
    const quantity = Number(item.quantity || 1);
    const price = Number(item.price || item.item_price || 0);
    return {
      id,
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      item_price: Number.isFinite(price) && price > 0 ? Math.round((price + Number.EPSILON) * 100) / 100 : undefined,
    };
  }).filter((item) => item.id);

  const customData = normalizeCustomData({
    currency: 'INR',
    value: Number.isFinite(total) ? Math.round((total + Number.EPSILON) * 100) / 100 : 0,
    order_id: orderIdString,
    content_ids: items.map((item) => item.id),
    content_type: 'product',
    contents: items,
    num_items: items.reduce((sum, item) => sum + item.quantity, 0),
    payment_id: paymentId || undefined,
    payment_type: paymentType,
    payment_method: paymentMethod,
  });
  const eventId = `brajmart.Purchase.order.${orderIdString}`;
  if (!isValidPurchasePayload(eventId, customData)) {
    return { ok: false, skipped: true, reason: 'invalid_purchase_payload' };
  }

  const verification = await getVerifiedRazorpayPurchase(customData, paymentId, statusToken);
  if (!verification.ok) {
    return { ok: false, skipped: true, reason: verification.reason };
  }

  const eventTime = toMetaEventTime(verification.verifiedAt || order.created_at);
  if (!eventTime) {
    return { ok: false, skipped: true, reason: 'purchase_too_old_for_meta_capi' };
  }

  const reservation = await reserveMetaConversionEvent(eventId, 'Purchase', orderIdString);
  if (!reservation.reserved) {
    return { ok: true, skipped: true, reason: 'duplicate_purchase_event', status: reservation.status, eventId };
  }

  try {
    const storedContext = await getMetaOrderContext(orderIdString);
    const fallbackSourceUrl = `${cleanString(process.env.FRONTEND_URL || process.env.SITE_URL) || DEFAULT_SITE_URL}/payment-status/${encodeURIComponent(cleanString(statusToken || orderIdString))}`;
    const storedSourceUrl = cleanString((storedContext as any).eventSourceUrl);
    const result = await sendMetaConversionApiEvent({
      eventName: 'Purchase',
      eventId,
      eventTime,
      eventSourceUrl: cleanString(options.eventSourceUrl) || storedSourceUrl || fallbackSourceUrl,
      userData: {
        ...storedContext,
        ...(options.userData || {}),
        email: order.customer_email,
        phone: getOrderPhone(order),
      },
      customData,
    });
    await markMetaConversionEvent(eventId, result.ok ? 'sent' : 'failed', result);
    return result;
  } catch (err) {
    await markMetaConversionEvent(eventId, 'failed', { reason: 'meta_purchase_send_failed' });
    throw err;
  }
};

router.post('/', async (req, res) => {
  const body = req.body || {};
  const eventName = cleanString(body.eventName);
  const eventId = cleanString(body.eventId);
  if (!ALLOWED_EVENTS.has(eventName) || !eventId) {
    return res.status(400).json({ message: 'Invalid Meta event payload.' });
  }
  const customData = normalizeCustomData(body.customData);
  if (eventName === 'Purchase') {
    return res.status(403).json({ message: 'Purchase events are sent only after server-verified Razorpay payment.' });
  }

  const userData = body.userData && typeof body.userData === 'object' ? body.userData as Record<string, unknown> : {};
  const clientUserAgent = cleanString(userData.clientUserAgent) || cleanString(req.headers['user-agent']);
  const clientIp = getClientIp(req);

  try {
    const data = await sendMetaConversionApiEvent({
      eventName,
      eventId,
      eventSourceUrl: normalizeSourceUrl(body.eventSourceUrl, req),
      userData: {
        ...userData,
        clientIp,
        clientUserAgent,
      },
      customData,
    });
    if (!data.ok && !data.skipped) {
      return res.status(502).json({ ok: false, message: 'Meta Conversions API request failed.' });
    }
    return res.json(data);
  } catch (err) {
    console.error('Meta Conversions API request error:', err);
    return res.status(502).json({ ok: false, message: 'Meta Conversions API request failed.' });
  }
});

export default router;
