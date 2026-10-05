import crypto from 'crypto';
import express from 'express';

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

router.post('/', async (req, res) => {
  const token = cleanString(process.env.META_CONVERSIONS_API_TOKEN);
  const pixelId = cleanString(process.env.META_PIXEL_ID || process.env.META_DATASET_ID) || DEFAULT_PIXEL_ID;
  const apiVersion = cleanString(process.env.META_CONVERSIONS_API_VERSION) || DEFAULT_API_VERSION;

  if (!token || !pixelId) {
    return res.json({ ok: false, skipped: true, reason: 'not_configured' });
  }

  const body = req.body || {};
  const eventName = cleanString(body.eventName);
  const eventId = cleanString(body.eventId);
  if (!ALLOWED_EVENTS.has(eventName) || !eventId) {
    return res.status(400).json({ message: 'Invalid Meta event payload.' });
  }
  const customData = normalizeCustomData(body.customData);
  if (eventName === 'Purchase' && !isValidPurchasePayload(eventId, customData)) {
    return res.status(400).json({ message: 'Invalid Purchase event payload.' });
  }

  const userData = body.userData && typeof body.userData === 'object' ? body.userData as Record<string, unknown> : {};
  const emailHash = hashEmail(userData.email);
  const phoneHash = hashPhone(userData.phone);
  const clientUserAgent = cleanString(userData.clientUserAgent) || cleanString(req.headers['user-agent']);
  const clientIp = getClientIp(req);
  const metaUserData: Record<string, unknown> = {};

  if (clientIp) metaUserData.client_ip_address = clientIp;
  if (clientUserAgent) metaUserData.client_user_agent = clientUserAgent;
  if (emailHash) metaUserData.em = [emailHash];
  if (phoneHash) metaUserData.ph = [phoneHash];
  if (cleanString(userData.fbp)) metaUserData.fbp = cleanString(userData.fbp);
  if (cleanString(userData.fbc)) metaUserData.fbc = cleanString(userData.fbc);

  const payload: Record<string, unknown> = {
    data: [{
      event_name: EVENT_NAME_MAP[eventName] || eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      event_source_url: normalizeSourceUrl(body.eventSourceUrl, req),
      action_source: 'website',
      user_data: metaUserData,
      custom_data: customData,
    }],
  };

  const testEventCode = cleanString(process.env.META_TEST_EVENT_CODE);
  if (testEventCode) payload.test_event_code = testEventCode;

  try {
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
      return res.status(502).json({ ok: false, message: 'Meta Conversions API request failed.' });
    }
    return res.json({ ok: true, eventId, response: data });
  } catch (err) {
    console.error('Meta Conversions API request error:', err);
    return res.status(502).json({ ok: false, message: 'Meta Conversions API request failed.' });
  }
});

export default router;
