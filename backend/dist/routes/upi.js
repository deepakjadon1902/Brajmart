"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../lib/db");
const email_1 = require("../lib/email");
const eta_1 = require("../lib/eta");
const dbHelpers_1 = require("../lib/dbHelpers");
const router = (0, express_1.Router)();
router.post('/webhook', async (req, res) => {
    try {
        const secret = process.env.UPI_WEBHOOK_SECRET;
        if (secret) {
            const header = String(req.headers['x-upi-secret'] || '');
            if (header !== secret)
                return res.status(401).json({ message: 'Unauthorized' });
        }
        const { token, status, paymentId } = req.body || {};
        if (!token || !status)
            return res.status(400).json({ message: 'Missing fields' });
        const normalized = String(status).toLowerCase() === 'success' ? 'paid' : String(status).toLowerCase() === 'failed' ? 'failed' : 'pending';
        const { min, max } = await (0, eta_1.getEtaConfig)();
        const etaText = (0, eta_1.getEtaText)(min, max);
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        const rows = await (0, db_1.dbQuery)('SELECT * FROM payments WHERE transaction_id = ? LIMIT 1', [token]);
        const payment = rows[0];
        if (!payment)
            return res.status(404).json({ message: 'Payment not found' });
        const newTxnId = paymentId || payment.transaction_id;
        await (0, db_1.dbExecute)('UPDATE payments SET status = ?, transaction_id = ?, updated_at = NOW() WHERE id = ?', [normalized, newTxnId, payment.id]);
        await (0, db_1.dbExecute)('INSERT INTO payment_status (token, status, order_id, amount, method, payment_id) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status), order_id = VALUES(order_id), amount = VALUES(amount), method = VALUES(method), payment_id = VALUES(payment_id), updated_at = NOW()', [token, normalized, payment.order_id, payment.amount, payment.method, newTxnId]);
        let orderDetails = null;
        if (payment.order_id) {
            const orderRows = await (0, db_1.dbQuery)('SELECT * FROM orders WHERE id = ? LIMIT 1', [payment.order_id]);
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
        if (payment.customer_email) {
            if (normalized === 'paid') {
                (0, email_1.sendPaymentReceipt)(payment.customer_email, { orderId: String(payment.order_id), amount: payment.amount, paymentId: newTxnId, eta: etaText, details: orderDetails }).catch(() => { });
            }
            else if (normalized === 'failed') {
                (0, email_1.sendPaymentFailed)(payment.customer_email, { orderId: String(payment.order_id), amount: payment.amount, paymentId: newTxnId, eta: etaText, details: orderDetails }).catch(() => { });
            }
        }
        if (normalized === 'paid' || normalized === 'failed') {
            (0, email_1.sendAdminPaymentNotice)({
                status: normalized,
                orderId: String(payment.order_id),
                amount: payment.amount,
                paymentId: newTxnId,
                method: payment.method,
                customerEmail: payment.customer_email,
            }).catch(() => { });
        }
        res.json({ ok: true });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
exports.default = router;
