import { Router } from 'express';
import crypto from 'crypto';
import { optionalAuth, AuthRequest } from '../middleware/auth';
import { isDbConnected, dbQuery, dbExecute } from '../lib/db';
import { getEtaConfig, getEtaText, getEstimatedDeliveryDate } from '../lib/eta';
import { sendAdminPaymentNotice, sendOrderConfirmation, sendPaymentFailed, sendPaymentReceipt } from '../lib/email';
import { parseJson } from '../lib/dbHelpers';
import { applyCouponToTotals, computeTotals, getCheckoutSettings, hasPrasadamItems, markCouponUsed, priceAndValidateOrderItems } from '../lib/orderPricing';
import { upsertUserDefaultAddress } from '../lib/userAddress';
import { resolveCodHandleFee } from '../lib/cod';
import { validateCheckoutOrderContact } from '../lib/checkoutValidation';
import { rateLimit, rateLimitKeyByIpAndOrderEmail } from '../middleware/rateLimit';

const router = Router();
const razorpayCreateLimiter = rateLimit('razorpay-create-order', {
  windowMs: 15 * 60 * 1000,
  max: 10,
  key: rateLimitKeyByIpAndOrderEmail,
  message: 'Too many payment attempts. Please wait before trying again.',
});
const razorpayReportLimiter = rateLimit('razorpay-status-report', {
  windowMs: 15 * 60 * 1000,
  max: 30,
  key: rateLimitKeyByIpAndOrderEmail,
  message: 'Too many payment status attempts. Please wait before trying again.',
});

const getRazorpayConfig = () => {
  const keyId = process.env.RAZORPAY_PLATFORM_KEY_ID || process.env.RAZORPAY_KEY_ID || '';
  const keySecret = process.env.RAZORPAY_PLATFORM_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET || '';
  const webhookSecret = process.env.RAZORPAY_PLATFORM_WEBHOOK_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET || '';
  return { keyId, keySecret, webhookSecret };
};

const hmacSha256 = (value: string, secret: string) =>
  crypto.createHmac('sha256', secret).update(value).digest('hex');

const timingSafeEqual = (a: string, b: string) => {
  const left = Buffer.from(a || '', 'hex');
  const right = Buffer.from(b || '', 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

const insertOrder = async (orderData: any, estimatedDelivery: Date) => {
  const status = orderData.status || 'confirmed';
  const statusHistory = Array.isArray(orderData.statusHistory) && orderData.statusHistory.length
    ? orderData.statusHistory
    : [{ status, date: new Date().toISOString(), note: 'Order placed successfully' }];

  const result: any = await dbExecute(
    'INSERT INTO orders (user_id, items, items_subtotal, packaging_amount, packaging_rate, shipping_amount, cod_amount, cod_available, cod_pincode, cod_message, coupon_code, coupon_discount, coupon_details, total, status, customer_name, customer_email, shipping_address, billing_address, payment_method, tracking_id, estimated_delivery, status_history) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      orderData.userId || null,
      JSON.stringify(orderData.items || []),
      orderData.itemsSubtotal,
      orderData.packagingAmount,
      orderData.packagingRate,
      orderData.shippingAmount,
      orderData.codAmount || 0,
      orderData.codAvailable,
      orderData.codPincode || null,
      orderData.codMessage || null,
      orderData.couponCode || null,
      orderData.couponDiscount || 0,
      orderData.couponDetails ? JSON.stringify(orderData.couponDetails) : null,
      orderData.total,
      status,
      orderData.customerName || null,
      orderData.customerEmail || null,
      JSON.stringify(orderData.shippingAddress || {}),
      JSON.stringify(orderData.billingAddress || {}),
      orderData.paymentMethod,
      null,
      estimatedDelivery,
      JSON.stringify(statusHistory),
    ]
  );

  const rows = await dbQuery<any>('SELECT * FROM orders WHERE id = ? LIMIT 1', [result.insertId]);
  return rows[0];
};

const createRazorpayOrder = async (params: {
  keyId: string;
  keySecret: string;
  amountPaise: number;
  currency: string;
  receipt: string;
  notes: Record<string, string>;
}) => {
  const auth = Buffer.from(`${params.keyId}:${params.keySecret}`).toString('base64');
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: params.amountPaise,
      currency: params.currency,
      receipt: params.receipt,
      payment_capture: true,
      notes: params.notes,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.description || data?.message || 'Failed to create Razorpay order';
    throw new Error(message);
  }
  return data as { id: string; amount: number; currency: string; receipt?: string };
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
  if (razorpayPaymentId) {
    const payment = await fetchRazorpayPayment(razorpayPaymentId);
    if (
      String(payment?.status || '').toLowerCase() === 'captured'
      && String(payment?.order_id || '') === razorpayOrderId
    ) {
      return payment;
    }
  }

  const payments = await fetchRazorpayOrderPayments(razorpayOrderId);
  return payments.find((payment: any) => String(payment?.status || '').toLowerCase() === 'captured') || null;
};

