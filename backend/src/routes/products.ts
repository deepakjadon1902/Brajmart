import { Router } from 'express';
import { isDbConnected, dbQuery, dbExecute } from '../lib/db';
import { auth, adminOnly } from '../middleware/auth';
import { parseJson, toIsoString, boolFromDb } from '../lib/dbHelpers';

const router = Router();

const asFiniteNumber = (value: any) => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

const normalizeMoneyOrNull = (value: any) => {
  if (value === null || value === undefined) return null;
  if (value === '') return null;
  const n = asFiniteNumber(value);
  if (n === null) return null;
  // Treat <= 0 as "unset" for optional fields like MRP.
  if (n <= 0) return null;
  return n;
};

const normalizeRequiredMoney = (value: any) => {
  const n = asFiniteNumber(value);
  if (n === null || n <= 0) return null;
  return n;
};

const isColorSelectionKey = (key: string) => String(key || '').toLowerCase().includes('color');

const sanitizeColorVariants = (input: any) => {
  const list = Array.isArray(input) ? input : [];
  return list
    .map((v: any) => {
      const color = String(v?.color ?? '').trim();
      const images = Array.isArray(v?.images) ? v.images.map((x: any) => String(x ?? '').trim()).filter(Boolean) : [];
      return color ? { color, images } : null;
    })
    .filter(Boolean);
};

const sanitizeVariantPricing = (input: any) => {
  const list = Array.isArray(input) ? input : [];
  return list
    .map((v: any) => {
      const selectionsRaw = v?.selections;
      const selectionsObj =
        selectionsRaw && typeof selectionsRaw === 'object' && !Array.isArray(selectionsRaw)
          ? (selectionsRaw as Record<string, unknown>)
          : {};

      const selections: Record<string, string> = {};
      for (const [k, val] of Object.entries(selectionsObj)) {
        if (isColorSelectionKey(k)) continue; // color never affects price
        const value = val === null || val === undefined ? '' : String(val);
        if (!value.trim()) continue;
        selections[String(k)] = value;
      }

      const price = Number(v?.price);
      if (!Number.isFinite(price) || price <= 0) return null;
      if (Object.keys(selections).length === 0) return null;
      return { selections, price };
    })
    .filter(Boolean);
};

// Pricing + stock must reflect immediately (no client/proxy caching).
const LIST_CACHE_CONTROL = 'no-store';

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

