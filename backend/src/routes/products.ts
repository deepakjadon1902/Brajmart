import { Router } from 'express';
import { isDbConnected, dbQuery, dbExecute } from '../lib/db';
import { auth, adminOnly } from '../middleware/auth';
import { parseJson, toIsoString, boolFromDb } from '../lib/dbHelpers';

const router = Router();

const LIST_CACHE_TTL_MS = 60_000;
const LIST_CACHE_CONTROL = 'public, max-age=60, stale-while-revalidate=300';
let listCache: { at: number; data: any[] } | null = null;

const ensureProductVariantColumns = async () => {
  const rows = await dbQuery<{ COLUMN_NAME: string }[]>(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME IN ('sizes','size_pricing','piece_pricing')"
  );
  const existing = new Set((rows || []).map((r: any) => String(r.COLUMN_NAME || r.column_name || '').toLowerCase()).filter(Boolean));
  const missing = {
    sizes: !existing.has('sizes'),
    size_pricing: !existing.has('size_pricing'),
    piece_pricing: !existing.has('piece_pricing'),
  };

  if (!missing.sizes && !missing.size_pricing && !missing.piece_pricing) return;

  // Add columns in a safe order so AFTER clauses work.
  if (missing.sizes) {
    await dbExecute('ALTER TABLE products ADD COLUMN sizes JSON NULL AFTER description');
  }
  if (missing.size_pricing) {
    await dbExecute('ALTER TABLE products ADD COLUMN size_pricing JSON NULL AFTER sizes');
  }
  if (missing.piece_pricing) {
    await dbExecute('ALTER TABLE products ADD COLUMN piece_pricing JSON NULL AFTER size_pricing');
  }
};

