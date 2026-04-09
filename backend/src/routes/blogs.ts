import { Router } from 'express';
import { auth, adminOnly } from '../middleware/auth';
import { dbExecute, dbQuery, isDbConnected } from '../lib/db';
import { toIsoString } from '../lib/dbHelpers';

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
      "SELECT * FROM blogs WHERE status = 'published' ORDER BY COALESCE(published_at, created_at) DESC"
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
      "SELECT * FROM blogs WHERE slug = ? AND status = 'published' LIMIT 1",
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

    await dbExecute(`UPDATE blogs SET ${update.sql} WHERE id = ?`, [...update.values, req.params.id]);
    const rows = await dbQuery<any>('SELECT * FROM blogs WHERE id = ? LIMIT 1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Blog not found' });
    res.json(mapBlogRow(rows[0]));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    await dbExecute('DELETE FROM blogs WHERE id = ?', [req.params.id]);
    res.json({ message: 'Blog deleted' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
