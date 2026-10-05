import { Product } from '@/types/product';
import { getApiBase } from './api';

type MetaPixelEvent =
  | 'PageView'
  | 'ViewContent'
  | 'Search'
  | 'Contact'
  | 'AddPaymentInfo'
  | 'AddToCart'
  | 'AddToWishlist'
  | 'InitiateCheckout'
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

type MetaPixelUserData = {
  email?: string;
  phone?: string;
};

type MetaPixelOptions = {
  eventId?: string;
  eventSourceUrl?: string;
  userData?: MetaPixelUserData;
};

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

const DEFAULT_CURRENCY = 'INR';

const readCookie = (name: string) => {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.$?*|{}()[\]\\/+^]/g, '\\$&')}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
};

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

export const createMetaEventId = (eventName: MetaPixelEvent) => {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `brajmart.${eventName}.${random}`;
};

const sendMetaConversionEvent = (eventName: MetaPixelEvent, eventId: string, params: MetaPixelParams, options: MetaPixelOptions) => {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return;

  const userData = {
    ...(options.userData || {}),
    fbp: readCookie('_fbp') || undefined,
    fbc: readCookie('_fbc') || undefined,
    clientUserAgent: window.navigator?.userAgent || undefined,
  };

  fetch(`${getApiBase()}/meta/conversions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventName,
      eventId,
      eventSourceUrl: options.eventSourceUrl || window.location.href,
      userData,
      customData: {
        currency: DEFAULT_CURRENCY,
        ...params,
      },
    }),
    keepalive: true,
  }).catch(() => undefined);
};

export const trackMetaPixelEvent = (eventName: MetaPixelEvent, params: MetaPixelParams = {}, options: MetaPixelOptions = {}) => {
  if (typeof window === 'undefined') return '';

  const eventId = options.eventId || createMetaEventId(eventName);
  const normalizedParams = {
    currency: DEFAULT_CURRENCY,
    ...normalizeMetaPixelParams(params),
  };

  if (typeof window.fbq === 'function') {
    window.fbq('track', eventName, normalizedParams, { eventID: eventId });
  }

  sendMetaConversionEvent(eventName, eventId, normalizedParams, options);
  return eventId;
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
