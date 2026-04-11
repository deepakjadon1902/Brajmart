import { Router } from 'express';
import { isDbConnected, dbQuery, dbExecute } from '../lib/db';
import { auth, adminOnly } from '../middleware/auth';
import { sendPaymentReceipt, sendPaymentFailed, sendAdminPaymentNotice } from '../lib/email';
import { getEtaConfig, getEtaText } from '../lib/eta';
import { parseJson, toIsoString } from '../lib/dbHelpers';

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

router.get('/', auth, adminOnly, async (_req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const rows = await dbQuery<any>('SELECT * FROM payments ORDER BY created_at DESC');
    res.json(rows.map(mapPaymentRow));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/status/:token', async (req, res) => {
  try {
    const token = req.params.token;
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const rows = await dbQuery<any>('SELECT * FROM payment_status WHERE token = ? LIMIT 1', [token]);
    if (!rows[0]) return res.status(404).json({ message: 'Payment not found' });
    res.json(mapPaymentStatusRow(rows[0]));
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
