import { Router } from 'express';
import { isDbConnected, dbQuery, dbExecute, withDbTransaction } from '../lib/db';
import { auth, adminOnly, AuthRequest } from '../middleware/auth';
import { toIsoString } from '../lib/dbHelpers';
import { actorFromRequest, insertAdminAuditLog } from '../lib/adminAudit';

const router = Router();

const LIST_CACHE_TTL_MS = 60_000;
const LIST_CACHE_CONTROL = 'public, max-age=60, stale-while-revalidate=300';
let listCache: { at: number; data: any[] } | null = null;
const clearListCache = () => {
  listCache = null;
};

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

const mapCategoryRow = (row: any) => ({
  _id: String(row.id),
  name: row.name,
  icon: row.icon,
  color: row.color,
  productCount: Number(row.product_count ?? 0),
  displayOrder: Number(row.display_order ?? 0),
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
  archivedAt: toIsoString(row.archived_at),
  archivedBy: row.archived_by || '',
  archiveReason: row.archive_reason || '',
});

const mapSubcategoryRow = (row: any) => ({
  _id: String(row.id),
  categoryId: String(row.category_id),
  name: row.name,
  displayOrder: Number(row.display_order ?? 0),
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
    fields.push(`${column} = ?`);
    values.push(value);
  };

  if (data.name !== undefined) set('name', data.name);
  if (data.icon !== undefined) set('icon', data.icon);
  if (data.color !== undefined) set('color', data.color);
  if (data.productCount !== undefined) set('product_count', data.productCount);
  if (data.displayOrder !== undefined) set('display_order', data.displayOrder);

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

    await ensureSubcategoriesTable();

    const rows = await dbQuery<any>('SELECT * FROM categories WHERE archived_at IS NULL ORDER BY (display_order IS NULL OR display_order = 0) ASC, display_order ASC, created_at DESC');
    const subRows = await dbQuery<any>('SELECT * FROM subcategories WHERE archived_at IS NULL ORDER BY (display_order IS NULL OR display_order = 0) ASC, display_order ASC, created_at DESC');

    // If "Deity Shringar Collection" is modeled as a subcategory under "Idols & Shringar",
    // hide the legacy category row from the public list (storefront navbar).
    const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();
    const hasDeityAsSub = (() => {
      const idolRow = rows.find((r) => norm(r.name) === norm('Idols & Shringar'));
      if (!idolRow) return false;
      return subRows.some((s) => Number(s.category_id) === Number(idolRow.id) && norm(s.name) === norm('Deity Shringar Collection'));
    })();
    const filteredRows = hasDeityAsSub
      ? rows.filter((r) => norm(r.name) !== norm('Deity Shringar Collection'))
      : rows;

    const subsByCat = new Map<string, any[]>();
    for (const r of subRows) {
      const key = String(r.category_id);
      const list = subsByCat.get(key) || [];
      list.push(mapSubcategoryRow(r));
      subsByCat.set(key, list);
    }

    const data = filteredRows.map((r) => {
      const cat = mapCategoryRow(r);
      return {
        ...cat,
        subcategories: subsByCat.get(String(r.id)) || [],
      };
    });
    listCache = { at: Date.now(), data };
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    await ensureSubcategoriesTable();
    const data = req.body || {};
    const result: any = await dbExecute(
      'INSERT INTO categories (name, icon, color, product_count, display_order) VALUES (?, ?, ?, ?, ?)',
      [data.name, data.icon, data.color ?? '#f59e0b', data.productCount ?? 0, data.displayOrder ?? 0]
    );
    const rows = await dbQuery<any>('SELECT * FROM categories WHERE id = ? LIMIT 1', [result.insertId]);
    clearListCache();
    await insertAdminAuditLog(null, {
      req: req as AuthRequest,
      action: 'CATEGORY_CREATE',
      entityType: 'category',
      entityId: result.insertId,
      after: rows[0],
      reason: 'Category created',
    }).catch(() => {});
    res.status(201).json(mapCategoryRow(rows[0]));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    await ensureSubcategoriesTable();

    const before = await dbQuery<any>('SELECT * FROM categories WHERE id = ? LIMIT 1', [req.params.id]);
    const prev = before?.[0];
    if (!prev) return res.status(404).json({ message: 'Category not found' });

    const update = buildUpdate(req.body || {});
    if (!update) return res.status(400).json({ message: 'No fields to update' });

    await dbExecute(`UPDATE categories SET ${update.sql} WHERE id = ?`, [...update.values, req.params.id]);
    const rows = await dbQuery<any>('SELECT * FROM categories WHERE id = ? LIMIT 1', [req.params.id]);
    const next = rows?.[0];
    if (!next) return res.status(404).json({ message: 'Category not found' });

    // Keep products consistent when a category name changes.
    // Some older products may still rely on legacy `products.category` string.
    const prevName = String(prev.name ?? '').trim();
    const nextName = String(next.name ?? '').trim();
    if (prevName && nextName && prevName !== nextName) {
      try {
        await dbExecute('UPDATE products SET category = ? WHERE category_id = ?', [nextName, req.params.id]);
      } catch {
        // ignore (column permissions/shape may differ in some environments)
      }
      try {
        await dbExecute(
          `UPDATE products
           SET category = ?, category_id = ?
           WHERE (category_id IS NULL OR category_id = 0) AND LOWER(TRIM(category)) = LOWER(TRIM(?))`,
          [nextName, req.params.id, prevName]
        );
      } catch {
        // ignore best-effort update errors
      }
    }

    clearListCache();
    await insertAdminAuditLog(null, {
      req: req as AuthRequest,
      action: 'CATEGORY_UPDATE',
      entityType: 'category',
      entityId: req.params.id,
      before: prev,
      after: next,
      reason: 'Category updated',
    }).catch(() => {});
    res.json(mapCategoryRow(next));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', auth, adminOnly, async (req: AuthRequest, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    await ensureSubcategoriesTable();
    const reason = String(req.body?.reason || req.query.reason || 'Category archived by admin').trim().slice(0, 255);
    const actor = actorFromRequest(req);
    let archived: any = null;
    await withDbTransaction(async (connection) => {
      const [rows] = await connection.execute('SELECT * FROM categories WHERE id = ? FOR UPDATE', [req.params.id]);
      const before = (rows as any[])[0];
      if (!before) throw new Error('Category not found');
      await connection.execute(
        'UPDATE categories SET archived_at = COALESCE(archived_at, NOW()), archived_by = ?, archive_reason = ?, updated_at = NOW() WHERE id = ?',
        [actor.adminEmail || actor.adminId || 'admin', reason, req.params.id]
      );
      await connection.execute(
        'UPDATE subcategories SET archived_at = COALESCE(archived_at, NOW()), archived_by = ?, archive_reason = ?, updated_at = NOW() WHERE category_id = ? AND archived_at IS NULL',
        [actor.adminEmail || actor.adminId || 'admin', `Parent category archived: ${reason}`.slice(0, 255), req.params.id]
      );
      const [afterRows] = await connection.execute('SELECT * FROM categories WHERE id = ? LIMIT 1', [req.params.id]);
      archived = (afterRows as any[])[0];
      await insertAdminAuditLog(connection, {
        req,
        action: 'CATEGORY_ARCHIVE',
        entityType: 'category',
        entityId: req.params.id,
        before,
        after: archived,
        reason,
      });
    });
    clearListCache();
    res.json({ message: 'Category archived', category: mapCategoryRow(archived) });
  } catch (err: any) {
    const message = err?.message || 'Failed to archive category';
    res.status(message === 'Category not found' ? 404 : 500).json({ message });
  }
});

