const express = require('express');
const Order = require('../models/Order');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

// Get user orders
router.get('/my', auth, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all orders (admin)
router.get('/', auth, adminOnly, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 }).populate('userId', 'name email');
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Track order by ID (public)
router.get('/track/:orderId', async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: parseInt(req.params.orderId) });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create order
router.post('/', auth, async (req, res) => {
  try {
    const order = new Order({ ...req.body, userId: req.user.id });
    await order.save();
    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update order status (admin)
router.put('/:id/status', auth, adminOnly, async (req, res) => {
  try {
    const { status, note } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    order.status = status;
    order.statusHistory.push({ status, date: new Date(), note });
    await order.save();
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
