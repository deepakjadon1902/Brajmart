"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasPrasadamItems = exports.isPrasadamItem = exports.priceAndValidateOrderItems = exports.applyCouponToTotals = exports.markCouponUsed = exports.computeTotals = exports.getCheckoutSettings = void 0;
const db_1 = require("./db");
const dbHelpers_1 = require("./dbHelpers");
const asInt = (value) => {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n))
        return null;
    const i = Math.floor(n);
    return i;
};
const asMoney = (value) => {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n))
        return null;
    return n;
};
const getCheckoutSettings = async () => {
    const rows = await (0, db_1.dbQuery)('SELECT free_shipping_threshold, shipping_fee, packaging_rate, tax_rate, min_order_amount, max_order_quantity, cod_enabled FROM settings LIMIT 1');
    const row = rows?.[0] || {};
    return {
        freeShippingThreshold: Number(row.free_shipping_threshold ?? 299) || 299,
        shippingFee: Number(row.shipping_fee ?? 49) || 49,
        // tax_rate remains the rollout-compatible source while older backend instances exist.
        packagingRate: Number(row.tax_rate ?? row.packaging_rate ?? 0) || 0,
        minOrderAmount: Number(row.min_order_amount ?? 0) || 0,
        maxOrderQuantity: Number(row.max_order_quantity ?? 0) || 0,
        codEnabled: (0, dbHelpers_1.boolFromDb)(row.cod_enabled ?? 1),
    };
};
exports.getCheckoutSettings = getCheckoutSettings;
const computeTotals = (itemsSubtotal, settings) => {
    const shipping = itemsSubtotal >= settings.freeShippingThreshold ? 0 : settings.shippingFee;
    const packaging = Math.round(itemsSubtotal * Math.max(0, settings.packagingRate) / 100);
    const total = itemsSubtotal + packaging + shipping;
    return { itemsSubtotal, packaging, shipping, total };
};
exports.computeTotals = computeTotals;
const normalizeCouponCode = (value) => String(value ?? '').trim().toUpperCase().replace(/\s+/g, '');
const markCouponUsed = async (rawCode) => {
    const code = normalizeCouponCode(rawCode);
    if (!code)
        return false;
    const result = await (0, db_1.dbExecute)('UPDATE coupons SET used_count = used_count + 1, updated_at = NOW() WHERE code = ? AND (usage_limit IS NULL OR used_count < usage_limit)', [code]);
    return Number(result?.affectedRows || 0) > 0;
};
exports.markCouponUsed = markCouponUsed;
const applyCouponToTotals = async (rawCode, items, totals) => {
    const code = normalizeCouponCode(rawCode);
    if (!code) {
        return {
            valid: false,
            message: 'Enter a coupon code',
            totals,
            coupon: null,
        };
    }
    const rows = await (0, db_1.dbQuery)('SELECT * FROM coupons WHERE code = ? AND is_active = 1 LIMIT 1', [code]);
    const coupon = rows[0];
    if (!coupon) {
        return { valid: false, message: 'Invalid or inactive coupon code', totals, coupon: null };
    }
    const now = Date.now();
    if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) {
        return { valid: false, message: 'This coupon is not active yet', totals, coupon: null };
    }
    if (coupon.ends_at && new Date(coupon.ends_at).getTime() < now) {
        return { valid: false, message: 'This coupon has expired', totals, coupon: null };
    }
    if (coupon.usage_limit !== null && coupon.usage_limit !== undefined && Number(coupon.used_count || 0) >= Number(coupon.usage_limit)) {
        return { valid: false, message: 'This coupon usage limit has been reached', totals, coupon: null };
    }
    const scopeType = String(coupon.scope_type || 'all');
    const scopeValue = String(coupon.scope_value || '');
    const eligibleItems = items.filter((item) => {
        if (scopeType === 'all')
            return true;
        if (scopeType === 'product')
            return String(item.productId) === scopeValue;
        if (scopeType === 'category')
            return String(item.category || '').trim().toLowerCase() === scopeValue.trim().toLowerCase();
        return false;
    });
    if (eligibleItems.length === 0) {
        return { valid: false, message: 'Coupon is not applicable to these products', totals, coupon: null };
    }
    const eligibleSubtotal = eligibleItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const minOrderAmount = Number(coupon.min_order_amount || 0);
    if (minOrderAmount > 0 && totals.itemsSubtotal < minOrderAmount) {
        return { valid: false, message: `Minimum order amount for this coupon is ${minOrderAmount}`, totals, coupon: null };
    }
    let productDiscount = 0;
    const discountType = String(coupon.discount_type || 'amount');
    const discountValue = Math.max(0, Number(coupon.discount_value || 0));
    if (discountType === 'percent') {
        productDiscount = Math.round(eligibleSubtotal * discountValue / 100);
    }
    else {
        productDiscount = Math.min(discountValue, eligibleSubtotal);
    }
    const maxDiscount = Number(coupon.max_discount || 0);
    if (maxDiscount > 0)
        productDiscount = Math.min(productDiscount, maxDiscount);
    const freeShipping = Boolean(Number(coupon.free_shipping)) ? totals.shipping : 0;
    const freePackaging = Boolean(Number(coupon.free_packaging)) ? totals.packaging : 0;
    const discountAmount = Math.min(totals.total, productDiscount + freeShipping + freePackaging);
    const nextTotals = {
        ...totals,
        couponDiscount: discountAmount,
        total: Math.max(0, totals.total - discountAmount),
    };
    const description = [
        productDiscount > 0 ? `${discountType === 'percent' ? `${discountValue}%` : `₹${productDiscount}`} off` : '',
        freeShipping > 0 ? 'free shipping' : '',
        freePackaging > 0 ? 'free packaging' : '',
    ].filter(Boolean).join(', ');
    return {
        valid: true,
        message: 'Coupon applied',
        totals: nextTotals,
        coupon: {
            id: Number(coupon.id),
            code,
            discountAmount,
            productDiscount,
            freeShipping,
            freePackaging,
            description: description || 'Coupon benefit applied',
        },
    };
};
exports.applyCouponToTotals = applyCouponToTotals;
const priceAndValidateOrderItems = async (items) => {
    const list = Array.isArray(items) ? items : [];
    if (list.length === 0)
        return { ok: false, message: 'Cart is empty' };
    const ids = list
        .map((it) => it.productId ?? it.id ?? it._id)
        .map((v) => String(v ?? '').trim())
        .filter(Boolean);
    if (ids.length === 0)
        return { ok: false, message: 'Missing product ids' };
    // De-duplicate ids for query.
    const uniqueIds = Array.from(new Set(ids));
    const placeholders = uniqueIds.map(() => '?').join(',');
    const rows = await (0, db_1.dbQuery)(`SELECT id, name, slug, price, image, category, in_stock FROM products WHERE id IN (${placeholders})`, uniqueIds);
    const byId = new Map((rows || []).map((r) => [String(r.id), r]));
    const pricedItems = [];
    let subtotal = 0;
    for (const raw of list) {
        const rawId = raw.productId ?? raw.id ?? raw._id;
        const productId = String(rawId ?? '').trim();
        if (!productId)
            return { ok: false, message: 'Missing product id for one of the items' };
        const product = byId.get(productId);
        if (!product)
            return { ok: false, message: 'One of the products in your cart no longer exists' };
        const quantity = asInt(raw.quantity ?? 1);
        if (!quantity || quantity <= 0)
            return { ok: false, message: `Invalid quantity for ${product.name}` };
        const price = asMoney(product.price);
        if (price === null || price <= 0)
            return { ok: false, message: `${product.name} has an invalid price. Please contact support.` };
        const inStock = (0, dbHelpers_1.boolFromDb)(product.in_stock);
        if (!inStock)
            return { ok: false, message: `${product.name} is out of stock` };
        subtotal += quantity * price;
        pricedItems.push({
            productId,
            slug: String(product.slug || ''),
            name: String(product.name || ''),
            image: String(product.image || ''),
            category: String(product.category || ''),
            quantity,
            price,
            selectedSize: raw.selectedSize,
            selectedPieces: raw.selectedPieces,
            selectedAttributes: raw.selectedAttributes,
            selections: raw.selections,
        });
    }
    return { ok: true, items: pricedItems, itemsSubtotal: subtotal };
};
exports.priceAndValidateOrderItems = priceAndValidateOrderItems;
const isPrasadamItem = (item) => {
    const text = `${item.category || ''} ${item.name || ''} ${item.slug || ''}`.toLowerCase();
    return /\bprasadam\b|\bprasad\b/.test(text);
};
exports.isPrasadamItem = isPrasadamItem;
const hasPrasadamItems = (items) => Array.isArray(items) && items.some(exports.isPrasadamItem);
exports.hasPrasadamItems = hasPrasadamItems;
