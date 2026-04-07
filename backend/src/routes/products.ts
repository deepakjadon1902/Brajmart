import { Router } from 'express';
import { isDbConnected, dbQuery, dbExecute } from '../lib/db';
import { memory } from '../lib/memoryStore';
import { auth, adminOnly } from '../middleware/auth';
import { parseJson, toIsoString, boolFromDb } from '../lib/dbHelpers';

const router = Router();

const mapProductRow = (row: any) => ({
  _id: String(row.id),
  name: row.name,
  slug: row.slug,
  price: Number(row.price),
  originalPrice: row.original_price !== null ? Number(row.original_price) : undefined,
  image: row.image,
  category: row.category,
  rating: Number(row.rating ?? 0),
  reviewCount: Number(row.review_count ?? 0),
  badge: row.badge ?? null,
  tags: parseJson(row.tags, []),
  inStock: boolFromDb(row.in_stock),
  soldCount: Number(row.sold_count ?? 0),
  description: row.description ?? '',
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

  if (data.name !== undefined) set('name', data.name);
  if (data.slug !== undefined) set('slug', data.slug);
  if (data.price !== undefined) set('price', data.price);
  if (data.originalPrice !== undefined) set('original_price', data.originalPrice);
  if (data.image !== undefined) set('image', data.image);
  if (data.category !== undefined) set('category', data.category);
  if (data.rating !== undefined) set('rating', data.rating);
  if (data.reviewCount !== undefined) set('review_count', data.reviewCount);
  if (data.badge !== undefined) set('badge', data.badge);
  if (data.tags !== undefined) set('tags', JSON.stringify(data.tags || []));
  if (data.inStock !== undefined) set('in_stock', data.inStock ? 1 : 0);
  if (data.soldCount !== undefined) set('sold_count', data.soldCount);
  if (data.description !== undefined) set('description', data.description);

  if (!fields.length) return null;
  fields.push('updated_at = NOW()');
  return { sql: fields.join(', '), values };
};

router.get('/', async (_req, res) => {
  try {
    if (!isDbConnected()) return res.json(memory.listProducts());
    const rows = await dbQuery<any>('SELECT * FROM products ORDER BY created_at DESC');
    res.json(rows.map(mapProductRow));
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
    const rows = await dbQuery<any>('SELECT * FROM products WHERE slug = ? LIMIT 1', [req.params.slug]);
    const row = rows[0];
    if (!row) return res.status(404).json({ message: 'Product not found' });
    res.json(mapProductRow(row));
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

    const data = req.body || {};
    const result: any = await dbExecute(
      'INSERT INTO products (name, slug, price, original_price, image, category, rating, review_count, badge, tags, in_stock, sold_count, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        data.name,
        data.slug,
        data.price,
        data.originalPrice ?? null,
        data.image,
        data.category,
        data.rating ?? 0,
        data.reviewCount ?? 0,
        data.badge ?? null,
        JSON.stringify(data.tags || []),
        data.inStock === undefined ? 1 : data.inStock ? 1 : 0,
        data.soldCount ?? 0,
        data.description ?? '',
      ]
    );

    const rows = await dbQuery<any>('SELECT * FROM products WHERE id = ? LIMIT 1', [result.insertId]);
    res.status(201).json(mapProductRow(rows[0]));
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

    const update = buildUpdate(req.body || {});
    if (!update) return res.status(400).json({ message: 'No fields to update' });

    await dbExecute(`UPDATE products SET ${update.sql} WHERE id = ?`, [...update.values, req.params.id]);
    const rows = await dbQuery<any>('SELECT * FROM products WHERE id = ? LIMIT 1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Product not found' });
    res.json(mapProductRow(rows[0]));
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
    await dbExecute('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ message: 'Product deleted' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
