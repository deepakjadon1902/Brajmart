"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const auth_1 = require("../middleware/auth");
const db_1 = require("../lib/db");
const eta_1 = require("../lib/eta");
const email_1 = require("../lib/email");
const dbHelpers_1 = require("../lib/dbHelpers");
const payuDrafts = new Map();
const createDraft = (draft) => {
    payuDrafts.set(draft.txnid, draft);
    return draft;
};
const removeDraft = (txnid) => {
    const draft = payuDrafts.get(txnid);
    payuDrafts.delete(txnid);
    return draft || null;
};
const router = (0, express_1.Router)();
const getBackendUrl = () => process.env.BACKEND_URL || process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
const getFrontendUrl = () => process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:8080';
const getPayuConfig = () => {
    const key = process.env.PAYU_KEY;
    const salt = process.env.PAYU_SALT;
    const env = (process.env.PAYU_ENV || 'test').toLowerCase();
    const isLive = env === 'live' || env === 'prod' || env === 'production';
    const actionUrl = isLive ? 'https://secure.payu.in/_payment' : 'https://test.payu.in/_payment';
    return { key, salt, env, actionUrl };
};
const sha512 = (value) => crypto_1.default.createHash('sha512').update(value).digest('hex');
const buildRequestHash = (params) => {
    const udf = [params.udf1, params.udf2, params.udf3, params.udf4, params.udf5].map((v) => v || '');
    const hashString = [
        params.key,
        params.txnid,
        params.amount,
        params.productinfo,
        params.firstname,
        params.email,
        ...udf,
        '', '', '', '', '',
        params.salt,
    ].join('|');
    return sha512(hashString);
};
const buildResponseHash = (params) => {
    const udf = [params.udf1, params.udf2, params.udf3, params.udf4, params.udf5].map((v) => v || '');
    const hashString = [
        params.salt,
        params.status,
        '', '', '', '', '', '',
        udf[4], udf[3], udf[2], udf[1], udf[0],
        params.email,
        params.firstname,
        params.productinfo,
        params.amount,
        params.txnid,
        params.key,
    ].join('|');
    return sha512(hashString);
};
const insertOrder = async (orderData, estimatedDelivery) => {
    const status = orderData.status || 'confirmed';
    const statusHistory = Array.isArray(orderData.statusHistory) && orderData.statusHistory.length
        ? orderData.statusHistory
        : [{ status, date: new Date().toISOString(), note: 'Order placed successfully' }];
    const result = await (0, db_1.dbExecute)('INSERT INTO orders (user_id, items, total, status, customer_name, customer_email, shipping_address, billing_address, payment_method, tracking_id, estimated_delivery, status_history) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
        orderData.userId || null,
        JSON.stringify(orderData.items || []),
        orderData.total,
        status,
        orderData.customerName || null,
        orderData.customerEmail || null,
        JSON.stringify(orderData.shippingAddress || {}),
        JSON.stringify(orderData.billingAddress || {}),
        orderData.paymentMethod,
        null,
        estimatedDelivery,
        JSON.stringify(statusHistory),
    ]);
    const orderId = result.insertId;
    const trackingId = `BM${orderId}`;
    await (0, db_1.dbExecute)('UPDATE orders SET tracking_id = ? WHERE id = ?', [trackingId, orderId]);
    const rows = await (0, db_1.dbQuery)('SELECT * FROM orders WHERE id = ? LIMIT 1', [orderId]);
    return rows[0];
};
router.post('/create-order', auth_1.auth, async (req, res) => {
    try {
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        const { key, salt, actionUrl } = getPayuConfig();
        if (!key || !salt)
            return res.status(500).json({ message: 'PayU credentials are not configured' });
        const { amount, method, order, customer } = req.body || {};
        if (!amount || amount <= 0)
            return res.status(400).json({ message: 'Invalid amount' });
        if (!order || !customer?.email || !customer?.name)
            return res.status(400).json({ message: 'Missing order details' });
        const txnid = `PAYU-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        const productinfo = `BrajMart Order (${Array.isArray(order.items) ? order.items.length : 0} items)`;
        const formattedAmount = Number(amount).toFixed(2);
        const { max } = await (0, eta_1.getEtaConfig)();
        const estimatedDelivery = (0, eta_1.getEstimatedDeliveryDate)(max);
        const rawUserId = req.user?.id;
        const numericUserId = rawUserId && Number.isFinite(Number(rawUserId)) ? Number(rawUserId) : null;
        const orderRow = await insertOrder({
            ...order,
            userId: numericUserId ?? null,
            status: 'processing',
            statusHistory: [{ status: 'processing', date: new Date().toISOString(), note: 'Payment initiated via PayU' }],
        }, estimatedDelivery);
        const orderId = orderRow.id;
        const methodLabel = method === 'card' ? 'PayU Card' : 'PayU UPI';
        await (0, db_1.dbExecute)('INSERT INTO payments (order_id, customer_name, customer_email, method, amount, status, transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?)', [orderId, customer.name, customer.email, methodLabel, Number(amount), 'pending', txnid]);
        await (0, db_1.dbExecute)('INSERT INTO payment_status (token, status, order_id, amount, method, payment_id) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status), order_id = VALUES(order_id), amount = VALUES(amount), method = VALUES(method), payment_id = VALUES(payment_id), updated_at = NOW()', [txnid, 'pending', orderId, Number(amount), methodLabel, null]);
        createDraft({
            txnid,
            createdAt: new Date().toISOString(),
            amount: Number(amount),
            method: method === 'card' ? 'card' : 'upi',
            customer: { name: customer.name, email: customer.email, phone: customer.phone },
            order,
            orderId,
        });
        const surl = `${getBackendUrl()}/api/payu/success`;
        const furl = `${getBackendUrl()}/api/payu/failure`;
        const fields = {
            key,
            txnid,
            amount: formattedAmount,
            productinfo,
            firstname: customer.name,
            email: customer.email,
            phone: customer.phone || '',
            surl,
            furl,
        };
        if (method === 'upi')
            fields.pg = 'UPI';
        if (method === 'card')
            fields.pg = 'CC';
        fields.hash = buildRequestHash({
            key,
            txnid,
            amount: formattedAmount,
            productinfo,
            firstname: customer.name,
            email: customer.email,
            salt,
        });
        res.json({ actionUrl, fields });
    }
    catch (err) {
        res.status(500).json({ message: err.message || 'Failed to create PayU order' });
    }
});
const handlePayuCallback = async (req, res, statusOverride) => {
    const { key, salt } = getPayuConfig();
    if (!key || !salt)
        return res.status(500).send('PayU not configured');
    if (!(0, db_1.isDbConnected)())
        return res.status(503).send('Database unavailable');
    const status = statusOverride || req.body.status;
    const txnid = req.body.txnid;
    const amount = req.body.amount;
    const productinfo = req.body.productinfo;
    const firstname = req.body.firstname;
    const email = req.body.email;
    const receivedHash = req.body.hash;
    const udf1 = req.body.udf1;
    const udf2 = req.body.udf2;
    const udf3 = req.body.udf3;
    const udf4 = req.body.udf4;
    const udf5 = req.body.udf5;
    const paymentId = req.body.mihpayid || req.body.payuMoneyId || txnid;
    const computed = buildResponseHash({
        key,
        salt,
        status,
        txnid,
        amount,
        productinfo,
        firstname,
        email,
        udf1,
        udf2,
        udf3,
        udf4,
        udf5,
    });
    const frontendUrl = getFrontendUrl();
    if (computed !== receivedHash) {
        return res.redirect(`${frontendUrl}/payment-status/${txnid}`);
    }
    const draft = removeDraft(txnid);
    const statusRows = await (0, db_1.dbQuery)('SELECT order_id, method, amount FROM payment_status WHERE token = ? LIMIT 1', [txnid]);
    const statusRow = statusRows[0];
    const linkedOrderId = statusRow?.order_id || draft?.orderId;
    const { min, max } = await (0, eta_1.getEtaConfig)();
    const etaText = (0, eta_1.getEtaText)(min, max);
    const estimatedDelivery = (0, eta_1.getEstimatedDeliveryDate)(max);
    const methodLabel = draft?.method === 'card' ? 'PayU Card' : draft?.method === 'upi' ? 'PayU UPI' : (statusRow?.method || 'PayU UPI');
    if (status === 'success') {
        let orderRow = null;
        let orderId = linkedOrderId;
        if (orderId) {
            const rows = await (0, db_1.dbQuery)('SELECT * FROM orders WHERE id = ? LIMIT 1', [orderId]);
            orderRow = rows[0];
        }
        if (!orderRow && draft?.order) {
            orderRow = await insertOrder({ ...draft.order, estimatedDelivery }, estimatedDelivery);
            orderId = orderRow.id;
        }
        if (!orderRow) {
            return res.redirect(`${frontendUrl}/payment-status/${txnid}`);
        }
        const history = (0, dbHelpers_1.parseJson)(orderRow.status_history, []);
        history.push({ status: 'confirmed', date: new Date().toISOString(), note: 'Payment successful via PayU' });
        await (0, db_1.dbExecute)('UPDATE orders SET status = ?, status_history = ?, updated_at = NOW() WHERE id = ?', ['confirmed', JSON.stringify(history), orderId]);
        const refreshedRows = await (0, db_1.dbQuery)('SELECT * FROM orders WHERE id = ? LIMIT 1', [orderId]);
        orderRow = refreshedRows[0] || orderRow;
        if (orderRow.customer_email) {
            const parsedItems = (0, dbHelpers_1.parseJson)(orderRow.items, []);
            const itemsCount = parsedItems.length || 0;
            (0, email_1.sendOrderConfirmation)(orderRow.customer_email, {
                orderId: String(orderId),
                total: orderRow.total,
                itemsCount,
                eta: etaText,
                items: parsedItems,
                paymentMethod: methodLabel,
                shippingAddress: (0, dbHelpers_1.parseJson)(orderRow.shipping_address, {}),
                billingAddress: (0, dbHelpers_1.parseJson)(orderRow.billing_address, {}),
            }).catch(() => { });
        }
        const existingPayments = await (0, db_1.dbQuery)('SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1', [orderId]);
        let payment = existingPayments[0];
        if (payment) {
            await (0, db_1.dbExecute)('UPDATE payments SET status = ?, transaction_id = ?, updated_at = NOW() WHERE id = ?', ['paid', String(paymentId), payment.id]);
            const paymentRows = await (0, db_1.dbQuery)('SELECT * FROM payments WHERE id = ? LIMIT 1', [payment.id]);
            payment = paymentRows[0];
        }
        else {
            const paymentResult = await (0, db_1.dbExecute)('INSERT INTO payments (order_id, customer_name, customer_email, method, amount, status, transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?)', [orderId, orderRow.customer_name || draft?.customer?.name || '', orderRow.customer_email || draft?.customer?.email || '', methodLabel, Number(amount), 'paid', String(paymentId)]);
            const paymentRows = await (0, db_1.dbQuery)('SELECT * FROM payments WHERE id = ? LIMIT 1', [paymentResult.insertId]);
            payment = paymentRows[0];
        }
        if (payment?.customer_email) {
            (0, email_1.sendPaymentReceipt)(payment.customer_email, {
                orderId: String(orderId),
                amount: payment.amount,
                paymentId: payment.transaction_id,
                eta: etaText,
                details: {
                    items: (0, dbHelpers_1.parseJson)(orderRow.items, []),
                    total: Number(orderRow.total),
                    paymentMethod: methodLabel,
                    shippingAddress: (0, dbHelpers_1.parseJson)(orderRow.shipping_address, {}),
                    billingAddress: (0, dbHelpers_1.parseJson)(orderRow.billing_address, {}),
                },
            }).catch(() => { });
        }
        (0, email_1.sendAdminPaymentNotice)({
            status: 'paid',
            orderId: String(orderId),
            amount: payment.amount,
            paymentId: payment.transaction_id,
            method: payment.method,
            customerEmail: payment.customer_email,
        }).catch(() => { });
        await (0, db_1.dbExecute)('INSERT INTO payment_status (token, status, order_id, amount, method, payment_id) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status), order_id = VALUES(order_id), amount = VALUES(amount), method = VALUES(method), payment_id = VALUES(payment_id), updated_at = NOW()', [txnid, 'paid', orderId, payment.amount, payment.method, payment.transaction_id]);
        return res.redirect(`${frontendUrl}/payment-status/${txnid}`);
    }
    const failedPayment = {
        orderId: 0,
        customerName: draft?.customer?.name || '',
        customerEmail: draft?.customer?.email || '',
        method: methodLabel,
        amount: Number(amount),
        status: 'failed',
        transactionId: String(paymentId),
    };
    if (linkedOrderId) {
        const rows = await (0, db_1.dbQuery)('SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1', [linkedOrderId]);
        const existing = rows[0];
        if (existing) {
            await (0, db_1.dbExecute)('UPDATE payments SET status = ?, transaction_id = ?, updated_at = NOW() WHERE id = ?', ['failed', failedPayment.transactionId, existing.id]);
        }
        else {
            await (0, db_1.dbExecute)('INSERT INTO payments (order_id, customer_name, customer_email, method, amount, status, transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?)', [linkedOrderId, failedPayment.customerName, failedPayment.customerEmail, failedPayment.method, failedPayment.amount, 'failed', failedPayment.transactionId]);
        }
    }
    else {
        await (0, db_1.dbExecute)('INSERT INTO payments (order_id, customer_name, customer_email, method, amount, status, transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?)', [null, failedPayment.customerName, failedPayment.customerEmail, failedPayment.method, failedPayment.amount, 'failed', failedPayment.transactionId]);
    }
    await (0, db_1.dbExecute)('INSERT INTO payment_status (token, status, order_id, amount, method, payment_id) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status), order_id = VALUES(order_id), amount = VALUES(amount), method = VALUES(method), payment_id = VALUES(payment_id), updated_at = NOW()', [txnid, 'failed', linkedOrderId || null, Number(amount), methodLabel, String(paymentId)]);
    if (linkedOrderId) {
        const rows = await (0, db_1.dbQuery)('SELECT * FROM orders WHERE id = ? LIMIT 1', [linkedOrderId]);
        const orderRow = rows[0];
        if (orderRow) {
            const history = (0, dbHelpers_1.parseJson)(orderRow.status_history, []);
            history.push({ status: 'cancelled', date: new Date().toISOString(), note: 'Payment failed via PayU' });
            await (0, db_1.dbExecute)('UPDATE orders SET status = ?, status_history = ?, updated_at = NOW() WHERE id = ?', ['cancelled', JSON.stringify(history), linkedOrderId]);
            (0, email_1.sendPaymentFailed)(orderRow.customer_email, {
                orderId: String(linkedOrderId),
                amount: Number(amount),
                paymentId: String(paymentId),
                eta: etaText,
                details: {
                    items: (0, dbHelpers_1.parseJson)(orderRow.items, []),
                    total: Number(orderRow.total),
                    paymentMethod: orderRow.payment_method,
                    shippingAddress: (0, dbHelpers_1.parseJson)(orderRow.shipping_address, {}),
                    billingAddress: (0, dbHelpers_1.parseJson)(orderRow.billing_address, {}),
                },
            }).catch(() => { });
        }
    }
    else if (draft?.customer?.email) {
        (0, email_1.sendPaymentFailed)(draft.customer.email, { orderId: 'N/A', amount: Number(amount), paymentId: String(paymentId), eta: etaText }).catch(() => { });
    }
    (0, email_1.sendAdminPaymentNotice)({
        status: 'failed',
        orderId: linkedOrderId ? String(linkedOrderId) : 'N/A',
        amount: Number(amount),
        paymentId: String(paymentId),
        method: methodLabel,
        customerEmail: draft?.customer?.email,
    }).catch(() => { });
    return res.redirect(`${frontendUrl}/payment-status/${txnid}`);
};
router.post('/success', async (req, res) => {
    handlePayuCallback(req, res, 'success').catch((err) => {
        console.error(err);
        res.redirect(`${getFrontendUrl()}/payment-status/${req.body?.txnid || 'unknown'}`);
    });
});
router.post('/failure', async (req, res) => {
    handlePayuCallback(req, res, 'failure').catch((err) => {
        console.error(err);
        res.redirect(`${getFrontendUrl()}/payment-status/${req.body?.txnid || 'unknown'}`);
    });
});
exports.default = router;
