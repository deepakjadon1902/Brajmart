import { Router, type Response } from 'express';
import crypto from 'crypto';
import { optionalAuth } from '../middleware/auth';
import { rateLimit, rateLimitKeyByIpAndOrderEmail } from '../middleware/rateLimit';
import { isDbConnected, dbQuery, dbExecute, withDbTransaction } from '../lib/db';
import { resolvePayUConfig, PayUConfigurationError, createPayURequestHash, verifyPayUResponseHash, verifyPayUTransaction } from '../lib/payu';
import { reserveInventoryForOrder } from '../lib/inventory';
import { createOnlineCheckout } from '../lib/onlineCheckout';
import { parseJson } from '../lib/dbHelpers';
import { updateOrderForPayment } from '../lib/paymentSettlement';

const router = Router();
const payuCreateLimiter = rateLimit('payu-create-checkout', {
  windowMs: 15 * 60 * 1000,
  max: 10,
  key: rateLimitKeyByIpAndOrderEmail,
  message: 'Too many payment attempts. Please wait before trying again.',
});
const payuCallbackLimiter = rateLimit('payu-callback', {
  windowMs: 15 * 60 * 1000,
  max: 60,
  key: rateLimitKeyByIpAndOrderEmail,
  message: 'Too many payment updates. Please try again shortly.',
});

type PayUCheckoutFields = Record<string, string>;

const respondToPayUConfigurationFailure = (res: Response, error: unknown) => {
  if (!(error instanceof PayUConfigurationError)) return false;
  console.error('PayU configuration needs attention:', error.message);
  res.status(503).json({
    code: 'PAYMENT_UNAVAILABLE',
    message: 'PayU online payment is temporarily unavailable. Choose Cashfree at checkout if available.',
  });
  return true;
};

const getFrontendUrl = () => {
  const value = String(process.env.FRONTEND_URL || process.env.SITE_URL || 'https://www.brajmart.com').trim().replace(/\/$/, '');
  try { return new URL(value).origin; } catch { return 'https://www.brajmart.com'; }
};

const payuFieldsFor = (params: {
  token: string;
  amount: number;
  orderId: number | string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  billingAddress: Record<string, any>;
}) => {
  const config = resolvePayUConfig();
  const fields: PayUCheckoutFields = {
    key: config.key,
    txnid: params.token,
    amount: Number(params.amount).toFixed(2),
    productinfo: `BrajMart order #${params.orderId}`.slice(0, 100),
    firstname: String(params.customerName || 'Customer').trim().split(/\s+/)[0].slice(0, 60) || 'Customer',
    email: params.customerEmail,
    phone: String(params.customerPhone || '').replace(/\D/g, '').slice(-10),
    surl: config.callbackUrl,
    furl: config.callbackUrl,
    curl: config.callbackUrl,
    udf1: String(params.orderId),
    udf2: '',
    udf3: '',
    udf4: '',
    udf5: '',
    address1: String(params.billingAddress.street || '').slice(0, 100),
    address2: String(params.billingAddress.addressLine2 || '').slice(0, 100),
    city: String(params.billingAddress.city || '').slice(0, 50),
    state: String(params.billingAddress.state || '').slice(0, 50),
    country: 'India',
    zipcode: String(params.billingAddress.pincode || '').slice(0, 20),
  };
  fields.hash = createPayURequestHash(fields, config.salt);
  return { actionUrl: config.paymentUrl, fields };
};

const makeTransactionId = (orderId: string | number) =>
  `BM${String(orderId).replace(/\D/g, '').slice(-8)}${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`.slice(0, 25);

const recordPaymentAttempt = async (orderRow: any, customerName: string, customerEmail: string, amount: number, token: string) => {
  await dbExecute(
    'INSERT INTO payments (order_id, customer_name, customer_email, method, amount, status, transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [orderRow.id, customerName, customerEmail, 'PayU', amount, 'pending', token]
  );
  await dbExecute(
    'INSERT INTO payment_status (token, status, order_id, amount, method, payment_id) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status), order_id = VALUES(order_id), amount = VALUES(amount), method = VALUES(method), payment_id = VALUES(payment_id), updated_at = NOW()',
    [token, 'pending', orderRow.id, amount, 'PayU', null]
  );
};

