import { Router } from 'express';
import { isDbConnected, dbQuery, dbExecute } from '../lib/db';
import { memory } from '../lib/memoryStore';
import { auth, adminOnly } from '../middleware/auth';
import { parseJson, toIsoString, boolFromDb } from '../lib/dbHelpers';

const router = Router();

const mapSettingsRow = (row: any) => ({
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
  codEnabled: boolFromDb(row.cod_enabled),
  upiEnabled: boolFromDb(row.upi_enabled),
  cardEnabled: boolFromDb(row.card_enabled),
  maintenanceMode: boolFromDb(row.maintenance_mode),
  metaTitle: row.meta_title,
  metaDescription: row.meta_description,
  storeLogo: row.store_logo,
  favicon: row.favicon,
  upiId: row.upi_id,
  upiPayeeName: row.upi_payee_name,
  socialLinks: parseJson(row.social_links, { instagram: '', facebook: '', youtube: '', whatsapp: '' }),
  announcementBar: parseJson(row.announcement_bar, { enabled: true, messages: [] }),
  notifications: parseJson(row.notifications, { orders: true, users: true, payments: true, stock: false }),
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
});

const buildUpdate = (data: any) => {
  const fields: string[] = [];
  const values: any[] = [];

  const set = (column: string, value: any) => {
    fields.push(`${column} = ?`);
    values.push(value);
  };

  if (data.storeName !== undefined) set('store_name', data.storeName);
  if (data.tagline !== undefined) set('tagline', data.tagline);
  if (data.currency !== undefined) set('currency', data.currency);
  if (data.freeShippingThreshold !== undefined) set('free_shipping_threshold', data.freeShippingThreshold);
  if (data.shippingFee !== undefined) set('shipping_fee', data.shippingFee);
  if (data.storeEmail !== undefined) set('store_email', data.storeEmail);
  if (data.storePhone !== undefined) set('store_phone', data.storePhone);
  if (data.storeAddress !== undefined) set('store_address', data.storeAddress);
  if (data.taxRate !== undefined) set('tax_rate', data.taxRate);
  if (data.minOrderAmount !== undefined) set('min_order_amount', data.minOrderAmount);
  if (data.maxOrderQuantity !== undefined) set('max_order_quantity', data.maxOrderQuantity);
  if (data.deliveryEtaMinDays !== undefined) set('delivery_eta_min_days', data.deliveryEtaMinDays);
  if (data.deliveryEtaMaxDays !== undefined) set('delivery_eta_max_days', data.deliveryEtaMaxDays);
  if (data.codEnabled !== undefined) set('cod_enabled', data.codEnabled ? 1 : 0);
  if (data.upiEnabled !== undefined) set('upi_enabled', data.upiEnabled ? 1 : 0);
  if (data.cardEnabled !== undefined) set('card_enabled', data.cardEnabled ? 1 : 0);
  if (data.maintenanceMode !== undefined) set('maintenance_mode', data.maintenanceMode ? 1 : 0);
  if (data.metaTitle !== undefined) set('meta_title', data.metaTitle);
  if (data.metaDescription !== undefined) set('meta_description', data.metaDescription);
  if (data.storeLogo !== undefined) set('store_logo', data.storeLogo);
  if (data.favicon !== undefined) set('favicon', data.favicon);
  if (data.upiId !== undefined) set('upi_id', data.upiId);
  if (data.upiPayeeName !== undefined) set('upi_payee_name', data.upiPayeeName);
  if (data.socialLinks !== undefined) set('social_links', JSON.stringify(data.socialLinks || {}));
  if (data.announcementBar !== undefined) set('announcement_bar', JSON.stringify(data.announcementBar || {}));
  if (data.notifications !== undefined) set('notifications', JSON.stringify(data.notifications || {}));

  if (!fields.length) return null;
  fields.push('updated_at = NOW()');
  return { sql: fields.join(', '), values };
};

router.get('/', async (_req, res) => {
  try {
    if (!isDbConnected()) return res.json(memory.getSettings());
    let rows = await dbQuery<any>('SELECT * FROM settings LIMIT 1');
    if (!rows[0]) {
      await dbExecute('INSERT INTO settings () VALUES ()');
      rows = await dbQuery<any>('SELECT * FROM settings LIMIT 1');
    }
    res.json(mapSettingsRow(rows[0]));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) {
      const updated = memory.updateSettings(req.body);
      return res.json(updated);
    }
    let rows = await dbQuery<any>('SELECT * FROM settings LIMIT 1');
    if (!rows[0]) {
      await dbExecute('INSERT INTO settings () VALUES ()');
      rows = await dbQuery<any>('SELECT * FROM settings LIMIT 1');
    }
    const update = buildUpdate(req.body || {});
    if (update) {
      await dbExecute(`UPDATE settings SET ${update.sql} WHERE id = ?`, [...update.values, rows[0].id]);
    }
    const refreshed = await dbQuery<any>('SELECT * FROM settings LIMIT 1');
    res.json(mapSettingsRow(refreshed[0]));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