const mapProductRow = (row: any) => ({
  _id: String(row.id),
  name: row.name,
  slug: row.slug,
  price: Number(row.price),
  originalPrice: row.original_price !== null ? Number(row.original_price) : undefined,
  image: row.image,
  images: (() => {
    const parsed = parseJson(row.images, []);
    if (Array.isArray(parsed) && parsed.length) return parsed;
    return row.image ? [row.image] : [];
  })(),
  category: row.category,
  rating: Number(row.rating ?? 0),
  reviewCount: Number(row.review_count ?? 0),
  badge: row.badge ?? null,
  tags: parseJson(row.tags, []),
  inStock: boolFromDb(row.in_stock),
  soldCount: Number(row.sold_count ?? 0),
  description: row.description ?? '',
  sizes: parseJson(row.sizes, []),
  sizePricing: parseJson(row.size_pricing, []),
  piecePricing: parseJson(row.piece_pricing, []),
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
  if (data.images !== undefined) set('images', JSON.stringify(data.images || []));
  if (data.category !== undefined) set('category', data.category);
  if (data.rating !== undefined) set('rating', data.rating);
  if (data.reviewCount !== undefined) set('review_count', data.reviewCount);
  if (data.badge !== undefined) set('badge', data.badge);
  if (data.tags !== undefined) set('tags', JSON.stringify(data.tags || []));
  if (data.inStock !== undefined) set('in_stock', data.inStock ? 1 : 0);
  if (data.soldCount !== undefined) set('sold_count', data.soldCount);
  if (data.description !== undefined) set('description', data.description);
  if (data.sizes !== undefined) set('sizes', JSON.stringify(data.sizes || []));
  if (data.sizePricing !== undefined) set('size_pricing', JSON.stringify(data.sizePricing || []));
  if (data.piecePricing !== undefined) set('piece_pricing', JSON.stringify(data.piecePricing || []));

  if (!fields.length) return null;
  fields.push('updated_at = NOW()');
  return { sql: fields.join(', '), values };
};

router.get('/', async (_req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    res.setHeader('Cache-Control', LIST_CACHE_CONTROL);

    if (listCache && (Date.now() - listCache.at) < LIST_CACHE_TTL_MS) {
      return res.json(listCache.data);
    }
    const rows = await dbQuery<any>('SELECT * FROM products ORDER BY created_at DESC');
    const data = rows.map(mapProductRow);
    listCache = { at: Date.now(), data };
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
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
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });

    const data = req.body || {};
    if (data.sizes !== undefined || data.sizePricing !== undefined || data.piecePricing !== undefined) {
      try {
        await ensureProductVariantColumns();
      } catch {
        // If permissions are restricted, fall back to legacy insert behavior below.
      }
    }
    const images = Array.isArray(data.images) && data.images.length ? data.images : (data.image ? [data.image] : []);

    const insertWithVariants = async () => dbExecute(
      'INSERT INTO products (name, slug, price, original_price, image, images, category, rating, review_count, badge, tags, in_stock, sold_count, description, sizes, size_pricing, piece_pricing) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        data.name,
        data.slug,
        data.price,
        data.originalPrice ?? null,
        data.image,
        JSON.stringify(images || []),
        data.category,
        data.rating ?? 0,
        data.reviewCount ?? 0,
        data.badge ?? null,
        JSON.stringify(data.tags || []),
        data.inStock === undefined ? 1 : data.inStock ? 1 : 0,
        data.soldCount ?? 0,
        data.description ?? '',
        JSON.stringify(data.sizes || []),
        JSON.stringify(data.sizePricing || []),
        JSON.stringify(data.piecePricing || []),
      ]
    );

    const insertWithoutVariants = async () => dbExecute(
      'INSERT INTO products (name, slug, price, original_price, image, images, category, rating, review_count, badge, tags, in_stock, sold_count, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        data.name,
        data.slug,
        data.price,
        data.originalPrice ?? null,
        data.image,
        JSON.stringify(images || []),
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

    let result: any;
    try {
      result = await insertWithVariants();
    } catch (err: any) {
      const message = String(err?.message || '');
      if (
        message.includes("Unknown column 'sizes'") ||
        message.includes("Unknown column 'size_pricing'") ||
        message.includes("Unknown column 'piece_pricing'")
      ) {
        result = await insertWithoutVariants();
      } else {
        throw err;
      }
    }

    const rows = await dbQuery<any>('SELECT * FROM products WHERE id = ? LIMIT 1', [result.insertId]);
    listCache = null;
    res.status(201).json(mapProductRow(rows[0]));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });

    const body = req.body || {};
    if (body.sizes !== undefined || body.sizePricing !== undefined || body.piecePricing !== undefined) {
      try {
        await ensureProductVariantColumns();
      } catch {
        // If permissions are restricted, fall back to legacy update behavior below.
      }
    }

    const update = buildUpdate(body);
    if (!update) return res.status(400).json({ message: 'No fields to update' });

    try {
      await dbExecute(`UPDATE products SET ${update.sql} WHERE id = ?`, [...update.values, req.params.id]);
    } catch (err: any) {
      const message = String(err?.message || '');
      if (
        message.includes("Unknown column 'sizes'") ||
        message.includes("Unknown column 'size_pricing'") ||
        message.includes("Unknown column 'piece_pricing'")
      ) {
        const fallbackBody = { ...(req.body || {}) };
        delete fallbackBody.sizes;
        delete fallbackBody.sizePricing;
        delete fallbackBody.piecePricing;
        const fallbackUpdate = buildUpdate(fallbackBody);
        if (!fallbackUpdate) return res.status(400).json({ message: 'No fields to update' });
        await dbExecute(`UPDATE products SET ${fallbackUpdate.sql} WHERE id = ?`, [...fallbackUpdate.values, req.params.id]);
      } else {
        throw err;
      }
    }
    const rows = await dbQuery<any>('SELECT * FROM products WHERE id = ? LIMIT 1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Product not found' });
    listCache = null;
    res.json(mapProductRow(rows[0]));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    await dbExecute('DELETE FROM products WHERE id = ?', [req.params.id]);
    listCache = null;
    res.json({ message: 'Product deleted' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
