"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../lib/db");
const email_1 = require("../lib/email");
const eta_1 = require("../lib/eta");
const auth_1 = require("../middleware/auth");
const dbHelpers_1 = require("../lib/dbHelpers");
const router = (0, express_1.Router)();
const mapOrderRow = (row) => ({
    _id: String(row.id),
    orderId: Number(row.id),
    userId: row.user_id ? String(row.user_id) : undefined,
    items: (0, dbHelpers_1.parseJson)(row.items, []),
    total: Number(row.total),
    status: row.status,
    customerName: row.customer_name ?? undefined,
    customerEmail: row.customer_email ?? undefined,
    shippingAddress: (0, dbHelpers_1.parseJson)(row.shipping_address, {}),
    billingAddress: (0, dbHelpers_1.parseJson)(row.billing_address, {}),
    paymentMethod: row.payment_method,
    trackingId: row.tracking_id ?? undefined,
    estimatedDelivery: (0, dbHelpers_1.toIsoString)(row.estimated_delivery),
    statusHistory: (0, dbHelpers_1.parseJson)(row.status_history, []),
    createdAt: (0, dbHelpers_1.toIsoString)(row.created_at),
    updatedAt: (0, dbHelpers_1.toIsoString)(row.updated_at),
});
router.get('/my', auth_1.auth, async (req, res) => {
    try {
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        const email = String(req.user?.email || '').trim().toLowerCase();
        if (email) {
            const rows = await (0, db_1.dbQuery)('SELECT * FROM orders WHERE user_id = ? OR (user_id IS NULL AND LOWER(customer_email) = ?) ORDER BY created_at DESC', [req.user?.id, email]);
            return res.json(rows.map(mapOrderRow));
        }
        const rows = await (0, db_1.dbQuery)('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [req.user?.id]);
        res.json(rows.map(mapOrderRow));
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.get('/', auth_1.auth, auth_1.adminOnly, async (_req, res) => {
    try {
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        const rows = await (0, db_1.dbQuery)('SELECT * FROM orders ORDER BY created_at DESC');
        res.json(rows.map(mapOrderRow));
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.get('/track/:orderId', async (req, res) => {
    try {
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        const orderId = parseInt(req.params.orderId, 10);
        const rows = await (0, db_1.dbQuery)('SELECT * FROM orders WHERE id = ? LIMIT 1', [orderId]);
        if (!rows[0])
            return res.status(404).json({ message: 'Order not found' });
        res.json(mapOrderRow(rows[0]));
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.post('/', auth_1.auth, async (req, res) => {
    try {
        const { min, max } = await (0, eta_1.getEtaConfig)();
        const etaText = (0, eta_1.getEtaText)(min, max);
        const estimatedDelivery = (0, eta_1.getEstimatedDeliveryDate)(max);
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        const data = req.body || {};
        const status = data.status || 'confirmed';
        const statusHistory = Array.isArray(data.statusHistory) && data.statusHistory.length
            ? data.statusHistory
            : [{ status, date: new Date().toISOString(), note: 'Order placed successfully' }];
        const result = await (0, db_1.dbExecute)('INSERT INTO orders (user_id, items, total, status, customer_name, customer_email, shipping_address, billing_address, payment_method, tracking_id, estimated_delivery, status_history) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
            data.userId || req.user?.id || null,
            JSON.stringify(data.items || []),
            data.total,
            status,
            data.customerName || null,
            data.customerEmail || null,
            JSON.stringify(data.shippingAddress || {}),
            JSON.stringify(data.billingAddress || {}),
            data.paymentMethod,
            null,
            estimatedDelivery,
            JSON.stringify(statusHistory),
        ]);
        const orderId = result.insertId;
        const trackingId = `BM${orderId}`;
        await (0, db_1.dbExecute)('UPDATE orders SET tracking_id = ? WHERE id = ?', [trackingId, orderId]);
        const rows = await (0, db_1.dbQuery)('SELECT * FROM orders WHERE id = ? LIMIT 1', [orderId]);
        const order = mapOrderRow(rows[0]);
        if (order.customerEmail) {
            (0, email_1.sendOrderConfirmation)(order.customerEmail, {
                orderId: String(order.orderId),
                total: order.total,
                itemsCount: order.items?.length || 0,
                eta: etaText,
                items: order.items,
                paymentMethod: order.paymentMethod,
                shippingAddress: order.shippingAddress,
                billingAddress: order.billingAddress,
            }).catch(() => { });
        }
        res.status(201).json(order);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.put('/:id/status', auth_1.auth, auth_1.adminOnly, async (req, res) => {
    try {
        const { status, note } = req.body;
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        const rows = await (0, db_1.dbQuery)('SELECT * FROM orders WHERE id = ? LIMIT 1', [req.params.id]);
        const row = rows[0];
        if (!row)
            return res.status(404).json({ message: 'Order not found' });
        const history = (0, dbHelpers_1.parseJson)(row.status_history, []);
        history.push({ status, date: new Date().toISOString(), note });
        await (0, db_1.dbExecute)('UPDATE orders SET status = ?, status_history = ?, updated_at = NOW() WHERE id = ?', [status, JSON.stringify(history), req.params.id]);
        const updatedRows = await (0, db_1.dbQuery)('SELECT * FROM orders WHERE id = ? LIMIT 1', [req.params.id]);
        const order = mapOrderRow(updatedRows[0]);
        if (order.customerEmail) {
            const { min, max } = await (0, eta_1.getEtaConfig)();
            const etaText = (0, eta_1.getEtaText)(min, max);
            (0, email_1.sendShippingUpdate)(order.customerEmail, {
                orderId: String(order.orderId),
                status,
                trackingId: order.trackingId,
                eta: etaText,
                details: {
                    items: order.items,
                    total: order.total,
                    paymentMethod: order.paymentMethod,
                    shippingAddress: order.shippingAddress,
                    billingAddress: order.billingAddress,
                },
            }).catch(() => { });
        }
        res.json(order);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
exports.default = router;
