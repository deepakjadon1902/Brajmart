import { Router, type Response } from 'express';
import crypto from 'crypto';
import { optionalAuth, AuthRequest } from '../middleware/auth';
import { rateLimit, rateLimitKeyByIpAndOrderEmail } from '../middleware/rateLimit';
import { isDbConnected, dbQuery, dbExecute, withDbTransaction } from '../lib/db';
import { getEtaConfig, getEstimatedDeliveryDate } from '../lib/eta';
import { capturePurchaseOrderContext } from '../lib/purchaseTracking';
import { resolvePayUConfig, PayUConfigurationError, createPayURequestHash, verifyPayUResponseHash, verifyPayUTransaction } from '../lib/payu';
import { applyCouponToTotals, computeTotals, getCheckoutSettings, hasPrasadamItems, priceAndValidateOrderItems } from '../lib/orderPricing';
import { upsertUserDefaultAddress } from '../lib/userAddress';
import { resolveCodHandleFee } from '../lib/cod';
import { validateCheckoutOrderContact } from '../lib/checkoutValidation';
import { releaseInventoryForOrder, reserveInventoryForOrder } from '../lib/inventory';
import { parseJson } from '../lib/dbHelpers';
import { updateOrderForPayment } from './razorpay';

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
    message: 'PayU online payment is temporarily unavailable. Please use Cash on Delivery if available or contact support.',
  });
  return true;
};

const normalizeIdempotencyKey = (value: unknown) => String(value || '').trim().slice(0, 112);
const buildCartHash = (input: unknown) => crypto.createHash('sha256').update(JSON.stringify(input || null)).digest('hex');
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

const saveCheckoutSession = async (input: {
  idempotencyKey: string;
  userId: number | null;
  customerEmail: string;
  cartHash: string;
  orderId: number;
  paymentToken: string;
  amount: number;
}) => {
  if (!input.idempotencyKey) return;
  await dbExecute(
    `INSERT INTO checkout_sessions
      (idempotency_key, user_id, customer_email, cart_hash, order_id, payment_token, amount, status, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active', DATE_ADD(NOW(), INTERVAL 45 MINUTE))
     ON DUPLICATE KEY UPDATE
      user_id = VALUES(user_id), customer_email = VALUES(customer_email), cart_hash = VALUES(cart_hash),
      order_id = VALUES(order_id), payment_token = VALUES(payment_token), amount = VALUES(amount),
      status = 'active', expires_at = VALUES(expires_at), updated_at = NOW()`,
    [input.idempotencyKey, input.userId, input.customerEmail, input.cartHash, input.orderId, input.paymentToken, input.amount]
  );
};

const findReusableCheckout = async (idempotencyKey: string, cartHash: string) => {
  if (!idempotencyKey) return null;
  const rows = await dbQuery<any>(
    `SELECT * FROM checkout_sessions
      WHERE idempotency_key = ? AND status = 'active' AND expires_at > NOW()
      LIMIT 1`,
    [idempotencyKey]
  );
  const session = rows[0];
  if (!session) return null;
  if (String(session.cart_hash || '') !== cartHash) throw new Error('Checkout session changed. Please refresh your cart and try again.');
  const paymentRows = await dbQuery<any>('SELECT method, status FROM payment_status WHERE token = ? LIMIT 1', [String(session.payment_token || '')]);
  if (String(paymentRows[0]?.method || '').toLowerCase() !== 'payu' || String(paymentRows[0]?.status || '') !== 'pending') return null;
  return { orderId: Number(session.order_id), token: String(session.payment_token), amount: Number(session.amount) };
};

const createOrderRow = async (orderData: any, estimatedDelivery: Date) => {
  const history = [{ status: 'pending_payment', date: new Date().toISOString(), note: 'PayU payment initiated, waiting for payment confirmation' }];
  const result: any = await dbExecute(
    'INSERT INTO orders (user_id, items, items_subtotal, packaging_amount, packaging_rate, shipping_amount, cod_amount, cod_available, cod_pincode, cod_message, coupon_code, coupon_discount, coupon_details, total, status, customer_name, customer_email, shipping_address, billing_address, payment_method, tracking_id, estimated_delivery, status_history) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      orderData.userId || null, JSON.stringify(orderData.items || []), orderData.itemsSubtotal, orderData.packagingAmount,
      orderData.packagingRate, orderData.shippingAmount, 0, orderData.codAvailable, orderData.codPincode || null,
      orderData.codMessage || null, orderData.couponCode || null, orderData.couponDiscount || 0,
      orderData.couponDetails ? JSON.stringify(orderData.couponDetails) : null, orderData.total, 'pending_payment',
      orderData.customerName || null, orderData.customerEmail || null, JSON.stringify(orderData.shippingAddress || {}),
      JSON.stringify(orderData.billingAddress || {}), 'PayU', null, estimatedDelivery, JSON.stringify(history),
    ]
  );
  const rows = await dbQuery<any>('SELECT * FROM orders WHERE id = ? LIMIT 1', [result.insertId]);
  return rows[0];
};

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

