import { Router } from 'express';
import { isDbConnected, dbQuery, dbExecute } from '../lib/db';
import { auth, adminOnly, AuthRequest } from '../middleware/auth';
import { boolFromDb, toIsoString } from '../lib/dbHelpers';
import { mapProductRow } from './products';
import { insertAdminAuditLog } from '../lib/adminAudit';
import { approvedReviewAggregateSql } from '../lib/reviewAggregates';

const router = Router();

const normalizeSlug = (value: unknown) =>
  String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

const mapCollectionRow = (row: any) => ({
  id: String(row.id),
  slug: row.slug,
  name: row.name,
  description: row.description || '',
  purposeKey: row.purpose_key || '',
  sortOrder: Number(row.sort_order || 0),
  isActive: boolFromDb(row.is_active),
  archivedAt: toIsoString(row.archived_at),
  archivedBy: row.archived_by || '',
  archiveReason: row.archive_reason || '',
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
});

const ensureCollectionsTable = async () => {
  await dbExecute(`
    CREATE TABLE IF NOT EXISTS collections (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      slug VARCHAR(160) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      purpose_key VARCHAR(120) NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_collections_slug (slug),
      KEY idx_collections_active_sort (is_active, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await dbExecute(`
    CREATE TABLE IF NOT EXISTS collection_products (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      collection_id BIGINT UNSIGNED NOT NULL,
      product_id BIGINT UNSIGNED NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_collection_products_item (collection_id, product_id),
      KEY idx_collection_products_collection_sort (collection_id, sort_order),
      KEY idx_collection_products_product (product_id),
      CONSTRAINT fk_collection_products_collection FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
      CONSTRAINT fk_collection_products_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
};

const getCollectionBySlug = async (slug: string, includeInactive = false) => {
  const rows = await dbQuery<any>(
    `SELECT * FROM collections WHERE slug = ? ${includeInactive ? '' : 'AND is_active = 1 AND archived_at IS NULL'} LIMIT 1`,
    [slug]
  );
  return rows[0] || null;
};

const getCollectionProducts = async (collectionId: string | number) => {
  const rows = await dbQuery<any>(
    `SELECT p.*, c.name AS category_name, s.name AS subcategory_name, ra.real_rating, ra.real_review_count
     FROM collection_products cp
     JOIN products p ON p.id = cp.product_id
     LEFT JOIN categories c ON p.category_id = c.id
     LEFT JOIN subcategories s ON p.subcategory_id = s.id
     LEFT JOIN (${approvedReviewAggregateSql}) ra ON ra.product_id = p.id
     WHERE cp.collection_id = ? AND p.archived_at IS NULL
     ORDER BY (cp.sort_order IS NULL OR cp.sort_order = 0) ASC, cp.sort_order ASC, cp.created_at ASC`,
    [collectionId]
  );
  return rows.map(mapProductRow);
};

router.get('/', async (_req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    await ensureCollectionsTable();
    const rows = await dbQuery<any>(
      'SELECT * FROM collections WHERE is_active = 1 AND archived_at IS NULL ORDER BY (sort_order IS NULL OR sort_order = 0) ASC, sort_order ASC, created_at DESC'
    );
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json(rows.map(mapCollectionRow));
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Failed to load collections' });
  }
});

router.get('/admin', auth, adminOnly, async (_req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    await ensureCollectionsTable();
    const rows = await dbQuery<any>(
      'SELECT * FROM collections ORDER BY (sort_order IS NULL OR sort_order = 0) ASC, sort_order ASC, created_at DESC'
    );
    res.json(rows.map(mapCollectionRow));
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Failed to load collections' });
  }
});

router.get('/:slug/products', async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    await ensureCollectionsTable();
    const slug = normalizeSlug(req.params.slug);
    const collection = await getCollectionBySlug(slug);
    if (!collection) return res.status(404).json({ message: 'Collection not found' });
    const products = await getCollectionProducts(collection.id);
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json({ collection: mapCollectionRow(collection), products });
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Failed to load collection products' });
  }
});

