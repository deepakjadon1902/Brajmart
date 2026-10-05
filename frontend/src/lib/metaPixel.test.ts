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

  it('sends purchase only with a confirmed order event ID and payload', () => {
    const eventId = trackMetaPixelEvent('Purchase', {
      content_ids: ['101'],
      contents: [{ id: '101', item_price: 199, quantity: 2 }],
      currency: 'INR',
      order_id: 1234,
      value: 398,
    }, {
      eventId: 'brajmart.Purchase.order.1234',
    });

    expect(eventId).toBe('brajmart.Purchase.order.1234');
    expect(window.fbq).toHaveBeenCalledWith('track', 'Purchase', expect.objectContaining({
      order_id: 1234,
      value: 398,
    }), { eventID: 'brajmart.Purchase.order.1234' });
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/meta/conversions'), expect.objectContaining({
      body: expect.stringContaining('"eventId":"brajmart.Purchase.order.1234"'),
    }));
  });

  it('sends matching browser and server event IDs for deduplication', () => {
    const eventId = trackMetaPixelEvent('AddToCart', { content_ids: ['tilak-1'] });

    expect(window.fbq).toHaveBeenCalledWith('track', 'AddToCart', expect.any(Object), { eventID: eventId });
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/meta/conversions'), expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining(`"eventId":"${eventId}"`),
    }));
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