const assertRazorpayPaymentCaptured = async (razorpayOrderId: string, razorpayPaymentId: string) => {
  const statusRows = await dbQuery<any>('SELECT amount FROM payment_status WHERE token = ? LIMIT 1', [razorpayOrderId]);
  const statusRow = statusRows[0];
  if (!statusRow) throw new Error('Payment not found');

  const payment = await fetchRazorpayPayment(razorpayPaymentId);
  const paymentStatus = String(payment?.status || '').toLowerCase();
  if (paymentStatus !== 'captured') {
    throw new Error('Razorpay payment is not captured yet');
  }
  if (String(payment?.order_id || '') !== razorpayOrderId) {
    throw new Error('Razorpay payment does not belong to this order');
  }
  const expectedAmount = Math.round(Number(statusRow.amount || 0) * 100);
  if (expectedAmount <= 0 || Number(payment?.amount) !== expectedAmount) {
    throw new Error('Razorpay payment amount does not match this order');
  }

  return payment;
};

const getOrderDetails = async (orderRow: any) => ({
  items: parseJson(orderRow.items, []),
  total: Number(orderRow.total),
  itemsSubtotal: orderRow.items_subtotal == null ? undefined : Number(orderRow.items_subtotal),
  shippingAmount: orderRow.shipping_amount == null ? undefined : Number(orderRow.shipping_amount),
  packagingAmount: orderRow.packaging_amount == null ? undefined : Number(orderRow.packaging_amount),
  packagingRate: orderRow.packaging_rate == null ? undefined : Number(orderRow.packaging_rate),
  codAmount: orderRow.cod_amount == null ? undefined : Number(orderRow.cod_amount),
  codAvailable: orderRow.cod_available == null ? undefined : Boolean(Number(orderRow.cod_available)),
  codPincode: orderRow.cod_pincode ?? undefined,
  codMessage: orderRow.cod_message ?? undefined,
  couponCode: orderRow.coupon_code ?? undefined,
  couponDiscount: orderRow.coupon_discount == null ? undefined : Number(orderRow.coupon_discount),
  couponDetails: parseJson(orderRow.coupon_details, null),
  paymentMethod: orderRow.payment_method,
  shippingAddress: parseJson(orderRow.shipping_address, {}),
  billingAddress: parseJson(orderRow.billing_address, {}),
});

const hasPaidSettlement = async (orderId: any) => {
  if (!orderId) return false;
  const rows = await dbQuery<any>(
    `SELECT 1
     FROM payments p
     WHERE p.order_id = ? AND p.status = 'paid'
     UNION ALL
     SELECT 1
     FROM payment_status ps
     WHERE ps.order_id = ? AND ps.status = 'paid'
     LIMIT 1`,
    [orderId, orderId]
  );
  return rows.length > 0;
};

