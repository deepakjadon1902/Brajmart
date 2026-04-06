import { Router } from 'express';
import Category from '../models/Category';
import { isDbConnected } from '../lib/db';
import { memory } from '../lib/memoryStore';
import { auth, adminOnly } from '../middleware/auth';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    if (!isDbConnected()) return res.json(memory.listCategories());
    const categories = await Category.find().sort({ createdAt: -1 });
    res.json(categories);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) {
      const created = memory.createCategory(req.body);
      return res.status(201).json(created);
    }
    const category = await Category.create(req.body);
    res.status(201).json(category);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) {
      const updated = memory.updateCategory(req.params.id, req.body);
      if (!updated) return res.status(404).json({ message: 'Category not found' });
      return res.json(updated);
    }
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(category);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) {
      memory.deleteCategory(req.params.id);
      return res.json({ message: 'Category deleted' });
    }
    await Category.findByIdAndDelete(req.params.id);
    res.json({ message: 'Category deleted' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
