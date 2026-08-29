import { Router } from 'express';
import { auth, adminOnly, AuthRequest } from '../middleware/auth';
import { dbExecute, dbQuery, isDbConnected, withDbTransaction } from '../lib/db';
import { toIsoString } from '../lib/dbHelpers';
import { actorFromRequest, insertAdminAuditLog } from '../lib/adminAudit';

const router = Router();

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

const mapBlogRow = (row: any) => ({
  id: String(row.id),
  _id: String(row.id),
  title: row.title,
  slug: row.slug,
  excerpt: row.excerpt ?? '',
  content: row.content ?? '',
  category: row.category ?? '',
  coverImage: row.cover_image ?? '',
  author: row.author ?? 'BrajMart Team',
  readTime: Number(row.read_time ?? 5),
  status: row.status ?? 'draft',
  archivedAt: toIsoString(row.archived_at),
  archivedBy: row.archived_by || '',
  archiveReason: row.archive_reason || '',
  publishedAt: toIsoString(row.published_at),
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
});

const mapBlogListRow = (row: any) => ({
  id: String(row.id),
  _id: String(row.id),
  title: row.title,
  slug: row.slug,
  excerpt: row.excerpt ?? '',
  category: row.category ?? '',
  coverImage: row.cover_image ?? '',
  author: row.author ?? 'BrajMart Team',
  readTime: Number(row.read_time ?? 5),
  status: row.status ?? 'draft',
  archivedAt: toIsoString(row.archived_at),
  archivedBy: row.archived_by || '',
  archiveReason: row.archive_reason || '',
  publishedAt: toIsoString(row.published_at),
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
});

const buildUpdate = (data: any) => {
  const fields: string[] = [];
  const values: any[] = [];

  const set = (column: string, value: any) => {
    fields.push(`${column} = ?`);
    values.push(value);
  };

  if (data.title !== undefined) set('title', data.title);
  if (data.slug !== undefined) set('slug', data.slug);
  if (data.excerpt !== undefined) set('excerpt', data.excerpt);
  if (data.content !== undefined) set('content', data.content);
  if (data.category !== undefined) set('category', data.category);
  if (data.coverImage !== undefined) set('cover_image', data.coverImage);
  if (data.author !== undefined) set('author', data.author);
  if (data.readTime !== undefined) set('read_time', data.readTime);
  if (data.status !== undefined) set('status', data.status);
  if (data.publishedAt !== undefined) set('published_at', data.publishedAt);

  if (!fields.length) return null;
  fields.push('updated_at = NOW()');
  return { sql: fields.join(', '), values };
};