router.post('/create-order', payuCreateLimiter, optionalAuth, async (req: AuthRequest, res) => {
  let orderRow: any = null;
  let reservedItems: any[] = [];
  try {
    resolvePayUConfig();
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const { amount, order, customer } = req.body || {};
    if (!order || !customer?.email || !customer?.name) return res.status(400).json({ message: 'Missing order details' });
    const customerEmail = String(customer.email || '').trim().toLowerCase();
    const contact = validateCheckoutOrderContact(order, customerEmail);
    if (!contact.ok) return res.status(400).json({ message: contact.message });

    const priced = await priceAndValidateOrderItems(order.items || []);
    if (!priced.ok) return res.status(400).json({ message: priced.message });
    if ((Boolean(order?.codRequested) || Number(order?.codAmount || 0) > 0) && hasPrasadamItems(priced.items)) {
      return res.status(400).json({ message: 'COD is not available for Prasadam products. Please use online payment for Prasadam orders.' });
    }

    const settings = await getCheckoutSettings();
    const baseTotals = computeTotals(priced.itemsSubtotal, settings);
    const cod = await resolveCodHandleFee({ ...order, items: priced.items }, settings);
    const totalsBeforeCoupon = { ...baseTotals, cod: cod.amount, total: baseTotals.total + cod.amount };
    let totals = totalsBeforeCoupon;
    let couponDetails: any = null;
    if (order?.couponCode) {
      const couponResult = await applyCouponToTotals(order.couponCode, priced.items, totalsBeforeCoupon);
      if (!couponResult.valid) return res.status(400).json({ message: couponResult.message });
      totals = { ...totalsBeforeCoupon, total: couponResult.totals.total };
      couponDetails = couponResult.coupon;
    }
    if (settings.minOrderAmount && totals.total < settings.minOrderAmount) return res.status(400).json({ message: `Minimum order amount is ${settings.minOrderAmount}` });
    if (settings.maxOrderQuantity) {
      const totalQty = priced.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
      if (totalQty > settings.maxOrderQuantity) return res.status(400).json({ message: `Maximum order quantity is ${settings.maxOrderQuantity}` });
    }
    if (amount !== undefined && Number.isFinite(Number(amount)) && Math.abs(Number(amount) - totals.total) > 0.01) {
      return res.status(400).json({ message: 'Cart total changed. Please refresh and try again.' });
    }

    const cartHash = buildCartHash({
      customerEmail,
      customerName: customer.name,
      customerPhone: customer.phone || '',
      shippingAddress: contact.shippingAddress,
      billingAddress: contact.billingAddress,
      items: priced.items.map((item) => ({ productId: item.productId, quantity: item.quantity, selectedSize: item.selectedSize || '', selectedPieces: item.selectedPieces || '', selectedAttributes: item.selectedAttributes || {}, price: item.price })),
      totals,
      couponCode: couponDetails?.code || '',
      codAmount: cod.amount,
    });
    const rawIdempotencyKey = normalizeIdempotencyKey(req.body?.idempotencyKey || req.headers['idempotency-key']);
    const idempotencyKey = rawIdempotencyKey ? `payu:${rawIdempotencyKey}` : '';
    const reusable = await findReusableCheckout(idempotencyKey, cartHash);
    if (reusable) {
      const orderRows = await dbQuery<any>('SELECT * FROM orders WHERE id = ? LIMIT 1', [reusable.orderId]);
      const savedOrder = orderRows[0];
      if (savedOrder) {
        const billing = parseJson(savedOrder.billing_address, {});
        const checkout = payuFieldsFor({ token: reusable.token, amount: reusable.amount, orderId: reusable.orderId, customerName: customer.name, customerEmail, customerPhone: customer.phone || '', billingAddress: billing });
        return res.json({ ...checkout, statusToken: reusable.token, orderId: reusable.orderId });
      }
    }

    const { max } = await getEtaConfig();
    const rawUserId = req.user?.id;
    const numericUserId = rawUserId && Number.isFinite(Number(rawUserId)) ? Number(rawUserId) : null;
    orderRow = await createOrderRow({
      ...order,
      userId: numericUserId,
      items: priced.items,
      itemsSubtotal: totals.itemsSubtotal,
      packagingAmount: totals.packaging,
      packagingRate: settings.packagingRate,
      shippingAmount: totals.shipping,
      codAvailable: cod.available,
      codPincode: cod.pincode,
      codMessage: cod.message,
      couponCode: couponDetails?.code || null,
      couponDiscount: couponDetails?.discountAmount || 0,
      couponDetails,
      total: totals.total,
      customerName: customer.name,
      customerEmail,
      shippingAddress: contact.shippingAddress,
      billingAddress: contact.billingAddress,
    }, getEstimatedDeliveryDate(max));

    capturePurchaseOrderContext(orderRow.id, {
      ...(req.body?.metaContext && typeof req.body.metaContext === 'object' ? req.body.metaContext : {}),
      externalId: numericUserId ? `user:${numericUserId}` : customerEmail,
    }, req).catch(() => {});
    if (numericUserId) upsertUserDefaultAddress(numericUserId, contact.shippingAddress || contact.billingAddress).catch(() => {});

    reservedItems = priced.items;
    await withDbTransaction((connection) => reserveInventoryForOrder(connection, Number(orderRow.id), priced.items));
    const token = makeTransactionId(orderRow.id);
    await recordPaymentAttempt(orderRow, customer.name, customerEmail, Number(totals.total), token);
    await saveCheckoutSession({ idempotencyKey, userId: numericUserId, customerEmail, cartHash, orderId: Number(orderRow.id), paymentToken: token, amount: Number(totals.total) });
    const checkout = payuFieldsFor({ token, amount: Number(totals.total), orderId: orderRow.id, customerName: customer.name, customerEmail, customerPhone: customer.phone || '', billingAddress: contact.billingAddress });
    return res.json({ ...checkout, statusToken: token, orderId: orderRow.id });
  } catch (err: any) {
    if (orderRow && reservedItems.length) {
      await withDbTransaction((connection) => releaseInventoryForOrder(connection, Number(orderRow.id), reservedItems)).catch(() => {});
    }
    if (respondToPayUConfigurationFailure(res, err)) return;
    return res.status(500).json({ message: err?.message || 'Failed to start PayU checkout' });
  }
});

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
