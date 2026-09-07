import { Router } from 'express';
import { isDbConnected, dbQuery, dbExecute, withDbTransaction } from '../lib/db';
import { auth, adminOnly, AuthRequest } from '../middleware/auth';
import { parseJson, toIsoString, boolFromDb } from '../lib/dbHelpers';
import { buildProductAuditReport } from '../lib/productDataQuality';
import { actorFromRequest, insertAdminAuditLog } from '../lib/adminAudit';
import { approvedReviewAggregateSql } from '../lib/reviewAggregates';

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

const normalizeRating = (value: any) => {
  if (value === undefined || value === null || value === '') return 0;
  const n = asFiniteNumber(value);
  if (n === null || n < 0 || n > 5) return null;
  return n;
};

const normalizeNonNegativeInt = (value: any, fallback = 0) => {
  if (value === undefined || value === null || value === '') return fallback;
  const n = asFiniteNumber(value);
  if (n === null || n < 0) return null;
  return Math.floor(n);
};

const validateProductCommerceFields = (data: any, opts: { partial?: boolean } = {}) => {
  const partial = Boolean(opts.partial);

  if (!partial || data.price !== undefined) {
    const normalizedPrice = normalizeRequiredMoney(data.price);
    if (normalizedPrice === null) return { ok: false as const, message: 'Price must be greater than 0' };
    data.price = normalizedPrice;
  }

  if (!partial || data.originalPrice !== undefined) {
    data.originalPrice = normalizeMoneyOrNull(data.originalPrice);
  }

  if (data.price !== undefined && data.originalPrice !== undefined && data.originalPrice !== null && data.price > data.originalPrice) {
    return { ok: false as const, message: 'Sale price cannot be higher than MRP' };
  }

  if (!partial || data.rating !== undefined) {
    const rating = normalizeRating(data.rating);
    if (rating === null) return { ok: false as const, message: 'Rating must be between 0 and 5' };
    data.rating = rating;
  }

  if (!partial || data.reviewCount !== undefined) {
    const reviewCount = normalizeNonNegativeInt(data.reviewCount);
    if (reviewCount === null) return { ok: false as const, message: 'Review count cannot be negative' };
    data.reviewCount = reviewCount;
  }

  if (!partial || data.soldCount !== undefined) {
    const soldCount = normalizeNonNegativeInt(data.soldCount);
    if (soldCount === null) return { ok: false as const, message: 'Sold count cannot be negative' };
    data.soldCount = soldCount;
  }

  return { ok: true as const };
};

const normalizeSku = (value: unknown) => String(value ?? '').trim().slice(0, 120);

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

const LIST_CACHE_TTL_MS = 60_000;
const LIST_CACHE_CONTROL = 'public, max-age=60, stale-while-revalidate=300';
let listCache: { at: number; data: any[] } | null = null;
const clearListCache = () => {
  listCache = null;
};

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

const ensureProductSeoColumns = async () => {
  const missing = await getMissingProductColumns(['meta_title', 'meta_description']);
  if (missing.meta_title) {
    await dbExecute('ALTER TABLE products ADD COLUMN meta_title VARCHAR(255) NULL AFTER description');
  }
  if (missing.meta_description) {
    await dbExecute('ALTER TABLE products ADD COLUMN meta_description TEXT NULL AFTER meta_title');
  }
};

const ensureProductCodColumn = async () => {
  const missing = await getMissingProductColumns(['cod_enabled']);
  if (missing.cod_enabled) {
    await dbExecute('ALTER TABLE products ADD COLUMN cod_enabled TINYINT(1) NULL AFTER in_stock');
  }
};

