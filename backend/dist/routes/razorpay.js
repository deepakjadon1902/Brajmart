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
const orderPricing_1 = require("../lib/orderPricing");
const userAddress_1 = require("../lib/userAddress");
const cod_1 = require("../lib/cod");
const router = (0, express_1.Router)();
const getRazorpayConfig = () => {
    const keyId = process.env.RAZORPAY_PLATFORM_KEY_ID || process.env.RAZORPAY_KEY_ID || '';
    const keySecret = process.env.RAZORPAY_PLATFORM_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET || '';
    const webhookSecret = process.env.RAZORPAY_PLATFORM_WEBHOOK_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET || '';
    return { keyId, keySecret, webhookSecret };
};
const hmacSha256 = (value, secret) => crypto_1.default.createHmac('sha256', secret).update(value).digest('hex');
const timingSafeEqual = (a, b) => {
    const left = Buffer.from(a || '', 'hex');
    const right = Buffer.from(b || '', 'hex');
    return left.length === right.length && crypto_1.default.timingSafeEqual(left, right);
};
const insertOrder = async (orderData, estimatedDelivery) => {
    const status = orderData.status || 'confirmed';
    const statusHistory = Array.isArray(orderData.statusHistory) && orderData.statusHistory.length
        ? orderData.statusHistory
        : [{ status, date: new Date().toISOString(), note: 'Order placed successfully' }];
    const result = await (0, db_1.dbExecute)('INSERT INTO orders (user_id, items, items_subtotal, packaging_amount, packaging_rate, shipping_amount, cod_amount, cod_available, cod_pincode, cod_message, total, status, customer_name, customer_email, shipping_address, billing_address, payment_method, tracking_id, estimated_delivery, status_history) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
        orderData.userId || null,
        JSON.stringify(orderData.items || []),
        orderData.itemsSubtotal,
        orderData.packagingAmount,
        orderData.packagingRate,
        orderData.shippingAmount,
        orderData.codAmount || 0,
        orderData.codAvailable,
        orderData.codPincode || null,
        orderData.codMessage || null,
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
    const rows = await (0, db_1.dbQuery)('SELECT * FROM orders WHERE id = ? LIMIT 1', [result.insertId]);
    return rows[0];
};
const createRazorpayOrder = async (params) => {
    const auth = Buffer.from(`${params.keyId}:${params.keySecret}`).toString('base64');
    const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            amount: params.amountPaise,
            currency: params.currency,
            receipt: params.receipt,
            payment_capture: true,
            notes: params.notes,
        }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = data?.error?.description || data?.message || 'Failed to create Razorpay order';
        throw new Error(message);
    }
    return data;
};
const getOrderDetails = async (orderRow) => ({
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
});
const updateOrderForPayment = async (params) => {
    const statusRows = await (0, db_1.dbQuery)('SELECT * FROM payment_status WHERE token = ? LIMIT 1', [params.razorpayOrderId]);
    const statusRow = statusRows[0];
    if (!statusRow)
        return null;
    const alreadyFinal = String(statusRow.status || '') === params.status;
    if (alreadyFinal) {
        if (params.razorpayPaymentId && String(statusRow.payment_id || '') !== params.razorpayPaymentId) {
            await (0, db_1.dbExecute)('UPDATE payment_status SET payment_id = ?, updated_at = NOW() WHERE token = ?', [params.razorpayPaymentId, params.razorpayOrderId]);
            await (0, db_1.dbExecute)('UPDATE payments SET transaction_id = ?, updated_at = NOW() WHERE order_id = ? ORDER BY id DESC LIMIT 1', [params.razorpayPaymentId, statusRow.order_id]);
        }
        return { orderId: statusRow.order_id, paymentId: params.razorpayPaymentId || statusRow.payment_id || params.razorpayOrderId, status: params.status };
    }
    const orderRows = await (0, db_1.dbQuery)('SELECT * FROM orders WHERE id = ? LIMIT 1', [statusRow.order_id]);
    let orderRow = orderRows[0];
    if (!orderRow)
        return null;
    const orderStatus = params.status === 'paid' ? 'confirmed' : 'cancelled';
    const history = (0, dbHelpers_1.parseJson)(orderRow.status_history, []);
    const alreadyHasTerminalNote = history.some((entry) => String(entry.note || '') === params.note);
    if (!alreadyHasTerminalNote) {
        history.push({ status: orderStatus, date: new Date().toISOString(), note: params.note });
    }
    await (0, db_1.dbExecute)('UPDATE orders SET status = ?, status_history = ?, updated_at = NOW() WHERE id = ?', [orderStatus, JSON.stringify(history), statusRow.order_id]);
    const paymentRows = await (0, db_1.dbQuery)('SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1', [statusRow.order_id]);
    const paymentRow = paymentRows[0];
    const transactionId = params.razorpayPaymentId || paymentRow?.transaction_id || params.razorpayOrderId;
    if (paymentRow) {
        await (0, db_1.dbExecute)('UPDATE payments SET status = ?, transaction_id = ?, updated_at = NOW() WHERE id = ?', [params.status, transactionId, paymentRow.id]);
    }
    else {
        await (0, db_1.dbExecute)('INSERT INTO payments (order_id, customer_name, customer_email, method, amount, status, transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?)', [statusRow.order_id, orderRow.customer_name || '', orderRow.customer_email || '', statusRow.method || 'Razorpay', Number(statusRow.amount || orderRow.total || 0), params.status, transactionId]);
    }
    await (0, db_1.dbExecute)('INSERT INTO payment_status (token, status, order_id, amount, method, payment_id) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status), order_id = VALUES(order_id), amount = VALUES(amount), method = VALUES(method), payment_id = VALUES(payment_id), updated_at = NOW()', [params.razorpayOrderId, params.status, statusRow.order_id, Number(statusRow.amount || orderRow.total || 0), statusRow.method || 'Razorpay', transactionId]);
    const refreshedRows = await (0, db_1.dbQuery)('SELECT * FROM orders WHERE id = ? LIMIT 1', [statusRow.order_id]);
    orderRow = refreshedRows[0] || orderRow;
    const details = await getOrderDetails(orderRow);
    const { min, max } = await (0, eta_1.getEtaConfig)();
    const etaText = (0, eta_1.getEtaText)(min, max);
    if (orderRow.customer_email) {
        if (params.status === 'paid') {
            (0, email_1.sendOrderConfirmation)(orderRow.customer_email, {
                orderId: String(statusRow.order_id),
                itemsCount: details.items.length || 0,
                eta: etaText,
                ...details,
            }).catch(() => { });
            (0, email_1.sendPaymentReceipt)(orderRow.customer_email, {
                orderId: String(statusRow.order_id),
                amount: Number(statusRow.amount || orderRow.total || 0),
                paymentId: transactionId,
                eta: etaText,
                details,
            }).catch(() => { });
        }
        else {
            (0, email_1.sendPaymentFailed)(orderRow.customer_email, {
                orderId: String(statusRow.order_id),
                amount: Number(statusRow.amount || orderRow.total || 0),
                paymentId: transactionId,
                eta: etaText,
                details,
            }).catch(() => { });
        }
    }
    (0, email_1.sendAdminPaymentNotice)({
        status: params.status,
        orderId: String(statusRow.order_id),
        amount: Number(statusRow.amount || orderRow.total || 0),
        paymentId: transactionId,
        method: statusRow.method || 'Razorpay',
        customerEmail: orderRow.customer_email,
    }).catch(() => { });
    return { orderId: statusRow.order_id, paymentId: transactionId, status: params.status };
};
router.post('/create-order', auth_1.optionalAuth, async (req, res) => {
    try {
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        const { keyId, keySecret } = getRazorpayConfig();
        if (!keyId || !keySecret)
            return res.status(500).json({ message: 'Razorpay credentials are not configured' });
        const { amount, order, customer } = req.body || {};
        if (!order || !customer?.email || !customer?.name)
            return res.status(400).json({ message: 'Missing order details' });
        const customerEmail = String(customer.email || '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
            return res.status(400).json({ message: 'Enter a valid customer email' });
        }
        const priced = await (0, orderPricing_1.priceAndValidateOrderItems)(order.items || []);
        if (!priced.ok)
            return res.status(400).json({ message: priced.message });
        if ((Boolean(order?.codRequested) || Number(order?.codAmount || 0) > 0) && (0, orderPricing_1.hasPrasadamItems)(priced.items)) {
            return res.status(400).json({ message: 'COD is not available for Prasadam products. Please use online payment for Prasadam orders.' });
        }
        const settings = await (0, orderPricing_1.getCheckoutSettings)();
        const baseTotals = (0, orderPricing_1.computeTotals)(priced.itemsSubtotal, settings);
        const cod = await (0, cod_1.resolveCodHandleFee)(order, settings);
        const totals = { ...baseTotals, cod: cod.amount, total: baseTotals.total + cod.amount };
        if (settings.minOrderAmount && totals.total < settings.minOrderAmount) {
            return res.status(400).json({ message: `Minimum order amount is ${settings.minOrderAmount}` });
        }
        if (settings.maxOrderQuantity) {
            const totalQty = priced.items.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0);
            if (totalQty > settings.maxOrderQuantity) {
                return res.status(400).json({ message: `Maximum order quantity is ${settings.maxOrderQuantity}` });
            }
        }
        if (amount !== undefined) {
            const clientAmount = Number(amount);
            if (Number.isFinite(clientAmount) && Math.abs(clientAmount - totals.total) > 0.01) {
                return res.status(400).json({ message: 'Cart total changed. Please refresh and try again.' });
            }
        }
        const { max } = await (0, eta_1.getEtaConfig)();
        const estimatedDelivery = (0, eta_1.getEstimatedDeliveryDate)(max);
        const rawUserId = req.user?.id;
        const numericUserId = rawUserId && Number.isFinite(Number(rawUserId)) ? Number(rawUserId) : null;
        const orderRow = await insertOrder({
            ...order,
            userId: numericUserId ?? null,
            items: priced.items,
            itemsSubtotal: totals.itemsSubtotal,
            packagingAmount: totals.packaging,
            packagingRate: settings.packagingRate,
            shippingAmount: totals.shipping,
            codAmount: cod.amount,
            codAvailable: cod.available,
            codPincode: cod.pincode,
            codMessage: cod.message,
            total: totals.total,
            paymentMethod: 'Razorpay',
            status: 'processing',
            statusHistory: [{ status: 'processing', date: new Date().toISOString(), note: 'Payment initiated via Razorpay' }],
            customerEmail,
        }, estimatedDelivery);
        if (numericUserId) {
            const addrToSave = order?.shippingAddress || order?.billingAddress;
            (0, userAddress_1.upsertUserDefaultAddress)(numericUserId, addrToSave).catch(() => { });
        }
        const amountPaise = Math.round(Number(totals.total) * 100);
        const razorpayOrder = await createRazorpayOrder({
            keyId,
            keySecret,
            amountPaise,
            currency: 'INR',
            receipt: `BM-${orderRow.id}-${Date.now()}`,
            notes: {
                brajmart_order_id: String(orderRow.id),
                customer_email: customerEmail,
            },
        });
        await (0, db_1.dbExecute)('INSERT INTO payments (order_id, customer_name, customer_email, method, amount, status, transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?)', [orderRow.id, customer.name, customerEmail, 'Razorpay', Number(totals.total), 'pending', razorpayOrder.id]);
        await (0, db_1.dbExecute)('INSERT INTO payment_status (token, status, order_id, amount, method, payment_id) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status), order_id = VALUES(order_id), amount = VALUES(amount), method = VALUES(method), payment_id = VALUES(payment_id), updated_at = NOW()', [razorpayOrder.id, 'pending', orderRow.id, Number(totals.total), 'Razorpay', null]);
        return res.json({
            keyId,
            orderId: razorpayOrder.id,
            statusToken: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency || 'INR',
            name: 'BrajMart',
            description: `Order #${orderRow.id}`,
            prefill: {
                name: customer.name,
                email: customerEmail,
                contact: customer.phone || '',
            },
        });
    }
    catch (err) {
        return res.status(500).json({ message: err?.message || 'Failed to create Razorpay order' });
    }
});
router.post('/verify', async (req, res) => {
    try {
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        const { keySecret } = getRazorpayConfig();
        if (!keySecret)
            return res.status(500).json({ message: 'Razorpay credentials are not configured' });
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ message: 'Missing Razorpay payment details' });
        }
        const expected = hmacSha256(`${razorpay_order_id}|${razorpay_payment_id}`, keySecret);
        if (!timingSafeEqual(expected, String(razorpay_signature))) {
            return res.status(400).json({ message: 'Invalid Razorpay signature' });
        }
        const result = await updateOrderForPayment({
            razorpayOrderId: String(razorpay_order_id),
            razorpayPaymentId: String(razorpay_payment_id),
            status: 'paid',
            note: 'Payment verified via Razorpay checkout signature',
        });
        if (!result)
            return res.status(404).json({ message: 'Payment not found' });
        return res.json({ ok: true, ...result });
    }
    catch (err) {
        return res.status(500).json({ message: err?.message || 'Failed to verify Razorpay payment' });
    }
});
router.post('/failed', async (req, res) => {
    try {
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        const { razorpay_order_id, razorpay_payment_id, customer_email, reason, } = req.body || {};
        const razorpayOrderId = String(razorpay_order_id || '').trim();
        const customerEmail = String(customer_email || '').trim().toLowerCase();
        if (!razorpayOrderId || !customerEmail) {
            return res.status(400).json({ message: 'Missing Razorpay order or customer email' });
        }
        const statusRows = await (0, db_1.dbQuery)('SELECT order_id FROM payment_status WHERE token = ? LIMIT 1', [razorpayOrderId]);
        const statusRow = statusRows[0];
        if (!statusRow?.order_id)
            return res.status(404).json({ message: 'Payment not found' });
        const orderRows = await (0, db_1.dbQuery)('SELECT customer_email FROM orders WHERE id = ? LIMIT 1', [statusRow.order_id]);
        const orderEmail = String(orderRows[0]?.customer_email || '').trim().toLowerCase();
        if (!orderEmail || orderEmail !== customerEmail) {
            return res.status(403).json({ message: 'Payment does not match this customer' });
        }
        const noteReason = String(reason || '').trim();
        const result = await updateOrderForPayment({
            razorpayOrderId,
            razorpayPaymentId: razorpay_payment_id ? String(razorpay_payment_id) : undefined,
            status: 'failed',
            note: noteReason ? `Payment failed via Razorpay checkout: ${noteReason}` : 'Payment failed via Razorpay checkout',
        });
        if (!result)
            return res.status(404).json({ message: 'Payment not found' });
        return res.json({ ok: true, ...result });
    }
    catch (err) {
        return res.status(500).json({ message: err?.message || 'Failed to record Razorpay payment failure' });
    }
});
router.post('/webhook', async (req, res) => {
    try {
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        const { webhookSecret } = getRazorpayConfig();
        if (!webhookSecret)
            return res.status(500).json({ message: 'Razorpay webhook secret is not configured' });
        const signature = String(req.headers['x-razorpay-signature'] || '');
        const rawBody = typeof req.rawBody === 'string' ? req.rawBody : JSON.stringify(req.body || {});
        const expected = hmacSha256(rawBody, webhookSecret);
        if (!signature || !timingSafeEqual(expected, signature)) {
            return res.status(400).json({ message: 'Invalid webhook signature' });
        }
        const event = String(req.body?.event || '');
        const payment = req.body?.payload?.payment?.entity || null;
        const order = req.body?.payload?.order?.entity || null;
        const razorpayOrderId = String(payment?.order_id || order?.id || '');
        const razorpayPaymentId = payment?.id ? String(payment.id) : undefined;
        if (!razorpayOrderId)
            return res.status(200).json({ ok: true, ignored: true, reason: 'No order id' });
        if (event === 'payment.captured' || event === 'order.paid') {
            await updateOrderForPayment({
                razorpayOrderId,
                razorpayPaymentId,
                status: 'paid',
                note: 'Payment confirmed via Razorpay webhook',
            });
        }
        else if (event === 'payment.failed') {
            await updateOrderForPayment({
                razorpayOrderId,
                razorpayPaymentId,
                status: 'failed',
                note: 'Payment failed via Razorpay webhook',
            });
        }
        return res.json({ ok: true });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ message: err?.message || 'Webhook processing failed' });
    }
});
exports.default = router;
