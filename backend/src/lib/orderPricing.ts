import { dbExecute, dbQuery } from './db';
import { boolFromDb } from './dbHelpers';

export type RawOrderItem = {
  productId?: string | number;
  id?: string | number;
  _id?: string | number;
  quantity?: number | string;
  selectedSize?: string;
  selectedPieces?: string;
  selectedAttributes?: Record<string, string>;
  selections?: Record<string, string>;
};

export type PricedOrderItem = {
  productId: string;
  slug: string;
  name: string;
  image: string;
  category: string;
  quantity: number;
  price: number;
  selectedSize?: string;
  selectedPieces?: string;
  selectedAttributes?: Record<string, string>;
  selections?: Record<string, string>;
};

type SettingsRow = {
  free_shipping_threshold?: any;
  shipping_fee?: any;
  packaging_rate?: any;
  tax_rate?: any;
  min_order_amount?: any;
  max_order_quantity?: any;
  cod_enabled?: any;
};

const asInt = (value: any) => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  return i;
};

const asMoney = (value: any) => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
};

export const getCheckoutSettings = async () => {
  const rows = await dbQuery<SettingsRow>('SELECT free_shipping_threshold, shipping_fee, packaging_rate, tax_rate, min_order_amount, max_order_quantity, cod_enabled FROM settings LIMIT 1');
  const row = rows?.[0] || ({} as SettingsRow);
  return {
    freeShippingThreshold: Number(row.free_shipping_threshold ?? 299) || 299,
    shippingFee: Number(row.shipping_fee ?? 49) || 49,
    // tax_rate remains the rollout-compatible source while older backend instances exist.
    packagingRate: Number(row.tax_rate ?? row.packaging_rate ?? 0) || 0,
    minOrderAmount: Number(row.min_order_amount ?? 0) || 0,
    maxOrderQuantity: Number(row.max_order_quantity ?? 0) || 0,
    codEnabled: boolFromDb(row.cod_enabled ?? 1),
  };
};

export const computeTotals = (itemsSubtotal: number, settings: { freeShippingThreshold: number; shippingFee: number; packagingRate: number }) => {
  const shipping = itemsSubtotal >= settings.freeShippingThreshold ? 0 : settings.shippingFee;
  const packaging = Math.round(itemsSubtotal * Math.max(0, settings.packagingRate) / 100);
  const total = itemsSubtotal + packaging + shipping;
  return { itemsSubtotal, packaging, shipping, total };
};

const normalizeCouponCode = (value: unknown) => String(value ?? '').trim().toUpperCase().replace(/\s+/g, '');

export const markCouponUsed = async (rawCode: unknown) => {
  const code = normalizeCouponCode(rawCode);
  if (!code) return false;
  const result = await dbExecute(
    'UPDATE coupons SET used_count = used_count + 1, updated_at = NOW() WHERE code = ? AND (usage_limit IS NULL OR used_count < usage_limit)',
    [code]
  );
  return Number(result?.affectedRows || 0) > 0;
};

