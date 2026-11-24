import { Router, type Response } from 'express';
import { rateLimit, rateLimitKeyByIpAndOrderEmail } from '../middleware/rateLimit';
import { isDbConnected, dbQuery } from '../lib/db';
import { resolvePayUConfig, PayUConfigurationError, verifyPayUResponseHash, verifyPayUTransaction } from '../lib/payu';
import { updateOrderForPayment } from '../lib/paymentSettlement';

const router = Router();
const payuCallbackLimiter = rateLimit('payu-callback', {
  windowMs: 15 * 60 * 1000,
  max: 60,
  key: rateLimitKeyByIpAndOrderEmail,
  message: 'Too many payment updates. Please try again shortly.',
});

const getFrontendUrl = () => {
  const value = String(process.env.FRONTEND_URL || process.env.SITE_URL || 'https://www.brajmart.com').trim().replace(/\/$/, '');
  try { return new URL(value).origin; } catch { return 'https://www.brajmart.com'; }
};

const redirectToPaymentStatus = (res: Response, token: string) =>
  res.redirect(303, `${getFrontendUrl()}/payment-status/${encodeURIComponent(token)}`);

router.post(['/create-order', '/retry'], (_req, res) => {
  return res.status(410).json({
    code: 'PAYMENT_UNAVAILABLE',
    message: 'Use Cashfree at checkout for online payments.',
  });
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
