"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasPrasadamItems = exports.isPrasadamItem = exports.priceAndValidateOrderItems = exports.computeTotals = exports.getCheckoutSettings = void 0;
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
