import { Router } from 'express';
import { auth, adminOnly } from '../middleware/auth';
import { dbExecute, dbQuery, isDbConnected } from '../lib/db';
import { applyCouponToTotals, computeTotals, getCheckoutSettings, priceAndValidateOrderItems } from '../lib/orderPricing';
import { toIsoString } from '../lib/dbHelpers';

const router = Router();

const cleanCode = (value: unknown) => String(value ?? '').trim().toUpperCase().replace(/\s+/g, '');
const asNonNegativeNumber = (value: unknown, label: string) => {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${label} must be a valid positive number`);
  return n;
};
const asOptionalDate = (value: unknown, label: string) => {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error(`${label} is invalid`);
  return date;
};

const mapCoupon = (row: any) => ({
  id: String(row.id),
  code: row.code,
  title: row.title || '',
  discountType: row.discount_type,
  discountValue: Number(row.discount_value || 0),
  maxDiscount: row.max_discount == null ? '' : Number(row.max_discount),
  freeShipping: Boolean(Number(row.free_shipping)),
  freePackaging: Boolean(Number(row.free_packaging)),
  scopeType: row.scope_type,
  scopeValue: row.scope_value || '',
  minOrderAmount: Number(row.min_order_amount || 0),
  usageLimit: row.usage_limit == null ? '' : Number(row.usage_limit),
  usedCount: Number(row.used_count || 0),
  startsAt: toIsoString(row.starts_at),
  endsAt: toIsoString(row.ends_at),
  isActive: Boolean(Number(row.is_active)),
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
});

const payloadValues = (data: any) => {
  const code = cleanCode(data.code);
  if (!code) throw new Error('Coupon code is required');
  const discountType = data.discountType === 'percent' ? 'percent' : 'amount';
  const scopeType = ['all', 'product', 'category'].includes(String(data.scopeType)) ? String(data.scopeType) : 'all';
  const discountValue = asNonNegativeNumber(data.discountValue, 'Discount');
  const maxDiscount = data.maxDiscount === '' || data.maxDiscount === null || data.maxDiscount === undefined
    ? null
    : asNonNegativeNumber(data.maxDiscount, 'Max discount');
  const minOrderAmount = asNonNegativeNumber(data.minOrderAmount, 'Min order');
  const usageLimit = data.usageLimit === '' || data.usageLimit === null || data.usageLimit === undefined
    ? null
    : Math.max(1, Math.floor(asNonNegativeNumber(data.usageLimit, 'Usage limit')));
  const scopeValue = scopeType === 'all' ? null : String(data.scopeValue || '').trim();
  const startsAt = asOptionalDate(data.startsAt, 'Start date');
  const endsAt = asOptionalDate(data.endsAt, 'End date');
  if (scopeType !== 'all' && !scopeValue) throw new Error(`Select a ${scopeType} for this coupon`);
  if (discountValue <= 0 && !data.freeShipping && !data.freePackaging) {
    throw new Error('Add a discount, free shipping, or free packaging');
  }
  if (discountType === 'percent' && discountValue > 100) throw new Error('Percentage discount cannot exceed 100');
  if (startsAt && endsAt && startsAt.getTime() > endsAt.getTime()) throw new Error('End date must be after start date');
  return [
    code,
    String(data.title || '').trim() || null,
    discountType,
    discountValue,
    maxDiscount,
    data.freeShipping ? 1 : 0,
    data.freePackaging ? 1 : 0,
    scopeType,
    scopeValue,
    minOrderAmount,
    usageLimit,
    startsAt,
    endsAt,
    data.isActive === false ? 0 : 1,
  ];
};

router.get('/', auth, adminOnly, async (_req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const rows = await dbQuery<any>('SELECT * FROM coupons ORDER BY created_at DESC');
    res.json(rows.map(mapCoupon));
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Failed to load coupons' });
  }
});

router.post('/', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const values = payloadValues(req.body || {});
    const result: any = await dbExecute(
      'INSERT INTO coupons (code, title, discount_type, discount_value, max_discount, free_shipping, free_packaging, scope_type, scope_value, min_order_amount, usage_limit, starts_at, ends_at, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      values
    );
    const rows = await dbQuery<any>('SELECT * FROM coupons WHERE id = ? LIMIT 1', [result.insertId]);
    res.status(201).json(mapCoupon(rows[0]));
  } catch (err: any) {
    const duplicate = String(err?.message || '').includes('Duplicate');
    res.status(duplicate ? 409 : 400).json({ message: duplicate ? 'Coupon code already exists' : err?.message || 'Failed to create coupon' });
  }
});

router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const values = payloadValues(req.body || {});
    await dbExecute(
      'UPDATE coupons SET code = ?, title = ?, discount_type = ?, discount_value = ?, max_discount = ?, free_shipping = ?, free_packaging = ?, scope_type = ?, scope_value = ?, min_order_amount = ?, usage_limit = ?, starts_at = ?, ends_at = ?, is_active = ?, updated_at = NOW() WHERE id = ?',
      [...values, req.params.id]
    );
    const rows = await dbQuery<any>('SELECT * FROM coupons WHERE id = ? LIMIT 1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Coupon not found' });
    res.json(mapCoupon(rows[0]));
  } catch (err: any) {
    const duplicate = String(err?.message || '').includes('Duplicate');
    res.status(duplicate ? 409 : 400).json({ message: duplicate ? 'Coupon code already exists' : err?.message || 'Failed to update coupon' });
  }
});

router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    await dbExecute('DELETE FROM coupons WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Failed to delete coupon' });
  }
});

router.post('/validate', async (req, res) => {
  try {
    if (!isDbConnected()) return res.status(503).json({ message: 'Database unavailable' });
    const priced = await priceAndValidateOrderItems(req.body?.items || []);
    if (!priced.ok) return res.status(400).json({ message: priced.message });
    const settings = await getCheckoutSettings();
    const totals = computeTotals(priced.itemsSubtotal, settings);
    const result = await applyCouponToTotals(req.body?.code, priced.items, totals);
    if (!result.valid) return res.status(400).json({ message: result.message });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Failed to validate coupon' });
  }
});

export default router;
