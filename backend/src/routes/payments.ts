import { Router } from 'express';
import Payment from '../models/Payment';
import { isDbConnected } from '../lib/db';
import { memory } from '../lib/memoryStore';
import { auth, adminOnly } from '../middleware/auth';
import { sendPaymentReceipt, sendPaymentFailed } from '../lib/email';
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
      return res.json(updated);
    }
    const payment = await Payment.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    res.json(payment);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