let ensuredCategorySchema = false;
const ensureSubcategoriesTable = async () => {
  await dbExecute(`
    CREATE TABLE IF NOT EXISTS subcategories (
      id INT NOT NULL AUTO_INCREMENT,
      category_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      display_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_subcategories_category_id (category_id),
      UNIQUE KEY uq_subcategories_category_name (category_id, name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
};

const ensureProductCategorySchema = async () => {
  if (ensuredCategorySchema) return;

  const missing = await getMissingProductColumns(['category_id', 'subcategory_id']);

  if (missing.category_id) {
    await dbExecute('ALTER TABLE products ADD COLUMN category_id INT NULL AFTER category');
  }
  if (missing.subcategory_id) {
    await dbExecute('ALTER TABLE products ADD COLUMN subcategory_id INT NULL AFTER category_id');
  }

  await ensureSubcategoriesTable();

  // Backfill category_id for existing products that only have legacy `category` name.
  try {
    await dbExecute(
      `UPDATE products p
       JOIN categories c ON LOWER(TRIM(p.category)) = LOWER(TRIM(c.name))
       SET p.category_id = c.id
       WHERE (p.category_id IS NULL OR p.category_id = 0) AND p.category IS NOT NULL AND p.category <> ''`
    );
  } catch {
    // ignore best-effort backfill errors
  }

  ensuredCategorySchema = true;
};

const ensureProductVariantColumns = async () => {
  const missing = await getMissingProductColumns(['sizes', 'size_pricing', 'piece_pricing', 'attributes', 'variant_pricing', 'color_variants']);

  if (!missing.sizes && !missing.size_pricing && !missing.piece_pricing && !missing.attributes && !missing.variant_pricing && !missing.color_variants) return;

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
  if (missing.color_variants) {
    await dbExecute('ALTER TABLE products ADD COLUMN color_variants JSON NULL AFTER variant_pricing');
  }
};

const variantFieldsProvided = (data: any) =>
  data?.sizes !== undefined ||
  data?.sizePricing !== undefined ||
  data?.piecePricing !== undefined ||
  data?.attributes !== undefined ||
  data?.variantPricing !== undefined ||
  data?.colorVariants !== undefined;

const getMissingVariantColumns = async () =>
  getMissingProductColumns(['sizes', 'size_pricing', 'piece_pricing', 'attributes', 'variant_pricing', 'color_variants']);

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
  categoryId: row.category_id !== undefined && row.category_id !== null ? Number(row.category_id) : undefined,
  subcategoryId: row.subcategory_id !== undefined && row.subcategory_id !== null ? Number(row.subcategory_id) : undefined,
  category: String(row.category_name ?? row.category ?? ''),
  subcategory: row.subcategory_name !== undefined && row.subcategory_name !== null ? String(row.subcategory_name) : (row.subcategory ?? null),
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
  variantPricing: sanitizeVariantPricing(parseJson(row.variant_pricing, [])),
  colorVariants: sanitizeColorVariants(parseJson(row.color_variants, [])),
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
  if (data.categoryId !== undefined || data.category_id !== undefined) {
    const raw = data.categoryId ?? data.category_id;
    const n = raw === null || raw === '' ? null : Number(raw);
    set('category_id', Number.isFinite(n as number) && (n as number) > 0 ? n : null);
  }
  if (data.subcategoryId !== undefined || data.subcategory_id !== undefined) {
    const raw = data.subcategoryId ?? data.subcategory_id;
    const n = raw === null || raw === '' ? null : Number(raw);
    set('subcategory_id', Number.isFinite(n as number) && (n as number) > 0 ? n : null);
  }
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
    const variants = sanitizeVariantPricing(data.variantPricing);
    // Ensure this always hits the DB as a string (works for JSON/LONGTEXT/BLOB columns).
    set('variant_pricing', JSON.stringify(variants));
  }
  if (data.colorVariants !== undefined) {
    const variants = sanitizeColorVariants(data.colorVariants);
    set('color_variants', JSON.stringify(variants));
  }

  if (!fields.length) return null;
  fields.push('updated_at = NOW()');
  return { sql: fields.join(', '), values };
};

router.get('/', async (_req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    res.setHeader('Cache-Control', LIST_CACHE_CONTROL);
    await ensureProductCategorySchema();
    const rows = await dbQuery<any>(
      `SELECT p.*, c.name AS category_name, s.name AS subcategory_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN subcategories s ON p.subcategory_id = s.id
       ORDER BY p.created_at DESC`
    );
    res.json(rows.map(mapProductRow));
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
    const cols = ['sizes', 'size_pricing', 'piece_pricing', 'attributes', 'variant_pricing', 'color_variants'];
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
    res.setHeader('Cache-Control', 'no-store');
    await ensureProductCategorySchema();
    const rows = await dbQuery<any>(
      `SELECT p.*, c.name AS category_name, s.name AS subcategory_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN subcategories s ON p.subcategory_id = s.id
       WHERE p.slug = ?
       LIMIT 1`,
      [req.params.slug]
    );
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
    await ensureProductCategorySchema();

    const data = req.body || {};
    const normalizedPrice = normalizeRequiredMoney(data.price);
    if (normalizedPrice === null) return res.status(400).json({ message: 'Price must be greater than 0' });
    data.price = normalizedPrice;
    data.originalPrice = normalizeMoneyOrNull(data.originalPrice);
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
    if (data.colorVariants === undefined) data.colorVariants = [];

    // Normalize category/subcategory IDs (supports both legacy name-based payloads and new IDs).
    const normalizedCategoryId = (() => {
      const raw = (data.categoryId ?? data.category_id);
      if (raw === undefined || raw === null || raw === '') return null;
      const n = Number(raw);
      return Number.isFinite(n) && n > 0 ? n : null;
    })();
    const normalizedSubcategoryId = (() => {
      const raw = (data.subcategoryId ?? data.subcategory_id);
      if (raw === undefined || raw === null || raw === '') return null;
      const n = Number(raw);
      return Number.isFinite(n) && n > 0 ? n : null;
    })();

    let categoryIdToSave: number | null = normalizedCategoryId;
    if (!categoryIdToSave && typeof data.category === 'string' && data.category.trim()) {
      const rows = await dbQuery<any>('SELECT id FROM categories WHERE name = ? LIMIT 1', [data.category.trim()]);
      const found = rows?.[0]?.id;
      if (found) categoryIdToSave = Number(found);
    }

    const insertWithVariants = async () => dbExecute(
      'INSERT INTO products (`name`, `slug`, `price`, `original_price`, `image`, `images`, `category`, `category_id`, `subcategory_id`, `rating`, `review_count`, `badge`, `tags`, `in_stock`, `sold_count`, `description`, `sizes`, `size_pricing`, `piece_pricing`, `attributes`, `variant_pricing`, `color_variants`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        data.name,
        data.slug,
        data.price,
        data.originalPrice ?? null,
        data.image,
        JSON.stringify(images || []),
        data.category,
        categoryIdToSave,
        normalizedSubcategoryId,
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
        JSON.stringify(Array.isArray(data.attributes) ? data.attributes : []),
        JSON.stringify(sanitizeVariantPricing(data.variantPricing || [])),
        JSON.stringify(sanitizeColorVariants(data.colorVariants || [])),
      ]
    );

    const insertWithoutVariants = async () => dbExecute(
      'INSERT INTO products (`name`, `slug`, `price`, `original_price`, `image`, `images`, `category`, `category_id`, `subcategory_id`, `rating`, `review_count`, `badge`, `tags`, `in_stock`, `sold_count`, `description`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        data.name,
        data.slug,
        data.price,
        data.originalPrice ?? null,
        data.image,
        JSON.stringify(images || []),
        data.category,
        categoryIdToSave,
        normalizedSubcategoryId,
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
        message.includes("Unknown column 'variant_pricing'") ||
        message.includes("Unknown column 'color_variants'")
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

    const rows = await dbQuery<any>(
      `SELECT p.*, c.name AS category_name, s.name AS subcategory_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN subcategories s ON p.subcategory_id = s.id
       WHERE p.id = ?
       LIMIT 1`,
      [result.insertId]
    );
    res.status(201).json(mapProductRow(rows[0]));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    await ensureProductCategorySchema();

    const body = req.body || {};

    const normalizedCategoryId = (() => {
      const raw = (body.categoryId ?? body.category_id);
      if (raw === undefined || raw === null || raw === '') return null;
      const n = Number(raw);
      return Number.isFinite(n) && n > 0 ? n : null;
    })();
    if (normalizedCategoryId !== null) body.categoryId = normalizedCategoryId;

    const normalizedSubcategoryId = (() => {
      const raw = (body.subcategoryId ?? body.subcategory_id);
      if (raw === undefined || raw === null || raw === '') return null;
      const n = Number(raw);
      return Number.isFinite(n) && n > 0 ? n : null;
    })();
    if (normalizedSubcategoryId !== null) body.subcategoryId = normalizedSubcategoryId;

    if (body.category !== undefined && normalizedCategoryId === null && typeof body.category === 'string' && body.category.trim()) {
      const rows = await dbQuery<any>('SELECT id FROM categories WHERE name = ? LIMIT 1', [body.category.trim()]);
      const found = rows?.[0]?.id;
      if (found) body.categoryId = Number(found);
    }

    if (body.price !== undefined) {
      const normalizedPrice = normalizeRequiredMoney(body.price);
      if (normalizedPrice === null) return res.status(400).json({ message: 'Price must be greater than 0' });
      body.price = normalizedPrice;
    }
    if (body.originalPrice !== undefined) {
      body.originalPrice = normalizeMoneyOrNull(body.originalPrice);
    }
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
      if (body.colorVariants === undefined) body.colorVariants = [];
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
        message.includes("Unknown column 'variant_pricing'") ||
        message.includes("Unknown column 'color_variants'")
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
        delete fallbackBody.colorVariants;
        const fallbackUpdate = buildUpdate(fallbackBody);
        if (!fallbackUpdate) return res.status(400).json({ message: 'No fields to update' });
        await dbExecute(`UPDATE products SET ${fallbackUpdate.sql} WHERE id = ?`, [...fallbackUpdate.values, req.params.id]);
      } else {
        throw err;
      }
    }
    const rows = await dbQuery<any>(
      `SELECT p.*, c.name AS category_name, s.name AS subcategory_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN subcategories s ON p.subcategory_id = s.id
       WHERE p.id = ?
       LIMIT 1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Product not found' });

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
    res.json({ message: 'Product deleted' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
