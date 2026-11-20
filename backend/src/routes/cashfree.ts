import crypto from 'node:crypto';
import { Router } from 'express';
import { optionalAuth } from '../middleware/auth';
import { rateLimit, rateLimitKeyByIpAndOrderEmail } from '../middleware/rateLimit';
import { CashfreeConfigurationError, createCashfreeSession, isCashfreeToken, resolveCashfreeConfig, verifyCashfreeSignature } from '../lib/cashfree';
import { reconcileCashfreeToken } from '../lib/cashfreeSettlement';
import { isDbConnected } from '../lib/db';
import { createOnlineCheckout } from '../lib/onlineCheckout';

const router = Router();
const checkoutLimiter = rateLimit('cashfree-checkout', {
  windowMs: 15 * 60_000,
  max: 10,
  key: rateLimitKeyByIpAndOrderEmail,
  message: 'Too many payment attempts. Please wait before trying again.',
});

router.post('/create-order', checkoutLimiter, optionalAuth, createOnlineCheckout({
  method: 'Cashfree',
  minimumAmount: 1,
  prepare: () => {
    const config = resolveCashfreeConfig();
    return (checkout) => createCashfreeSession(config, checkout).catch((error) => {
      console.error('Cashfree could not start checkout:', error instanceof Error ? error.message : error);
      throw new CashfreeConfigurationError('Cashfree could not start checkout.');
    });
  },
  createToken: () => 'cf_' + crypto.randomUUID(),
  respondToFailure: (res, error) => {
    if (!(error instanceof CashfreeConfigurationError)) return false;
    res.status(503).json({ code: 'PAYMENT_UNAVAILABLE', message: 'Cashfree checkout is temporarily unavailable. Please try again or choose PayU.' });
    return true;
  },
}));

router.post('/resume', checkoutLimiter, async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  const token = String(req.body?.token || '');
  if (!isCashfreeToken(token)) return res.status(400).json({ message: 'Invalid payment token.' });
  if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
  try {
    const result = await reconcileCashfreeToken(token);
    if (!result.session) return res.status(409).json({ message: 'This checkout cannot be resumed. Refresh to see the latest payment status.' });
    return res.json({ ...result.session, statusToken: token, orderId: result.row.order_id });
  } catch {
    return res.status(503).json({ message: 'Cashfree is temporarily unavailable. Please try again.' });
  }
});

router.post('/webhook', async (req, res) => {
  try {
    const config = resolveCashfreeConfig();
    const rawBody = (req as typeof req & { rawBody?: string }).rawBody || '';
    if (!verifyCashfreeSignature(rawBody, req.get('x-webhook-timestamp') || '', req.get('x-webhook-signature') || '', config.secret)) {
      return res.status(400).send('Invalid Cashfree signature.');
    }
    const token = String(req.body?.data?.order?.order_id || '');
    if (!isCashfreeToken(token) || req.body?.type !== 'PAYMENT_SUCCESS_WEBHOOK') return res.sendStatus(200);
    if (!isDbConnected()) return res.sendStatus(503);
    const { row } = await reconcileCashfreeToken(token);
    return res.sendStatus(row?.status === 'pending' ? 503 : 200);
  } catch (error) {
    console.error('Cashfree webhook could not be reconciled:', error instanceof Error ? error.message : error);
    return res.sendStatus(503);
  }
});

export default router;