const ensureCategoryCodColumn = async () => {
  const rows = await dbQuery<{ COLUMN_NAME: string }[]>(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'cod_enabled'
     LIMIT 1`
  );
  if (!rows.length) {
    await dbExecute('ALTER TABLE categories ADD COLUMN cod_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER product_count');
  }
};

const ensureCodSchema = async () => {
  await ensureProductCodColumn();
  await ensureCategoryCodColumn();
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

export const mapProductRow = (row: any) => ({
  id: String(row.id),
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
  rating: Number(row.real_review_count || 0) > 0 ? Number(row.real_rating ?? 0) : Number(row.rating ?? 0),
  reviewCount: Number(row.real_review_count || 0) > 0 ? Number(row.real_review_count ?? 0) : Number(row.review_count ?? 0),
  badge: row.badge ?? null,
  tags: parseJson(row.tags, []),
  inStock: boolFromDb(row.in_stock),
  codEnabled: row.cod_enabled === undefined || row.cod_enabled === null ? null : boolFromDb(row.cod_enabled),
  categoryCodEnabled: row.category_cod_enabled === undefined || row.category_cod_enabled === null ? undefined : boolFromDb(row.category_cod_enabled),
  stockQuantity: row.stock_quantity === undefined || row.stock_quantity === null ? null : Number(row.stock_quantity),
  reservedQuantity: row.reserved_quantity === undefined || row.reserved_quantity === null ? 0 : Number(row.reserved_quantity),
  lowStockThreshold: row.low_stock_threshold === undefined || row.low_stock_threshold === null ? 3 : Number(row.low_stock_threshold),
  sku: row.sku ?? '',
  soldCount: Number(row.sold_count ?? 0),
  description: row.description ?? '',
  metaTitle: row.meta_title ?? '',
  metaDescription: row.meta_description ?? '',
  sizes: parseJson(row.sizes, []),
  sizePricing: parseJson(row.size_pricing, []),
  piecePricing: parseJson(row.piece_pricing, []),
  attributes: parseJson(row.attributes, []),
  variantPricing: sanitizeVariantPricing(parseJson(row.variant_pricing, [])),
  colorVariants: sanitizeColorVariants(parseJson(row.color_variants, [])),
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
  archivedAt: toIsoString(row.archived_at),
  archivedBy: row.archived_by || '',
  archiveReason: row.archive_reason || '',
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
  if (data.codEnabled !== undefined) {
    if (data.codEnabled === null || data.codEnabled === '') set('cod_enabled', null);
    else set('cod_enabled', data.codEnabled ? 1 : 0);
  }
  if (data.stockQuantity !== undefined) {
    const n = data.stockQuantity === null || data.stockQuantity === '' ? null : Math.max(0, Math.floor(Number(data.stockQuantity) || 0));
    set('stock_quantity', n);
  }
  if (data.reservedQuantity !== undefined) set('reserved_quantity', Math.max(0, Math.floor(Number(data.reservedQuantity) || 0)));
  if (data.lowStockThreshold !== undefined) set('low_stock_threshold', Math.max(0, Math.floor(Number(data.lowStockThreshold) || 0)));
  if (data.sku !== undefined) set('sku', data.sku);
  if (data.soldCount !== undefined) set('sold_count', data.soldCount);
  if (data.description !== undefined) set('description', data.description);
  if (data.metaTitle !== undefined) set('meta_title', data.metaTitle);
  if (data.metaDescription !== undefined) set('meta_description', data.metaDescription);
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

router.get('/', async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const fresh = req.query.fresh === '1';
    res.setHeader('Cache-Control', fresh ? 'no-store, max-age=0' : LIST_CACHE_CONTROL);
    if (!fresh && listCache && (Date.now() - listCache.at) < LIST_CACHE_TTL_MS) {
      return res.json(listCache.data);
    }
    await ensureProductCategorySchema();
    await ensureProductSeoColumns();
    await ensureCodSchema();
    const rows = await dbQuery<any>(
      `SELECT p.*, c.name AS category_name, c.cod_enabled AS category_cod_enabled, s.name AS subcategory_name, ra.real_rating, ra.real_review_count
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN subcategories s ON p.subcategory_id = s.id
       LEFT JOIN (${approvedReviewAggregateSql}) ra ON ra.product_id = p.id
       WHERE p.archived_at IS NULL
       ORDER BY p.created_at DESC`
    );
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
    const cols = ['meta_title', 'meta_description', 'cod_enabled', 'sizes', 'size_pricing', 'piece_pricing', 'attributes', 'variant_pricing', 'color_variants'];
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

router.get('/audit', auth, adminOnly, async (_req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    await ensureProductCategorySchema();
    await ensureProductSeoColumns();
    await ensureCodSchema();
    const rows = await dbQuery<any>(
      `SELECT p.*, c.name AS category_name, c.cod_enabled AS category_cod_enabled, s.name AS subcategory_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN subcategories s ON p.subcategory_id = s.id
       WHERE p.archived_at IS NULL
       ORDER BY p.created_at DESC`
    );
    res
      .setHeader('Cache-Control', 'no-store, max-age=0')
      .json(buildProductAuditReport(rows));
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Failed to audit products' });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    res.setHeader('Cache-Control', 'no-store');
    await ensureProductCategorySchema();
    await ensureProductSeoColumns();
    await ensureCodSchema();
    const rows = await dbQuery<any>(
      `SELECT p.*, c.name AS category_name, c.cod_enabled AS category_cod_enabled, s.name AS subcategory_name, ra.real_rating, ra.real_review_count
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN subcategories s ON p.subcategory_id = s.id
       LEFT JOIN (${approvedReviewAggregateSql}) ra ON ra.product_id = p.id
       WHERE p.slug = ? AND p.archived_at IS NULL
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
    await ensureProductSeoColumns();
    await ensureCodSchema();

    const data = req.body || {};
    if (data.sku !== undefined) {
      data.sku = normalizeSku(data.sku);
    }
    const commerceValidation = validateProductCommerceFields(data);
    if (!commerceValidation.ok) return res.status(400).json({ message: commerceValidation.message });
    if (data.stockQuantity !== undefined) {
      const stockQuantity = data.stockQuantity === null || data.stockQuantity === '' ? null : Math.floor(Number(data.stockQuantity));
      if (stockQuantity !== null && (!Number.isFinite(stockQuantity) || stockQuantity < 0)) {
        return res.status(400).json({ message: 'Stock quantity cannot be negative.' });
      }
      data.stockQuantity = stockQuantity;
    }
    if (data.lowStockThreshold !== undefined) {
      const lowStockThreshold = Math.floor(Number(data.lowStockThreshold));
      if (!Number.isFinite(lowStockThreshold) || lowStockThreshold < 0) {
        return res.status(400).json({ message: 'Low stock threshold cannot be negative.' });
      }
      data.lowStockThreshold = lowStockThreshold;
    }
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
      'INSERT INTO products (`name`, `slug`, `sku`, `price`, `original_price`, `image`, `images`, `category`, `category_id`, `subcategory_id`, `rating`, `review_count`, `badge`, `tags`, `in_stock`, `stock_quantity`, `low_stock_threshold`, `cod_enabled`, `sold_count`, `description`, `meta_title`, `meta_description`, `sizes`, `size_pricing`, `piece_pricing`, `attributes`, `variant_pricing`, `color_variants`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        data.name,
        data.slug,
        data.sku || null,
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
        data.stockQuantity === undefined ? null : data.stockQuantity,
        data.lowStockThreshold === undefined ? 3 : data.lowStockThreshold,
        data.codEnabled === undefined || data.codEnabled === null || data.codEnabled === '' ? null : data.codEnabled ? 1 : 0,
        data.soldCount ?? 0,
        data.description ?? '',
        data.metaTitle ?? '',
        data.metaDescription ?? '',
        JSON.stringify(data.sizes || []),
        JSON.stringify(data.sizePricing || []),
        JSON.stringify(data.piecePricing || []),
        JSON.stringify(Array.isArray(data.attributes) ? data.attributes : []),
        JSON.stringify(sanitizeVariantPricing(data.variantPricing || [])),
        JSON.stringify(sanitizeColorVariants(data.colorVariants || [])),
      ]
    );

    const insertWithoutVariants = async () => dbExecute(
      'INSERT INTO products (`name`, `slug`, `sku`, `price`, `original_price`, `image`, `images`, `category`, `category_id`, `subcategory_id`, `rating`, `review_count`, `badge`, `tags`, `in_stock`, `stock_quantity`, `low_stock_threshold`, `cod_enabled`, `sold_count`, `description`, `meta_title`, `meta_description`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        data.name,
        data.slug,
        data.sku || null,
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
        data.stockQuantity === undefined ? null : data.stockQuantity,
        data.lowStockThreshold === undefined ? 3 : data.lowStockThreshold,
        data.codEnabled === undefined || data.codEnabled === null || data.codEnabled === '' ? null : data.codEnabled ? 1 : 0,
        data.soldCount ?? 0,
        data.description ?? '',
        data.metaTitle ?? '',
        data.metaDescription ?? '',
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
      `SELECT p.*, c.name AS category_name, c.cod_enabled AS category_cod_enabled, s.name AS subcategory_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN subcategories s ON p.subcategory_id = s.id
       WHERE p.id = ?
       LIMIT 1`,
      [result.insertId]
    );
    clearListCache();
    await insertAdminAuditLog(null, {
      req: req as AuthRequest,
      action: 'PRODUCT_CREATE',
      entityType: 'product',
      entityId: result.insertId,
      after: rows[0],
      reason: 'Product created',
    }).catch(() => {});
    res.status(201).json(mapProductRow(rows[0]));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    await ensureProductCategorySchema();
    await ensureProductSeoColumns();
    await ensureCodSchema();

    const body = req.body || {};
    if (body.sku !== undefined) {
      body.sku = normalizeSku(body.sku);
    }

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

    if (body.stockQuantity !== undefined || body.reservedQuantity !== undefined || body.lowStockThreshold !== undefined) {
      const rows = await dbQuery<any>('SELECT stock_quantity, reserved_quantity, low_stock_threshold FROM products WHERE id = ? LIMIT 1', [req.params.id]);
      const existing = rows?.[0];
      if (!existing) return res.status(404).json({ message: 'Product not found' });
      const stockQuantity = body.stockQuantity === undefined
        ? (existing.stock_quantity === null || existing.stock_quantity === undefined ? null : Number(existing.stock_quantity))
        : (body.stockQuantity === null || body.stockQuantity === '' ? null : Math.floor(Number(body.stockQuantity)));
      const reservedQuantity = body.reservedQuantity === undefined ? Math.max(0, Math.floor(Number(existing.reserved_quantity || 0))) : Math.floor(Number(body.reservedQuantity));
      const lowStockThreshold = body.lowStockThreshold === undefined ? Math.max(0, Math.floor(Number(existing.low_stock_threshold || 0))) : Math.floor(Number(body.lowStockThreshold));
      if (stockQuantity !== null && (!Number.isFinite(stockQuantity) || stockQuantity < 0)) {
        return res.status(400).json({ message: 'Stock quantity cannot be negative.' });
      }
      if (!Number.isFinite(reservedQuantity) || reservedQuantity < 0) {
        return res.status(400).json({ message: 'Reserved quantity cannot be negative.' });
      }
      if (!Number.isFinite(lowStockThreshold) || lowStockThreshold < 0) {
        return res.status(400).json({ message: 'Low stock threshold cannot be negative.' });
      }
      if (stockQuantity !== null && reservedQuantity > stockQuantity) {
        return res.status(400).json({ message: 'Stock quantity cannot be lower than reserved stock.' });
      }
      if (body.stockQuantity !== undefined) body.stockQuantity = stockQuantity;
      if (body.reservedQuantity !== undefined) body.reservedQuantity = reservedQuantity;
      if (body.lowStockThreshold !== undefined) body.lowStockThreshold = lowStockThreshold;
    }

    let existingCommerceRow: any = null;
    if (body.price !== undefined || body.originalPrice !== undefined) {
      const rows = await dbQuery<any>('SELECT price, original_price FROM products WHERE id = ? LIMIT 1', [req.params.id]);
      existingCommerceRow = rows?.[0] || null;
      if (!existingCommerceRow) return res.status(404).json({ message: 'Product not found' });
    }

    const commerceValidation = validateProductCommerceFields(body, { partial: true });
    if (!commerceValidation.ok) return res.status(400).json({ message: commerceValidation.message });
    if (existingCommerceRow) {
      const nextPrice = body.price !== undefined ? Number(body.price) : Number(existingCommerceRow.price);
      const nextOriginalPrice =
        body.originalPrice !== undefined ? body.originalPrice : normalizeMoneyOrNull(existingCommerceRow.original_price);
      if (nextOriginalPrice !== null && Number.isFinite(nextPrice) && nextPrice > nextOriginalPrice) {
        return res.status(400).json({ message: 'Sale price cannot be higher than MRP' });
      }
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

    let beforeProduct: any = null;
    try {
      const beforeRows = await dbQuery<any>('SELECT * FROM products WHERE id = ? LIMIT 1', [req.params.id]);
      beforeProduct = beforeRows[0];
      if (!beforeProduct) return res.status(404).json({ message: 'Product not found' });
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
      `SELECT p.*, c.name AS category_name, c.cod_enabled AS category_cod_enabled, s.name AS subcategory_name
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
    clearListCache();
    await insertAdminAuditLog(null, {
      req: req as AuthRequest,
      action: 'PRODUCT_UPDATE',
      entityType: 'product',
      entityId: req.params.id,
      before: beforeProduct,
      after: rows[0],
      reason: 'Product updated',
    }).catch(() => {});
    res.json(mapProductRow(rows[0]));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', auth, adminOnly, async (req: AuthRequest, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const reason = String(req.body?.reason || req.query.reason || 'Product archived by admin').trim().slice(0, 255);
    const actor = actorFromRequest(req);
    let archived: any = null;
    await withDbTransaction(async (connection) => {
      const [rows] = await connection.execute('SELECT * FROM products WHERE id = ? FOR UPDATE', [req.params.id]);
      const before = (rows as any[])[0];
      if (!before) throw new Error('Product not found');
      if (!before.archived_at) {
        await connection.execute(
          'UPDATE products SET archived_at = NOW(), archived_by = ?, archive_reason = ?, in_stock = 0, updated_at = NOW() WHERE id = ?',
          [actor.adminEmail || actor.adminId || 'admin', reason, req.params.id]
        );
      }
      const [afterRows] = await connection.execute('SELECT * FROM products WHERE id = ? LIMIT 1', [req.params.id]);
      archived = (afterRows as any[])[0];
      await insertAdminAuditLog(connection, {
        req,
        action: 'PRODUCT_ARCHIVE',
        entityType: 'product',
        entityId: req.params.id,
        before,
        after: archived,
        reason,
      });
    });
    clearListCache();
    res.json({ message: 'Product archived', product: mapProductRow(archived) });
  } catch (err: any) {
    const message = err?.message || 'Failed to archive product';
    res.status(message === 'Product not found' ? 404 : 500).json({ message });
  }
});

router.post('/:id/restore', auth, adminOnly, async (req: AuthRequest, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const reason = String(req.body?.reason || 'Product restored by admin').trim().slice(0, 255);
    let restored: any = null;
    await withDbTransaction(async (connection) => {
      const [rows] = await connection.execute('SELECT * FROM products WHERE id = ? FOR UPDATE', [req.params.id]);
      const before = (rows as any[])[0];
      if (!before) throw new Error('Product not found');
      if (!before.name || !before.slug || Number(before.price) <= 0 || !before.image) {
        throw new Error('Cannot restore product until name, slug, price, and image are valid.');
      }
      const [slugRows] = await connection.execute('SELECT id FROM products WHERE slug = ? AND id <> ? AND archived_at IS NULL LIMIT 1', [before.slug, req.params.id]);
      if ((slugRows as any[]).length) throw new Error('Cannot restore product because another active product uses this slug.');
      if (before.sku) {
        const [skuRows] = await connection.execute('SELECT id FROM products WHERE sku = ? AND id <> ? AND archived_at IS NULL LIMIT 1', [before.sku, req.params.id]);
        if ((skuRows as any[]).length) throw new Error('Cannot restore product because another active product uses this SKU.');
      }
      if (before.category_id) {
        const [catRows] = await connection.execute('SELECT id FROM categories WHERE id = ? AND archived_at IS NULL LIMIT 1', [before.category_id]);
        if (!(catRows as any[]).length) throw new Error('Cannot restore product because its category is archived or missing.');
      }
      const stock = before.stock_quantity === null || before.stock_quantity === undefined ? null : Number(before.stock_quantity);
      const reserved = Number(before.reserved_quantity || 0);
      if (stock !== null && (stock < 0 || reserved < 0 || reserved > stock)) {
        throw new Error('Cannot restore product until inventory quantities are valid.');
      }
      await connection.execute(
        'UPDATE products SET archived_at = NULL, archived_by = NULL, archive_reason = NULL, in_stock = IF(stock_quantity IS NULL OR stock_quantity - reserved_quantity > 0, 1, 0), updated_at = NOW() WHERE id = ?',
        [req.params.id]
      );
      const [afterRows] = await connection.execute('SELECT * FROM products WHERE id = ? LIMIT 1', [req.params.id]);
      restored = (afterRows as any[])[0];
      await insertAdminAuditLog(connection, {
        req,
        action: 'PRODUCT_RESTORE',
        entityType: 'product',
        entityId: req.params.id,
        before,
        after: restored,
        reason,
      });
    });
    clearListCache();
    res.json({ message: 'Product restored', product: mapProductRow(restored) });
  } catch (err: any) {
    const message = err?.message || 'Failed to restore product';
    res.status(message === 'Product not found' ? 404 : 400).json({ message });
  }
});

export default router;
