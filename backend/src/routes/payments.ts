import { Router } from 'express';
import Payment from '../models/Payment';
import PaymentStatus from '../models/PaymentStatus';
import { isDbConnected } from '../lib/db';
import { memory } from '../lib/memoryStore';
import { auth, adminOnly } from '../middleware/auth';
import { sendPaymentReceipt, sendPaymentFailed, sendAdminPaymentNotice } from '../lib/email';
import { getEtaConfig, getEtaText } from '../lib/eta';

const router = Router();

router.get('/', auth, adminOnly, async (_req, res) => {
  try {
    if (!isDbConnected()) return res.json(memory.listPayments());
    const payments = await Payment.find().sort({ createdAt: -1 });
    res.json(payments);
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
    const status = await PaymentStatus.findOne({ token });
    if (!status) return res.status(404).json({ message: 'Payment not found' });
    res.json(status);
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
    const payment = await Payment.create(req.body);
    if (payment.customerEmail) {
      if (payment.status === 'paid') {
        sendPaymentReceipt(payment.customerEmail, { orderId: String(payment.orderId), amount: payment.amount, paymentId: payment.transactionId, eta: etaText }).catch(() => {});
      } else if (payment.status === 'failed') {
        sendPaymentFailed(payment.customerEmail, { orderId: String(payment.orderId), amount: payment.amount, paymentId: payment.transactionId, eta: etaText }).catch(() => {});
      }
    }
    await PaymentStatus.findOneAndUpdate(
      { token: payment.transactionId },
      {
        token: payment.transactionId,
        status: payment.status,
        orderId: payment.orderId,
        amount: payment.amount,
        method: payment.method,
        paymentId: payment.transactionId,
      },
      { upsert: true, new: true }
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
    const payment = await Payment.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (payment) {
      await PaymentStatus.findOneAndUpdate(
        { token: payment.transactionId },
        {
          token: payment.transactionId,
          status: payment.status,
          orderId: payment.orderId,
          amount: payment.amount,
          method: payment.method,
          paymentId: payment.transactionId,
        },
        { upsert: true, new: true }
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
