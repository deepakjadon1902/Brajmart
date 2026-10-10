import crypto from 'crypto';
import express from 'express';
import { dbQuery, isDbConnected } from '../lib/db';

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

const sha256 = (value: string) =>
  crypto.createHash('sha256').update(value).digest('hex');

const hashEmail = (value: unknown) => {
  const email = cleanString(value).toLowerCase();
  if (!email || !email.includes('@')) return '';
  return sha256(email);
};

const hashPhone = (value: unknown) => {
  const digits = cleanString(value).replace(/\D/g, '');
  if (digits.length < 7) return '';
  return sha256(digits);
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

const hasPaidOrderForPurchase = async (customData: Record<string, unknown>) => {
  if (!isDbConnected()) return false;

  const orderId = cleanString(customData.order_id);
  const purchaseValue = Number(customData.value);
  const purchaseContents = Array.isArray(customData.contents) ? customData.contents : [];
  if (!orderId || !Number.isFinite(purchaseValue) || purchaseValue <= 0 || purchaseContents.length === 0) return false;

  const orderRows = await dbQuery<any>('SELECT id, total, items FROM orders WHERE id = ? LIMIT 1', [orderId]);
  const order = orderRows[0];
  if (!order) return false;

  const orderTotal = Number(order.total || 0);
  if (!Number.isFinite(orderTotal) || Math.abs(orderTotal - purchaseValue) > 1) return false;

  const paidRows = await dbQuery<any>(
    `SELECT 1 AS paid
       FROM payments
      WHERE order_id = ? AND status = 'paid'
      LIMIT 1`,
    [orderId]
  );
  const paidStatusRows = paidRows.length ? paidRows : await dbQuery<any>(
    `SELECT 1 AS paid
       FROM payment_status
      WHERE order_id = ? AND status = 'paid'
      LIMIT 1`,
    [orderId]
  );
  if (!paidStatusRows.length) return false;

  const orderIds = new Set(parseOrderItems(order.items).map(orderItemId).filter(Boolean));
  if (!orderIds.size) return false;

  return purchaseContents.every((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const id = cleanString((item as Record<string, unknown>).id);
    return id && orderIds.has(id);
  });
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
}) => {
  const { token, pixelId, apiVersion } = getMetaConfig();
  if (!token || !pixelId) {
    return { ok: false, skipped: true, reason: 'not_configured' };
  }

  const userData = input.userData || {};
  const emailHash = hashEmail(userData.email);
  const phoneHash = hashPhone(userData.phone);
  const metaUserData: Record<string, unknown> = {};

  if (cleanString(userData.clientIp)) metaUserData.client_ip_address = cleanString(userData.clientIp);
  if (cleanString(userData.clientUserAgent)) metaUserData.client_user_agent = cleanString(userData.clientUserAgent);
  if (emailHash) metaUserData.em = [emailHash];
  if (phoneHash) metaUserData.ph = [phoneHash];
  if (cleanString(userData.fbp)) metaUserData.fbp = cleanString(userData.fbp);
  if (cleanString(userData.fbc)) metaUserData.fbc = cleanString(userData.fbc);

  const payload: Record<string, unknown> = {
    data: [{
      event_name: EVENT_NAME_MAP[input.eventName] || input.eventName,
      event_time: Math.floor(Date.now() / 1000),
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

export const sendVerifiedMetaPurchaseForOrder = async (orderId: number | string, paymentId?: string, statusToken?: string) => {
  if (!isDbConnected()) return { ok: false, skipped: true, reason: 'db_unavailable' };
  const orderIdString = cleanString(orderId);
  if (!/^\d+$/.test(orderIdString)) return { ok: false, skipped: true, reason: 'invalid_order' };

  const orderRows = await dbQuery<any>('SELECT * FROM orders WHERE id = ? LIMIT 1', [orderIdString]);
  const order = orderRows[0];
  if (!order) return { ok: false, skipped: true, reason: 'order_not_found' };

  const total = Number(order.total || 0);
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
    payment_type: 'Razorpay',
    payment_method: 'Razorpay',
  });
  const eventId = `brajmart.Purchase.order.${orderIdString}`;
  if (!isValidPurchasePayload(eventId, customData)) {
    return { ok: false, skipped: true, reason: 'invalid_purchase_payload' };
  }
  if (!(await hasPaidOrderForPurchase(customData))) {
    return { ok: false, skipped: true, reason: 'not_paid' };
  }

  return sendMetaConversionApiEvent({
    eventName: 'Purchase',
    eventId,
    eventSourceUrl: `${cleanString(process.env.FRONTEND_URL || process.env.SITE_URL) || DEFAULT_SITE_URL}/payment-status/${encodeURIComponent(cleanString(statusToken || orderIdString))}`,
    userData: {
      email: order.customer_email,
      phone: getOrderPhone(order),
    },
    customData,
  });
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
