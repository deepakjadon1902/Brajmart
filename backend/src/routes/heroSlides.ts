import { Router } from 'express';
import { auth, adminOnly, AuthRequest } from '../middleware/auth';
import { dbExecute, dbQuery, isDbConnected } from '../lib/db';
import { insertAdminAuditLog } from '../lib/adminAudit';

const router = Router();

const LIST_CACHE_TTL_MS = 60_000;
const LIST_CACHE_CONTROL = 'public, max-age=60, stale-while-revalidate=300';
let listCache: { at: number; data: any[] } | null = null;

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

router.get('/', async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const fresh = req.query.fresh === '1';
    res.setHeader('Cache-Control', fresh ? 'no-store, max-age=0' : LIST_CACHE_CONTROL);
    if (!fresh && listCache && (Date.now() - listCache.at) < LIST_CACHE_TTL_MS) {
      return res.json(listCache.data);
    }
    const rows = await dbQuery<any>('SELECT * FROM hero_slides WHERE is_active = 1 ORDER BY sort_order ASC, id ASC');
    const data = rows.map(mapRow);
    listCache = { at: Date.now(), data };
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', auth, adminOnly, async (req: AuthRequest, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const { tag, title, subtitle, cta, image, overlay, sortOrder, isActive } = req.body || {};
    if (!title || !image) return res.status(400).json({ message: 'Title and image are required' });

    const result: any = await dbExecute(
      'INSERT INTO hero_slides (tag, title, subtitle, cta, image_url, overlay, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [tag || '', title, subtitle || '', cta || '', image, overlay || '', sortOrder ?? 0, isActive === false ? 0 : 1]
    );
    const rows = await dbQuery<any>('SELECT * FROM hero_slides WHERE id = ? LIMIT 1', [result.insertId]);
    await insertAdminAuditLog(null, {
      req,
      action: 'HERO_SLIDE_CREATE',
      entityType: 'hero_slide',
      entityId: result.insertId,
      after: rows[0],
      reason: 'Hero slide created',
    }).catch(() => {});
    listCache = null;
    res.status(201).json(mapRow(rows[0]));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', auth, adminOnly, async (req: AuthRequest, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const { tag, title, subtitle, cta, image, overlay, sortOrder, isActive } = req.body || {};
    const beforeRows = await dbQuery<any>('SELECT * FROM hero_slides WHERE id = ? LIMIT 1', [req.params.id]);
    const before = beforeRows[0];
    if (!before) return res.status(404).json({ message: 'Slide not found' });
    await dbExecute(
      'UPDATE hero_slides SET tag = ?, title = ?, subtitle = ?, cta = ?, image_url = ?, overlay = ?, sort_order = ?, is_active = ?, updated_at = NOW() WHERE id = ?',
      [tag || '', title || '', subtitle || '', cta || '', image || '', overlay || '', sortOrder ?? 0, isActive === false ? 0 : 1, req.params.id]
    );
    const rows = await dbQuery<any>('SELECT * FROM hero_slides WHERE id = ? LIMIT 1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Slide not found' });
    await insertAdminAuditLog(null, {
      req,
      action: rows[0].is_active ? 'HERO_SLIDE_UPDATE' : 'HERO_SLIDE_DISABLE',
      entityType: 'hero_slide',
      entityId: req.params.id,
      before,
      after: rows[0],
      reason: 'Hero slide updated',
    }).catch(() => {});
    listCache = null;
    res.json(mapRow(rows[0]));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', auth, adminOnly, async (req: AuthRequest, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const beforeRows = await dbQuery<any>('SELECT * FROM hero_slides WHERE id = ? LIMIT 1', [req.params.id]);
    const before = beforeRows[0];
    if (!before) return res.status(404).json({ message: 'Slide not found' });
    await dbExecute('UPDATE hero_slides SET is_active = 0, updated_at = NOW() WHERE id = ?', [req.params.id]);
    const rows = await dbQuery<any>('SELECT * FROM hero_slides WHERE id = ? LIMIT 1', [req.params.id]);
    await insertAdminAuditLog(null, {
      req,
      action: 'HERO_SLIDE_DISABLE',
      entityType: 'hero_slide',
      entityId: req.params.id,
      before,
      after: rows[0],
      reason: String(req.body?.reason || req.query.reason || 'Hero slide disabled instead of deleted').slice(0, 255),
    }).catch(() => {});
    listCache = null;
    res.json({ message: 'Slide disabled', slide: mapRow(rows[0]) });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
