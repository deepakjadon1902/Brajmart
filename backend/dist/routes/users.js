"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../lib/db");
const auth_1 = require("../middleware/auth");
const dbHelpers_1 = require("../lib/dbHelpers");
const router = (0, express_1.Router)();
const mapUserRow = (row) => ({
    _id: String(row.id),
    name: row.name,
    email: row.email,
    phone: row.phone || '',
    role: row.role,
    status: row.status,
    googleId: row.google_id ?? null,
    avatar: row.avatar || '',
    isVerified: (0, dbHelpers_1.boolFromDb)(row.is_verified),
    verificationToken: row.verification_token ?? null,
    verificationTokenExpires: (0, dbHelpers_1.toIsoString)(row.verification_token_expires),
    addresses: (0, dbHelpers_1.parseJson)(row.addresses, []),
    createdAt: (0, dbHelpers_1.toIsoString)(row.created_at),
    updatedAt: (0, dbHelpers_1.toIsoString)(row.updated_at),
});
router.get('/', auth_1.auth, auth_1.adminOnly, async (_req, res) => {
    try {
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        const rows = await (0, db_1.dbQuery)('SELECT * FROM users ORDER BY created_at DESC');
        res.json(rows.map(mapUserRow));
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.put('/me', auth_1.auth, async (req, res) => {
    try {
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        const userIdRaw = req.user?.id;
        if (!userIdRaw)
            return res.status(401).json({ message: 'Unauthorized' });
        const userId = Number(userIdRaw);
        if (!Number.isFinite(userId))
            return res.status(401).json({ message: 'Unauthorized' });
        const { fullName, email, mobile, address, city, state, pincode, } = req.body || {};
        const addresses = [
            {
                fullName: fullName || '',
                mobile: mobile || '',
                street: address || '',
                city: city || '',
                state: state || '',
                pincode: pincode || '',
                isDefault: true,
            },
        ];
        const currentRows = await (0, db_1.dbQuery)('SELECT email FROM users WHERE id = ? LIMIT 1', [userId]);
        if (!currentRows[0])
            return res.status(404).json({ message: 'User not found' });
        const currentEmailRaw = String(currentRows[0].email || '').trim();
        const currentEmail = currentEmailRaw.toLowerCase();
        const nextEmailRaw = String(email || '').trim();
        const nextEmail = nextEmailRaw.toLowerCase();
        let finalEmailRaw = nextEmailRaw ? nextEmailRaw : currentEmailRaw;
        let emailConflict = false;
        if (nextEmailRaw && nextEmail !== currentEmail) {
            const exists = await (0, db_1.dbQuery)('SELECT id FROM users WHERE LOWER(email) = ? AND id <> ? LIMIT 1', [nextEmail, userId]);
            if (exists.length) {
                emailConflict = true;
                finalEmailRaw = currentEmailRaw;
            }
        }
        await (0, db_1.dbExecute)('UPDATE users SET name = ?, email = ?, phone = ?, addresses = ?, updated_at = NOW() WHERE id = ?', [fullName || '', finalEmailRaw, mobile || '', JSON.stringify(addresses), userId]);
        const rows = await (0, db_1.dbQuery)('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
        if (!rows[0])
            return res.status(404).json({ message: 'User not found' });
        res.json({ ...mapUserRow(rows[0]), emailConflict });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.get('/:id', auth_1.auth, auth_1.adminOnly, async (req, res) => {
    try {
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        const rows = await (0, db_1.dbQuery)('SELECT * FROM users WHERE id = ? LIMIT 1', [req.params.id]);
        if (!rows[0])
            return res.status(404).json({ message: 'User not found' });
        res.json(mapUserRow(rows[0]));
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.put('/:id/role', auth_1.auth, auth_1.adminOnly, async (req, res) => {
    try {
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        await (0, db_1.dbExecute)('UPDATE users SET role = ?, updated_at = NOW() WHERE id = ?', [req.body.role, req.params.id]);
        const rows = await (0, db_1.dbQuery)('SELECT * FROM users WHERE id = ? LIMIT 1', [req.params.id]);
        res.json(rows[0] ? mapUserRow(rows[0]) : null);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.put('/:id/status', auth_1.auth, auth_1.adminOnly, async (req, res) => {
    try {
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        await (0, db_1.dbExecute)('UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?', [req.body.status, req.params.id]);
        const rows = await (0, db_1.dbQuery)('SELECT * FROM users WHERE id = ? LIMIT 1', [req.params.id]);
        res.json(rows[0] ? mapUserRow(rows[0]) : null);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.delete('/:id', auth_1.auth, auth_1.adminOnly, async (req, res) => {
    try {
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        await (0, db_1.dbExecute)('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ message: 'User deleted' });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
exports.default = router;
