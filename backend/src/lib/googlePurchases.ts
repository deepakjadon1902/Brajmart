import { dbExecute, dbQuery, isDbConnected } from './db';
import { parseJson } from './dbHelpers';
import { getVerifiedRazorpayPurchase, orderItemId } from '../routes/metaConversions';

const clean = (value: unknown) => String(value ?? '').trim();
const config = () => ({ measurementId: clean(process.env.GA4_MEASUREMENT_ID), secret: clean(process.env.GA4_API_SECRET) });
let schema: Promise<void> | null = null;
const ensureSchema = () => schema ||= (async () => {
  await dbExecute(`CREATE TABLE IF NOT EXISTS google_order_contexts (
    order_id BIGINT UNSIGNED NOT NULL PRIMARY KEY, measurement_id VARCHAR(40) NOT NULL,
    client_id VARCHAR(128) NOT NULL, session_id VARCHAR(30) NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);
  await dbExecute(`CREATE TABLE IF NOT EXISTS google_purchase_events (
    event_key VARCHAR(190) NOT NULL PRIMARY KEY, order_id BIGINT UNSIGNED NOT NULL,
    status ENUM('pending','submitted','failed') NOT NULL DEFAULT 'pending',
    payload JSON NOT NULL, attempts INT NOT NULL DEFAULT 1, last_error VARCHAR(100) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);
})().catch((error) => { schema = null; throw error; });

export const captureGoogleOrderContext = async (orderId: string | number, value: any) => {
  const { measurementId, secret } = config();
  const context = value?.googleAnalytics;
  if (!isDbConnected() || !secret || !/^G-[A-Z0-9]+$/.test(measurementId) || !/^\d+$/.test(String(orderId)) || !context || context.measurementId !== measurementId) return;
  if (context.analyticsConsent === false) {
    await ensureSchema();
    await dbExecute('DELETE FROM google_order_contexts WHERE order_id = ?', [orderId]);
    return;
  }
  if (context.analyticsConsent !== true || !/^\d{1,20}\.\d{1,20}$/.test(clean(context.clientId))) return;
  const sessionId = /^\d{1,20}$/.test(clean(context.sessionId)) ? clean(context.sessionId) : null;
  await ensureSchema();
  await dbExecute(`INSERT INTO google_order_contexts (order_id, measurement_id, client_id, session_id) VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE measurement_id = VALUES(measurement_id), client_id = VALUES(client_id), session_id = VALUES(session_id), updated_at = NOW()`,
  [orderId, measurementId, context.clientId, sessionId]);
};

export const buildGooglePurchaseParams = (order: any) => {
  const source = parseJson<any[]>(order.items, []);
  if (!Array.isArray(source) || !source.length || source.length > 200
    || source.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) return null;
  const items = source.map((item) => ({
    item_id: orderItemId(item),
    item_name: clean(item.name || item.product?.name).slice(0, 100),
    quantity: Number(item.quantity ?? 1),
    price: Number(item.price),
  }));
  if (items.some((item) => !item.item_id || !Number.isSafeInteger(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.price) || item.price < 0)) return null;
  const subtotal = items.reduce((sum, item) => sum + Math.round(item.price * 100) * item.quantity, 0);
  const coupon = parseJson<any>(order.coupon_details, {}) || {};
  const discount = Math.round(Number(order.coupon_discount ?? coupon.discountAmount ?? 0) * 100);
  const total = Math.round(Number(order.total) * 100);
  if (!Number.isSafeInteger(total) || total <= 0 || !Number.isSafeInteger(subtotal) || subtotal <= 0 || !Number.isSafeInteger(discount) || discount < 0 || discount > subtotal || total < subtotal - discount) return null;
  // GA4 value is merchandise revenue. Keep shipping/fees and captured order_total
  // separate; distribute the saved coupon so item prices agree with that value.
  let remainingDiscount = discount;
  let remainingSubtotal = subtotal;
  const discountedItems = items.map((item) => {
    const lineTotal = Math.round(item.price * 100) * item.quantity;
    const lineDiscount = remainingSubtotal ? Math.floor(remainingDiscount * lineTotal / remainingSubtotal) : 0;
    remainingDiscount -= lineDiscount;
    remainingSubtotal -= lineTotal;
    return { ...item, price: Number(((lineTotal - lineDiscount) / item.quantity / 100).toFixed(6)) };
  });
  const shippingAndFees = total - subtotal + discount;
  return {
    transaction_id: String(order.id), currency: 'INR', value: (subtotal - discount) / 100,
    shipping: shippingAndFees / 100, order_total: total / 100,
    ...(clean(order.coupon_code || coupon.code) ? { coupon: clean(order.coupon_code || coupon.code) } : {}),
    items: discountedItems,
  };
};

export const sendVerifiedGooglePurchaseForOrder = async (orderId: string | number, paymentId?: string, statusToken?: string) => {
  const { measurementId, secret } = config();
  if (!secret || !/^G-[A-Z0-9]+$/.test(measurementId)) return { ok: false, skipped: true, reason: 'google_not_configured' };
  if (!isDbConnected() || !/^\d+$/.test(String(orderId))) return { ok: false, skipped: true, reason: 'invalid_order' };
  const orders = await dbQuery<any>('SELECT * FROM orders WHERE id = ? LIMIT 1', [orderId]);
  const order = orders[0];
  if (!order || clean(order.payment_method).toLowerCase() !== 'razorpay') return { ok: false, skipped: true, reason: 'not_razorpay_verified' };
  const params = buildGooglePurchaseParams(order);
  if (!params) return { ok: false, skipped: true, reason: 'invalid_purchase_items' };
  const verification = await getVerifiedRazorpayPurchase({ order_id: String(orderId), value: Number(order.total), contents: params.items.map((item) => ({ id: item.item_id })) }, paymentId, statusToken);
  if (!verification.ok) return { ok: false, skipped: true, reason: verification.reason };
  const eventTime = new Date(verification.verifiedAt as string | Date).getTime();
  if (!Number.isFinite(eventTime) || eventTime < Date.now() - 72 * 60 * 60 * 1000 || eventTime > Date.now() + 300_000) return { ok: false, skipped: true, reason: 'google_event_time_out_of_range' };
  await ensureSchema();
  const contexts = await dbQuery<any>('SELECT * FROM google_order_contexts WHERE order_id = ? LIMIT 1', [orderId]);
  const context = contexts[0];
  if (!context || context.measurement_id !== measurementId || !/^\d{1,20}\.\d{1,20}$/.test(clean(context.client_id))) return { ok: false, skipped: true, reason: 'google_consent_or_client_id_missing' };
  const sessionId = Number(context.session_id);
  const payload = {
    client_id: context.client_id, timestamp_micros: Math.floor(eventTime * 1000),
    consent: { ad_user_data: 'DENIED', ad_personalization: 'DENIED' },
    validation_behavior: 'ENFORCE_RECOMMENDATIONS',
    events: [{ name: 'purchase', params: { ...params, ...(Number.isSafeInteger(sessionId) && sessionId > 0 ? { session_id: sessionId } : {}), engagement_time_msec: 1 } }],
  };
  const eventKey = `${measurementId}:order:${orderId}`;
  const inserted = await dbExecute(`INSERT IGNORE INTO google_purchase_events (event_key, order_id, payload) VALUES (?, ?, ?)`, [eventKey, orderId, JSON.stringify(payload)]);
  let toSend = payload;
  if (!Number(inserted.affectedRows)) {
    const rows = await dbQuery<any>('SELECT status, payload FROM google_purchase_events WHERE event_key = ? LIMIT 1', [eventKey]);
    if (rows[0]?.status === 'submitted') return { ok: true, skipped: true, reason: 'duplicate_purchase_event' };
    const claimed = await dbExecute(`UPDATE google_purchase_events SET status = 'pending', attempts = attempts + 1, last_error = NULL, updated_at = NOW()
      WHERE event_key = ? AND (status = 'failed' OR (status = 'pending' AND updated_at < DATE_SUB(NOW(), INTERVAL 2 MINUTE)))`, [eventKey]);
    if (!Number(claimed.affectedRows)) return { ok: true, skipped: true, reason: 'purchase_already_pending' };
    // Freeze the original client ID and transaction payload across retries.
    toSend = parseJson(rows[0]?.payload, payload);
  }
  try {
    const url = new URL('https://www.google-analytics.com/mp/collect');
    url.searchParams.set('measurement_id', measurementId);
    url.searchParams.set('api_secret', secret);
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(toSend), signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error('google_http_error');
    // Measurement Protocol 2xx confirms transport only, not validation/processing.
    await dbExecute("UPDATE google_purchase_events SET status = 'submitted', last_error = NULL, updated_at = NOW() WHERE event_key = ?", [eventKey]);
    return { ok: true, submitted: true, transactionId: String(orderId) };
  } catch {
    await dbExecute("UPDATE google_purchase_events SET status = 'failed', last_error = 'google_delivery_failed', updated_at = NOW() WHERE event_key = ?", [eventKey]);
    return { ok: false, reason: 'google_delivery_failed' };
  }
};
