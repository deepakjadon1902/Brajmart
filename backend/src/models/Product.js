const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  price: { type: Number, required: true },
  originalPrice: { type: Number },
  image: { type: String, required: true },
  category: { type: String, required: true },
  rating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  badge: { type: String, enum: ['new', 'bestseller', 'combo', 'exclusive', null], default: null },
  inStock: { type: Boolean, default: true },
  soldCount: { type: Number, default: 0 },
  description: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
