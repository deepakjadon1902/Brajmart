import { Router } from 'express';
import crypto from 'crypto';
import { auth, AuthRequest } from '../middleware/auth';
import { isDbConnected, dbQuery, dbExecute } from '../lib/db';
import { getEtaConfig, getEtaText, getEstimatedDeliveryDate } from '../lib/eta';
import { sendOrderConfirmation, sendPaymentFailed, sendPaymentReceipt, sendAdminPaymentNotice } from '../lib/email';
import { parseJson } from '../lib/dbHelpers';

type PayuDraft = {
  txnid: string;
  createdAt: string;
  amount: number;
  method: 'upi' | 'card';
  customer: { name: string; email: string; phone?: string };
  order: any;
  orderId?: number;
};

const payuDrafts = new Map<string, PayuDraft>();
const createDraft = (draft: PayuDraft) => {
  payuDrafts.set(draft.txnid, draft);
  return draft;
};
const removeDraft = (txnid: string) => {
  const draft = payuDrafts.get(txnid);
  payuDrafts.delete(txnid);
  return draft || null;
};

const router = Router();

const getBackendUrl = () => process.env.BACKEND_URL || process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
const getFrontendUrl = () => process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:8080';

const getPayuConfig = () => {
  const key = process.env.PAYU_KEY;
  const salt = process.env.PAYU_SALT;
  const env = (process.env.PAYU_ENV || 'test').toLowerCase();
  const isLive = env === 'live' || env === 'prod' || env === 'production';
  const actionUrl = isLive ? 'https://secure.payu.in/_payment' : 'https://test.payu.in/_payment';
  return { key, salt, env, actionUrl };
};

const sha512 = (value: string) => crypto.createHash('sha512').update(value).digest('hex');

const buildRequestHash = (params: {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
  salt: string;
}) => {
  const udf = [params.udf1, params.udf2, params.udf3, params.udf4, params.udf5].map((v) => v || '');
  const hashString = [
    params.key,
    params.txnid,
    params.amount,
    params.productinfo,
    params.firstname,
    params.email,
    ...udf,
    '', '', '', '', '',
    params.salt,
  ].join('|');
  return sha512(hashString);
};

const buildResponseHash = (params: {
  key: string;
  salt: string;
  status: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
}) => {
  const udf = [params.udf1, params.udf2, params.udf3, params.udf4, params.udf5].map((v) => v || '');
  const hashString = [
    params.salt,
    params.status,
    '', '', '', '', '', '',
    udf[4], udf[3], udf[2], udf[1], udf[0],
    params.email,
    params.firstname,
    params.productinfo,
    params.amount,
    params.txnid,
    params.key,
  ].join('|');
  return sha512(hashString);
};

const buildResponseHashWithAdditionalCharges = (params: {
  key: string;
  salt: string;
  status: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  additionalCharges: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
}) => {
  const udf = [params.udf1, params.udf2, params.udf3, params.udf4, params.udf5].map((v) => v || '');
  const hashString = [
    params.additionalCharges,
    params.salt,
    params.status,
    '', '', '', '', '', '',
    udf[4], udf[3], udf[2], udf[1], udf[0],
    params.email,
    params.firstname,
    params.productinfo,
    params.amount,
    params.txnid,
    params.key,
  ].join('|');
  return sha512(hashString);
};

