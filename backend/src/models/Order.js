const mongoose = require('mongoose');
const Counter = require('./Counter');

const addressSchema = new mongoose.Schema({
  fullName: String,
  mobile: String,
  street: String,
  city: String,
  state: String,
  pincode: String,
}, { _id: false });

const orderItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name: String,
  image: String,
  quantity: Number,
  price: Number,
}, { _id: false });

const statusHistorySchema = new mongoose.Schema({
  status: String,
  date: { type: Date, default: Date.now },
  note: String,
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderId: { type: Number, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [orderItemSchema],
  total: { type: Number, required: true },
  status: {
    type: String,
    enum: ['confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'],
    default: 'confirmed',
  },
  shippingAddress: addressSchema,
  billingAddress: addressSchema,
  paymentMethod: { type: String, required: true },
  trackingId: String,
  estimatedDelivery: Date,
  statusHistory: [statusHistorySchema],
}, { timestamps: true });

// Auto-increment orderId starting from 10000
orderSchema.pre('save', async function (next) {
  if (this.isNew) {
    const counter = await Counter.findByIdAndUpdate(
      'orderId',
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.orderId = counter.seq;
    this.trackingId = `BM${this.orderId}`;
    this.estimatedDelivery = new Date(Date.now() + 5 * 86400000);
    this.statusHistory = [{ status: this.status, date: new Date(), note: 'Order placed successfully' }];
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
