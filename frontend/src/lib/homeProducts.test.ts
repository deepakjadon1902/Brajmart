import { describe, expect, it } from 'vitest';
import { pickHomeProducts } from './homeProducts.mjs';
import { compareProductsByQuality } from '@/utils/productPresentation';
import type { Product } from '@/types/product';

const products = (): Product[] => Array.from({ length: 9 }, (_, index) => ({
  id: String(index + 1), name: `Product ${index + 1}`, slug: `product-${index + 1}`,
  category: 'Prasadam', image: '/logo.png', price: 100, inStock: true,
  rating: 5, reviewCount: 100 - index, showOnHome: false, homePosition: null,
}));
const select = (items: Product[]) => pickHomeProducts(items, compareProductsByQuality);
const ids = (items: Product[]) => select(items).map((item: Product) => item.id);

describe('six home products per category', () => {
  it('uses the six top products automatically without changing the input', () => {
    const items = products().reverse();
    expect(ids(items)).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(items[0].id).toBe('9');
  });
  it('replaces precisely the chosen automatic position and keeps six products', () => {
    const items = products();
    items[8] = { ...items[8], showOnHome: true, homePosition: 4 };
    expect(ids(items)).toEqual(['1', '2', '3', '9', '5', '6']);
  });
  it('supports all six manual positions and restores automatic picks on release', () => {
    const items = products();
    for (let i = 0; i < 6; i++) items[i] = { ...items[i], showOnHome: true, homePosition: 6 - i };
    expect(ids(items)).toEqual(['6', '5', '4', '3', '2', '1']);
    for (const item of items) { item.showOnHome = false; item.homePosition = null; }
    expect(ids(items)).toEqual(['1', '2', '3', '4', '5', '6']);
  });
  it('moves an existing top product without duplicates or empty positions', () => {
    const items = products();
    items[0] = { ...items[0], showOnHome: true, homePosition: 5 };
    expect(ids(items)).toEqual(['5', '2', '3', '4', '1', '6']);
  });
  it('keeps legacy selections and fills every unassigned position automatically', () => {
    const items = products();
    items[8].showOnHome = true;
    expect(ids(items)).toEqual(['9', '2', '3', '4', '5', '6']);
  });
  it('handles small categories and stale conflicting positions without duplicates', () => {
    const items = products().slice(0, 3);
    items[0] = { ...items[0], showOnHome: true, homePosition: 6, updatedAt: '2026-10-16' };
    items[1] = { ...items[1], showOnHome: true, homePosition: 6, updatedAt: '2026-10-17' };
    expect(ids(items)).toEqual(['1', '3', '2']);
    expect(ids([])).toEqual([]);
  });
  it('preserves positions when the prerender snapshot includes original and selected candidates', () => {
    const items = products();
    items[8] = { ...items[8], showOnHome: true, homePosition: 4 };
    const snapshot = [...select(items), ...pickHomeProducts(items, compareProductsByQuality, false)];
    expect(ids(snapshot)).toEqual(ids(items));
  });
  it('keeps category positions out of collections that mix categories', () => {
    const items = products();
    items[8] = { ...items[8], showOnHome: true, homePosition: 1 };
    expect(pickHomeProducts(items, compareProductsByQuality, false).map((item: Product) => item.id)).toEqual(['1', '2', '3', '4', '5', '6']);
  });
});
