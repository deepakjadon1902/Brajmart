"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../lib/db");
const auth_1 = require("../middleware/auth");
const email_1 = require("../lib/email");
const eta_1 = require("../lib/eta");
const dbHelpers_1 = require("../lib/dbHelpers");
const router = (0, express_1.Router)();
const mapPaymentRow = (row) => ({
    _id: String(row.id),
    orderId: row.order_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    method: row.method,
    amount: Number(row.amount),
    status: row.status,
    transactionId: row.transaction_id,
    createdAt: (0, dbHelpers_1.toIsoString)(row.created_at),
    updatedAt: (0, dbHelpers_1.toIsoString)(row.updated_at),
});
const mapPaymentStatusRow = (row) => ({
    token: row.token,
    status: row.status,
    orderId: row.order_id ?? undefined,
    amount: row.amount ?? undefined,
    method: row.method ?? undefined,
    paymentId: row.payment_id ?? undefined,
    createdAt: (0, dbHelpers_1.toIsoString)(row.created_at),
    updatedAt: (0, dbHelpers_1.toIsoString)(row.updated_at),
});
router.get('/', auth_1.auth, auth_1.adminOnly, async (_req, res) => {
    try {
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        const rows = await (0, db_1.dbQuery)('SELECT * FROM payments ORDER BY created_at DESC');
        res.json(rows.map(mapPaymentRow));
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.get('/status/:token', async (req, res) => {
    try {
        const token = req.params.token;
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        const rows = await (0, db_1.dbQuery)('SELECT * FROM payment_status WHERE token = ? LIMIT 1', [token]);
        if (!rows[0])
            return res.status(404).json({ message: 'Payment not found' });
        res.json(mapPaymentStatusRow(rows[0]));
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.post('/', auth_1.auth, async (req, res) => {
    try {
        const { min, max } = await (0, eta_1.getEtaConfig)();
        const etaText = (0, eta_1.getEtaText)(min, max);
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        const data = req.body || {};
        const result = await (0, db_1.dbExecute)('INSERT INTO payments (order_id, customer_name, customer_email, method, amount, status, transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?)', [data.orderId, data.customerName, data.customerEmail, data.method, data.amount, data.status || 'pending', data.transactionId]);
        const rows = await (0, db_1.dbQuery)('SELECT * FROM payments WHERE id = ? LIMIT 1', [result.insertId]);
        const payment = mapPaymentRow(rows[0]);
        let orderDetails = null;
        if (payment.orderId) {
            const orderRows = await (0, db_1.dbQuery)('SELECT * FROM orders WHERE id = ? LIMIT 1', [payment.orderId]);
            const orderRow = orderRows[0];
            if (orderRow) {
                orderDetails = {
                    items: (0, dbHelpers_1.parseJson)(orderRow.items, []),
                    total: Number(orderRow.total),
                    paymentMethod: orderRow.payment_method,
                    shippingAddress: (0, dbHelpers_1.parseJson)(orderRow.shipping_address, {}),
                    billingAddress: (0, dbHelpers_1.parseJson)(orderRow.billing_address, {}),
                };
            }
        }
        if (payment.customerEmail) {
            if (payment.status === 'paid') {
                (0, email_1.sendPaymentReceipt)(payment.customerEmail, { orderId: String(payment.orderId), amount: payment.amount, paymentId: payment.transactionId, eta: etaText, details: orderDetails }).catch(() => { });
            }
            else if (payment.status === 'failed') {
                (0, email_1.sendPaymentFailed)(payment.customerEmail, { orderId: String(payment.orderId), amount: payment.amount, paymentId: payment.transactionId, eta: etaText, details: orderDetails }).catch(() => { });
            }
        }
        await (0, db_1.dbExecute)('INSERT INTO payment_status (token, status, order_id, amount, method, payment_id) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status), order_id = VALUES(order_id), amount = VALUES(amount), method = VALUES(method), payment_id = VALUES(payment_id), updated_at = NOW()', [payment.transactionId, payment.status, payment.orderId, payment.amount, payment.method, payment.transactionId]);
        if (payment.status === 'paid' || payment.status === 'failed') {
            (0, email_1.sendAdminPaymentNotice)({
                status: payment.status,
                orderId: String(payment.orderId),
                amount: payment.amount,
                paymentId: payment.transactionId,
                method: payment.method,
                customerEmail: payment.customerEmail,
            }).catch(() => { });
        }
        res.status(201).json(payment);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.put('/:id', auth_1.auth, auth_1.adminOnly, async (req, res) => {
    try {
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        const { min, max } = await (0, eta_1.getEtaConfig)();
        const etaText = (0, eta_1.getEtaText)(min, max);
        await (0, db_1.dbExecute)('UPDATE payments SET status = ?, updated_at = NOW() WHERE id = ?', [req.body.status, req.params.id]);
        const rows = await (0, db_1.dbQuery)('SELECT * FROM payments WHERE id = ? LIMIT 1', [req.params.id]);
        const payment = rows[0] ? mapPaymentRow(rows[0]) : null;
        if (payment) {
            await (0, db_1.dbExecute)('INSERT INTO payment_status (token, status, order_id, amount, method, payment_id) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status), order_id = VALUES(order_id), amount = VALUES(amount), method = VALUES(method), payment_id = VALUES(payment_id), updated_at = NOW()', [payment.transactionId, payment.status, payment.orderId, payment.amount, payment.method, payment.transactionId]);
        }
        let orderDetails = null;
        if (payment?.orderId) {
            const orderRows = await (0, db_1.dbQuery)('SELECT * FROM orders WHERE id = ? LIMIT 1', [payment.orderId]);
            const orderRow = orderRows[0];
            if (orderRow) {
                orderDetails = {
                    items: (0, dbHelpers_1.parseJson)(orderRow.items, []),
                    total: Number(orderRow.total),
                    paymentMethod: orderRow.payment_method,
                    shippingAddress: (0, dbHelpers_1.parseJson)(orderRow.shipping_address, {}),
                    billingAddress: (0, dbHelpers_1.parseJson)(orderRow.billing_address, {}),
                };
            }
        }
        if (payment && (payment.status === 'paid' || payment.status === 'failed')) {
            if (payment.customerEmail) {
                if (payment.status === 'paid') {
                    (0, email_1.sendPaymentReceipt)(payment.customerEmail, { orderId: String(payment.orderId), amount: payment.amount, paymentId: payment.transactionId, eta: etaText, details: orderDetails }).catch(() => { });
                }
                else {
                    (0, email_1.sendPaymentFailed)(payment.customerEmail, { orderId: String(payment.orderId), amount: payment.amount, paymentId: payment.transactionId, eta: etaText, details: orderDetails }).catch(() => { });
                }
            }
            (0, email_1.sendAdminPaymentNotice)({
                status: payment.status,
                orderId: String(payment.orderId),
                amount: payment.amount,
                paymentId: payment.transactionId,
                method: payment.method,
                customerEmail: payment.customerEmail,
            }).catch(() => { });
        }
        res.json(payment);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
exports.default = router;
