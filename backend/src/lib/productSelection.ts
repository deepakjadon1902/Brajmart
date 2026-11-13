import { parseJson } from './dbHelpers';

const arrayFromDb = (value: unknown): any[] => {
  const parsed = parseJson<any>(value, []);
  return Array.isArray(parsed) ? parsed : [];
};

const money = (value: unknown) => {
  const number = Number(value);
  return value != null && Number.isFinite(number) && number > 0
    ? Math.round(number * 100) / 100
    : null;
};

export type ProductSelection = {
  selectedSize?: string;
  selectedPieces?: string | number;
  selectedAttributes?: Record<string, string>;
};

export const resolveProductSelection = (product: any, selection: ProductSelection) => {
  const rawAttributes = selection.selectedAttributes || {};
  if (typeof rawAttributes !== 'object' || Array.isArray(rawAttributes)) {
    return { ok: false as const, message: 'Invalid product selection' };
  }
  const legacySize = typeof (rawAttributes as Record<string, unknown>).size === 'string'
    ? (rawAttributes as Record<string, unknown>).size
    : '';
  const legacyPieces = (rawAttributes as Record<string, unknown>).pieces;
  const selectedSize = String(selection.selectedSize || legacySize || '').trim();
  const pieces = selection.selectedPieces == null || selection.selectedPieces === ''
    ? (legacyPieces == null || legacyPieces === '' ? 1 : Number(legacyPieces))
    : Number(selection.selectedPieces);
  if (!Number.isInteger(pieces) || pieces < 1 || pieces > 120) {
    return { ok: false as const, message: 'Invalid number of pieces for this product' };
  }

  const attributes: Record<string, string> = {};
  const catalogAttributes = arrayFromDb(product.attributes);
  for (const [key, rawValue] of Object.entries(rawAttributes)) {
    if (key === 'size' || key === 'pieces') continue;
    if (typeof rawValue !== 'string') return { ok: false as const, message: 'Invalid product selection' };
    const value = rawValue.trim();
    const attribute = catalogAttributes.find((item) => String(item.slug) === key);
    if (!attribute || !arrayFromDb(attribute.terms).map(String).includes(value)) {
      return { ok: false as const, message: 'A selected product option is no longer available' };
    }
    attributes[key] = value;
  }

  const sizePricing = arrayFromDb(product.size_pricing);
  if (selectedSize) {
    const allowedSizes = arrayFromDb(product.sizes).map(String);
    if (allowedSizes.length ? !allowedSizes.includes(selectedSize)
      : !sizePricing.some((item) => String(item.size) === selectedSize)) {
      return { ok: false as const, message: 'The selected size is no longer available' };
    }
  }

  const priceSelections: Record<string, string> = { ...attributes };
  const color = catalogAttributes.find((item) => /color/i.test(`${item.slug} ${item.name}`));
  if (color?.slug) delete priceSelections[color.slug];
  if (selectedSize) priceSelections.size = selectedSize;
  if (pieces > 1) priceSelections.pieces = String(pieces);

  const variants = arrayFromDb(product.variant_pricing)
    .sort((a, b) => Object.keys(b.selections || {}).length - Object.keys(a.selections || {}).length);
  const variant = variants.find((item) => item.selections && typeof item.selections === 'object'
    && Object.keys(item.selections).length > 0
    && Object.entries(item.selections).every(([key, value]) => priceSelections[key] === String(value)));
  let price = money(variant?.price ?? product.price);
  if (!variant && selectedSize && pieces === 1) {
    const size = sizePricing.find((item) => String(item.size) === selectedSize);
    if (size) price = money(size.price);
  }
  if (!variant && pieces > 1) {
    const tier = arrayFromDb(product.piece_pricing).find((item) => Number(item.pieces) === pieces);
    price = money(tier ? tier.price : Number(product.price) * pieces);
  }
  if (!price) return { ok: false as const, message: 'This product has an invalid price' };

  return {
    ok: true as const,
    price,
    sku: String(variant?.sku || product.sku || '').trim(),
    selectedSize: selectedSize || undefined,
    selectedPieces: pieces,
    selectedAttributes: attributes,
  };
};