router.get('/', async (_req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const rows = await dbQuery<any>(
      "SELECT * FROM blogs WHERE status = 'published' AND archived_at IS NULL ORDER BY COALESCE(published_at, created_at) DESC"
    );
    res.json(rows.map(mapBlogListRow));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/admin', auth, adminOnly, async (_req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const rows = await dbQuery<any>('SELECT * FROM blogs ORDER BY created_at DESC');
    res.json(rows.map(mapBlogRow));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/admin/:slug', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const rows = await dbQuery<any>('SELECT * FROM blogs WHERE slug = ? LIMIT 1', [req.params.slug]);
    const row = rows[0];
    if (!row) return res.status(404).json({ message: 'Blog not found' });
    res.json(mapBlogRow(row));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const rows = await dbQuery<any>(
      "SELECT * FROM blogs WHERE slug = ? AND status = 'published' AND archived_at IS NULL LIMIT 1",
      [req.params.slug]
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ message: 'Blog not found' });
    res.json(mapBlogRow(row));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const data = req.body || {};
    const finalSlug = data.slug ? String(data.slug) : slugify(String(data.title || ''));
    if (!data.title) return res.status(400).json({ message: 'Title is required' });
    if (!finalSlug) return res.status(400).json({ message: 'Slug is required' });

    const excerpt =
      data.excerpt !== undefined && data.excerpt !== null
        ? data.excerpt
        : data.content
          ? String(data.content).slice(0, 200)
          : '';

    const status = data.status || 'draft';
    const publishedAt =
      status === 'published' ? data.publishedAt || new Date() : data.publishedAt || null;

    const result: any = await dbExecute(
      'INSERT INTO blogs (title, slug, excerpt, content, category, cover_image, author, read_time, status, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        data.title,
        finalSlug,
        excerpt ?? '',
        data.content ?? '',
        data.category ?? '',
        data.coverImage ?? '',
        data.author ?? 'BrajMart Team',
        data.readTime ?? 5,
        status,
        publishedAt,
      ]
    );

    const rows = await dbQuery<any>('SELECT * FROM blogs WHERE id = ? LIMIT 1', [result.insertId]);
    await insertAdminAuditLog(null, {
      req: req as AuthRequest,
      action: 'BLOG_CREATE',
      entityType: 'blog',
      entityId: result.insertId,
      after: rows[0],
      reason: 'Blog created',
    }).catch(() => {});
    res.status(201).json(mapBlogRow(rows[0]));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const data = req.body || {};
    if (data.title && !data.slug) data.slug = slugify(String(data.title));

    if (data.status === 'published' && data.publishedAt === undefined) {
      data.publishedAt = new Date();
    }
    if (data.status === 'draft' && data.publishedAt === undefined) {
      data.publishedAt = null;
    }

    const update = buildUpdate(data);
    if (!update) return res.status(400).json({ message: 'No fields to update' });

    const beforeRows = await dbQuery<any>('SELECT * FROM blogs WHERE id = ? LIMIT 1', [req.params.id]);
    const before = beforeRows[0];
    if (!before) return res.status(404).json({ message: 'Blog not found' });
    await dbExecute(`UPDATE blogs SET ${update.sql} WHERE id = ?`, [...update.values, req.params.id]);
    const rows = await dbQuery<any>('SELECT * FROM blogs WHERE id = ? LIMIT 1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Blog not found' });
    await insertAdminAuditLog(null, {
      req: req as AuthRequest,
      action: data.status === 'published' && before.status !== 'published' ? 'BLOG_PUBLISH' : 'BLOG_UPDATE',
      entityType: 'blog',
      entityId: req.params.id,
      before,
      after: rows[0],
      reason: 'Blog updated',
    }).catch(() => {});
    res.json(mapBlogRow(rows[0]));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', auth, adminOnly, async (req: AuthRequest, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const reason = String(req.body?.reason || req.query.reason || 'Blog archived by admin').trim().slice(0, 255);
    const actor = actorFromRequest(req);
    let archived: any = null;
    await withDbTransaction(async (connection) => {
      const [rows] = await connection.execute('SELECT * FROM blogs WHERE id = ? FOR UPDATE', [req.params.id]);
      const before = (rows as any[])[0];
      if (!before) throw new Error('Blog not found');
      await connection.execute(
        'UPDATE blogs SET archived_at = COALESCE(archived_at, NOW()), archived_by = ?, archive_reason = ?, updated_at = NOW() WHERE id = ?',
        [actor.adminEmail || actor.adminId || 'admin', reason, req.params.id]
      );
      const [afterRows] = await connection.execute('SELECT * FROM blogs WHERE id = ? LIMIT 1', [req.params.id]);
      archived = (afterRows as any[])[0];
      await insertAdminAuditLog(connection, {
        req,
        action: 'BLOG_ARCHIVE',
        entityType: 'blog',
        entityId: req.params.id,
        before,
        after: archived,
        reason,
      });
    });
    res.json({ message: 'Blog archived', blog: mapBlogRow(archived) });
  } catch (err: any) {
    const message = err?.message || 'Failed to archive blog';
    res.status(message === 'Blog not found' ? 404 : 500).json({ message });
  }
});

router.post('/:id/restore', auth, adminOnly, async (req: AuthRequest, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const reason = String(req.body?.reason || 'Blog restored by admin').trim().slice(0, 255);
    let restored: any = null;
    await withDbTransaction(async (connection) => {
      const [rows] = await connection.execute('SELECT * FROM blogs WHERE id = ? FOR UPDATE', [req.params.id]);
      const before = (rows as any[])[0];
      if (!before) throw new Error('Blog not found');
      if (!before.title || !before.slug || !before.content) throw new Error('Cannot restore blog until title, slug, and content are valid.');
      const [dupes] = await connection.execute('SELECT id FROM blogs WHERE slug = ? AND id <> ? AND archived_at IS NULL LIMIT 1', [before.slug, req.params.id]);
      if ((dupes as any[]).length) throw new Error('Cannot restore blog because another active blog uses this slug.');
      await connection.execute('UPDATE blogs SET archived_at = NULL, archived_by = NULL, archive_reason = NULL, updated_at = NOW() WHERE id = ?', [req.params.id]);
      const [afterRows] = await connection.execute('SELECT * FROM blogs WHERE id = ? LIMIT 1', [req.params.id]);
      restored = (afterRows as any[])[0];
      await insertAdminAuditLog(connection, {
        req,
        action: 'BLOG_RESTORE',
        entityType: 'blog',
        entityId: req.params.id,
        before,
        after: restored,
        reason,
      });
    });
    res.json({ message: 'Blog restored', blog: mapBlogRow(restored) });
  } catch (err: any) {
    const message = err?.message || 'Failed to restore blog';
    res.status(message === 'Blog not found' ? 404 : 400).json({ message });
  }
});

export default router;