const updateOrderForPayment = async (params: {
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  status: 'paid' | 'failed';
  note: string;
}) => {
  const statusRows = await dbQuery<any>('SELECT * FROM payment_status WHERE token = ? LIMIT 1', [params.razorpayOrderId]);
  const statusRow = statusRows[0];
  if (!statusRow) return null;
  if (String(statusRow.status || '') === 'paid' && params.status === 'failed') {
    return { orderId: statusRow.order_id, paymentId: statusRow.payment_id || params.razorpayPaymentId || params.razorpayOrderId, status: 'paid' };
  }

  if (params.status === 'failed' && await hasPaidSettlement(statusRow.order_id)) {
    await dbExecute(
      'UPDATE payment_status SET status = ?, updated_at = NOW() WHERE token = ?',
      ['paid', params.razorpayOrderId]
    );
    return { orderId: statusRow.order_id, paymentId: statusRow.payment_id || params.razorpayPaymentId || params.razorpayOrderId, status: 'paid' };
  }

  const alreadyFinal = String(statusRow.status || '') === params.status;
  if (alreadyFinal) {
    if (params.razorpayPaymentId && String(statusRow.payment_id || '') !== params.razorpayPaymentId) {
      await dbExecute(
        'UPDATE payment_status SET payment_id = ?, updated_at = NOW() WHERE token = ?',
        [params.razorpayPaymentId, params.razorpayOrderId]
      );
      await dbExecute(
        'UPDATE payments SET transaction_id = ?, updated_at = NOW() WHERE order_id = ? ORDER BY id DESC LIMIT 1',
        [params.razorpayPaymentId, statusRow.order_id]
      );
    }
    return { orderId: statusRow.order_id, paymentId: params.razorpayPaymentId || statusRow.payment_id || params.razorpayOrderId, status: params.status };
  }

  const orderRows = await dbQuery<any>('SELECT * FROM orders WHERE id = ? LIMIT 1', [statusRow.order_id]);
  let orderRow = orderRows[0];
  if (!orderRow) return null;

  const orderStatus = params.status === 'paid' ? 'confirmed' : String(orderRow.status || 'processing');
  const history = parseJson<Array<{ status: string; date: string; note?: string }>>(orderRow.status_history, []);
  const alreadyHasTerminalNote = history.some((entry) => String(entry.note || '') === params.note);
  if (!alreadyHasTerminalNote) {
    history.push({ status: orderStatus, date: new Date().toISOString(), note: params.note });
  }

  await dbExecute(
    'UPDATE orders SET status = ?, status_history = ?, updated_at = NOW() WHERE id = ?',
    [orderStatus, JSON.stringify(history), statusRow.order_id]
  );

  const paymentRows = await dbQuery<any>('SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1', [statusRow.order_id]);
  const paymentRow = paymentRows[0];
  const transactionId = params.razorpayPaymentId || paymentRow?.transaction_id || params.razorpayOrderId;

  if (paymentRow) {
    await dbExecute(
      'UPDATE payments SET status = ?, transaction_id = ?, updated_at = NOW() WHERE id = ?',
      [params.status, transactionId, paymentRow.id]
    );
  } else {
    await dbExecute(
      'INSERT INTO payments (order_id, customer_name, customer_email, method, amount, status, transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [statusRow.order_id, orderRow.customer_name || '', orderRow.customer_email || '', statusRow.method || 'Razorpay', Number(statusRow.amount || orderRow.total || 0), params.status, transactionId]
    );
  }

  await dbExecute(
    'INSERT INTO payment_status (token, status, order_id, amount, method, payment_id) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status), order_id = VALUES(order_id), amount = VALUES(amount), method = VALUES(method), payment_id = VALUES(payment_id), updated_at = NOW()',
    [params.razorpayOrderId, params.status, statusRow.order_id, Number(statusRow.amount || orderRow.total || 0), statusRow.method || 'Razorpay', transactionId]
  );

  if (params.status === 'paid' && orderRow.coupon_code) {
    await markCouponUsed(orderRow.coupon_code);
  }

  const refreshedRows = await dbQuery<any>('SELECT * FROM orders WHERE id = ? LIMIT 1', [statusRow.order_id]);
  orderRow = refreshedRows[0] || orderRow;
  const details = await getOrderDetails(orderRow);
  const { min, max } = await getEtaConfig();
  const etaText = getEtaText(min, max);

  if (orderRow.customer_email) {
    if (params.status === 'paid') {
      sendOrderConfirmation(orderRow.customer_email, {
        orderId: String(statusRow.order_id),
        itemsCount: details.items.length || 0,
        eta: etaText,
        ...details,
      }).catch(() => {});
      sendPaymentReceipt(orderRow.customer_email, {
        orderId: String(statusRow.order_id),
        amount: Number(statusRow.amount || orderRow.total || 0),
        paymentId: transactionId,
        eta: etaText,
        details,
      }).catch(() => {});
    } else {
      sendPaymentFailed(orderRow.customer_email, {
        orderId: String(statusRow.order_id),
        amount: Number(statusRow.amount || orderRow.total || 0),
        paymentId: transactionId,
        eta: etaText,
        details,
      }).catch(() => {});
    }
  }

  sendAdminPaymentNotice({
    status: params.status,
    orderId: String(statusRow.order_id),
    amount: Number(statusRow.amount || orderRow.total || 0),
    paymentId: transactionId,
    method: statusRow.method || 'Razorpay',
    customerEmail: orderRow.customer_email,
  }).catch(() => {});

  return { orderId: statusRow.order_id, paymentId: transactionId, status: params.status };
};

