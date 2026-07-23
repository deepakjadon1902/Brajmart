import { Router } from 'express';
import { isDbConnected, dbQuery, dbExecute } from '../lib/db';
import { auth, adminOnly } from '../middleware/auth';
import { sendPaymentReceipt, sendPaymentFailed, sendAdminPaymentNotice } from '../lib/email';
import { getEtaConfig, getEtaText } from '../lib/eta';
import { parseJson, toIsoString } from '../lib/dbHelpers';
import crypto from 'crypto';

const router = Router();

const mapPaymentRow = (row: any) => ({
  _id: String(row.id),
  orderId: row.order_id,
  customerName: row.customer_name,
  customerEmail: row.customer_email,
  method: row.method,
  amount: Number(row.amount),
  status: row.status,
  transactionId: row.transaction_id,
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
});

const mapPaymentStatusRow = (row: any) => ({
  token: row.token,
  status: row.status,
  orderId: row.order_id ?? undefined,
  amount: row.amount ?? undefined,
  method: row.method ?? undefined,
  paymentId: row.payment_id ?? undefined,
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
});

const sha512 = (value: string) => crypto.createHash('sha512').update(value).digest('hex');

const getPayuVerifyEndpoint = () => {
  const env = String(process.env.PAYU_ENV || 'test').toLowerCase();
  const isLive = env === 'live' || env === 'prod' || env === 'production';
  // PayU verify_payment endpoint uses form=2.
  return isLive
    ? 'https://info.payu.in/merchant/postservice?form=2'
    : 'https://test.payu.in/merchant/postservice?form=2';
};

