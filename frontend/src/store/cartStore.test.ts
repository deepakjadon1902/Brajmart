import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  fetchCart: vi.fn(),
  updateCart: vi.fn().mockResolvedValue({}),
  getAuthToken: vi.fn(() => ''),
}));
vi.mock('@/lib/metaPixel', () => ({
  productToMetaPixelParams: vi.fn(() => ({})),
  trackMetaPixelEvent: vi.fn(),
}));

import { getCartLineKey, useCartStore } from './cartStore';
import type { Product } from '@/types/product';

const productForSize = (size: string): Product => ({
  id: `product-1::s=${size}`,
  name: 'Variant Product',
  slug: 'variant-product',
  price: 100,
  image: '/product.jpg',
  category: 'Home',
  rating: 5,
  reviewCount: 0,
  inStock: true,
  selectedSize: size,
  selectedAttributes: { size },
});

describe('cart line identity', () => {
  beforeEach(() => {
    useCartStore.setState({ items: [], drawerOpen: false, lastAddedProductId: '' });
    localStorage.clear();
  });

  it('keeps variant lines distinct after the API normalizes product IDs', () => {
    const medium = { productId: 'product-1', selectedSize: 'M', selectedAttributes: { size: 'M' }, quantity: 1 };
    const large = { productId: 'product-1', selectedSize: 'L', selectedAttributes: { size: 'L' }, quantity: 1 };
    expect(getCartLineKey(medium)).not.toEqual(getCartLineKey(large));
    expect(getCartLineKey(medium)).toEqual(getCartLineKey({ ...productForSize('M'), quantity: 1 }));
  });

  it('adds, updates, and removes only the selected variant line', () => {
    const store = useCartStore.getState();
    store.addItem(productForSize('M'), 1);
    store.addItem(productForSize('L'), 2);
    store.addItem(productForSize('M'), 2);

    let items = useCartStore.getState().items;
    expect(items).toHaveLength(2);
    expect(items.find((item) => item.product.selectedSize === 'M')?.quantity).toBe(3);
    expect(items.find((item) => item.product.selectedSize === 'L')?.quantity).toBe(2);

    const medium = items.find((item) => item.product.selectedSize === 'M')!;
    const large = items.find((item) => item.product.selectedSize === 'L')!;
    useCartStore.getState().updateQuantity(medium, 4);
    expect(useCartStore.getState().items.find((item) => item.product.selectedSize === 'L')?.quantity).toBe(2);
    useCartStore.getState().removeItem(large);
    items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].product.selectedSize).toBe('M');
    expect(items[0].quantity).toBe(4);
  });
});
