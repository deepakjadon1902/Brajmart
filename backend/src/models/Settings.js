const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  storeName: { type: String, default: 'BrajMart' },
  tagline: { type: String, default: 'From Braj, With Love 🙏' },
  currency: { type: String, default: 'INR' },
  freeShippingThreshold: { type: Number, default: 499 },
  shippingFee: { type: Number, default: 49 },
  notifications: {
    orders: { type: Boolean, default: true },
    users: { type: Boolean, default: true },
    payments: { type: Boolean, default: true },
    stock: { type: Boolean, default: false },
  },
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);