const hasPaidSettlement = async (orderId: number | string) => {
  const rows = await dbQuery<any>(
    `SELECT 1 FROM payments WHERE order_id = ? AND status = 'paid'
     UNION ALL SELECT 1 FROM payment_status WHERE order_id = ? AND status = 'paid' LIMIT 1`,
    [orderId, orderId]
  );
  return rows.length > 0;
};

const redirectToPaymentStatus = (res: Response, token: string) =>
  res.redirect(303, `${getFrontendUrl()}/payment-status/${encodeURIComponent(token)}`);

router.post('/create-order', payuCreateLimiter, optionalAuth, createOnlineCheckout({
  method: 'PayU',
  prepare: () => {
    resolvePayUConfig();
    return (checkout) => checkout.alreadyPaid ? { completed: true } : payuFieldsFor(checkout);
  },
  createToken: makeTransactionId,
  respondToFailure: respondToPayUConfigurationFailure,
}));

router.post('/retry', payuCreateLimiter, async (req, res) => {
  try {
    resolvePayUConfig();
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const previousToken = String(req.body?.token || '').trim();
    if (!previousToken) return res.status(400).json({ message: 'Missing payment token' });
    const statusRows = await dbQuery<any>('SELECT * FROM payment_status WHERE token = ? LIMIT 1', [previousToken]);
    const statusRow = statusRows[0];
    const previousMethod = String(statusRow?.method || '').toLowerCase();
    if (!statusRow?.order_id || previousMethod !== 'payu') return res.status(404).json({ message: 'PayU payment not found' });
    if (String(statusRow.status || '') === 'paid' || await hasPaidSettlement(statusRow.order_id)) return res.status(409).json({ message: 'This order is already paid' });
    if (String(statusRow.status || '') !== 'failed') return res.status(409).json({ message: 'Wait for the current payment attempt to finish before retrying.' });

    const previousAmount = Number(statusRow.amount || 0);
    let previousPayment: Awaited<ReturnType<typeof verifyPayUTransaction>>;
    try {
      previousPayment = await verifyPayUTransaction(previousToken, previousAmount);
    } catch {
      return res.status(503).json({ message: 'We could not verify the previous attempt yet. Please wait a moment and try again.' });
    }
    if (previousPayment.captured) {
      await updateOrderForPayment({
        token: previousToken,
        paymentId: previousPayment.paymentId || String(statusRow.payment_id || previousToken),
        status: 'paid',
        note: 'Payment reconciled before PayU retry',
        provider: 'PayU',
      });
      return res.status(409).json({ message: 'This order is already paid' });
    }

    const orderRows = await dbQuery<any>('SELECT * FROM orders WHERE id = ? LIMIT 1', [statusRow.order_id]);
    const orderRow = orderRows[0];
    if (!orderRow) return res.status(404).json({ message: 'Order not found' });
    const amount = Number(statusRow.amount || orderRow.total || 0);
    if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) !== Math.round(Number(orderRow.total) * 100)) {
      return res.status(400).json({ message: 'Invalid retry amount' });
    }

    const items = parseJson<any[]>(orderRow.items, []);
    await withDbTransaction((connection) => reserveInventoryForOrder(connection, Number(orderRow.id), items));
    const history = parseJson<Array<{ status: string; date: string; note?: string }>>(orderRow.status_history, []);
    history.push({ status: 'pending_payment', date: new Date().toISOString(), note: 'PayU payment retry initiated' });
    await dbExecute('UPDATE orders SET status = ?, payment_method = ?, status_history = ?, updated_at = NOW() WHERE id = ?', ['pending_payment', 'PayU', JSON.stringify(history), orderRow.id]);

    const token = makeTransactionId(orderRow.id);
    const customerName = String(orderRow.customer_name || 'Customer');
    const customerEmail = String(orderRow.customer_email || '').trim().toLowerCase();
    await recordPaymentAttempt(orderRow, customerName, customerEmail, amount, token);
    const billing = parseJson<any>(orderRow.billing_address, {});
    const shipping = parseJson<any>(orderRow.shipping_address, {});
    const checkout = payuFieldsFor({
      token,
      amount,
      orderId: orderRow.id,
      customerName,
      customerEmail,
      customerPhone: billing.mobile || shipping.mobile || '',
      billingAddress: billing,
    });
    return res.json({ ...checkout, statusToken: token, orderId: orderRow.id });
  } catch (err: any) {
    if (respondToPayUConfigurationFailure(res, err)) return;
    return res.status(500).json({ message: err?.message || 'Failed to retry PayU payment' });
  }
});