router.post('/:id/restore', auth, adminOnly, async (req: AuthRequest, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const reason = String(req.body?.reason || 'Category restored by admin').trim().slice(0, 255);
    let restored: any = null;
    await withDbTransaction(async (connection) => {
      const [rows] = await connection.execute('SELECT * FROM categories WHERE id = ? FOR UPDATE', [req.params.id]);
      const before = (rows as any[])[0];
      if (!before) throw new Error('Category not found');
      if (!String(before.name || '').trim()) throw new Error('Cannot restore category without a name.');
      const [dupes] = await connection.execute('SELECT id FROM categories WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND id <> ? AND archived_at IS NULL LIMIT 1', [before.name, req.params.id]);
      if ((dupes as any[]).length) throw new Error('Cannot restore category because another active category uses this name.');
      await connection.execute('UPDATE categories SET archived_at = NULL, archived_by = NULL, archive_reason = NULL, updated_at = NOW() WHERE id = ?', [req.params.id]);
      const [afterRows] = await connection.execute('SELECT * FROM categories WHERE id = ? LIMIT 1', [req.params.id]);
      restored = (afterRows as any[])[0];
      await insertAdminAuditLog(connection, {
        req,
        action: 'CATEGORY_RESTORE',
        entityType: 'category',
        entityId: req.params.id,
        before,
        after: restored,
        reason,
      });
    });
    clearListCache();
    res.json({ message: 'Category restored', category: mapCategoryRow(restored) });
  } catch (err: any) {
    const message = err?.message || 'Failed to restore category';
    res.status(message === 'Category not found' ? 404 : 400).json({ message });
  }
});

