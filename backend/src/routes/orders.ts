import { Router } from 'express';
import Order from '../models/Order';
import { isDbConnected } from '../lib/db';
import { memory } from '../lib/memoryStore';
import { sendOrderConfirmation, sendShippingUpdate } from '../lib/email';
import { getEtaConfig, getEtaText, getEstimatedDeliveryDate } from '../lib/eta';
import { auth, adminOnly, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/my', auth, async (req: AuthRequest, res) => {
  try {
    if (!isDbConnected()) return res.json(memory.listOrders().filter((o) => o.userId === req.user?.id));
    const orders = await Order.find({ userId: req.user?.id }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/', auth, adminOnly, async (_req, res) => {
  try {
    if (!isDbConnected()) return res.json(memory.listOrders());
    const orders = await Order.find().sort({ createdAt: -1 }).populate('userId', 'name email');
    res.json(orders);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/track/:orderId', async (req, res) => {
  try {
    if (!isDbConnected()) {
      const found = memory.findOrderByOrderId(parseInt(req.params.orderId, 10));
      if (!found) return res.status(404).json({ message: 'Order not found' });
      return res.json(found);
    }
    const order = await Order.findOne({ orderId: parseInt(req.params.orderId, 10) });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', auth, async (req: AuthRequest, res) => {
  try {
    const { min, max } = await getEtaConfig();
    const etaText = getEtaText(min, max);
    const estimatedDelivery = getEstimatedDeliveryDate(max);
    if (!isDbConnected()) {
      const created = memory.createOrder({ ...req.body, userId: req.body.userId || req.user?.id, estimatedDelivery: estimatedDelivery.toISOString() });
      if (created.customerEmail) {
        sendOrderConfirmation(created.customerEmail, { orderId: String(created.orderId), total: created.total, itemsCount: created.items?.length || 0, eta: etaText })
          .catch(() => {});
      }
      return res.status(201).json(created);
    }
    const order = new Order({ ...req.body, userId: req.body.userId || req.user?.id, estimatedDelivery });
    await order.save();
    if (order.customerEmail) {
      sendOrderConfirmation(order.customerEmail, { orderId: String(order.orderId), total: order.total, itemsCount: order.items?.length || 0, eta: etaText })
        .catch(() => {});
    }
    res.status(201).json(order);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id/status', auth, adminOnly, async (req, res) => {
  try {
    const { status, note } = req.body;
    if (!isDbConnected()) {
      const updated = memory.updateOrderStatus(req.params.id, status, note);
      if (!updated) return res.status(404).json({ message: 'Order not found' });
      if (updated.customerEmail) {
        const { min, max } = await getEtaConfig();
        const etaText = getEtaText(min, max);
        sendShippingUpdate(updated.customerEmail, {
          orderId: String(updated.orderId),
          status,
          trackingId: updated.trackingId,
          eta: etaText,
        }).catch(() => {});
      }
      return res.json(updated);
    }
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    order.status = status;
    order.statusHistory.push({ status, date: new Date(), note });
    await order.save();
    if (order.customerEmail) {
      const { min, max } = await getEtaConfig();
      const etaText = getEtaText(min, max);
      sendShippingUpdate(order.customerEmail, {
        orderId: String(order.orderId),
        status,
        trackingId: order.trackingId,
        eta: etaText,
      }).catch(() => {});
    }
    res.json(order);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
