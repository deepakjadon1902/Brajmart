import { Product } from '@/types/product';

type MetaPixelEvent =
  | 'AddPaymentInfo'
  | 'AddToCart'
  | 'AddToWishlist'
  | 'Lead'
  | 'Purchase';

type MetaPixelParams = {
  content_ids?: string[];
  content_name?: string;
  content_type?: string;
  contents?: Array<{
    id: string;
    item_price?: number;
    quantity?: number;
  }>;
  currency?: string;
  num_items?: number;
  value?: number;
  [key: string]: unknown;
};

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

const DEFAULT_CURRENCY = 'INR';

export const toPositiveMetaValue = (value: unknown): number | undefined => {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
};

const normalizeMetaPixelParams = (params: MetaPixelParams): MetaPixelParams => {
  const normalized = { ...params };

  if ('value' in normalized) {
    const value = toPositiveMetaValue(normalized.value);
    if (value === undefined) {
      delete normalized.value;
    } else {
      normalized.value = value;
    }
  }

  return normalized;
};

export const trackMetaPixelEvent = (eventName: MetaPixelEvent, params: MetaPixelParams = {}) => {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return;

  window.fbq('track', eventName, {
    currency: DEFAULT_CURRENCY,
    ...normalizeMetaPixelParams(params),
  });
};

export const productToMetaPixelParams = (product: Product, quantity = 1): MetaPixelParams => {
  const safeQuantity = Math.max(1, Number(quantity) || 1);
  const price = toPositiveMetaValue(product.price);
  const value = price === undefined ? undefined : toPositiveMetaValue(price * safeQuantity);
  const contents: MetaPixelParams['contents'] = [{
    id: String(product.id || product.slug || product.name),
    quantity: safeQuantity,
  }];

  if (price !== undefined) {
    contents[0].item_price = price;
  }

  const params: MetaPixelParams = {
    content_ids: [String(product.id || product.slug || product.name)],
    content_name: product.name,
    content_type: 'product',
    contents,
    num_items: safeQuantity,
  };

  if (value !== undefined) {
    params.value = value;
  }

  return params;
};