const verifyPayuPayment = async (txnid: string) => {
  const key = process.env.PAYU_KEY;
  const salt = process.env.PAYU_SALT;
  if (!key || !salt) return null;

  const command = 'verify_payment';
  const hash = sha512([key, command, txnid, salt].join('|'));

  const body = new URLSearchParams();
  body.set('key', key);
  body.set('command', command);
  body.set('var1', txnid);
  body.set('hash', hash);

  const res = await fetch(getPayuVerifyEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const text = await res.text();
  // PayU returns JSON on this endpoint. If it changes, fail gracefully.
  const parsed = (() => {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  })();
  return parsed;
};

const normalizePayuStatus = (value: any) => String(value || '').trim().toLowerCase();

const getPaymentOrderDetails = async (orderId: any) => {
  if (!orderId) return null;
  const orderRows = await dbQuery<any>('SELECT * FROM orders WHERE id = ? LIMIT 1', [orderId]);
  const orderRow = orderRows[0];
  if (!orderRow) return null;
  return {
    orderRow,
    details: {
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
      paymentMethod: orderRow.payment_method,
      shippingAddress: parseJson(orderRow.shipping_address, {}),
      billingAddress: parseJson(orderRow.billing_address, {}),
    },
  };
};

const reconcilePendingPayuToken = async (token: string) => {
  if (!token) return null;
  if (!isDbConnected()) return null;
  if (!(process.env.PAYU_KEY && process.env.PAYU_SALT)) return null;

  const rows = await dbQuery<any>('SELECT * FROM payment_status WHERE token = ? LIMIT 1', [token]);
  const current = rows[0];
  if (!current) return null;
  if (String(current.status) !== 'pending') return current;

  const verify = await verifyPayuPayment(token);
  const details = verify?.transaction_details?.[token] || verify?.transaction_details?.[String(token)] || null;
  const status = normalizePayuStatus(details?.status);
  const mihpayid = details?.mihpayid || details?.mihpayId || details?.payuid || null;

  if (status !== 'success' && status !== 'failure') return current;

  const nextStatus = status === 'success' ? 'paid' : 'failed';
  const orderId = current.order_id ?? null;
  const amount = current.amount ?? null;
  const method = current.method ?? null;
  const paymentId = mihpayid ? String(mihpayid) : null;

  await dbExecute(
    'UPDATE payment_status SET status = ?, payment_id = COALESCE(?, payment_id), updated_at = NOW() WHERE token = ?',
    [nextStatus, paymentId, token]
  );

  let paymentRow: any = null;
  if (orderId) {
    const paymentRows = await dbQuery<any>('SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1', [orderId]);
    paymentRow = paymentRows[0];
    if (paymentRow) {
      await dbExecute(
        'UPDATE payments SET status = ?, transaction_id = COALESCE(?, transaction_id), updated_at = NOW() WHERE id = ?',
        [nextStatus, paymentId, paymentRow.id]
      );
      const refreshed = await dbQuery<any>('SELECT * FROM payments WHERE id = ? LIMIT 1', [paymentRow.id]);
      paymentRow = refreshed[0] || paymentRow;
    }

    const orderRows = await dbQuery<any>('SELECT * FROM orders WHERE id = ? LIMIT 1', [orderId]);
    const orderRow = orderRows[0];
    if (orderRow) {
      const history = parseJson<Array<{ status: string; date: string; note?: string }>>(orderRow.status_history, []);
      history.push({
        status: nextStatus === 'paid' ? 'confirmed' : 'cancelled',
        date: new Date().toISOString(),
        note: nextStatus === 'paid' ? 'Payment verified via PayU verify_payment' : 'Payment failed (verified via PayU verify_payment)',
      });
      await dbExecute(
        'UPDATE orders SET status = ?, status_history = ?, updated_at = NOW() WHERE id = ?',
        [nextStatus === 'paid' ? 'confirmed' : 'cancelled', JSON.stringify(history), orderId]
      );
    }
  }

  // If PayU callback/webhook was missed, still notify customer/admin.
  try {
    const { min, max } = await getEtaConfig();
    const etaText = getEtaText(min, max);

    if (paymentRow?.customer_email) {
      const orderData = await getPaymentOrderDetails(orderId);
      const orderDetails = orderData?.details || undefined;
      if (nextStatus === 'paid') {
        sendPaymentReceipt(paymentRow.customer_email, { orderId: String(orderId), amount: Number(amount || paymentRow.amount || 0), paymentId: paymentId || paymentRow.transaction_id, eta: etaText, details: orderDetails }).catch(() => {});
      } else {
        sendPaymentFailed(paymentRow.customer_email, { orderId: String(orderId), amount: Number(amount || paymentRow.amount || 0), paymentId: paymentId || paymentRow.transaction_id, eta: etaText, details: orderDetails }).catch(() => {});
      }
    }

    sendAdminPaymentNotice({
      status: nextStatus as 'paid' | 'failed',
      orderId: orderId ? String(orderId) : 'N/A',
      amount: Number(amount || paymentRow?.amount || 0),
      paymentId: paymentId || token,
      method: method || paymentRow?.method,
      customerEmail: paymentRow?.customer_email,
    }).catch(() => {});
  } catch {
    // ignore email failures
  }

  const refreshed = await dbQuery<any>('SELECT * FROM payment_status WHERE token = ? LIMIT 1', [token]);
  return refreshed[0] || current;
};

router.get('/', auth, adminOnly, async (_req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });

    // Automatically reconcile a few most-recent pending PayU payments so admin panel updates automatically.
    if (process.env.PAYU_KEY && process.env.PAYU_SALT) {
      const pending = await dbQuery<any>(
        "SELECT token FROM payment_status WHERE status = 'pending' AND method LIKE 'PayU%' ORDER BY updated_at DESC LIMIT 10"
      );
      for (const row of pending) {
        const token = String(row?.token || '').trim();
        if (!token) continue;
        try {
          await reconcilePendingPayuToken(token);
        } catch {
          // ignore per-token failures
        }
      }
    }

    const rows = await dbQuery<any>('SELECT * FROM payments ORDER BY created_at DESC');
    res.json(rows.map(mapPaymentRow));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/reconcile', auth, adminOnly, async (_req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    if (!(process.env.PAYU_KEY && process.env.PAYU_SALT)) return res.json({ ok: true, reconciled: 0, message: 'PayU credentials not configured' });

    const pending = await dbQuery<any>(
      "SELECT token FROM payment_status WHERE status = 'pending' AND method LIKE 'PayU%' ORDER BY updated_at DESC LIMIT 25"
    );

    let reconciled = 0;
    for (const row of pending) {
      const token = String(row?.token || '').trim();
      if (!token) continue;
      try {
        const beforeRows = await dbQuery<any>('SELECT status FROM payment_status WHERE token = ? LIMIT 1', [token]);
        const before = String(beforeRows?.[0]?.status || '');
        const after = await reconcilePendingPayuToken(token);
        const afterStatus = String(after?.status || '');
        if (before === 'pending' && afterStatus !== 'pending') reconciled += 1;
      } catch {
        // ignore
      }
    }

    return res.json({ ok: true, reconciled });
  } catch (err: any) {
    return res.status(500).json({ message: err?.message || 'Failed to reconcile payments' });
  }
});

