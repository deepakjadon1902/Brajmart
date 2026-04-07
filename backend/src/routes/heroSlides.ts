import { Router } from 'express';
import { auth, adminOnly } from '../middleware/auth';
import { dbExecute, dbQuery, isDbConnected } from '../lib/db';

const router = Router();

const mapRow = (row: any) => ({
  id: String(row.id),
  tag: row.tag || '',
  title: row.title || '',
  subtitle: row.subtitle || '',
  cta: row.cta || '',
  image: row.image_url || '',
  overlay: row.overlay || '',
  sortOrder: Number(row.sort_order ?? 0),
  isActive: Boolean(row.is_active),
  createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
  updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
});

router.get('/', async (_req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const rows = await dbQuery<any>('SELECT * FROM hero_slides WHERE is_active = 1 ORDER BY sort_order ASC, id ASC');
    res.json(rows.map(mapRow));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const { tag, title, subtitle, cta, image, overlay, sortOrder, isActive } = req.body || {};
    if (!title || !image) return res.status(400).json({ message: 'Title and image are required' });

    const result: any = await dbExecute(
      'INSERT INTO hero_slides (tag, title, subtitle, cta, image_url, overlay, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [tag || '', title, subtitle || '', cta || '', image, overlay || '', sortOrder ?? 0, isActive === false ? 0 : 1]
    );
    const rows = await dbQuery<any>('SELECT * FROM hero_slides WHERE id = ? LIMIT 1', [result.insertId]);
    res.status(201).json(mapRow(rows[0]));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const { tag, title, subtitle, cta, image, overlay, sortOrder, isActive } = req.body || {};
    await dbExecute(
      'UPDATE hero_slides SET tag = ?, title = ?, subtitle = ?, cta = ?, image_url = ?, overlay = ?, sort_order = ?, is_active = ?, updated_at = NOW() WHERE id = ?',
      [tag || '', title || '', subtitle || '', cta || '', image || '', overlay || '', sortOrder ?? 0, isActive === false ? 0 : 1, req.params.id]
    );
    const rows = await dbQuery<any>('SELECT * FROM hero_slides WHERE id = ? LIMIT 1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Slide not found' });
    res.json(mapRow(rows[0]));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    await dbExecute('DELETE FROM hero_slides WHERE id = ?', [req.params.id]);
    res.json({ message: 'Slide deleted' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