const resolveRazorpayStatusToken = async (payment: any, order: any) => {
  const razorpayOrderId = String(payment?.order_id || order?.id || '').trim();
  if (razorpayOrderId) return razorpayOrderId;

  const notes = payment?.notes || {};
  const noteOrderId = String(notes?.brajmart_order_id || notes?.order_id || notes?.orderId || '').trim();
  if (/^\d+$/.test(noteOrderId)) {
    const rows = await dbQuery<any>(
      "SELECT token FROM payment_status WHERE order_id = ? AND method = 'Razorpay' ORDER BY updated_at DESC LIMIT 1",
      [Number(noteOrderId)]
    );
    if (rows[0]?.token) return String(rows[0].token);
  }

  const paymentId = String(payment?.id || '').trim();
  if (paymentId) {
    const rows = await dbQuery<any>('SELECT token FROM payment_status WHERE payment_id = ? LIMIT 1', [paymentId]);
    if (rows[0]?.token) return String(rows[0].token);
  }

  const amountPaise = Number(payment?.amount);
  const createdAt = Number(payment?.created_at || 0);
  if (Number.isFinite(amountPaise) && amountPaise > 0 && Number.isFinite(createdAt) && createdAt > 0) {
    const rows = await dbQuery<any>(
      `SELECT ps.token
       FROM payment_status ps
       JOIN payments p ON p.order_id = ps.order_id
       WHERE ps.status = 'pending'
         AND ps.method = 'Razorpay'
         AND ROUND(p.amount * 100) = ?
         AND p.created_at BETWEEN DATE_SUB(FROM_UNIXTIME(?), INTERVAL 45 MINUTE)
                              AND DATE_ADD(FROM_UNIXTIME(?), INTERVAL 15 MINUTE)
       ORDER BY p.created_at DESC, p.id DESC
       LIMIT 2`,
      [amountPaise, createdAt, createdAt]
    );
    if (rows.length === 1 && rows[0]?.token) return String(rows[0].token);
  }

  return '';
};

