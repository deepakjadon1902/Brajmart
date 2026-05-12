import { Router } from 'express';
import { isDbConnected, dbQuery, dbExecute } from '../lib/db';
import { auth, adminOnly } from '../middleware/auth';
import { parseJson, toIsoString, boolFromDb } from '../lib/dbHelpers';

const router = Router();

const LIST_CACHE_TTL_MS = 60_000;
const LIST_CACHE_CONTROL = 'public, max-age=60, stale-while-revalidate=300';
let listCache: { at: number; data: any[] } | null = null;

const getMissingProductColumns = async (cols: string[]) => {
  const rows = await dbQuery<{ COLUMN_NAME: string }[]>(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME IN (${cols.map(() => '?').join(',')})`,
    cols
  );
  const existing = new Set((rows || []).map((r: any) => String(r.COLUMN_NAME || r.column_name || '').toLowerCase()).filter(Boolean));
  const missing: Record<string, boolean> = {};
  for (const c of cols) missing[c] = !existing.has(String(c).toLowerCase());
  return missing;
};

const ensureProductVariantColumns = async () => {
  const missing = await getMissingProductColumns(['sizes', 'size_pricing', 'piece_pricing', 'attributes', 'variant_pricing']);

  if (!missing.sizes && !missing.size_pricing && !missing.piece_pricing && !missing.attributes && !missing.variant_pricing) return;

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
  if (missing.attributes) {
    await dbExecute('ALTER TABLE products ADD COLUMN attributes JSON NULL AFTER piece_pricing');
  }
  if (missing.variant_pricing) {
    await dbExecute('ALTER TABLE products ADD COLUMN variant_pricing JSON NULL AFTER attributes');
  }
};

const variantFieldsProvided = (data: any) =>
  data?.sizes !== undefined ||
  data?.sizePricing !== undefined ||
  data?.piecePricing !== undefined ||
  data?.attributes !== undefined ||
  data?.variantPricing !== undefined;

const getMissingVariantColumns = async () =>
  getMissingProductColumns(['sizes', 'size_pricing', 'piece_pricing', 'attributes', 'variant_pricing']);

const variantSchemaErrorMessage = (missing: Record<string, boolean>) => {
  const missingCols = Object.keys(missing).filter((k) => missing[k]);
  if (!missingCols.length) return null;
  return `Database schema missing product variant columns: ${missingCols.join(', ')}. Run backend/sql/migrate_products_all_variants.sql (safe migration section) and restart the backend.`;
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
  attributes: parseJson(row.attributes, []),
  variantPricing: parseJson(row.variant_pricing, []),
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
});

const buildUpdate = (data: any) => {
  const fields: string[] = [];
  const values: any[] = [];

  const set = (column: string, value: any) => {
    fields.push(`\`${column}\` = ?`);
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
  if (data.attributes !== undefined) {
    const attrs = Array.isArray(data.attributes) ? data.attributes : [];
    // Ensure this always hits the DB as a string (works for JSON/LONGTEXT/BLOB columns).
    set('attributes', JSON.stringify(attrs));
  }
  if (data.variantPricing !== undefined) {
    const variants = Array.isArray(data.variantPricing) ? data.variantPricing : [];
    // Ensure this always hits the DB as a string (works for JSON/LONGTEXT/BLOB columns).
    set('variant_pricing', JSON.stringify(variants));
  }

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

// Admin diagnostic: verify the connected DB schema supports product variants/attributes.
router.get('/schema', auth, adminOnly, async (_req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const dbRow = await dbQuery<any>('SELECT DATABASE() AS db');
    const database = dbRow?.[0]?.db ?? null;
    const cols = ['sizes', 'size_pricing', 'piece_pricing', 'attributes', 'variant_pricing'];
    const missing = await getMissingProductColumns(cols);
    res.json({
      database,
      table: 'products',
      columns: cols.reduce((acc: any, c) => {
        acc[c] = missing[c] ? 'missing' : 'present';
        return acc;
      }, {}),
    });
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Failed to read schema' });
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
    if (process.env.NODE_ENV !== 'production') {
      console.log('POST /products payload keys:', Object.keys(data));
      console.log('POST /products attributes count:', Array.isArray(data.attributes) ? data.attributes.length : 'n/a');
      console.log('POST /products variantPricing count:', Array.isArray(data.variantPricing) ? data.variantPricing.length : 'n/a');
    }
    const wantsVariants = variantFieldsProvided(data);
    if (wantsVariants) {
      try {
        await ensureProductVariantColumns();
      } catch {
        // If permissions are restricted, we'll validate below and return a helpful error
        // instead of silently dropping fields.
      }
    }

    // If schema is missing required columns, fail fast with a clear message.
    if (wantsVariants) {
      const missing = await getMissingVariantColumns();
      const msg = variantSchemaErrorMessage(missing);
      if (msg) return res.status(400).json({ message: msg });
    }
    const images = Array.isArray(data.images) && data.images.length ? data.images : (data.image ? [data.image] : []);

    // Defensive: ensure attribute fields are present if the client sent them, even if empty.
    // This prevents "undefined" from omitting columns in some client payload paths.
    if (data.attributes === undefined) data.attributes = [];
    if (data.variantPricing === undefined) data.variantPricing = [];

    const insertWithVariants = async () => dbExecute(
      'INSERT INTO products (`name`, `slug`, `price`, `original_price`, `image`, `images`, `category`, `rating`, `review_count`, `badge`, `tags`, `in_stock`, `sold_count`, `description`, `sizes`, `size_pricing`, `piece_pricing`, `attributes`, `variant_pricing`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
        JSON.stringify(data.attributes || []),
        JSON.stringify(data.variantPricing || []),
      ]
    );

    const insertWithoutVariants = async () => dbExecute(
      'INSERT INTO products (`name`, `slug`, `price`, `original_price`, `image`, `images`, `category`, `rating`, `review_count`, `badge`, `tags`, `in_stock`, `sold_count`, `description`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
        message.includes("Unknown column 'piece_pricing'") ||
        message.includes("Unknown column 'attributes'") ||
        message.includes("Unknown column 'variant_pricing'")
      ) {
        if (wantsVariants) {
          const missing = await getMissingVariantColumns();
          const msg = variantSchemaErrorMessage(missing) || 'Database schema missing product variant columns. Run the SQL migration and retry.';
          return res.status(400).json({ message: msg });
        }
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
    if (process.env.NODE_ENV !== 'production') {
      console.log('PUT /products payload keys:', Object.keys(body));
      console.log('PUT /products attributes count:', Array.isArray(body.attributes) ? body.attributes.length : 'n/a');
      console.log('PUT /products variantPricing count:', Array.isArray(body.variantPricing) ? body.variantPricing.length : 'n/a');
      if (body.attributes !== undefined) console.log('PUT /products attributes raw:', body.attributes);
      if (body.variantPricing !== undefined) console.log('PUT /products variantPricing raw:', body.variantPricing);
    }
    const wantsVariants = variantFieldsProvided(body);
    if (wantsVariants) {
      try {
        await ensureProductVariantColumns();
      } catch {
        // If permissions are restricted, we'll validate below and return a helpful error
        // instead of silently dropping fields.
      }
    }

    if (wantsVariants) {
      const missing = await getMissingVariantColumns();
      const msg = variantSchemaErrorMessage(missing);
      if (msg) return res.status(400).json({ message: msg });
    }

    // Defensive: always write these columns when the client is doing a variant-enabled save.
    // This guarantees they persist (db will store "[]") and stops them reverting to NULL on refresh.
    if (wantsVariants) {
      if (body.attributes === undefined) body.attributes = [];
      if (body.variantPricing === undefined) body.variantPricing = [];
      if (body.sizes === undefined) body.sizes = [];
      if (body.sizePricing === undefined) body.sizePricing = [];
      if (body.piecePricing === undefined) body.piecePricing = [];
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
        message.includes("Unknown column 'piece_pricing'") ||
        message.includes("Unknown column 'attributes'") ||
        message.includes("Unknown column 'variant_pricing'")
      ) {
        if (wantsVariants) {
          const missing = await getMissingVariantColumns();
          const msg = variantSchemaErrorMessage(missing) || 'Database schema missing product variant columns. Run the SQL migration and retry.';
          return res.status(400).json({ message: msg });
        }
        const fallbackBody = { ...(req.body || {}) };
        delete fallbackBody.sizes;
        delete fallbackBody.sizePricing;
        delete fallbackBody.piecePricing;
        delete fallbackBody.attributes;
        delete fallbackBody.variantPricing;
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

    // Diagnostic: if client attempted to save attributes but DB still returns NULL, surface a clear error.
    // This prevents "success" toasts when the DB schema/permissions/connection is wrong.
    const saved = rows[0];
    const attemptedAttrs = body.attributes !== undefined || body.variantPricing !== undefined;
    if (attemptedAttrs) {
      const attrsNull = saved.attributes === null || saved.attributes === undefined;
      const variantsNull = saved.variant_pricing === null || saved.variant_pricing === undefined;
      if (attrsNull || variantsNull) {
        return res.status(500).json({
          message:
            'Product updated, but custom attributes did not persist to DB. Verify you restarted the backend, the backend is connected to the same database you are checking in phpMyAdmin, and the `products.attributes` / `products.variant_pricing` columns are writable.',
        });
      }
    }
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
