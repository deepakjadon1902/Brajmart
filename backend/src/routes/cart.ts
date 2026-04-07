import { Router } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { isDbConnected, dbQuery, dbExecute } from '../lib/db';
import { memory } from '../lib/memoryStore';
import { parseJson, toIsoString } from '../lib/dbHelpers';

const router = Router();

const mapCartRow = (row: any) => ({
  _id: String(row.id),
  userId: String(row.user_id),
  items: parseJson(row.items, []),
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
});

router.get('/', auth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!isDbConnected()) {
      const cart = memory.getCartByUser(userId);
      return res.json(cart || { userId, items: [] });
    }
    const rows = await dbQuery<any>('SELECT * FROM carts WHERE user_id = ? LIMIT 1', [userId]);
    const row = rows[0];
    res.json(row ? mapCartRow(row) : { userId, items: [] });
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

    await dbExecute(
      'INSERT INTO carts (user_id, items) VALUES (?, ?) ON DUPLICATE KEY UPDATE items = VALUES(items), updated_at = NOW()',
      [userId, JSON.stringify(items)]
    );
    const rows = await dbQuery<any>('SELECT * FROM carts WHERE user_id = ? LIMIT 1', [userId]);
    res.json(rows[0] ? mapCartRow(rows[0]) : { userId, items: [] });
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
    await dbExecute('UPDATE carts SET items = ?, updated_at = NOW() WHERE user_id = ?', [JSON.stringify([]), userId]);
    const rows = await dbQuery<any>('SELECT * FROM carts WHERE user_id = ? LIMIT 1', [userId]);
    res.json(rows[0] ? mapCartRow(rows[0]) : { userId, items: [] });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