export const applyCouponToTotals = async (
  rawCode: unknown,
  items: PricedOrderItem[],
  totals: { itemsSubtotal: number; packaging: number; shipping: number; total: number }
) => {
  const code = normalizeCouponCode(rawCode);
  if (!code) {
    return {
      valid: false as const,
      message: 'Enter a coupon code',
      totals,
      coupon: null,
    };
  }

  const rows = await dbQuery<any>('SELECT * FROM coupons WHERE code = ? AND is_active = 1 LIMIT 1', [code]);
  const coupon = rows[0];
  if (!coupon) {
    return { valid: false as const, message: 'Invalid or inactive coupon code', totals, coupon: null };
  }

  const now = Date.now();
  if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) {
    return { valid: false as const, message: 'This coupon is not active yet', totals, coupon: null };
  }
  if (coupon.ends_at && new Date(coupon.ends_at).getTime() < now) {
    return { valid: false as const, message: 'This coupon has expired', totals, coupon: null };
  }
  if (coupon.usage_limit !== null && coupon.usage_limit !== undefined && Number(coupon.used_count || 0) >= Number(coupon.usage_limit)) {
    return { valid: false as const, message: 'This coupon usage limit has been reached', totals, coupon: null };
  }

  const scopeType = String(coupon.scope_type || 'all');
  const scopeValue = String(coupon.scope_value || '');
  const eligibleItems = items.filter((item) => {
    if (scopeType === 'all') return true;
    if (scopeType === 'product') return String(item.productId) === scopeValue;
    if (scopeType === 'category') return String(item.category || '').trim().toLowerCase() === scopeValue.trim().toLowerCase();
    return false;
  });
  if (eligibleItems.length === 0) {
    return { valid: false as const, message: 'Coupon is not applicable to these products', totals, coupon: null };
  }

  const eligibleSubtotal = eligibleItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const minOrderAmount = Number(coupon.min_order_amount || 0);
  if (minOrderAmount > 0 && totals.itemsSubtotal < minOrderAmount) {
    return { valid: false as const, message: `Minimum order amount for this coupon is ${minOrderAmount}`, totals, coupon: null };
  }

  let productDiscount = 0;
  const discountType = String(coupon.discount_type || 'amount');
  const discountValue = Math.max(0, Number(coupon.discount_value || 0));
  if (discountType === 'percent') {
    productDiscount = Math.round(eligibleSubtotal * discountValue / 100);
  } else {
    productDiscount = Math.min(discountValue, eligibleSubtotal);
  }

  const maxDiscount = Number(coupon.max_discount || 0);
  if (maxDiscount > 0) productDiscount = Math.min(productDiscount, maxDiscount);

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
    valid: true as const,
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

export const priceAndValidateOrderItems = async (items: any[]) => {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) return { ok: false as const, message: 'Cart is empty' };

  const ids = list
    .map((it: RawOrderItem) => it.productId ?? it.id ?? it._id)
    .map((v) => String(v ?? '').trim())
    .filter(Boolean);

  if (ids.length === 0) return { ok: false as const, message: 'Missing product ids' };

  // De-duplicate ids for query.
  const uniqueIds = Array.from(new Set(ids));
  const placeholders = uniqueIds.map(() => '?').join(',');
  const rows = await dbQuery<any>(`SELECT id, name, slug, price, image, category, in_stock FROM products WHERE id IN (${placeholders})`, uniqueIds);
  const byId = new Map<string, any>((rows || []).map((r) => [String(r.id), r]));

  const pricedItems: PricedOrderItem[] = [];
  let subtotal = 0;

  for (const raw of list as RawOrderItem[]) {
    const rawId = raw.productId ?? raw.id ?? raw._id;
    const productId = String(rawId ?? '').trim();
    if (!productId) return { ok: false as const, message: 'Missing product id for one of the items' };

    const product = byId.get(productId);
    if (!product) return { ok: false as const, message: 'One of the products in your cart no longer exists' };

    const quantity = asInt(raw.quantity ?? 1);
    if (!quantity || quantity <= 0) return { ok: false as const, message: `Invalid quantity for ${product.name}` };

    const price = asMoney(product.price);
    if (price === null || price <= 0) return { ok: false as const, message: `${product.name} has an invalid price. Please contact support.` };

    const inStock = boolFromDb(product.in_stock);
    if (!inStock) return { ok: false as const, message: `${product.name} is out of stock` };

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

  return { ok: true as const, items: pricedItems, itemsSubtotal: subtotal };
};

export const isPrasadamItem = (item: { name?: unknown; category?: unknown; slug?: unknown }) => {
  const text = `${item.category || ''} ${item.name || ''} ${item.slug || ''}`.toLowerCase();
  return /\bprasadam\b|\bprasad\b/.test(text);
};

export const hasPrasadamItems = (items: Array<{ name?: unknown; category?: unknown; slug?: unknown }>) =>
  Array.isArray(items) && items.some(isPrasadamItem);