router.post('/callback', payuCallbackLimiter, async (req, res) => {
  const token = String(req.body?.txnid || '').trim();
  try {
    const config = resolvePayUConfig();
    if (!isDbConnected()) return res.status(503).send('Payment service is temporarily unavailable.');
    if (!token || token.length > 25 || !/^[a-zA-Z0-9_-]+$/.test(token)) return res.status(400).send('Invalid payment response.');
    const statusRows = await dbQuery<any>('SELECT * FROM payment_status WHERE token = ? LIMIT 1', [token]);
    const statusRow = statusRows[0];
    if (!statusRow || String(statusRow.method || '').toLowerCase() !== 'payu') return res.status(404).send('Payment not found.');
    const orderRows = await dbQuery<any>('SELECT total, payment_method, customer_email FROM orders WHERE id = ? LIMIT 1', [statusRow.order_id]);
    const orderRow = orderRows[0];
    const amount = Number(statusRow.amount);
    const responseAmount = Number(req.body?.amount);
    const responseEmail = String(req.body?.email || '').trim().toLowerCase();
    const expectedProductInfo = `BrajMart order #${statusRow.order_id}`;
    if (!orderRow || String(orderRow.payment_method || '').toLowerCase() !== 'payu'
      || String(req.body?.key || '') !== config.key
      || Math.round(amount * 100) !== Math.round(Number(orderRow.total) * 100)
      || Math.round(responseAmount * 100) !== Math.round(amount * 100)
      || responseEmail !== String(orderRow.customer_email || '').trim().toLowerCase()
      || String(req.body?.udf1 || '') !== String(statusRow.order_id)
      || String(req.body?.productinfo || '') !== expectedProductInfo
      || !verifyPayUResponseHash(req.body || {}, config.salt)) {
      console.warn('PayU callback rejected because its signature or stored payment details did not match.');
      return res.redirect(303, `${getFrontendUrl()}/checkout?payment=verification-failed`);
    }

    const callbackStatus = String(req.body?.status || '').toLowerCase();
    const unmappedStatus = String(req.body?.unmappedstatus || '').toLowerCase();
    const transactionStatus = String(req.body?.txnStatus || '').toLowerCase();
    const isCancelled = ['cancel', 'cancelled', 'canceled', 'usercancelled'].includes(callbackStatus)
      || ['cancel', 'cancelled', 'canceled', 'usercancelled'].includes(unmappedStatus)
      || transactionStatus === 'cancel';
    const isFailed = ['failure', 'failed', 'pending'].includes(callbackStatus)
      || ['failed', 'bounced', 'dropped', 'autorefund'].includes(unmappedStatus)
      || isCancelled;
    if (callbackStatus === 'success') {
      const verified = await verifyPayUTransaction(token, amount);
      if (verified.captured) {
        await updateOrderForPayment({
          token,
          paymentId: verified.paymentId || String(req.body?.mihpayid || req.body?.mihpayupid || token),
          status: 'paid',
          note: 'Payment verified by PayU callback and Verify Payment API',
          provider: 'PayU',
          request: req,
        });
      } else {
        console.warn('PayU callback reported success but Verify Payment API has not confirmed capture.', { token });
      }
    } else if (isFailed) {
      let verified: Awaited<ReturnType<typeof verifyPayUTransaction>> | null = null;
      try {
        verified = await verifyPayUTransaction(token, amount);
      } catch {
        // A valid signed failure/cancel callback still gives us the return path.
      }
      if (verified?.captured) {
        await updateOrderForPayment({
          token,
          paymentId: verified.paymentId || String(req.body?.mihpayid || req.body?.mihpayupid || token),
          status: 'paid',
          note: 'PayU payment capture confirmed during callback reconciliation',
          provider: 'PayU',
          request: req,
        });
      } else {
        await updateOrderForPayment({
          token,
          paymentId: String(req.body?.mihpayid || req.body?.mihpayupid || token),
          status: 'failed',
          note: isCancelled ? 'PayU payment cancelled by customer' : 'PayU payment was not completed',
          provider: 'PayU',
        });
      }
    }
    return redirectToPaymentStatus(res, token);
  } catch (err: any) {
    if (err instanceof PayUConfigurationError) return res.status(503).send('PayU is not configured. Please contact support.');
    console.error('PayU callback processing failed:', err?.message || err);
    if (token) return redirectToPaymentStatus(res, token);
    return res.status(500).send('Unable to verify payment. Please contact support.');
  }
});

export default router;
