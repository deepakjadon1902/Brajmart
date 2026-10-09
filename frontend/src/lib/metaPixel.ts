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
    __brajmartLoadMarketing?: () => void;
  }
}

const DEFAULT_CURRENCY = 'INR';
const META_PIXEL_ID = '1824114108557446';
const BROWSER_FALLBACK_EVENTS = new Set<MetaPixelEvent>([
  'AddToCart',
  'InitiateCheckout',
  'AddPaymentInfo',
]);

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

const isValidPurchaseEvent = (eventId: string, params: MetaPixelParams) => {
  const orderId = params.order_id;
  const orderIdString = typeof orderId === 'number' || typeof orderId === 'string' ? String(orderId) : '';
  if (!/^\d+$/.test(orderIdString)) return false;
  if (eventId !== `brajmart.Purchase.order.${orderIdString}`) return false;
  if (params.currency !== DEFAULT_CURRENCY) return false;
  if (toPositiveMetaValue(params.value) === undefined) return false;
  if (!Array.isArray(params.content_ids) || params.content_ids.length === 0) return false;
  if (!Array.isArray(params.contents) || params.contents.length === 0) return false;

  return params.contents.every((item) => {
    if (!item || !item.id) return false;
    const quantity = Number(item.quantity);
    return Number.isFinite(quantity) && quantity > 0;
  });
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

const appendMetaPixelParam = (searchParams: URLSearchParams, key: string, value: unknown) => {
  if (value === undefined || value === null || value === '') return;
  const encodedValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
  searchParams.set(key, encodedValue);
};

const sendBrowserMetaPixelFallback = (eventName: MetaPixelEvent, eventId: string, params: MetaPixelParams) => {
  if (!BROWSER_FALLBACK_EVENTS.has(eventName) || typeof window === 'undefined' || typeof document === 'undefined') return;

  const searchParams = new URLSearchParams({
    id: META_PIXEL_ID,
    ev: eventName,
    dl: window.location.href,
    if: 'false',
    ts: String(Date.now()),
  });

  appendMetaPixelParam(searchParams, 'eid', eventId);
  appendMetaPixelParam(searchParams, 'cd[currency]', params.currency || DEFAULT_CURRENCY);
  appendMetaPixelParam(searchParams, 'cd[value]', params.value);
  appendMetaPixelParam(searchParams, 'cd[content_ids]', params.content_ids);
  appendMetaPixelParam(searchParams, 'cd[content_name]', params.content_name);
  appendMetaPixelParam(searchParams, 'cd[content_type]', params.content_type);
  appendMetaPixelParam(searchParams, 'cd[contents]', params.contents);
  appendMetaPixelParam(searchParams, 'cd[num_items]', params.num_items);
  appendMetaPixelParam(searchParams, 'cd[order_id]', params.order_id);
  appendMetaPixelParam(searchParams, 'cd[payment_id]', params.payment_id);
  appendMetaPixelParam(searchParams, 'cd[payment_method]', params.payment_method);
  appendMetaPixelParam(searchParams, 'cd[payment_type]', params.payment_type);

  const pixel = document.createElement('img');
  pixel.width = 1;
  pixel.height = 1;
  pixel.alt = '';
  pixel.style.display = 'none';
  pixel.referrerPolicy = 'no-referrer-when-downgrade';
  pixel.src = `https://www.facebook.com/tr?${searchParams.toString()}`;
  (document.body || document.head || document.documentElement).appendChild(pixel);
};

export const trackMetaPixelEvent = (eventName: MetaPixelEvent, params: MetaPixelParams = {}, options: MetaPixelOptions = {}) => {
  if (typeof window === 'undefined') return '';

  const eventId = options.eventId || createMetaEventId(eventName);
  const normalizedParams = {
    currency: DEFAULT_CURRENCY,
    ...normalizeMetaPixelParams(params),
  };

  if (eventName === 'Purchase' && !isValidPurchaseEvent(eventId, normalizedParams)) {
    if (window.console && window.console.warn) {
      window.console.warn('Blocked invalid Meta Purchase event.', { eventID: eventId, url: window.location.href });
    }
    return '';
  }

  if (typeof window.fbq !== 'function') {
    window.__brajmartLoadMarketing?.();
  }

  if (eventName !== 'Purchase' && typeof window.fbq === 'function') {
    window.fbq('track', eventName, normalizedParams, { eventID: eventId });
  }

  sendBrowserMetaPixelFallback(eventName, eventId, normalizedParams);
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
