const express = require('express');
const Payment = require('../models/Payment');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

// Get all payments (admin)
router.get('/', auth, adminOnly, async (req, res) => {
  try {
    const payments = await Payment.find().sort({ createdAt: -1 });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create payment
router.post('/', auth, async (req, res) => {
  try {
    const payment = await Payment.create(req.body);
    res.status(201).json(payment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update payment status (admin)
router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const payment = await Payment.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    res.json(payment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
