const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  orderId: { type: Number, required: true },
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true },
  method: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['paid', 'pending', 'failed', 'refunded'], default: 'pending' },
  transactionId: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
