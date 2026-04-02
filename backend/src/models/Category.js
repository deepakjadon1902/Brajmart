const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  icon: { type: String, required: true }, // base64 image or emoji
  color: { type: String, default: '#f59e0b' },
  productCount: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);