router.post('/create-order', razorpayCreateLimiter, optionalAuth, async (req: AuthRequest, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const { keyId, keySecret } = getRazorpayConfig();
    if (!keyId || !keySecret) return res.status(500).json({ message: 'Razorpay credentials are not configured' });

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
    const cod = await resolveCodHandleFee(order, settings);
    const totalsBeforeCoupon = { ...baseTotals, cod: cod.amount, total: baseTotals.total + cod.amount };
    let totals = totalsBeforeCoupon;
    let couponDetails: any = null;
    if (order?.couponCode) {
      const couponResult = await applyCouponToTotals(order.couponCode, priced.items, totalsBeforeCoupon);
      if (!couponResult.valid) return res.status(400).json({ message: couponResult.message });
      totals = { ...totalsBeforeCoupon, total: couponResult.totals.total };
      couponDetails = couponResult.coupon;
    }
    if (settings.minOrderAmount && totals.total < settings.minOrderAmount) {
      return res.status(400).json({ message: `Minimum order amount is ${settings.minOrderAmount}` });
    }
    if (settings.maxOrderQuantity) {
      const totalQty = priced.items.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0);
      if (totalQty > settings.maxOrderQuantity) {
        return res.status(400).json({ message: `Maximum order quantity is ${settings.maxOrderQuantity}` });
      }
    }
    if (amount !== undefined) {
      const clientAmount = Number(amount);
      if (Number.isFinite(clientAmount) && Math.abs(clientAmount - totals.total) > 0.01) {
        return res.status(400).json({ message: 'Cart total changed. Please refresh and try again.' });
      }
    }

    const { max } = await getEtaConfig();
    const estimatedDelivery = getEstimatedDeliveryDate(max);
    const rawUserId = req.user?.id;
    const numericUserId = rawUserId && Number.isFinite(Number(rawUserId)) ? Number(rawUserId) : null;
    const orderRow = await insertOrder({
      ...order,
      userId: numericUserId ?? null,
      items: priced.items,
      itemsSubtotal: totals.itemsSubtotal,
      packagingAmount: totals.packaging,
      packagingRate: settings.packagingRate,
      shippingAmount: totals.shipping,
      codAmount: cod.amount,
      codAvailable: cod.available,
      codPincode: cod.pincode,
      codMessage: cod.message,
      couponCode: couponDetails?.code || null,
      couponDiscount: couponDetails?.discountAmount || 0,
      couponDetails,
      total: totals.total,
      paymentMethod: 'Razorpay',
      status: 'processing',
      statusHistory: [{ status: 'processing', date: new Date().toISOString(), note: 'Payment initiated via Razorpay' }],
      customerEmail,
      shippingAddress: contact.shippingAddress,
      billingAddress: contact.billingAddress,
    }, estimatedDelivery);

    if (numericUserId) {
      const addrToSave = contact.shippingAddress || contact.billingAddress;
      upsertUserDefaultAddress(numericUserId, addrToSave).catch(() => {});
    }

    const amountPaise = Math.round(Number(totals.total) * 100);
    const razorpayOrder = await createRazorpayOrder({
      keyId,
      keySecret,
      amountPaise,
      currency: 'INR',
      receipt: `BM-${orderRow.id}-${Date.now()}`,
      notes: {
        brajmart_order_id: String(orderRow.id),
        customer_email: customerEmail,
      },
    });

    await dbExecute(
      'INSERT INTO payments (order_id, customer_name, customer_email, method, amount, status, transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [orderRow.id, customer.name, customerEmail, 'Razorpay', Number(totals.total), 'pending', razorpayOrder.id]
    );
    await dbExecute(
      'INSERT INTO payment_status (token, status, order_id, amount, method, payment_id) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status), order_id = VALUES(order_id), amount = VALUES(amount), method = VALUES(method), payment_id = VALUES(payment_id), updated_at = NOW()',
      [razorpayOrder.id, 'pending', orderRow.id, Number(totals.total), 'Razorpay', null]
    );

    return res.json({
      keyId,
      orderId: razorpayOrder.id,
      statusToken: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency || 'INR',
      name: 'BrajMart',
      description: `Order #${orderRow.id}`,
      prefill: {
        name: customer.name,
        email: customerEmail,
        contact: customer.phone || '',
      },
    });
  } catch (err: any) {
    return res.status(500).json({ message: err?.message || 'Failed to create Razorpay order' });
  }
});

router.post('/verify', razorpayReportLimiter, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const { keySecret } = getRazorpayConfig();
    if (!keySecret) return res.status(500).json({ message: 'Razorpay credentials are not configured' });

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: 'Missing Razorpay payment details' });
    }

    const expected = hmacSha256(`${razorpay_order_id}|${razorpay_payment_id}`, keySecret);
    if (!timingSafeEqual(expected, String(razorpay_signature))) {
      return res.status(400).json({ message: 'Invalid Razorpay signature' });
    }

    await assertRazorpayPaymentCaptured(String(razorpay_order_id), String(razorpay_payment_id));

    const result = await updateOrderForPayment({
      razorpayOrderId: String(razorpay_order_id),
      razorpayPaymentId: String(razorpay_payment_id),
      status: 'paid',
      note: 'Payment verified via Razorpay checkout signature',
    });
    if (!result) return res.status(404).json({ message: 'Payment not found' });

    return res.json({ ok: true, ...result });
  } catch (err: any) {
    return res.status(500).json({ message: err?.message || 'Failed to verify Razorpay payment' });
  }
});