router.post('/', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    await ensureCollectionsTable();
    const data = req.body || {};
    const name = String(data.name || '').trim();
    const slug = normalizeSlug(data.slug || name);
    if (!name || !slug) return res.status(400).json({ message: 'Collection name and slug are required' });

    const result: any = await dbExecute(
      `INSERT INTO collections (slug, name, description, purpose_key, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        slug,
        name,
        String(data.description || '').trim(),
        normalizeSlug(data.purposeKey || data.purpose_key || slug),
        Math.max(0, Math.floor(Number(data.sortOrder || data.sort_order || 0))),
        data.isActive === false || data.is_active === false ? 0 : 1,
      ]
    );
    const rows = await dbQuery<any>('SELECT * FROM collections WHERE id = ? LIMIT 1', [result.insertId]);
    await insertAdminAuditLog(null, {
      req: req as AuthRequest,
      action: 'COLLECTION_CREATE',
      entityType: 'collection',
      entityId: result.insertId,
      after: rows[0],
      reason: 'Collection created',
    }).catch(() => {});
    res.status(201).json(mapCollectionRow(rows[0]));
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Failed to create collection' });
  }
});

router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    await ensureCollectionsTable();
    const data = req.body || {};
    const fields: string[] = [];
    const values: any[] = [];
    const set = (column: string, value: any) => {
      fields.push(`${column} = ?`);
      values.push(value);
    };

    if (data.name !== undefined) set('name', String(data.name || '').trim());
    if (data.slug !== undefined) set('slug', normalizeSlug(data.slug));
    if (data.description !== undefined) set('description', String(data.description || '').trim());
    if (data.purposeKey !== undefined || data.purpose_key !== undefined) set('purpose_key', normalizeSlug(data.purposeKey ?? data.purpose_key));
    if (data.sortOrder !== undefined || data.sort_order !== undefined) set('sort_order', Math.max(0, Math.floor(Number(data.sortOrder ?? data.sort_order ?? 0))));
    if (data.isActive !== undefined || data.is_active !== undefined) set('is_active', data.isActive === false || data.is_active === false ? 0 : 1);
    if (!fields.length) return res.status(400).json({ message: 'No collection fields provided' });

    const beforeRows = await dbQuery<any>('SELECT * FROM collections WHERE id = ? LIMIT 1', [req.params.id]);
    const before = beforeRows[0];
    if (!before) return res.status(404).json({ message: 'Collection not found' });
    fields.push('updated_at = NOW()');
    values.push(req.params.id);
    await dbExecute(`UPDATE collections SET ${fields.join(', ')} WHERE id = ?`, values);
    const rows = await dbQuery<any>('SELECT * FROM collections WHERE id = ? LIMIT 1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Collection not found' });
    await insertAdminAuditLog(null, {
      req: req as AuthRequest,
      action: rows[0].is_active ? 'COLLECTION_UPDATE' : 'COLLECTION_DISABLE',
      entityType: 'collection',
      entityId: req.params.id,
      before,
      after: rows[0],
      reason: 'Collection updated',
    }).catch(() => {});
    res.json(mapCollectionRow(rows[0]));
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Failed to update collection' });
  }
});

router.put('/:id/products', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    await ensureCollectionsTable();
    const productIds = Array.isArray(req.body?.productIds) ? req.body.productIds : [];
    if (productIds.length > 120) return res.status(400).json({ message: 'A collection can contain up to 120 products' });

    const before = await dbQuery<any>('SELECT product_id, sort_order FROM collection_products WHERE collection_id = ? ORDER BY sort_order ASC', [req.params.id]);
    await dbExecute('DELETE FROM collection_products WHERE collection_id = ?', [req.params.id]);
    for (const [index, rawId] of productIds.entries()) {
      const productId = Number(rawId);
      if (!Number.isFinite(productId) || productId <= 0) continue;
      await dbExecute(
        'INSERT IGNORE INTO collection_products (collection_id, product_id, sort_order) VALUES (?, ?, ?)',
        [req.params.id, productId, index + 1]
      );
    }
    const collection = await dbQuery<any>('SELECT * FROM collections WHERE id = ? LIMIT 1', [req.params.id]);
    if (!collection[0]) return res.status(404).json({ message: 'Collection not found' });
    await insertAdminAuditLog(null, {
      req: req as AuthRequest,
      action: 'COLLECTION_PRODUCTS_UPDATE',
      entityType: 'collection',
      entityId: req.params.id,
      before,
      after: productIds,
      reason: 'Collection products updated',
    }).catch(() => {});
    res.json({ collection: mapCollectionRow(collection[0]), products: await getCollectionProducts(req.params.id) });
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Failed to update collection products' });
  }
});

export default router;
