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

export const trackMetaPixelEvent = (eventName: MetaPixelEvent, params: MetaPixelParams = {}) => {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return;

  window.fbq('track', eventName, {
    currency: DEFAULT_CURRENCY,
    ...params,
  });
};

export const productToMetaPixelParams = (product: Product, quantity = 1): MetaPixelParams => {
  const safeQuantity = Math.max(1, Number(quantity) || 1);
  const price = Number(product.price) || 0;

  return {
    content_ids: [String(product.id || product.slug || product.name)],
    content_name: product.name,
    content_type: 'product',
    contents: [{
      id: String(product.id || product.slug || product.name),
      item_price: price,
      quantity: safeQuantity,
    }],
    num_items: safeQuantity,
    value: price * safeQuantity,
  };
};
