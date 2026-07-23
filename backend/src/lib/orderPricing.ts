import { dbQuery } from './db';
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
