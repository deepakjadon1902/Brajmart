import { Router } from 'express';
import Product from '../models/Product';
import { isDbConnected } from '../lib/db';
import { memory } from '../lib/memoryStore';
import { auth, adminOnly } from '../middleware/auth';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    if (!isDbConnected()) return res.json(memory.listProducts());
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    if (!isDbConnected()) {
      const found = memory.listProducts().find((p) => p.slug === req.params.slug);
      if (!found) return res.status(404).json({ message: 'Product not found' });
      return res.json(found);
    }
    const product = await Product.findOne({ slug: req.params.slug });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) {
      const created = memory.createProduct(req.body);
      return res.status(201).json(created);
    }
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) {
      const updated = memory.updateProduct(req.params.id, req.body);
      if (!updated) return res.status(404).json({ message: 'Product not found' });
      return res.json(updated);
    }
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(product);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) {
      memory.deleteProduct(req.params.id);
      return res.json({ message: 'Product deleted' });
    }
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
