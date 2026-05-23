"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../lib/db");
const auth_1 = require("../middleware/auth");
const dbHelpers_1 = require("../lib/dbHelpers");
const router = (0, express_1.Router)();
// Categories must reflect immediately in both Admin and Storefront.
// Avoid browser/proxy caching for this endpoint.
const LIST_CACHE_CONTROL = 'no-store';
const ensureSubcategoriesTable = async () => {
    await (0, db_1.dbExecute)(`
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
const mapCategoryRow = (row) => ({
    _id: String(row.id),
    name: row.name,
    icon: row.icon,
    color: row.color,
    productCount: Number(row.product_count ?? 0),
    displayOrder: Number(row.display_order ?? 0),
    createdAt: (0, dbHelpers_1.toIsoString)(row.created_at),
    updatedAt: (0, dbHelpers_1.toIsoString)(row.updated_at),
});
const mapSubcategoryRow = (row) => ({
    _id: String(row.id),
    categoryId: String(row.category_id),
    name: row.name,
    displayOrder: Number(row.display_order ?? 0),
    createdAt: (0, dbHelpers_1.toIsoString)(row.created_at),
    updatedAt: (0, dbHelpers_1.toIsoString)(row.updated_at),
});
const buildUpdate = (data) => {
    const fields = [];
    const values = [];
    const set = (column, value) => {
        fields.push(`${column} = ?`);
        values.push(value);
    };
    if (data.name !== undefined)
        set('name', data.name);
    if (data.icon !== undefined)
        set('icon', data.icon);
    if (data.color !== undefined)
        set('color', data.color);
    if (data.productCount !== undefined)
        set('product_count', data.productCount);
    if (data.displayOrder !== undefined)
        set('display_order', data.displayOrder);
    if (!fields.length)
        return null;
    fields.push('updated_at = NOW()');
    return { sql: fields.join(', '), values };
};
router.get('/', async (_req, res) => {
    try {
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        res.setHeader('Cache-Control', LIST_CACHE_CONTROL);
        await ensureSubcategoriesTable();
        const rows = await (0, db_1.dbQuery)('SELECT * FROM categories ORDER BY (display_order IS NULL OR display_order = 0) ASC, display_order ASC, created_at DESC');
        const subRows = await (0, db_1.dbQuery)('SELECT * FROM subcategories ORDER BY (display_order IS NULL OR display_order = 0) ASC, display_order ASC, created_at DESC');
        const subsByCat = new Map();
        for (const r of subRows) {
            const key = String(r.category_id);
            const list = subsByCat.get(key) || [];
            list.push(mapSubcategoryRow(r));
            subsByCat.set(key, list);
        }
        const data = rows.map((r) => {
            const cat = mapCategoryRow(r);
            return {
                ...cat,
                subcategories: subsByCat.get(String(r.id)) || [],
            };
        });
        res.json(data);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.post('/', auth_1.auth, auth_1.adminOnly, async (req, res) => {
    try {
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        await ensureSubcategoriesTable();
        const data = req.body || {};
        const result = await (0, db_1.dbExecute)('INSERT INTO categories (name, icon, color, product_count, display_order) VALUES (?, ?, ?, ?, ?)', [data.name, data.icon, data.color ?? '#f59e0b', data.productCount ?? 0, data.displayOrder ?? 0]);
        const rows = await (0, db_1.dbQuery)('SELECT * FROM categories WHERE id = ? LIMIT 1', [result.insertId]);
        res.status(201).json(mapCategoryRow(rows[0]));
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.put('/:id', auth_1.auth, auth_1.adminOnly, async (req, res) => {
    try {
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        await ensureSubcategoriesTable();
        const update = buildUpdate(req.body || {});
        if (!update)
            return res.status(400).json({ message: 'No fields to update' });
        await (0, db_1.dbExecute)(`UPDATE categories SET ${update.sql} WHERE id = ?`, [...update.values, req.params.id]);
        const rows = await (0, db_1.dbQuery)('SELECT * FROM categories WHERE id = ? LIMIT 1', [req.params.id]);
        if (!rows[0])
            return res.status(404).json({ message: 'Category not found' });
        res.json(mapCategoryRow(rows[0]));
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.delete('/:id', auth_1.auth, auth_1.adminOnly, async (req, res) => {
    try {
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        await ensureSubcategoriesTable();
        await (0, db_1.dbExecute)('DELETE FROM subcategories WHERE category_id = ?', [req.params.id]);
        await (0, db_1.dbExecute)('DELETE FROM categories WHERE id = ?', [req.params.id]);
        res.json({ message: 'Category deleted' });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.get('/:id/subcategories', async (req, res) => {
    try {
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        await ensureSubcategoriesTable();
        const rows = await (0, db_1.dbQuery)('SELECT * FROM subcategories WHERE category_id = ? ORDER BY (display_order IS NULL OR display_order = 0) ASC, display_order ASC, created_at DESC', [req.params.id]);
        res.json(rows.map(mapSubcategoryRow));
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.post('/:id/subcategories', auth_1.auth, auth_1.adminOnly, async (req, res) => {
    try {
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        await ensureSubcategoriesTable();
        const data = req.body || {};
        const name = String(data.name || '').trim();
        if (!name)
            return res.status(400).json({ message: 'Subcategory name is required' });
        const displayOrder = Number(data.displayOrder ?? 0) || 0;
        const result = await (0, db_1.dbExecute)('INSERT INTO subcategories (category_id, name, display_order) VALUES (?, ?, ?)', [req.params.id, name, displayOrder]);
        const rows = await (0, db_1.dbQuery)('SELECT * FROM subcategories WHERE id = ? LIMIT 1', [result.insertId]);
        res.status(201).json(mapSubcategoryRow(rows[0]));
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.put('/subcategories/:subId', auth_1.auth, auth_1.adminOnly, async (req, res) => {
    try {
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        await ensureSubcategoriesTable();
        const data = req.body || {};
        const fields = [];
        const values = [];
        if (data.name !== undefined) {
            const name = String(data.name || '').trim();
            if (!name)
                return res.status(400).json({ message: 'Subcategory name is required' });
            fields.push('name = ?');
            values.push(name);
        }
        if (data.displayOrder !== undefined) {
            fields.push('display_order = ?');
            values.push(Number(data.displayOrder ?? 0) || 0);
        }
        if (!fields.length)
            return res.status(400).json({ message: 'No fields to update' });
        fields.push('updated_at = NOW()');
        await (0, db_1.dbExecute)(`UPDATE subcategories SET ${fields.join(', ')} WHERE id = ?`, [...values, req.params.subId]);
        const rows = await (0, db_1.dbQuery)('SELECT * FROM subcategories WHERE id = ? LIMIT 1', [req.params.subId]);
        if (!rows[0])
            return res.status(404).json({ message: 'Subcategory not found' });
        res.json(mapSubcategoryRow(rows[0]));
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.delete('/subcategories/:subId', auth_1.auth, auth_1.adminOnly, async (req, res) => {
    try {
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        await ensureSubcategoriesTable();
        await (0, db_1.dbExecute)('DELETE FROM subcategories WHERE id = ?', [req.params.subId]);
        res.json({ message: 'Subcategory deleted' });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
exports.default = router;
