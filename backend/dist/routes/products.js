"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../lib/db");
const auth_1 = require("../middleware/auth");
const dbHelpers_1 = require("../lib/dbHelpers");
const router = (0, express_1.Router)();
const mapProductRow = (row) => ({
    _id: String(row.id),
    name: row.name,
    slug: row.slug,
    price: Number(row.price),
    originalPrice: row.original_price !== null ? Number(row.original_price) : undefined,
    image: row.image,
    images: (() => {
        const parsed = (0, dbHelpers_1.parseJson)(row.images, []);
        if (Array.isArray(parsed) && parsed.length)
            return parsed;
        return row.image ? [row.image] : [];
    })(),
    category: row.category,
    rating: Number(row.rating ?? 0),
    reviewCount: Number(row.review_count ?? 0),
    badge: row.badge ?? null,
    tags: (0, dbHelpers_1.parseJson)(row.tags, []),
    inStock: (0, dbHelpers_1.boolFromDb)(row.in_stock),
    soldCount: Number(row.sold_count ?? 0),
    description: row.description ?? '',
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
    if (data.slug !== undefined)
        set('slug', data.slug);
    if (data.price !== undefined)
        set('price', data.price);
    if (data.originalPrice !== undefined)
        set('original_price', data.originalPrice);
    if (data.image !== undefined)
        set('image', data.image);
    if (data.images !== undefined)
        set('images', JSON.stringify(data.images || []));
    if (data.category !== undefined)
        set('category', data.category);
    if (data.rating !== undefined)
        set('rating', data.rating);
    if (data.reviewCount !== undefined)
        set('review_count', data.reviewCount);
    if (data.badge !== undefined)
        set('badge', data.badge);
    if (data.tags !== undefined)
        set('tags', JSON.stringify(data.tags || []));
    if (data.inStock !== undefined)
        set('in_stock', data.inStock ? 1 : 0);
    if (data.soldCount !== undefined)
        set('sold_count', data.soldCount);
    if (data.description !== undefined)
        set('description', data.description);
    if (!fields.length)
        return null;
    fields.push('updated_at = NOW()');
    return { sql: fields.join(', '), values };
};
router.get('/', async (_req, res) => {
    try {
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        const rows = await (0, db_1.dbQuery)('SELECT * FROM products ORDER BY created_at DESC');
        res.json(rows.map(mapProductRow));
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.get('/:slug', async (req, res) => {
    try {
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        const rows = await (0, db_1.dbQuery)('SELECT * FROM products WHERE slug = ? LIMIT 1', [req.params.slug]);
        const row = rows[0];
        if (!row)
            return res.status(404).json({ message: 'Product not found' });
        res.json(mapProductRow(row));
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
        const images = Array.isArray(data.images) && data.images.length ? data.images : (data.image ? [data.image] : []);
        const result = await (0, db_1.dbExecute)('INSERT INTO products (name, slug, price, original_price, image, images, category, rating, review_count, badge, tags, in_stock, sold_count, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
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
        ]);
        const rows = await (0, db_1.dbQuery)('SELECT * FROM products WHERE id = ? LIMIT 1', [result.insertId]);
        res.status(201).json(mapProductRow(rows[0]));
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
        await (0, db_1.dbExecute)(`UPDATE products SET ${update.sql} WHERE id = ?`, [...update.values, req.params.id]);
        const rows = await (0, db_1.dbQuery)('SELECT * FROM products WHERE id = ? LIMIT 1', [req.params.id]);
        if (!rows[0])
            return res.status(404).json({ message: 'Product not found' });
        res.json(mapProductRow(rows[0]));
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.delete('/:id', auth_1.auth, auth_1.adminOnly, async (req, res) => {
    try {
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        await (0, db_1.dbExecute)('DELETE FROM products WHERE id = ?', [req.params.id]);
        res.json({ message: 'Product deleted' });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
exports.default = router;