router.get('/status/:token', async (req, res) => {
  try {
    const token = req.params.token;
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const rows = await dbQuery<any>('SELECT * FROM payment_status WHERE token = ? LIMIT 1', [token]);
    if (!rows[0]) return res.status(404).json({ message: 'Payment not found' });

    // Auto-reconcile pending PayU payments (no manual verification needed).
    // If webhook is delayed/missed, we verify directly with PayU when the customer views the status page.
    const current = rows[0];
    if (String(current.status) === 'pending' && (process.env.PAYU_KEY && process.env.PAYU_SALT)) {
      try {
        const reconciled = await reconcilePendingPayuToken(token);
        if (reconciled && String(reconciled.status) !== 'pending') return res.json(mapPaymentStatusRow(reconciled));
      } catch {
        // ignore reconciliation errors; fall back to current pending status
      }
    }

    res.json(mapPaymentStatusRow(current));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { min, max } = await getEtaConfig();
    const etaText = getEtaText(min, max);
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });

    const data = req.body || {};
    const result: any = await dbExecute(
      'INSERT INTO payments (order_id, customer_name, customer_email, method, amount, status, transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [data.orderId, data.customerName, data.customerEmail, data.method, data.amount, data.status || 'pending', data.transactionId]
    );

    const rows = await dbQuery<any>('SELECT * FROM payments WHERE id = ? LIMIT 1', [result.insertId]);
    const payment = mapPaymentRow(rows[0]);

    let orderDetails: any = null;
    if (payment.orderId) {
      const orderRows = await dbQuery<any>('SELECT * FROM orders WHERE id = ? LIMIT 1', [payment.orderId]);
      const orderRow = orderRows[0];
      if (orderRow) {
        orderDetails = {
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
          paymentMethod: orderRow.payment_method,
          shippingAddress: parseJson(orderRow.shipping_address, {}),
          billingAddress: parseJson(orderRow.billing_address, {}),
        };
      }
    }

    if (payment.customerEmail) {
      if (payment.status === 'paid') {
        sendPaymentReceipt(payment.customerEmail, { orderId: String(payment.orderId), amount: payment.amount, paymentId: payment.transactionId, eta: etaText, details: orderDetails }).catch(() => {});
      } else if (payment.status === 'failed') {
        sendPaymentFailed(payment.customerEmail, { orderId: String(payment.orderId), amount: payment.amount, paymentId: payment.transactionId, eta: etaText, details: orderDetails }).catch(() => {});
      }
    }

    await dbExecute(
      'INSERT INTO payment_status (token, status, order_id, amount, method, payment_id) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status), order_id = VALUES(order_id), amount = VALUES(amount), method = VALUES(method), payment_id = VALUES(payment_id), updated_at = NOW()',
      [payment.transactionId, payment.status, payment.orderId, payment.amount, payment.method, payment.transactionId]
    );

    if (payment.status === 'paid' || payment.status === 'failed') {
      sendAdminPaymentNotice({
        status: payment.status,
        orderId: String(payment.orderId),
        amount: payment.amount,
        paymentId: payment.transactionId,
        method: payment.method,
        customerEmail: payment.customerEmail,
      }).catch(() => {});
    }

    res.status(201).json(payment);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });

    const { min, max } = await getEtaConfig();
    const etaText = getEtaText(min, max);

    await dbExecute('UPDATE payments SET status = ?, updated_at = NOW() WHERE id = ?', [req.body.status, req.params.id]);
    const rows = await dbQuery<any>('SELECT * FROM payments WHERE id = ? LIMIT 1', [req.params.id]);
    const payment = rows[0] ? mapPaymentRow(rows[0]) : null;

    if (payment) {
      await dbExecute(
        'INSERT INTO payment_status (token, status, order_id, amount, method, payment_id) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status), order_id = VALUES(order_id), amount = VALUES(amount), method = VALUES(method), payment_id = VALUES(payment_id), updated_at = NOW()',
        [payment.transactionId, payment.status, payment.orderId, payment.amount, payment.method, payment.transactionId]
      );
    }

    let orderDetails: any = null;
    if (payment?.orderId) {
      const orderRows = await dbQuery<any>('SELECT * FROM orders WHERE id = ? LIMIT 1', [payment.orderId]);
      const orderRow = orderRows[0];
      if (orderRow) {
        orderDetails = {
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
          paymentMethod: orderRow.payment_method,
          shippingAddress: parseJson(orderRow.shipping_address, {}),
          billingAddress: parseJson(orderRow.billing_address, {}),
        };
      }
    }

    if (payment && (payment.status === 'paid' || payment.status === 'failed')) {
      if (payment.customerEmail) {
        if (payment.status === 'paid') {
          sendPaymentReceipt(payment.customerEmail, { orderId: String(payment.orderId), amount: payment.amount, paymentId: payment.transactionId, eta: etaText, details: orderDetails }).catch(() => {});
        } else {
          sendPaymentFailed(payment.customerEmail, { orderId: String(payment.orderId), amount: payment.amount, paymentId: payment.transactionId, eta: etaText, details: orderDetails }).catch(() => {});
        }
      }
      sendAdminPaymentNotice({
        status: payment.status as 'paid' | 'failed',
        orderId: String(payment.orderId),
        amount: payment.amount,
        paymentId: payment.transactionId,
        method: payment.method,
        customerEmail: payment.customerEmail,
      }).catch(() => {});
    }
    res.json(payment);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
