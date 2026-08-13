import { Router } from 'express';
import { auth, AuthRequest } from '../middleware/auth';
import { isDbConnected, dbQuery, dbExecute } from '../lib/db';
import { parseJson, toIsoString } from '../lib/dbHelpers';

const router = Router();

const mapWishlistRow = (row: any) => ({
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
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });

    const rows = await dbQuery<any>('SELECT * FROM wishlists WHERE user_id = ? LIMIT 1', [userId]);
    const row = rows[0];
    res.json(row ? mapWishlistRow(row) : { userId, items: [] });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/', auth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });

    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    await dbExecute(
      'INSERT INTO wishlists (user_id, items) VALUES (?, ?) ON DUPLICATE KEY UPDATE items = VALUES(items), updated_at = NOW()',
      [userId, JSON.stringify(items)]
    );

    const rows = await dbQuery<any>('SELECT * FROM wishlists WHERE user_id = ? LIMIT 1', [userId]);
    res.json(rows[0] ? mapWishlistRow(rows[0]) : { userId, items: [] });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/', auth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });

    await dbExecute('UPDATE wishlists SET items = ?, updated_at = NOW() WHERE user_id = ?', [JSON.stringify([]), userId]);
    const rows = await dbQuery<any>('SELECT * FROM wishlists WHERE user_id = ? LIMIT 1', [userId]);
    res.json(rows[0] ? mapWishlistRow(rows[0]) : { userId, items: [] });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
