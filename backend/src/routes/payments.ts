import { Router } from 'express';
import { isDbConnected, dbQuery, dbExecute } from '../lib/db';
import { memory } from '../lib/memoryStore';
import { auth, adminOnly } from '../middleware/auth';
import { sendPaymentReceipt, sendPaymentFailed, sendAdminPaymentNotice } from '../lib/email';
import { getEtaConfig, getEtaText } from '../lib/eta';
import { toIsoString } from '../lib/dbHelpers';

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
    if (!isDbConnected()) return res.json(memory.listPayments());
    const rows = await dbQuery<any>('SELECT * FROM payments ORDER BY created_at DESC');
    res.json(rows.map(mapPaymentRow));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/status/:token', async (req, res) => {
  try {
    const token = req.params.token;
    if (!isDbConnected()) {
      const status = memory.getPaymentStatus(token);
      if (!status) return res.status(404).json({ message: 'Payment not found' });
      return res.json(status);
    }
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
    if (!isDbConnected()) {
      const created = memory.createPayment(req.body);
      if (created.customerEmail) {
        if (created.status === 'paid') {
          sendPaymentReceipt(created.customerEmail, { orderId: String(created.orderId), amount: created.amount, paymentId: created.transactionId, eta: etaText }).catch(() => {});
        } else if (created.status === 'failed') {
          sendPaymentFailed(created.customerEmail, { orderId: String(created.orderId), amount: created.amount, paymentId: created.transactionId, eta: etaText }).catch(() => {});
        }
      }
      memory.upsertPaymentStatus(created.transactionId, {
        status: created.status as any,
        orderId: typeof created.orderId === 'number' ? created.orderId : undefined,
        amount: created.amount,
        method: created.method,
        paymentId: created.transactionId,
      });
      if (created.status === 'paid' || created.status === 'failed') {
        sendAdminPaymentNotice({
          status: created.status,
          orderId: String(created.orderId),
          amount: created.amount,
          paymentId: created.transactionId,
          method: created.method,
          customerEmail: created.customerEmail,
        }).catch(() => {});
      }
      return res.status(201).json(created);
    }

    const data = req.body || {};
    const result: any = await dbExecute(
      'INSERT INTO payments (order_id, customer_name, customer_email, method, amount, status, transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [data.orderId, data.customerName, data.customerEmail, data.method, data.amount, data.status || 'pending', data.transactionId]
    );

    const rows = await dbQuery<any>('SELECT * FROM payments WHERE id = ? LIMIT 1', [result.insertId]);
    const payment = mapPaymentRow(rows[0]);

    if (payment.customerEmail) {
      if (payment.status === 'paid') {
        sendPaymentReceipt(payment.customerEmail, { orderId: String(payment.orderId), amount: payment.amount, paymentId: payment.transactionId, eta: etaText }).catch(() => {});
      } else if (payment.status === 'failed') {
        sendPaymentFailed(payment.customerEmail, { orderId: String(payment.orderId), amount: payment.amount, paymentId: payment.transactionId, eta: etaText }).catch(() => {});
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
    if (!isDbConnected()) {
      const updated = memory.updatePayment(req.params.id, req.body.status);
      if (!updated) return res.status(404).json({ message: 'Payment not found' });
      memory.upsertPaymentStatus(updated.transactionId, {
        status: updated.status as any,
        orderId: typeof updated.orderId === 'number' ? updated.orderId : undefined,
        amount: updated.amount,
        method: updated.method,
        paymentId: updated.transactionId,
      });
      if (updated.status === 'paid' || updated.status === 'failed') {
        sendAdminPaymentNotice({
          status: updated.status,
          orderId: String(updated.orderId),
          amount: updated.amount,
          paymentId: updated.transactionId,
          method: updated.method,
          customerEmail: updated.customerEmail,
        }).catch(() => {});
      }
      return res.json(updated);
    }

    await dbExecute('UPDATE payments SET status = ?, updated_at = NOW() WHERE id = ?', [req.body.status, req.params.id]);
    const rows = await dbQuery<any>('SELECT * FROM payments WHERE id = ? LIMIT 1', [req.params.id]);
    const payment = rows[0] ? mapPaymentRow(rows[0]) : null;

    if (payment) {
      await dbExecute(
        'INSERT INTO payment_status (token, status, order_id, amount, method, payment_id) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status), order_id = VALUES(order_id), amount = VALUES(amount), method = VALUES(method), payment_id = VALUES(payment_id), updated_at = NOW()',
        [payment.transactionId, payment.status, payment.orderId, payment.amount, payment.method, payment.transactionId]
      );
    }

    if (payment && (payment.status === 'paid' || payment.status === 'failed')) {
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