const insertOrder = async (orderData: any, estimatedDelivery: Date) => {
  const status = orderData.status || 'confirmed';
  const statusHistory = Array.isArray(orderData.statusHistory) && orderData.statusHistory.length
    ? orderData.statusHistory
    : [{ status, date: new Date().toISOString(), note: 'Order placed successfully' }];

  const result: any = await dbExecute(
    'INSERT INTO orders (user_id, items, total, status, customer_name, customer_email, shipping_address, billing_address, payment_method, tracking_id, estimated_delivery, status_history) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      orderData.userId || null,
      JSON.stringify(orderData.items || []),
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

  const orderId = result.insertId;
  const rows = await dbQuery<any>('SELECT * FROM orders WHERE id = ? LIMIT 1', [orderId]);
  return rows[0];
};

router.post('/create-order', auth, async (req: AuthRequest, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const { key, salt, actionUrl } = getPayuConfig();
    if (!key || !salt) return res.status(500).json({ message: 'PayU credentials are not configured' });

    const { amount, method, order, customer } = req.body || {};
    if (!amount || amount <= 0) return res.status(400).json({ message: 'Invalid amount' });
    if (!order || !customer?.email || !customer?.name) return res.status(400).json({ message: 'Missing order details' });

    const txnid = `PAYU-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const productinfo = `BrajMart Order (${Array.isArray(order.items) ? order.items.length : 0} items)`;
    const formattedAmount = Number(amount).toFixed(2);

    const { max } = await getEtaConfig();
    const estimatedDelivery = getEstimatedDeliveryDate(max);
    const rawUserId = req.user?.id;
    const numericUserId = rawUserId && Number.isFinite(Number(rawUserId)) ? Number(rawUserId) : null;
    const orderRow = await insertOrder({
      ...order,
      userId: numericUserId ?? null,
      status: 'processing',
      statusHistory: [{ status: 'processing', date: new Date().toISOString(), note: 'Payment initiated via PayU' }],
    }, estimatedDelivery);

    const orderId = orderRow.id;
    const methodLabel = method === 'card' ? 'PayU Card' : 'PayU UPI';

    await dbExecute(
      'INSERT INTO payments (order_id, customer_name, customer_email, method, amount, status, transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [orderId, customer.name, customer.email, methodLabel, Number(amount), 'pending', txnid]
    );

    await dbExecute(
      'INSERT INTO payment_status (token, status, order_id, amount, method, payment_id) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status), order_id = VALUES(order_id), amount = VALUES(amount), method = VALUES(method), payment_id = VALUES(payment_id), updated_at = NOW()',
      [txnid, 'pending', orderId, Number(amount), methodLabel, null]
    );

    createDraft({
      txnid,
      createdAt: new Date().toISOString(),
      amount: Number(amount),
      method: method === 'card' ? 'card' : 'upi',
      customer: { name: customer.name, email: customer.email, phone: customer.phone },
      order,
      orderId,
    });

    const surl = `${getBackendUrl()}/api/payu/success`;
    const furl = `${getBackendUrl()}/api/payu/failure`;

    const fields: Record<string, string> = {
      key,
      txnid,
      amount: formattedAmount,
      productinfo,
      firstname: customer.name,
      email: customer.email,
      phone: customer.phone || '',
      surl,
      furl,
    };

    if (method === 'upi') fields.pg = 'UPI';
    if (method === 'card') fields.pg = 'CC';

    fields.hash = buildRequestHash({
      key,
      txnid,
      amount: formattedAmount,
      productinfo,
      firstname: customer.name,
      email: customer.email,
      salt,
    });

    res.json({ actionUrl, fields });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Failed to create PayU order' });
  }
});

const normalizePayuStatus = (value: any) => String(value || '').trim().toLowerCase();

const computePayuResponseHash = (payload: any, key: string, salt: string) => {
  const status = normalizePayuStatus(payload.status);
  const txnid = String(payload.txnid || '');
  const amount = String(payload.amount || '');
  const productinfo = String(payload.productinfo || '');
  const firstname = String(payload.firstname || '');
  const email = String(payload.email || '');
  const udf1 = payload.udf1;
  const udf2 = payload.udf2;
  const udf3 = payload.udf3;
  const udf4 = payload.udf4;
  const udf5 = payload.udf5;
  const additionalCharges = payload.additionalCharges;

  if (additionalCharges !== undefined && additionalCharges !== null && String(additionalCharges) !== '') {
    return buildResponseHashWithAdditionalCharges({
      key,
      salt,
      status,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      additionalCharges: String(additionalCharges),
      udf1,
      udf2,
      udf3,
      udf4,
      udf5,
    });
  }

  return buildResponseHash({
    key,
    salt,
    status,
    txnid,
    amount,
    productinfo,
    firstname,
    email,
    udf1,
    udf2,
    udf3,
    udf4,
    udf5,
  });
};

const handlePayuCallback = async (req: any, res: any, statusOverride?: 'success' | 'failure') => {
  const { key, salt } = getPayuConfig();
  if (!key || !salt) return res.status(500).send('PayU not configured');
  if (!isDbConnected()) return res.status(503).send('Database unavailable');

  const payload = req.body?.event_payload ? req.body.event_payload : req.body;

  const status = normalizePayuStatus(statusOverride || payload.status);
  const txnid = payload.txnid;
  const amount = payload.amount;
  const receivedHash = payload.hash;
  const paymentId = payload.mihpayid || payload.payuMoneyId || txnid;

  const computed = computePayuResponseHash({ ...payload, status }, key, salt);

  const frontendUrl = getFrontendUrl();

  if (computed !== receivedHash) {
    return res.redirect(`${frontendUrl}/payment-status/${txnid}`);
  }

  const draft = removeDraft(txnid);
  const statusRows = await dbQuery<any>('SELECT order_id, method, amount FROM payment_status WHERE token = ? LIMIT 1', [txnid]);
  const statusRow = statusRows[0];
  const linkedOrderId = statusRow?.order_id || draft?.orderId;

  const { min, max } = await getEtaConfig();
  const etaText = getEtaText(min, max);
  const estimatedDelivery = getEstimatedDeliveryDate(max);
  const methodLabel = draft?.method === 'card' ? 'PayU Card' : draft?.method === 'upi' ? 'PayU UPI' : (statusRow?.method || 'PayU UPI');

  if (status === 'success') {
    let orderRow: any = null;
    let orderId = linkedOrderId;
    if (orderId) {
      const rows = await dbQuery<any>('SELECT * FROM orders WHERE id = ? LIMIT 1', [orderId]);
      orderRow = rows[0];
    }
    if (!orderRow && draft?.order) {
      orderRow = await insertOrder({ ...draft.order, estimatedDelivery }, estimatedDelivery);
      orderId = orderRow.id;
    }
    if (!orderRow) {
      return res.redirect(`${frontendUrl}/payment-status/${txnid}`);
    }

    const history = parseJson<Array<{ status: string; date: string; note?: string }>>(orderRow.status_history, []);
    history.push({ status: 'confirmed', date: new Date().toISOString(), note: 'Payment successful via PayU' });
    await dbExecute('UPDATE orders SET status = ?, status_history = ?, updated_at = NOW() WHERE id = ?', ['confirmed', JSON.stringify(history), orderId]);
    const refreshedRows = await dbQuery<any>('SELECT * FROM orders WHERE id = ? LIMIT 1', [orderId]);
    orderRow = refreshedRows[0] || orderRow;

    if (orderRow.customer_email) {
      const parsedItems = parseJson(orderRow.items, []);
      const itemsCount = parsedItems.length || 0;
      sendOrderConfirmation(orderRow.customer_email, {
        orderId: String(orderId),
        total: orderRow.total,
        itemsCount,
        eta: etaText,
        items: parsedItems,
        paymentMethod: methodLabel,
        shippingAddress: parseJson(orderRow.shipping_address, {}),
        billingAddress: parseJson(orderRow.billing_address, {}),
      }).catch(() => {});
    }

    const existingPayments = await dbQuery<any>('SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1', [orderId]);
    let payment = existingPayments[0];
    if (payment) {
      await dbExecute('UPDATE payments SET status = ?, transaction_id = ?, updated_at = NOW() WHERE id = ?', ['paid', String(paymentId), payment.id]);
      const paymentRows = await dbQuery<any>('SELECT * FROM payments WHERE id = ? LIMIT 1', [payment.id]);
      payment = paymentRows[0];
    } else {
      const paymentResult: any = await dbExecute(
        'INSERT INTO payments (order_id, customer_name, customer_email, method, amount, status, transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [orderId, orderRow.customer_name || draft?.customer?.name || '', orderRow.customer_email || draft?.customer?.email || '', methodLabel, Number(amount), 'paid', String(paymentId)]
      );
      const paymentRows = await dbQuery<any>('SELECT * FROM payments WHERE id = ? LIMIT 1', [paymentResult.insertId]);
      payment = paymentRows[0];
    }

    if (payment?.customer_email) {
      sendPaymentReceipt(payment.customer_email, {
        orderId: String(orderId),
        amount: payment.amount,
        paymentId: payment.transaction_id,
        eta: etaText,
        details: {
          items: parseJson(orderRow.items, []),
          total: Number(orderRow.total),
          paymentMethod: methodLabel,
          shippingAddress: parseJson(orderRow.shipping_address, {}),
          billingAddress: parseJson(orderRow.billing_address, {}),
        },
      }).catch(() => {});
    }
    sendAdminPaymentNotice({
      status: 'paid',
      orderId: String(orderId),
      amount: payment.amount,
      paymentId: payment.transaction_id,
      method: payment.method,
      customerEmail: payment.customer_email,
    }).catch(() => {});

    await dbExecute(
      'INSERT INTO payment_status (token, status, order_id, amount, method, payment_id) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status), order_id = VALUES(order_id), amount = VALUES(amount), method = VALUES(method), payment_id = VALUES(payment_id), updated_at = NOW()',
      [txnid, 'paid', orderId, payment.amount, payment.method, payment.transaction_id]
    );

    return res.redirect(`${frontendUrl}/payment-status/${txnid}`);
  }

  const failedPayment = {
    orderId: 0,
    customerName: draft?.customer?.name || '',
    customerEmail: draft?.customer?.email || '',
    method: methodLabel,
    amount: Number(amount),
    status: 'failed' as const,
    transactionId: String(paymentId),
  };

  if (linkedOrderId) {
    const rows = await dbQuery<any>('SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1', [linkedOrderId]);
    const existing = rows[0];
    if (existing) {
      await dbExecute('UPDATE payments SET status = ?, transaction_id = ?, updated_at = NOW() WHERE id = ?', ['failed', failedPayment.transactionId, existing.id]);
    } else {
      await dbExecute(
        'INSERT INTO payments (order_id, customer_name, customer_email, method, amount, status, transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [linkedOrderId, failedPayment.customerName, failedPayment.customerEmail, failedPayment.method, failedPayment.amount, 'failed', failedPayment.transactionId]
      );
    }
  } else {
    await dbExecute(
      'INSERT INTO payments (order_id, customer_name, customer_email, method, amount, status, transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [null, failedPayment.customerName, failedPayment.customerEmail, failedPayment.method, failedPayment.amount, 'failed', failedPayment.transactionId]
    );
  }
  await dbExecute(
    'INSERT INTO payment_status (token, status, order_id, amount, method, payment_id) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status), order_id = VALUES(order_id), amount = VALUES(amount), method = VALUES(method), payment_id = VALUES(payment_id), updated_at = NOW()',
    [txnid, 'failed', linkedOrderId || null, Number(amount), methodLabel, String(paymentId)]
  );

  if (linkedOrderId) {
    const rows = await dbQuery<any>('SELECT * FROM orders WHERE id = ? LIMIT 1', [linkedOrderId]);
    const orderRow = rows[0];
    if (orderRow) {
      const history = parseJson<Array<{ status: string; date: string; note?: string }>>(orderRow.status_history, []);
      history.push({ status: 'cancelled', date: new Date().toISOString(), note: 'Payment failed via PayU' });
      await dbExecute('UPDATE orders SET status = ?, status_history = ?, updated_at = NOW() WHERE id = ?', ['cancelled', JSON.stringify(history), linkedOrderId]);
      sendPaymentFailed(orderRow.customer_email, {
        orderId: String(linkedOrderId),
        amount: Number(amount),
        paymentId: String(paymentId),
        eta: etaText,
        details: {
          items: parseJson(orderRow.items, []),
          total: Number(orderRow.total),
          paymentMethod: orderRow.payment_method,
          shippingAddress: parseJson(orderRow.shipping_address, {}),
          billingAddress: parseJson(orderRow.billing_address, {}),
        },
      }).catch(() => {});
    }
  } else if (draft?.customer?.email) {
    sendPaymentFailed(draft.customer.email, { orderId: 'N/A', amount: Number(amount), paymentId: String(paymentId), eta: etaText }).catch(() => {});
  }
  sendAdminPaymentNotice({
    status: 'failed',
    orderId: linkedOrderId ? String(linkedOrderId) : 'N/A',
    amount: Number(amount),
    paymentId: String(paymentId),
    method: methodLabel,
    customerEmail: draft?.customer?.email,
  }).catch(() => {});

  return res.redirect(`${frontendUrl}/payment-status/${txnid}`);
};

router.post('/success', async (req, res) => {
  handlePayuCallback(req, res, 'success').catch((err) => {
    console.error(err);
    res.redirect(`${getFrontendUrl()}/payment-status/${req.body?.txnid || 'unknown'}`);
  });
});

router.post('/failure', async (req, res) => {
  handlePayuCallback(req, res, 'failure').catch((err) => {
    console.error(err);
    res.redirect(`${getFrontendUrl()}/payment-status/${req.body?.txnid || 'unknown'}`);
  });
});

router.post('/webhook', async (req, res) => {
  const { key, salt } = getPayuConfig();
  if (!key || !salt) return res.status(500).json({ message: 'PayU not configured' });
  if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });

  const payload = req.body?.event_payload ? req.body.event_payload : req.body;
  const txnid = payload?.txnid;
  if (!txnid) return res.status(400).json({ message: 'Missing txnid' });

  const status = normalizePayuStatus(payload.status);
  const receivedHash = payload.hash;
  const computed = computePayuResponseHash({ ...payload, status }, key, salt);

  if (!receivedHash || computed !== receivedHash) {
    return res.status(400).json({ message: 'Invalid hash' });
  }

  // This endpoint is meant to auto-confirm/auto-fail payments.
  // Ignore non-terminal statuses (like pending/refund/etc.) so they don't incorrectly mark orders failed.
  if (status !== 'success' && status !== 'failure') {
    return res.status(200).json({ ok: true, ignored: true, status });
  }

  try {
    // Reuse existing callback handler logic, but don't rely on browser redirect.
    await handlePayuCallback({ body: payload }, { redirect: () => undefined }, status === 'success' ? 'success' : status === 'failure' ? 'failure' : undefined);
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ message: err?.message || 'Webhook processing failed' });
  }
});

export default router;
