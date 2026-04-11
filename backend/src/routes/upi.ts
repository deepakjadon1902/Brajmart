import { Router } from 'express';
import { isDbConnected, dbQuery, dbExecute } from '../lib/db';
import { sendPaymentReceipt, sendPaymentFailed, sendAdminPaymentNotice } from '../lib/email';
import { getEtaConfig, getEtaText } from '../lib/eta';
import { parseJson } from '../lib/dbHelpers';

const router = Router();

router.post('/webhook', async (req, res) => {
  try {
    const secret = process.env.UPI_WEBHOOK_SECRET;
    if (secret) {
      const header = String(req.headers['x-upi-secret'] || '');
      if (header !== secret) return res.status(401).json({ message: 'Unauthorized' });
    }

    const { token, status, paymentId } = req.body || {};
    if (!token || !status) return res.status(400).json({ message: 'Missing fields' });

    const normalized = String(status).toLowerCase() === 'success' ? 'paid' : String(status).toLowerCase() === 'failed' ? 'failed' : 'pending';
    const { min, max } = await getEtaConfig();
    const etaText = getEtaText(min, max);

    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });

    const rows = await dbQuery<any>('SELECT * FROM payments WHERE transaction_id = ? LIMIT 1', [token]);
    const payment = rows[0];
    if (!payment) return res.status(404).json({ message: 'Payment not found' });

    const newTxnId = paymentId || payment.transaction_id;
    await dbExecute('UPDATE payments SET status = ?, transaction_id = ?, updated_at = NOW() WHERE id = ?', [normalized, newTxnId, payment.id]);

    await dbExecute(
      'INSERT INTO payment_status (token, status, order_id, amount, method, payment_id) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status), order_id = VALUES(order_id), amount = VALUES(amount), method = VALUES(method), payment_id = VALUES(payment_id), updated_at = NOW()',
      [token, normalized, payment.order_id, payment.amount, payment.method, newTxnId]
    );

    let orderDetails: any = null;
    if (payment.order_id) {
      const orderRows = await dbQuery<any>('SELECT * FROM orders WHERE id = ? LIMIT 1', [payment.order_id]);
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

    if (payment.customer_email) {
      if (normalized === 'paid') {
        sendPaymentReceipt(payment.customer_email, { orderId: String(payment.order_id), amount: payment.amount, paymentId: newTxnId, eta: etaText, details: orderDetails }).catch(() => {});
      } else if (normalized === 'failed') {
        sendPaymentFailed(payment.customer_email, { orderId: String(payment.order_id), amount: payment.amount, paymentId: newTxnId, eta: etaText, details: orderDetails }).catch(() => {});
      }
    }
    if (normalized === 'paid' || normalized === 'failed') {
      sendAdminPaymentNotice({
        status: normalized as any,
        orderId: String(payment.order_id),
        amount: payment.amount,
        paymentId: newTxnId,
        method: payment.method,
        customerEmail: payment.customer_email,
      }).catch(() => {});
    }

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
