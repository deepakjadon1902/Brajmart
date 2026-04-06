import { Router } from 'express';
import Payment from '../models/Payment';
import PaymentStatus from '../models/PaymentStatus';
import { isDbConnected } from '../lib/db';
import { memory } from '../lib/memoryStore';
import { sendPaymentReceipt, sendPaymentFailed, sendAdminPaymentNotice } from '../lib/email';
import { getEtaConfig, getEtaText } from '../lib/eta';

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

    if (!isDbConnected()) {
      const payment = memory.listPayments().find((p) => p.transactionId === token);
      if (payment) {
        payment.status = normalized;
        if (paymentId) payment.transactionId = paymentId;
        memory.upsertPaymentStatus(token, {
          status: normalized as any,
          orderId: typeof payment.orderId === 'number' ? payment.orderId : undefined,
          amount: payment.amount,
          method: payment.method,
          paymentId: payment.transactionId,
        });
        if (payment.customerEmail) {
          if (normalized === 'paid') {
            sendPaymentReceipt(payment.customerEmail, { orderId: String(payment.orderId), amount: payment.amount, paymentId: payment.transactionId, eta: etaText }).catch(() => {});
          } else if (normalized === 'failed') {
            sendPaymentFailed(payment.customerEmail, { orderId: String(payment.orderId), amount: payment.amount, paymentId: payment.transactionId, eta: etaText }).catch(() => {});
          }
        }
        if (normalized === 'paid' || normalized === 'failed') {
          sendAdminPaymentNotice({
            status: normalized as any,
            orderId: String(payment.orderId),
            amount: payment.amount,
            paymentId: payment.transactionId,
            method: payment.method,
            customerEmail: payment.customerEmail,
          }).catch(() => {});
        }
      }
      return res.json({ ok: true });
    }

    const payment = await Payment.findOne({ transactionId: token });
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    payment.status = normalized as any;
    if (paymentId) payment.transactionId = paymentId;
    await payment.save();

    await PaymentStatus.findOneAndUpdate(
      { token },
      {
        token,
        status: normalized,
        orderId: payment.orderId,
        amount: payment.amount,
        method: payment.method,
        paymentId: payment.transactionId,
      },
      { upsert: true, new: true }
    );

    if (payment.customerEmail) {
      if (normalized === 'paid') {
        sendPaymentReceipt(payment.customerEmail, { orderId: String(payment.orderId), amount: payment.amount, paymentId: payment.transactionId, eta: etaText }).catch(() => {});
      } else if (normalized === 'failed') {
        sendPaymentFailed(payment.customerEmail, { orderId: String(payment.orderId), amount: payment.amount, paymentId: payment.transactionId, eta: etaText }).catch(() => {});
      }
    }
    if (normalized === 'paid' || normalized === 'failed') {
      sendAdminPaymentNotice({
        status: normalized as any,
        orderId: String(payment.orderId),
        amount: payment.amount,
        paymentId: payment.transactionId,
        method: payment.method,
        customerEmail: payment.customerEmail,
      }).catch(() => {});
    }

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