router.post('/failed', razorpayReportLimiter, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });

    const {
      razorpay_order_id,
      razorpay_payment_id,
      customer_email,
      reason,
    } = req.body || {};

    const razorpayOrderId = String(razorpay_order_id || '').trim();
    const customerEmail = String(customer_email || '').trim().toLowerCase();
    if (!razorpayOrderId || !customerEmail) {
      return res.status(400).json({ message: 'Missing Razorpay order or customer email' });
    }

    const statusRows = await dbQuery<any>('SELECT order_id FROM payment_status WHERE token = ? LIMIT 1', [razorpayOrderId]);
    const statusRow = statusRows[0];
    if (!statusRow?.order_id) return res.status(404).json({ message: 'Payment not found' });

    const orderRows = await dbQuery<any>('SELECT customer_email FROM orders WHERE id = ? LIMIT 1', [statusRow.order_id]);
    const orderEmail = String(orderRows[0]?.customer_email || '').trim().toLowerCase();
    if (!orderEmail || orderEmail !== customerEmail) {
      return res.status(403).json({ message: 'Payment does not match this customer' });
    }

    const capturedPayment = await findCapturedRazorpayPayment(razorpayOrderId, razorpay_payment_id ? String(razorpay_payment_id) : undefined).catch(() => null);
    if (capturedPayment) {
      const result = await updateOrderForPayment({
        razorpayOrderId,
        razorpayPaymentId: String(capturedPayment.id),
        status: 'paid',
        note: 'Payment corrected from Razorpay captured status',
      });
      if (!result) return res.status(404).json({ message: 'Payment not found' });
      return res.json({ ok: true, ...result });
    }

    const noteReason = String(reason || '').trim();
    const result = await updateOrderForPayment({
      razorpayOrderId,
      razorpayPaymentId: razorpay_payment_id ? String(razorpay_payment_id) : undefined,
      status: 'failed',
      note: noteReason ? `Payment failed via Razorpay checkout: ${noteReason}` : 'Payment failed via Razorpay checkout',
    });
    if (!result) return res.status(404).json({ message: 'Payment not found' });

    return res.json({ ok: true, ...result });
  } catch (err: any) {
    return res.status(500).json({ message: err?.message || 'Failed to record Razorpay payment failure' });
  }
});

router.post('/webhook', async (req: any, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const { webhookSecret } = getRazorpayConfig();
    if (!webhookSecret) return res.status(500).json({ message: 'Razorpay webhook secret is not configured' });

    const signature = String(req.headers['x-razorpay-signature'] || '');
    const rawBody = typeof req.rawBody === 'string' ? req.rawBody : JSON.stringify(req.body || {});
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
        razorpayOrderId,
        razorpayPaymentId,
        status: 'paid',
        note: 'Payment confirmed via Razorpay webhook',
      });
    } else if (event === 'payment.failed') {
      const capturedPayment = await findCapturedRazorpayPayment(razorpayOrderId, razorpayPaymentId).catch(() => null);
      if (capturedPayment) {
        await updateOrderForPayment({
          razorpayOrderId,
          razorpayPaymentId: String(capturedPayment.id),
          status: 'paid',
          note: 'Payment corrected from Razorpay captured status',
        });
        return res.json({ ok: true });
      }
      await updateOrderForPayment({
        razorpayOrderId,
        razorpayPaymentId,
        status: 'failed',
        note: 'Payment failed via Razorpay webhook',
      });
    }

    return res.json({ ok: true });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ message: err?.message || 'Webhook processing failed' });
  }
});

export default router;
