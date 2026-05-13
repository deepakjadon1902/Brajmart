"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../lib/db");
const auth_1 = require("../middleware/auth");
const email_1 = require("../lib/email");
const eta_1 = require("../lib/eta");
const dbHelpers_1 = require("../lib/dbHelpers");
const crypto_1 = __importDefault(require("crypto"));
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
const sha512 = (value) => crypto_1.default.createHash('sha512').update(value).digest('hex');
const getPayuVerifyEndpoint = () => {
    const env = String(process.env.PAYU_ENV || 'test').toLowerCase();
    const isLive = env === 'live' || env === 'prod' || env === 'production';
    // PayU verify_payment endpoint uses form=2.
    return isLive
        ? 'https://info.payu.in/merchant/postservice?form=2'
        : 'https://test.payu.in/merchant/postservice?form=2';
};
const verifyPayuPayment = async (txnid) => {
    const key = process.env.PAYU_KEY;
    const salt = process.env.PAYU_SALT;
    if (!key || !salt)
        return null;
    const command = 'verify_payment';
    const hash = sha512([key, command, txnid, salt].join('|'));
    const body = new URLSearchParams();
    body.set('key', key);
    body.set('command', command);
    body.set('var1', txnid);
    body.set('hash', hash);
    const res = await fetch(getPayuVerifyEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });
    const text = await res.text();
    // PayU returns JSON on this endpoint. If it changes, fail gracefully.
    const parsed = (() => {
        try {
            return JSON.parse(text);
        }
        catch {
            return null;
        }
    })();
    return parsed;
};
const normalizePayuStatus = (value) => String(value || '').trim().toLowerCase();
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
        // Auto-reconcile pending PayU payments (no manual verification needed).
        // If webhook is delayed/missed, we verify directly with PayU when the customer views the status page.
        const current = rows[0];
        if (String(current.status) === 'pending' && (process.env.PAYU_KEY && process.env.PAYU_SALT)) {
            try {
                const verify = await verifyPayuPayment(token);
                const details = verify?.transaction_details?.[token] || verify?.transaction_details?.[String(token)] || null;
                const status = normalizePayuStatus(details?.status);
                const mihpayid = details?.mihpayid || details?.mihpayId || details?.payuid || null;
                if (status === 'success' || status === 'failure') {
                    const nextStatus = status === 'success' ? 'paid' : 'failed';
                    const orderId = current.order_id ?? null;
                    const amount = current.amount ?? null;
                    const method = current.method ?? null;
                    await (0, db_1.dbExecute)('UPDATE payment_status SET status = ?, payment_id = COALESCE(?, payment_id), updated_at = NOW() WHERE token = ?', [nextStatus, mihpayid ? String(mihpayid) : null, token]);
                    // Update payments table for the linked order if present.
                    if (orderId) {
                        const paymentRows = await (0, db_1.dbQuery)('SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1', [orderId]);
                        const payment = paymentRows[0];
                        if (payment) {
                            await (0, db_1.dbExecute)('UPDATE payments SET status = ?, transaction_id = COALESCE(?, transaction_id), updated_at = NOW() WHERE id = ?', [nextStatus, mihpayid ? String(mihpayid) : null, payment.id]);
                        }
                        // Update order status/history.
                        const orderRows = await (0, db_1.dbQuery)('SELECT * FROM orders WHERE id = ? LIMIT 1', [orderId]);
                        const orderRow = orderRows[0];
                        if (orderRow) {
                            const history = (0, dbHelpers_1.parseJson)(orderRow.status_history, []);
                            history.push({
                                status: nextStatus === 'paid' ? 'confirmed' : 'cancelled',
                                date: new Date().toISOString(),
                                note: nextStatus === 'paid' ? 'Payment verified via PayU verify_payment' : 'Payment failed (verified via PayU verify_payment)',
                            });
                            await (0, db_1.dbExecute)('UPDATE orders SET status = ?, status_history = ?, updated_at = NOW() WHERE id = ?', [nextStatus === 'paid' ? 'confirmed' : 'cancelled', JSON.stringify(history), orderId]);
                        }
                    }
                    const refreshed = await (0, db_1.dbQuery)('SELECT * FROM payment_status WHERE token = ? LIMIT 1', [token]);
                    return res.json(mapPaymentStatusRow(refreshed[0] || current));
                }
            }
            catch {
                // ignore reconciliation errors; fall back to current pending status
            }
        }
        res.json(mapPaymentStatusRow(current));
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
