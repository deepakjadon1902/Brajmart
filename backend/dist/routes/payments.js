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
const orderVisibility_1 = require("../lib/orderVisibility");
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
const getAdminPaymentRows = async () => {
    const rows = await (0, db_1.dbQuery)(`SELECT
       CONCAT('payment:', p.id) AS id,
       p.order_id,
       p.customer_name,
       p.customer_email,
       p.method,
       p.amount,
       p.status,
       p.transaction_id,
       p.created_at,
       p.updated_at
     FROM payments p
     WHERE ${(0, orderVisibility_1.finalPaymentWhereSql)('p')}
     UNION ALL
     SELECT
       CONCAT('status:', ps.token) AS id,
       ps.order_id,
       COALESCE(o.customer_name, '') AS customer_name,
       COALESCE(o.customer_email, '') AS customer_email,
       COALESCE(ps.method, o.payment_method, 'Unknown') AS method,
       COALESCE(ps.amount, o.total, 0) AS amount,
       ps.status,
       COALESCE(ps.payment_id, ps.token) AS transaction_id,
       ps.created_at,
       ps.updated_at
     FROM payment_status ps
     LEFT JOIN orders o ON o.id = ps.order_id
     WHERE ps.status IN ('paid', 'failed', 'refunded')
       AND NOT EXISTS (
       SELECT 1
       FROM payments p
       WHERE p.order_id = ps.order_id
          OR p.transaction_id = ps.token
          OR (ps.payment_id IS NOT NULL AND p.transaction_id = ps.payment_id)
       LIMIT 1
     )
     ORDER BY created_at DESC`);
    return rows.map((row) => ({
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
    }));
};
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
const getRazorpayConfig = () => {
    const keyId = process.env.RAZORPAY_PLATFORM_KEY_ID || process.env.RAZORPAY_KEY_ID || '';
    const keySecret = process.env.RAZORPAY_PLATFORM_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET || '';
    return { keyId, keySecret };
};
const fetchRazorpayJson = async (path) => {
    const { keyId, keySecret } = getRazorpayConfig();
    if (!keyId || !keySecret)
        return null;
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const res = await fetch(`https://api.razorpay.com/v1${path}`, {
        headers: { Authorization: `Basic ${auth}` },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok)
        return null;
    return data;
};
const getPaymentOrderDetails = async (orderId) => {
    if (!orderId)
        return null;
    const orderRows = await (0, db_1.dbQuery)('SELECT * FROM orders WHERE id = ? LIMIT 1', [orderId]);
    const orderRow = orderRows[0];
    if (!orderRow)
        return null;
    return {
        orderRow,
        details: {
            items: (0, dbHelpers_1.parseJson)(orderRow.items, []),
            total: Number(orderRow.total),
            itemsSubtotal: orderRow.items_subtotal == null ? undefined : Number(orderRow.items_subtotal),
            shippingAmount: orderRow.shipping_amount == null ? undefined : Number(orderRow.shipping_amount),
            packagingAmount: orderRow.packaging_amount == null ? undefined : Number(orderRow.packaging_amount),
            packagingRate: orderRow.packaging_rate == null ? undefined : Number(orderRow.packaging_rate),
            codAmount: orderRow.cod_amount == null ? undefined : Number(orderRow.cod_amount),
            codAvailable: orderRow.cod_available == null ? undefined : Boolean(Number(orderRow.cod_available)),
            codPincode: orderRow.cod_pincode ?? undefined,
            codMessage: orderRow.cod_message ?? undefined,
            paymentMethod: orderRow.payment_method,
            shippingAddress: (0, dbHelpers_1.parseJson)(orderRow.shipping_address, {}),
            billingAddress: (0, dbHelpers_1.parseJson)(orderRow.billing_address, {}),
        },
    };
};
const reconcilePendingPayuToken = async (token) => {
    if (!token)
        return null;
    if (!(0, db_1.isDbConnected)())
        return null;
    if (!(process.env.PAYU_KEY && process.env.PAYU_SALT))
        return null;
    const rows = await (0, db_1.dbQuery)('SELECT * FROM payment_status WHERE token = ? LIMIT 1', [token]);
    const current = rows[0];
    if (!current)
        return null;
    if (String(current.status) !== 'pending')
        return current;
    const verify = await verifyPayuPayment(token);
    const details = verify?.transaction_details?.[token] || verify?.transaction_details?.[String(token)] || null;
    const status = normalizePayuStatus(details?.status);
    const mihpayid = details?.mihpayid || details?.mihpayId || details?.payuid || null;
    if (status !== 'success' && status !== 'failure')
        return current;
    const nextStatus = status === 'success' ? 'paid' : 'failed';
    const orderId = current.order_id ?? null;
    const amount = current.amount ?? null;
    const method = current.method ?? null;
    const paymentId = mihpayid ? String(mihpayid) : null;
    await (0, db_1.dbExecute)('UPDATE payment_status SET status = ?, payment_id = COALESCE(?, payment_id), updated_at = NOW() WHERE token = ?', [nextStatus, paymentId, token]);
    let paymentRow = null;
    if (orderId) {
        const paymentRows = await (0, db_1.dbQuery)('SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1', [orderId]);
        paymentRow = paymentRows[0];
        if (paymentRow) {
            await (0, db_1.dbExecute)('UPDATE payments SET status = ?, transaction_id = COALESCE(?, transaction_id), updated_at = NOW() WHERE id = ?', [nextStatus, paymentId, paymentRow.id]);
            const refreshed = await (0, db_1.dbQuery)('SELECT * FROM payments WHERE id = ? LIMIT 1', [paymentRow.id]);
            paymentRow = refreshed[0] || paymentRow;
        }
        if (!paymentRow) {
            const orderRows = await (0, db_1.dbQuery)('SELECT * FROM orders WHERE id = ? LIMIT 1', [orderId]);
            const orderRow = orderRows[0];
            if (orderRow) {
                const inserted = await (0, db_1.dbExecute)('INSERT INTO payments (order_id, customer_name, customer_email, method, amount, status, transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?)', [orderId, orderRow.customer_name || '', orderRow.customer_email || '', method || orderRow.payment_method || 'PayU', Number(amount || orderRow.total || 0), nextStatus, paymentId || token]);
                const refreshed = await (0, db_1.dbQuery)('SELECT * FROM payments WHERE id = ? LIMIT 1', [inserted.insertId]);
                paymentRow = refreshed[0] || null;
            }
        }
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
    // If PayU callback/webhook was missed, still notify customer/admin.
    try {
        const { min, max } = await (0, eta_1.getEtaConfig)();
        const etaText = (0, eta_1.getEtaText)(min, max);
        if (paymentRow?.customer_email) {
            const orderData = await getPaymentOrderDetails(orderId);
            const orderDetails = orderData?.details || undefined;
            if (nextStatus === 'paid') {
                (0, email_1.sendPaymentReceipt)(paymentRow.customer_email, { orderId: String(orderId), amount: Number(amount || paymentRow.amount || 0), paymentId: paymentId || paymentRow.transaction_id, eta: etaText, details: orderDetails }).catch(() => { });
            }
            else {
                (0, email_1.sendPaymentFailed)(paymentRow.customer_email, { orderId: String(orderId), amount: Number(amount || paymentRow.amount || 0), paymentId: paymentId || paymentRow.transaction_id, eta: etaText, details: orderDetails }).catch(() => { });
            }
        }
        (0, email_1.sendAdminPaymentNotice)({
            status: nextStatus,
            orderId: orderId ? String(orderId) : 'N/A',
            amount: Number(amount || paymentRow?.amount || 0),
            paymentId: paymentId || token,
            method: method || paymentRow?.method,
            customerEmail: paymentRow?.customer_email,
        }).catch(() => { });
    }
    catch {
        // ignore email failures
    }
    const refreshed = await (0, db_1.dbQuery)('SELECT * FROM payment_status WHERE token = ? LIMIT 1', [token]);
    return refreshed[0] || current;
};
const applyRazorpayStatus = async (params) => {
    const rows = await (0, db_1.dbQuery)('SELECT * FROM payment_status WHERE token = ? LIMIT 1', [params.token]);
    const current = rows[0];
    if (!current)
        return null;
    if (String(current.status) === params.status)
        return current;
    const orderId = current.order_id ?? null;
    const paymentRows = orderId
        ? await (0, db_1.dbQuery)('SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1', [orderId])
        : [];
    let paymentRow = paymentRows[0];
    const transactionId = params.paymentId || paymentRow?.transaction_id || params.token;
    await (0, db_1.dbExecute)('UPDATE payment_status SET status = ?, payment_id = ?, updated_at = NOW() WHERE token = ?', [params.status, transactionId, params.token]);
    if (paymentRow) {
        await (0, db_1.dbExecute)('UPDATE payments SET status = ?, transaction_id = ?, updated_at = NOW() WHERE id = ?', [params.status, transactionId, paymentRow.id]);
        const refreshedPayments = await (0, db_1.dbQuery)('SELECT * FROM payments WHERE id = ? LIMIT 1', [paymentRow.id]);
        paymentRow = refreshedPayments[0] || paymentRow;
    }
    let orderData = null;
    if (orderId) {
        orderData = await getPaymentOrderDetails(orderId);
        if (orderData?.orderRow) {
            const orderStatus = params.status === 'paid' ? 'confirmed' : 'cancelled';
            const history = (0, dbHelpers_1.parseJson)(orderData.orderRow.status_history, []);
            if (!history.some((entry) => String(entry.note || '') === params.note)) {
                history.push({ status: orderStatus, date: new Date().toISOString(), note: params.note });
            }
            await (0, db_1.dbExecute)('UPDATE orders SET status = ?, status_history = ?, updated_at = NOW() WHERE id = ?', [orderStatus, JSON.stringify(history), orderId]);
            orderData = await getPaymentOrderDetails(orderId);
        }
    }
    if (!paymentRow && orderData?.orderRow) {
        const inserted = await (0, db_1.dbExecute)('INSERT INTO payments (order_id, customer_name, customer_email, method, amount, status, transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?)', [
            orderId,
            orderData.orderRow.customer_name || '',
            orderData.orderRow.customer_email || '',
            current.method || orderData.orderRow.payment_method || 'Razorpay',
            Number(current.amount || orderData.orderRow.total || 0),
            params.status,
            transactionId,
        ]);
        const refreshedPayments = await (0, db_1.dbQuery)('SELECT * FROM payments WHERE id = ? LIMIT 1', [inserted.insertId]);
        paymentRow = refreshedPayments[0] || null;
    }
    try {
        const { min, max } = await (0, eta_1.getEtaConfig)();
        const etaText = (0, eta_1.getEtaText)(min, max);
        const details = orderData?.details || undefined;
        const customerEmail = paymentRow?.customer_email || orderData?.orderRow?.customer_email;
        const amount = Number(current.amount || paymentRow?.amount || orderData?.orderRow?.total || 0);
        if (customerEmail) {
            if (params.status === 'paid') {
                if (orderData?.orderRow) {
                    (0, email_1.sendOrderConfirmation)(customerEmail, {
                        orderId: String(orderId),
                        total: Number(orderData.orderRow.total || amount),
                        itemsCount: details?.items?.length || 0,
                        eta: etaText,
                        ...details,
                    }).catch(() => { });
                }
                (0, email_1.sendPaymentReceipt)(customerEmail, { orderId: String(orderId), amount, paymentId: transactionId, eta: etaText, details }).catch(() => { });
            }
            else {
                (0, email_1.sendPaymentFailed)(customerEmail, { orderId: String(orderId), amount, paymentId: transactionId, eta: etaText, details }).catch(() => { });
            }
        }
        (0, email_1.sendAdminPaymentNotice)({
            status: params.status,
            orderId: orderId ? String(orderId) : 'N/A',
            amount,
            paymentId: transactionId,
            method: current.method || paymentRow?.method || 'Razorpay',
            customerEmail,
        }).catch(() => { });
    }
    catch {
        // ignore email failures during reconciliation
    }
    const refreshed = await (0, db_1.dbQuery)('SELECT * FROM payment_status WHERE token = ? LIMIT 1', [params.token]);
    return refreshed[0] || current;
};
const reconcilePendingRazorpayToken = async (token) => {
    if (!token || !(0, db_1.isDbConnected)())
        return null;
    const rows = await (0, db_1.dbQuery)('SELECT * FROM payment_status WHERE token = ? LIMIT 1', [token]);
    const current = rows[0];
    if (!current || String(current.status) !== 'pending')
        return current || null;
    let capturedPayment = null;
    let failedPayment = null;
    if (token.startsWith('order_')) {
        const order = await fetchRazorpayJson(`/orders/${encodeURIComponent(token)}`);
        const orderPayments = await fetchRazorpayJson(`/orders/${encodeURIComponent(token)}/payments`);
        const items = Array.isArray(orderPayments?.items) ? orderPayments.items : [];
        capturedPayment = items.find((p) => String(p?.status || '').toLowerCase() === 'captured') || null;
        failedPayment = items.find((p) => String(p?.status || '').toLowerCase() === 'failed') || null;
        if (!capturedPayment && (String(order?.status || '').toLowerCase() === 'paid' || Number(order?.amount_paid || 0) >= Number(order?.amount || 1))) {
            capturedPayment = items[0] || { id: token };
        }
    }
    else if (token.startsWith('pay_')) {
        const payment = await fetchRazorpayJson(`/payments/${encodeURIComponent(token)}`);
        if (String(payment?.status || '').toLowerCase() === 'captured')
            capturedPayment = payment;
        if (String(payment?.status || '').toLowerCase() === 'failed')
            failedPayment = payment;
    }
    if (!capturedPayment && Number(current.amount || 0) > 0) {
        const currentRows = await (0, db_1.dbQuery)('SELECT created_at FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1', [current.order_id]);
        const createdAtMs = currentRows[0]?.created_at ? new Date(currentRows[0].created_at).getTime() : Date.now();
        const from = Math.floor((createdAtMs - 60 * 60 * 1000) / 1000);
        const to = Math.floor((Date.now() + 5 * 60 * 1000) / 1000);
        const payments = await fetchRazorpayJson(`/payments?count=100&from=${from}&to=${to}`);
        const matches = (Array.isArray(payments?.items) ? payments.items : []).filter((p) => String(p?.status || '').toLowerCase() === 'captured'
            && !p?.order_id
            && Math.round(Number(current.amount) * 100) === Number(p?.amount));
        if (matches.length === 1)
            capturedPayment = matches[0];
    }
    if (capturedPayment) {
        return applyRazorpayStatus({
            token,
            status: 'paid',
            paymentId: capturedPayment?.id ? String(capturedPayment.id) : undefined,
            note: 'Payment reconciled from Razorpay API',
        });
    }
    if (failedPayment) {
        return applyRazorpayStatus({
            token,
            status: 'failed',
            paymentId: failedPayment?.id ? String(failedPayment.id) : undefined,
            note: 'Payment failure reconciled from Razorpay API',
        });
    }
    return current;
};
router.get('/', auth_1.auth, auth_1.adminOnly, async (_req, res) => {
    try {
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        res.json(await getAdminPaymentRows());
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.post('/reconcile', auth_1.auth, auth_1.adminOnly, async (_req, res) => {
    try {
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        const pending = await (0, db_1.dbQuery)("SELECT token FROM payment_status WHERE status = 'pending' AND method LIKE 'PayU%' ORDER BY updated_at DESC LIMIT 25");
        let reconciled = 0;
        if (process.env.PAYU_KEY && process.env.PAYU_SALT) {
            for (const row of pending) {
                const token = String(row?.token || '').trim();
                if (!token)
                    continue;
                try {
                    const beforeRows = await (0, db_1.dbQuery)('SELECT status FROM payment_status WHERE token = ? LIMIT 1', [token]);
                    const before = String(beforeRows?.[0]?.status || '');
                    const after = await reconcilePendingPayuToken(token);
                    const afterStatus = String(after?.status || '');
                    if (before === 'pending' && afterStatus !== 'pending')
                        reconciled += 1;
                }
                catch {
                    // ignore
                }
            }
        }
        const pendingRazorpay = await (0, db_1.dbQuery)("SELECT token FROM payment_status WHERE status = 'pending' AND method = 'Razorpay' ORDER BY updated_at DESC LIMIT 25");
        for (const row of pendingRazorpay) {
            const token = String(row?.token || '').trim();
            if (!token)
                continue;
            try {
                const beforeRows = await (0, db_1.dbQuery)('SELECT status FROM payment_status WHERE token = ? LIMIT 1', [token]);
                const before = String(beforeRows?.[0]?.status || '');
                const after = await reconcilePendingRazorpayToken(token);
                const afterStatus = String(after?.status || '');
                if (before === 'pending' && afterStatus !== 'pending')
                    reconciled += 1;
            }
            catch {
                // ignore
            }
        }
        return res.json({ ok: true, reconciled });
    }
    catch (err) {
        return res.status(500).json({ message: err?.message || 'Failed to reconcile payments' });
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
        // Auto-reconcile pending payments (no manual verification needed).
        // If webhook is delayed/missed, verify directly with the gateway while the customer views the status page.
        const current = rows[0];
        if (String(current.status) === 'pending' && (process.env.PAYU_KEY && process.env.PAYU_SALT)) {
            try {
                const reconciled = await reconcilePendingPayuToken(token);
                if (reconciled && String(reconciled.status) !== 'pending')
                    return res.json(mapPaymentStatusRow(reconciled));
            }
            catch {
                // ignore reconciliation errors; fall back to current pending status
            }
        }
        if (String(current.status) === 'pending' && String(current.method || '') === 'Razorpay') {
            try {
                const reconciled = await reconcilePendingRazorpayToken(token);
                if (reconciled && String(reconciled.status) !== 'pending')
                    return res.json(mapPaymentStatusRow(reconciled));
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
router.post('/', auth_1.auth, async (_req, res) => {
    return res.status(403).json({ message: 'Payments are recorded only by verified gateway callbacks.' });
});
router.put('/:id', auth_1.auth, auth_1.adminOnly, async (req, res) => {
    try {
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        if (String(req.body?.status || '').toLowerCase() === 'paid') {
            return res.status(400).json({ message: 'Paid status can only be set by verified gateway confirmation.' });
        }
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
                    itemsSubtotal: orderRow.items_subtotal == null ? undefined : Number(orderRow.items_subtotal),
                    shippingAmount: orderRow.shipping_amount == null ? undefined : Number(orderRow.shipping_amount),
                    packagingAmount: orderRow.packaging_amount == null ? undefined : Number(orderRow.packaging_amount),
                    packagingRate: orderRow.packaging_rate == null ? undefined : Number(orderRow.packaging_rate),
                    codAmount: orderRow.cod_amount == null ? undefined : Number(orderRow.cod_amount),
                    codAvailable: orderRow.cod_available == null ? undefined : Boolean(Number(orderRow.cod_available)),
                    codPincode: orderRow.cod_pincode ?? undefined,
                    codMessage: orderRow.cod_message ?? undefined,
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
