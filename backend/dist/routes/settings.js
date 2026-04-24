"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../lib/db");
const auth_1 = require("../middleware/auth");
const dbHelpers_1 = require("../lib/dbHelpers");
const email_1 = require("../lib/email");
const router = (0, express_1.Router)();
const mapSettingsRow = (row) => ({
    _id: String(row.id),
    storeName: row.store_name,
    tagline: row.tagline,
    currency: row.currency,
    freeShippingThreshold: Number(row.free_shipping_threshold ?? 0),
    shippingFee: Number(row.shipping_fee ?? 0),
    storeEmail: row.store_email,
    storePhone: row.store_phone,
    storeAddress: row.store_address,
    taxRate: Number(row.tax_rate ?? 0),
    minOrderAmount: Number(row.min_order_amount ?? 0),
    maxOrderQuantity: Number(row.max_order_quantity ?? 0),
    deliveryEtaMinDays: Number(row.delivery_eta_min_days ?? 3),
    deliveryEtaMaxDays: Number(row.delivery_eta_max_days ?? 7),
    codEnabled: (0, dbHelpers_1.boolFromDb)(row.cod_enabled),
    upiEnabled: (0, dbHelpers_1.boolFromDb)(row.upi_enabled),
    cardEnabled: (0, dbHelpers_1.boolFromDb)(row.card_enabled),
    maintenanceMode: (0, dbHelpers_1.boolFromDb)(row.maintenance_mode),
    metaTitle: row.meta_title,
    metaDescription: row.meta_description,
    storeLogo: row.store_logo,
    favicon: row.favicon,
    socialLinks: (0, dbHelpers_1.parseJson)(row.social_links, { instagram: '', facebook: '', youtube: '', whatsapp: '' }),
    announcementBar: (0, dbHelpers_1.parseJson)(row.announcement_bar, { enabled: true, messages: [] }),
    notifications: (0, dbHelpers_1.parseJson)(row.notifications, { orders: true, users: true, payments: true, stock: false }),
    heroBadges: (0, dbHelpers_1.parseJson)(row.hero_badges, ['🏛️ Temple Authenticated', '🌿 100% Organic', '🚚 Pan-India Delivery']),
    createdAt: (0, dbHelpers_1.toIsoString)(row.created_at),
    updatedAt: (0, dbHelpers_1.toIsoString)(row.updated_at),
});
const buildUpdate = (data) => {
    const fields = [];
    const values = [];
    const set = (column, value) => {
        fields.push(`${column} = ?`);
        values.push(value);
    };
    if (data.storeName !== undefined)
        set('store_name', data.storeName);
    if (data.tagline !== undefined)
        set('tagline', data.tagline);
    if (data.currency !== undefined)
        set('currency', data.currency);
    if (data.freeShippingThreshold !== undefined)
        set('free_shipping_threshold', data.freeShippingThreshold);
    if (data.shippingFee !== undefined)
        set('shipping_fee', data.shippingFee);
    if (data.storeEmail !== undefined)
        set('store_email', data.storeEmail);
    if (data.storePhone !== undefined)
        set('store_phone', data.storePhone);
    if (data.storeAddress !== undefined)
        set('store_address', data.storeAddress);
    if (data.taxRate !== undefined)
        set('tax_rate', data.taxRate);
    if (data.minOrderAmount !== undefined)
        set('min_order_amount', data.minOrderAmount);
    if (data.maxOrderQuantity !== undefined)
        set('max_order_quantity', data.maxOrderQuantity);
    if (data.deliveryEtaMinDays !== undefined)
        set('delivery_eta_min_days', data.deliveryEtaMinDays);
    if (data.deliveryEtaMaxDays !== undefined)
        set('delivery_eta_max_days', data.deliveryEtaMaxDays);
    if (data.codEnabled !== undefined)
        set('cod_enabled', data.codEnabled ? 1 : 0);
    if (data.upiEnabled !== undefined)
        set('upi_enabled', data.upiEnabled ? 1 : 0);
    if (data.cardEnabled !== undefined)
        set('card_enabled', data.cardEnabled ? 1 : 0);
    if (data.maintenanceMode !== undefined)
        set('maintenance_mode', data.maintenanceMode ? 1 : 0);
    if (data.metaTitle !== undefined)
        set('meta_title', data.metaTitle);
    if (data.metaDescription !== undefined)
        set('meta_description', data.metaDescription);
    if (data.storeLogo !== undefined)
        set('store_logo', data.storeLogo);
    if (data.favicon !== undefined)
        set('favicon', data.favicon);
    if (data.socialLinks !== undefined)
        set('social_links', JSON.stringify(data.socialLinks || {}));
    if (data.announcementBar !== undefined)
        set('announcement_bar', JSON.stringify(data.announcementBar || {}));
    if (data.notifications !== undefined)
        set('notifications', JSON.stringify(data.notifications || {}));
    if (data.heroBadges !== undefined)
        set('hero_badges', JSON.stringify(data.heroBadges || []));
    if (!fields.length)
        return null;
    fields.push('updated_at = NOW()');
    return { sql: fields.join(', '), values };
};
router.get('/', async (_req, res) => {
    try {
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        let rows = await (0, db_1.dbQuery)('SELECT * FROM settings LIMIT 1');
        if (!rows[0]) {
            await (0, db_1.dbExecute)('INSERT INTO settings () VALUES ()');
            rows = await (0, db_1.dbQuery)('SELECT * FROM settings LIMIT 1');
        }
        res.json(mapSettingsRow(rows[0]));
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.put('/', auth_1.auth, auth_1.adminOnly, async (req, res) => {
    try {
        if (!(0, db_1.isDbConnected)())
            return res.status(503).json({ message: 'Database unavailable' });
        let rows = await (0, db_1.dbQuery)('SELECT * FROM settings LIMIT 1');
        if (!rows[0]) {
            await (0, db_1.dbExecute)('INSERT INTO settings () VALUES ()');
            rows = await (0, db_1.dbQuery)('SELECT * FROM settings LIMIT 1');
        }
        const update = buildUpdate(req.body || {});
        if (update) {
            await (0, db_1.dbExecute)(`UPDATE settings SET ${update.sql} WHERE id = ?`, [...update.values, rows[0].id]);
        }
        const refreshed = await (0, db_1.dbQuery)('SELECT * FROM settings LIMIT 1');
        res.json(mapSettingsRow(refreshed[0]));
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.post('/test-email', auth_1.auth, auth_1.adminOnly, async (req, res) => {
    try {
        const to = String(req.body?.to || '').trim();
        if (!to)
            return res.status(400).json({ message: 'Recipient email is required' });
        await (0, email_1.sendEmail)(to, 'BrajMart SMTP Test', '<p>This is a test email from BrajMart. If you received this, SMTP is working.</p>');
        res.json({ message: 'Test email sent' });
    }
    catch (err) {
        res.status(500).json({ message: err.message || 'Failed to send test email' });
    }
});
exports.default = router;