router.get('/:id/subcategories', async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    await ensureSubcategoriesTable();
    const rows = await dbQuery<any>('SELECT * FROM subcategories WHERE category_id = ? AND archived_at IS NULL ORDER BY (display_order IS NULL OR display_order = 0) ASC, display_order ASC, created_at DESC', [req.params.id]);
    res.json(rows.map(mapSubcategoryRow));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/subcategories', auth, adminOnly, async (req: AuthRequest, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    await ensureSubcategoriesTable();
    const data = req.body || {};
    const name = String(data.name || '').trim();
    if (!name) return res.status(400).json({ message: 'Subcategory name is required' });
    const displayOrder = Number(data.displayOrder ?? 0) || 0;

    const result: any = await dbExecute(
      'INSERT INTO subcategories (category_id, name, display_order) VALUES (?, ?, ?)',
      [req.params.id, name, displayOrder]
    );
    const rows = await dbQuery<any>('SELECT * FROM subcategories WHERE id = ? LIMIT 1', [result.insertId]);
    await insertAdminAuditLog(null, {
      req,
      action: 'SUBCATEGORY_CREATE',
      entityType: 'subcategory',
      entityId: result.insertId,
      after: rows[0],
      reason: 'Subcategory created',
    }).catch(() => {});
    clearListCache();
    res.status(201).json(mapSubcategoryRow(rows[0]));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/subcategories/:subId', auth, adminOnly, async (req: AuthRequest, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    await ensureSubcategoriesTable();
    const data = req.body || {};
    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      const name = String(data.name || '').trim();
      if (!name) return res.status(400).json({ message: 'Subcategory name is required' });
      fields.push('name = ?');
      values.push(name);
    }
    if (data.displayOrder !== undefined) {
      fields.push('display_order = ?');
      values.push(Number(data.displayOrder ?? 0) || 0);
    }

    if (!fields.length) return res.status(400).json({ message: 'No fields to update' });
    fields.push('updated_at = NOW()');

    const beforeRows = await dbQuery<any>('SELECT * FROM subcategories WHERE id = ? LIMIT 1', [req.params.subId]);
    const before = beforeRows[0];
    if (!before) return res.status(404).json({ message: 'Subcategory not found' });
    await dbExecute(`UPDATE subcategories SET ${fields.join(', ')} WHERE id = ?`, [...values, req.params.subId]);
    const rows = await dbQuery<any>('SELECT * FROM subcategories WHERE id = ? LIMIT 1', [req.params.subId]);
    if (!rows[0]) return res.status(404).json({ message: 'Subcategory not found' });
    await insertAdminAuditLog(null, {
      req,
      action: 'SUBCATEGORY_UPDATE',
      entityType: 'subcategory',
      entityId: req.params.subId,
      before,
      after: rows[0],
      reason: 'Subcategory updated',
    }).catch(() => {});
    clearListCache();
    res.json(mapSubcategoryRow(rows[0]));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/subcategories/:subId', auth, adminOnly, async (req: AuthRequest, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    await ensureSubcategoriesTable();
    const beforeRows = await dbQuery<any>('SELECT * FROM subcategories WHERE id = ? LIMIT 1', [req.params.subId]);
    const before = beforeRows[0];
    if (!before) return res.status(404).json({ message: 'Subcategory not found' });
    await dbExecute(
      'UPDATE subcategories SET archived_at = COALESCE(archived_at, NOW()), archived_by = ?, archive_reason = ?, updated_at = NOW() WHERE id = ?',
      [
        String(req.user?.email || req.user?.id || 'admin').slice(0, 120),
        String(req.body?.reason || req.query.reason || 'Subcategory archived by admin').slice(0, 255),
        req.params.subId,
      ]
    );
    const rows = await dbQuery<any>('SELECT * FROM subcategories WHERE id = ? LIMIT 1', [req.params.subId]);
    await insertAdminAuditLog(null, {
      req,
      action: 'SUBCATEGORY_ARCHIVE',
      entityType: 'subcategory',
      entityId: req.params.subId,
      before,
      after: rows[0],
      reason: String(req.body?.reason || req.query.reason || 'Subcategory archived by admin').slice(0, 255),
    }).catch(() => {});
    clearListCache();
    res.json({ message: 'Subcategory archived', subcategory: mapSubcategoryRow(rows[0]) });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
