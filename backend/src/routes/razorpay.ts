import { Router, type Response } from 'express';
import crypto from 'crypto';
import { isDbConnected, dbQuery } from '../lib/db';
import { rateLimit, rateLimitKeyByIpAndOrderEmail } from '../middleware/rateLimit';
import { isCapturedRazorpayPayment, verifyCapturedRazorpayPayment } from '../lib/razorpayVerification';
import { updateOrderForPayment } from '../lib/paymentSettlement';
import { RazorpayConfigurationError, resolveRazorpayCredentials } from '../lib/razorpayEnvironment';

const router = Router();
const razorpayReportLimiter = rateLimit('razorpay-status-report', {
  windowMs: 15 * 60 * 1000,
  max: 30,
  key: rateLimitKeyByIpAndOrderEmail,
  message: 'Too many payment status attempts. Please wait before trying again.',
});

const getRazorpayConfig = () => {
  return resolveRazorpayCredentials();
};

const respondToConfigurationFailure = (res: Response, error: unknown) => {
  if (!(error instanceof RazorpayConfigurationError)) return false;
  console.error('Razorpay configuration invalid; run npm run check:razorpay on the backend service.', {
    code: error.code, issues: error.issues,
  });
  res.status(503).json({
    code: 'PAYMENT_UNAVAILABLE',
    message: 'Online payment is temporarily unavailable. Please try again shortly or contact support.',
  });
  return true;
};

const hmacSha256 = (value: string, secret: string) =>
  crypto.createHmac('sha256', secret).update(value).digest('hex');

