import { describe, expect, it, vi, beforeEach } from 'vitest';
import { productToMetaPixelParams, toPositiveMetaValue, trackMetaPixelEvent } from './metaPixel';
import type { Product } from '@/types/product';

const product = (price: number): Product => ({
  id: 'tilak-1',
  name: 'Tilak',
  slug: 'tilak',
  price,
  image: '/tilak.jpg',
  category: 'Puja',
  rating: 5,
  reviewCount: 1,
  inStock: true,
});

describe('metaPixel', () => {
  beforeEach(() => {
    window.fbq = vi.fn();
    delete window.__brajmartLoadMarketing;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    }) as unknown as typeof fetch;
  });

  it('normalizes valid values to positive numeric money values', () => {
    expect(toPositiveMetaValue('9.90')).toBe(9.9);
    expect(toPositiveMetaValue(9)).toBe(9);
    expect(toPositiveMetaValue(9.999)).toBe(10);
  });

  it('rejects missing, zero, negative, and non-numeric values', () => {
    expect(toPositiveMetaValue(null)).toBeUndefined();
    expect(toPositiveMetaValue(0)).toBeUndefined();
    expect(toPositiveMetaValue(-1)).toBeUndefined();
    expect(toPositiveMetaValue('abc')).toBeUndefined();
  });

  it('does not send invalid value fields to Meta Pixel', () => {
    trackMetaPixelEvent('AddToCart', { value: 0, currency: 'INR' });

    expect(window.fbq).toHaveBeenCalledWith('track', 'AddToCart', { currency: 'INR' }, expect.objectContaining({
      eventID: expect.stringContaining('brajmart.AddToCart.'),
    }));
  });

  it('sends valid value fields as numbers to Meta Pixel', () => {
    trackMetaPixelEvent('AddToCart', { value: '9.90' });

    expect(window.fbq).toHaveBeenCalledWith('track', 'AddToCart', {
      currency: 'INR',
      value: 9.9,
    }, expect.objectContaining({
      eventID: expect.stringContaining('brajmart.AddToCart.'),
    }));
  });

  it('blocks purchase events without a confirmed order payload', () => {
    const eventId = trackMetaPixelEvent('Purchase', { value: '9.90' });

    expect(eventId).toBe('');
    expect(window.fbq).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('blocks purchase events even with an order payload because the backend sends verified purchases', () => {
    const eventId = trackMetaPixelEvent('Purchase', {
      content_ids: ['101'],
      contents: [{ id: '101', item_price: 199, quantity: 2 }],
      currency: 'INR',
      order_id: 1234,
      value: 398,
    }, {
      eventId: 'brajmart.Purchase.order.1234',
    });

    expect(eventId).toBe('');
    expect(window.fbq).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sends matching browser and server event IDs for deduplication', () => {
    const eventId = trackMetaPixelEvent('AddToCart', { content_ids: ['tilak-1'] });

    expect(window.fbq).toHaveBeenCalledWith('track', 'AddToCart', expect.any(Object), { eventID: eventId });
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/meta/conversions'), expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining(`"eventId":"${eventId}"`),
    }));
  });

  it('loads deferred marketing before sending browser pixel events', () => {
    window.fbq = undefined;
    const fbq = vi.fn();
    window.__brajmartLoadMarketing = vi.fn(() => {
      window.fbq = fbq;
    });

    trackMetaPixelEvent('AddToCart', productToMetaPixelParams(product(99)));

    expect(window.__brajmartLoadMarketing).toHaveBeenCalledOnce();
    expect(fbq).toHaveBeenCalledWith('track', 'AddToCart', expect.objectContaining({
      content_ids: ['tilak-1'],
      content_type: 'product',
      contents: [{ id: 'tilak-1', item_price: 99, quantity: 1 }],
      currency: 'INR',
      value: 99,
    }), expect.objectContaining({
      eventID: expect.stringContaining('brajmart.AddToCart.'),
    }));
  });

  it('sends a direct browser AddToCart pixel fallback with product data', () => {
    const imageSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    let fallbackSrc = '';
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      configurable: true,
      get() {
        return imageSrc?.get?.call(this) || fallbackSrc;
      },
      set(value) {
        fallbackSrc = String(value);
        imageSrc?.set?.call(this, value);
      },
    });

    try {
      const eventId = trackMetaPixelEvent('AddToCart', productToMetaPixelParams(product(99)));
      const fallbackUrl = new URL(fallbackSrc);

      expect(fallbackUrl.origin).toBe('https://www.facebook.com');
      expect(fallbackUrl.pathname).toBe('/tr');
      expect(fallbackUrl.searchParams.get('id')).toBe('1824114108557446');
      expect(fallbackUrl.searchParams.get('ev')).toBe('AddToCart');
      expect(fallbackUrl.searchParams.get('eid')).toBe(eventId);
      expect(fallbackUrl.searchParams.get('cd[currency]')).toBe('INR');
      expect(fallbackUrl.searchParams.get('cd[value]')).toBe('99');
      expect(fallbackUrl.searchParams.get('cd[content_ids]')).toBe(JSON.stringify(['tilak-1']));
      expect(fallbackUrl.searchParams.get('cd[content_type]')).toBe('product');
      expect(JSON.parse(fallbackUrl.searchParams.get('cd[contents]') || '[]')).toEqual([{ id: 'tilak-1', item_price: 99, quantity: 1 }]);
    } finally {
      if (imageSrc) {
        Object.defineProperty(HTMLImageElement.prototype, 'src', imageSrc);
      }
    }
  });

  it('sends direct browser pixel fallbacks for checkout and payment info only', () => {
    const imageSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    const fallbackSrcs: string[] = [];
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      configurable: true,
      get() {
        return imageSrc?.get?.call(this) || fallbackSrcs[fallbackSrcs.length - 1] || '';
      },
      set(value) {
        fallbackSrcs.push(String(value));
        imageSrc?.set?.call(this, value);
      },
    });

    try {
      trackMetaPixelEvent('InitiateCheckout', {
        content_ids: ['tilak-1'],
        content_type: 'product',
        contents: [{ id: 'tilak-1', item_price: 99, quantity: 1 }],
        num_items: 1,
        value: 99,
      });
      trackMetaPixelEvent('AddPaymentInfo', {
        content_ids: ['tilak-1'],
        content_type: 'product',
        contents: [{ id: 'tilak-1', item_price: 99, quantity: 1 }],
        num_items: 1,
        payment_method: 'Razorpay',
        value: 99,
      });
      const fallbackUrls = fallbackSrcs.map((src) => new URL(src));
      expect(fallbackUrls.map((url) => url.searchParams.get('ev'))).toEqual([
        'InitiateCheckout',
        'AddPaymentInfo',
      ]);
      fallbackUrls.forEach((url) => {
        expect(url.origin).toBe('https://www.facebook.com');
        expect(url.pathname).toBe('/tr');
        expect(url.searchParams.get('id')).toBe('1824114108557446');
        expect(url.searchParams.get('cd[currency]')).toBe('INR');
        expect(url.searchParams.get('cd[value]')).toBe('99');
        expect(url.searchParams.get('cd[content_ids]')).toBe(JSON.stringify(['tilak-1']));
        expect(JSON.parse(url.searchParams.get('cd[contents]') || '[]')).toEqual([{ id: 'tilak-1', item_price: 99, quantity: 1 }]);
      });
      expect(fallbackUrls[1].searchParams.get('cd[payment_method]')).toBe('Razorpay');
    } finally {
      if (imageSrc) {
        Object.defineProperty(HTMLImageElement.prototype, 'src', imageSrc);
      }
    }
  });

  it('builds product params with a positive numeric value', () => {
    expect(productToMetaPixelParams(product(49.995), 2)).toMatchObject({
      contents: [{ id: 'tilak-1', item_price: 50, quantity: 2 }],
      num_items: 2,
      value: 100,
    });
  });

  it('omits product value when catalog price is not greater than zero', () => {
    expect(productToMetaPixelParams(product(0))).not.toHaveProperty('value');
  });
});
