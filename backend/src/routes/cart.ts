import { Router } from 'express';
import Cart from '../models/Cart';
import { auth, AuthRequest } from '../middleware/auth';
import { isDbConnected } from '../lib/db';
import { memory } from '../lib/memoryStore';

const router = Router();

router.get('/', auth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!isDbConnected()) {
      const cart = memory.getCartByUser(userId);
      return res.json(cart || { userId, items: [] });
    }
    const cart = await Cart.findOne({ userId });
    res.json(cart || { userId, items: [] });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/', auth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const items = req.body.items || [];
    if (!isDbConnected()) {
      const cart = memory.upsertCart(userId, items);
      return res.json(cart);
    }
    const cart = await Cart.findOneAndUpdate({ userId }, { items }, { upsert: true, new: true });
    res.json(cart);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/', auth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!isDbConnected()) {
      const cart = memory.clearCart(userId);
      return res.json(cart || { userId, items: [] });
    }
    const cart = await Cart.findOneAndUpdate({ userId }, { items: [] }, { new: true });
    res.json(cart || { userId, items: [] });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