const timingSafeEqual = (a: string, b: string) => {
  if (!/^[a-fA-F0-9]{64}$/.test(a) || !/^[a-fA-F0-9]{64}$/.test(b)) return false;
  const left = Buffer.from(a || '', 'hex');
  const right = Buffer.from(b || '', 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

const fetchRazorpayPayment = async (paymentId: string) => {
  const { keyId, keySecret } = getRazorpayConfig();
  if (!keyId || !keySecret) throw new Error('Razorpay credentials are not configured');
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.description || data?.message || 'Unable to confirm Razorpay payment';
    throw new Error(message);
  }
  return data;
};

const fetchRazorpayOrderPayments = async (razorpayOrderId: string) => {
  const { keyId, keySecret } = getRazorpayConfig();
  if (!keyId || !keySecret) throw new Error('Razorpay credentials are not configured');
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const response = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(razorpayOrderId)}/payments`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.description || data?.message || 'Unable to fetch Razorpay order payments';
    throw new Error(message);
  }
  return Array.isArray(data?.items) ? data.items : [];
};

const findCapturedRazorpayPayment = async (razorpayOrderId: string, razorpayPaymentId?: string) => {
  const rows = await dbQuery<any>('SELECT amount FROM payment_status WHERE token = ? LIMIT 1', [razorpayOrderId]);
  if (!rows[0]) return null;
  const amount = Number(rows[0].amount);
  if (razorpayPaymentId) {
    const payment = await fetchRazorpayPayment(razorpayPaymentId);
    if (isCapturedRazorpayPayment(payment, { orderId: razorpayOrderId, paymentId: razorpayPaymentId, amount })) {
      return payment;
    }
  }

  const payments = await fetchRazorpayOrderPayments(razorpayOrderId);
  return payments.find((payment: any) => isCapturedRazorpayPayment(payment, { orderId: razorpayOrderId, paymentId: String(payment?.id || ''), amount })) || null;
};

const assertRazorpayPaymentCaptured = async (razorpayOrderId: string, razorpayPaymentId: string) => {
  const statusRows = await dbQuery<any>('SELECT amount FROM payment_status WHERE token = ? LIMIT 1', [razorpayOrderId]);
  const statusRow = statusRows[0];
  if (!statusRow) throw new Error('Payment not found');

  return verifyCapturedRazorpayPayment({ orderId: razorpayOrderId, paymentId: razorpayPaymentId, amount: Number(statusRow.amount) });
};

const resolveRazorpayStatusToken = async (payment: any, order: any) => {
  const razorpayOrderId = String(payment?.order_id || order?.id || '').trim();
  if (razorpayOrderId) return razorpayOrderId;

  return '';
};

router.post('/verify', razorpayReportLimiter, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const { keySecret } = getRazorpayConfig();
    if (!keySecret) return res.status(500).json({ message: 'Razorpay credentials are not configured' });

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: 'Missing Razorpay payment details' });
    }

    const statusRows = await dbQuery<any>('SELECT token FROM payment_status WHERE token = ? LIMIT 1', [String(razorpay_order_id)]);
    const storedOrderId = String(statusRows[0]?.token || '');
    if (!storedOrderId || storedOrderId !== String(razorpay_order_id)) return res.status(404).json({ message: 'Payment not found' });
    const expected = hmacSha256(`${storedOrderId}|${razorpay_payment_id}`, keySecret);
    if (!timingSafeEqual(expected, String(razorpay_signature))) {
      return res.status(400).json({ message: 'Invalid Razorpay signature' });
    }

    await assertRazorpayPaymentCaptured(String(razorpay_order_id), String(razorpay_payment_id));

    const result = await updateOrderForPayment({
      token: String(razorpay_order_id),
      paymentId: String(razorpay_payment_id),
      status: 'paid',
      note: 'Payment verified via Razorpay checkout signature',
      metaContext: req.body?.metaContext,
      request: req,
    });
    if (!result) return res.status(404).json({ message: 'Payment not found' });

    return res.json({ ok: true, ...result });
  } catch (err: any) {
    if (respondToConfigurationFailure(res, err)) return;
    return res.status(500).json({ message: err?.message || 'Failed to verify Razorpay payment' });
  }
});

router.post('/failed', razorpayReportLimiter, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    getRazorpayConfig();

    const {
      razorpay_order_id,
      razorpay_payment_id,
      customer_email,
      reason,
    } = req.body || {};

    const razorpayOrderId = String(razorpay_order_id || '').trim();
    const customerEmail = String(customer_email || '').trim().toLowerCase();
    if (!razorpayOrderId) {
      return res.status(400).json({ message: 'Missing Razorpay order' });
    }

    const statusRows = await dbQuery<any>('SELECT order_id FROM payment_status WHERE token = ? LIMIT 1', [razorpayOrderId]);
    const statusRow = statusRows[0];
    if (!statusRow?.order_id) return res.status(404).json({ message: 'Payment not found' });

    const orderRows = await dbQuery<any>('SELECT customer_email FROM orders WHERE id = ? LIMIT 1', [statusRow.order_id]);
    const orderEmail = String(orderRows[0]?.customer_email || '').trim().toLowerCase();
    if (customerEmail && (!orderEmail || orderEmail !== customerEmail)) {
      return res.status(403).json({ message: 'Payment does not match this customer' });
    }

    const capturedPayment = await findCapturedRazorpayPayment(razorpayOrderId, razorpay_payment_id ? String(razorpay_payment_id) : undefined).catch(() => null);
    if (capturedPayment) {
      const result = await updateOrderForPayment({
        token: razorpayOrderId,
        paymentId: String(capturedPayment.id),
        status: 'paid',
        note: 'Payment corrected from Razorpay captured status',
        metaContext: req.body?.metaContext,
        request: req,
      });
      if (!result) return res.status(404).json({ message: 'Payment not found' });
      return res.json({ ok: true, ...result });
    }

    const noteReason = String(reason || '').trim();
    const result = await updateOrderForPayment({
      token: razorpayOrderId,
      paymentId: razorpay_payment_id ? String(razorpay_payment_id) : undefined,
      status: 'failed',
      note: noteReason ? `Payment failed via Razorpay checkout: ${noteReason}` : 'Payment failed via Razorpay checkout',
    });
    if (!result) return res.status(404).json({ message: 'Payment not found' });

    return res.json({ ok: true, ...result });
  } catch (err: any) {
    if (respondToConfigurationFailure(res, err)) return;
    return res.status(500).json({ message: err?.message || 'Failed to record Razorpay payment failure' });
  }
});

router.post('/webhook', async (req: any, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const { webhookSecret } = getRazorpayConfig();
    if (!webhookSecret) return res.status(500).json({ message: 'Razorpay webhook secret is not configured' });

    const signature = String(req.headers['x-razorpay-signature'] || '');
    if (typeof req.rawBody !== 'string') return res.status(400).json({ message: 'Missing raw webhook body' });
    const rawBody = req.rawBody;
    const expected = hmacSha256(rawBody, webhookSecret);
    if (!signature || !timingSafeEqual(expected, signature)) {
      return res.status(400).json({ message: 'Invalid webhook signature' });
    }

    const event = String(req.body?.event || '');
    const payment = req.body?.payload?.payment?.entity || null;
    const order = req.body?.payload?.order?.entity || null;
    const razorpayOrderId = await resolveRazorpayStatusToken(payment, order);
    const razorpayPaymentId = payment?.id ? String(payment.id) : undefined;
    if (!razorpayOrderId) return res.status(200).json({ ok: true, ignored: true, reason: 'No order id' });

    if (event === 'payment.captured' || event === 'order.paid') {
      await updateOrderForPayment({
        token: razorpayOrderId,
        paymentId: razorpayPaymentId,
        status: 'paid',
        note: 'Payment confirmed via Razorpay webhook',
      });
    } else if (event === 'payment.failed') {
      const capturedPayment = await findCapturedRazorpayPayment(razorpayOrderId, razorpayPaymentId).catch(() => null);
      if (capturedPayment) {
        await updateOrderForPayment({
          token: razorpayOrderId,
          paymentId: String(capturedPayment.id),
          status: 'paid',
          note: 'Payment corrected from Razorpay captured status',
        });
        return res.json({ ok: true });
      }
      await updateOrderForPayment({
        token: razorpayOrderId,
        paymentId: razorpayPaymentId,
        status: 'failed',
        note: 'Payment failed via Razorpay webhook',
      });
    }

    return res.json({ ok: true });
  } catch (err: any) {
    if (respondToConfigurationFailure(res, err)) return;
    console.error(err);
    return res.status(500).json({ message: err?.message || 'Webhook processing failed' });
  }
});

export default router;
