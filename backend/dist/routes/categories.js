"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../lib/db");
const auth_1 = require("../middleware/auth");
const dbHelpers_1 = require("../lib/dbHelpers");
const router = (0, express_1.Router)();
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
        const rows = await (0, db_1.dbQuery)('SELECT * FROM categories ORDER BY (display_order IS NULL OR display_order = 0) ASC, display_order ASC, created_at DESC');
        res.json(rows.map(mapCategoryRow));
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.post('/', auth_1.auth, auth_1.adminOnly, async (req, res) => {
    try {
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
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
        await (0, db_1.dbExecute)('DELETE FROM categories WHERE id = ?', [req.params.id]);
        res.json({ message: 'Category deleted' });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
exports.default = router;
