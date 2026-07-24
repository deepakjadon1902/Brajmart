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
    trackMetaPixelEvent('Purchase', { value: 0, currency: 'INR' });

    expect(window.fbq).toHaveBeenCalledWith('track', 'Purchase', { currency: 'INR' });
  });

  it('sends valid value fields as numbers to Meta Pixel', () => {
    trackMetaPixelEvent('Purchase', { value: '9.90' });

    expect(window.fbq).toHaveBeenCalledWith('track', 'Purchase', {
      currency: 'INR',
      value: 9.9,
    });
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
