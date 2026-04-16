"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const db_1 = require("../lib/db");
const dbHelpers_1 = require("../lib/dbHelpers");
const router = (0, express_1.Router)();
const mapCartRow = (row) => ({
    _id: String(row.id),
    userId: String(row.user_id),
    items: (0, dbHelpers_1.parseJson)(row.items, []),
    createdAt: (0, dbHelpers_1.toIsoString)(row.created_at),
    updatedAt: (0, dbHelpers_1.toIsoString)(row.updated_at),
});
router.get('/', auth_1.auth, async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ message: 'Unauthorized' });
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        const rows = await (0, db_1.dbQuery)('SELECT * FROM carts WHERE user_id = ? LIMIT 1', [userId]);
        const row = rows[0];
        res.json(row ? mapCartRow(row) : { userId, items: [] });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.put('/', auth_1.auth, async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ message: 'Unauthorized' });
        const items = req.body.items || [];
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        await (0, db_1.dbExecute)('INSERT INTO carts (user_id, items) VALUES (?, ?) ON DUPLICATE KEY UPDATE items = VALUES(items), updated_at = NOW()', [userId, JSON.stringify(items)]);
        const rows = await (0, db_1.dbQuery)('SELECT * FROM carts WHERE user_id = ? LIMIT 1', [userId]);
        res.json(rows[0] ? mapCartRow(rows[0]) : { userId, items: [] });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.delete('/', auth_1.auth, async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ message: 'Unauthorized' });
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        await (0, db_1.dbExecute)('UPDATE carts SET items = ?, updated_at = NOW() WHERE user_id = ?', [JSON.stringify([]), userId]);
        const rows = await (0, db_1.dbQuery)('SELECT * FROM carts WHERE user_id = ? LIMIT 1', [userId]);
        res.json(rows[0] ? mapCartRow(rows[0]) : { userId, items: [] });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
exports.default = router;
