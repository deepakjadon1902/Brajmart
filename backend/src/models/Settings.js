const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  storeName: { type: String, default: 'BrajMart' },
  tagline: { type: String, default: 'From Braj, With Love 🙏' },
  currency: { type: String, default: 'INR' },
  freeShippingThreshold: { type: Number, default: 499 },
  shippingFee: { type: Number, default: 49 },
  storeEmail: { type: String, default: 'support@brajmart.com' },
  storePhone: { type: String, default: '+91 9876543210' },
  storeAddress: { type: String, default: 'Vrindavan, Mathura, UP 281121, India' },
  taxRate: { type: Number, default: 0 },
  minOrderAmount: { type: Number, default: 0 },
  maxOrderQuantity: { type: Number, default: 10 },
  codEnabled: { type: Boolean, default: true },
  upiEnabled: { type: Boolean, default: true },
  cardEnabled: { type: Boolean, default: true },
  maintenanceMode: { type: Boolean, default: false },
  metaTitle: { type: String, default: 'BrajMart — Authentic Vrindavan Products' },
  metaDescription: { type: String, default: '' },
  storeLogo: { type: String, default: '' },
  socialLinks: {
    instagram: { type: String, default: '' },
    facebook: { type: String, default: '' },
    youtube: { type: String, default: '' },
    whatsapp: { type: String, default: '' },
  },
  announcementBar: {
    enabled: { type: Boolean, default: true },
    messages: [{ type: String }],
  },
  notifications: {
    orders: { type: Boolean, default: true },
    users: { type: Boolean, default: true },
    payments: { type: Boolean, default: true },
    stock: { type: Boolean, default: false },
  },
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);
