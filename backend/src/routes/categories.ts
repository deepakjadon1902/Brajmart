import { Router } from 'express';
import { isDbConnected, dbQuery, dbExecute } from '../lib/db';
import { auth, adminOnly } from '../middleware/auth';
import { toIsoString } from '../lib/dbHelpers';

const router = Router();

// Categories must reflect immediately in both Admin and Storefront.
// Avoid browser/proxy caching for this endpoint.
const LIST_CACHE_CONTROL = 'no-store';

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
});

const mapSubcategoryRow = (row: any) => ({
  _id: String(row.id),
  categoryId: String(row.category_id),
  name: row.name,
  displayOrder: Number(row.display_order ?? 0),
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
  if (data.icon !== undefined) set('icon', data.icon);
  if (data.color !== undefined) set('color', data.color);
  if (data.productCount !== undefined) set('product_count', data.productCount);
  if (data.displayOrder !== undefined) set('display_order', data.displayOrder);

  if (!fields.length) return null;
  fields.push('updated_at = NOW()');
  return { sql: fields.join(', '), values };
};

router.get('/', async (_req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    res.setHeader('Cache-Control', LIST_CACHE_CONTROL);

    await ensureSubcategoriesTable();

    const rows = await dbQuery<any>('SELECT * FROM categories ORDER BY (display_order IS NULL OR display_order = 0) ASC, display_order ASC, created_at DESC');
    const subRows = await dbQuery<any>('SELECT * FROM subcategories ORDER BY (display_order IS NULL OR display_order = 0) ASC, display_order ASC, created_at DESC');

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

    res.json(mapCategoryRow(next));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    await ensureSubcategoriesTable();
    await dbExecute('DELETE FROM subcategories WHERE category_id = ?', [req.params.id]);
    await dbExecute('DELETE FROM categories WHERE id = ?', [req.params.id]);
    res.json({ message: 'Category deleted' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id/subcategories', async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    await ensureSubcategoriesTable();
    const rows = await dbQuery<any>('SELECT * FROM subcategories WHERE category_id = ? ORDER BY (display_order IS NULL OR display_order = 0) ASC, display_order ASC, created_at DESC', [req.params.id]);
    res.json(rows.map(mapSubcategoryRow));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/subcategories', auth, adminOnly, async (req, res) => {
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
    res.status(201).json(mapSubcategoryRow(rows[0]));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/subcategories/:subId', auth, adminOnly, async (req, res) => {
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

    await dbExecute(`UPDATE subcategories SET ${fields.join(', ')} WHERE id = ?`, [...values, req.params.subId]);
    const rows = await dbQuery<any>('SELECT * FROM subcategories WHERE id = ? LIMIT 1', [req.params.subId]);
    if (!rows[0]) return res.status(404).json({ message: 'Subcategory not found' });
    res.json(mapSubcategoryRow(rows[0]));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/subcategories/:subId', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    await ensureSubcategoriesTable();
    await dbExecute('DELETE FROM subcategories WHERE id = ?', [req.params.subId]);
    res.json({ message: 'Subcategory deleted' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
