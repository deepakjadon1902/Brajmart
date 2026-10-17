import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCategories, fetchProducts } from '@/lib/api';
import { useProductStore } from './productStore';
import type { Product } from '@/types/product';

vi.mock('@/lib/api', () => ({ fetchCategories: vi.fn(), fetchProducts: vi.fn() }));
const item = (id: string, category = 'Prasadam', position: number | null = null): Product => ({
  id, name: `Product ${id}`, slug: `product-${id}`, category, price: 100, image: '/logo.png',
  rating: 0, reviewCount: 0, inStock: true, showOnHome: position !== null, homePosition: position,
});
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useProductStore.setState({ products: [], categories: [], lastFetchedAt: 0, loading: false, error: null });
  vi.mocked(fetchCategories).mockResolvedValue([]);
});

describe('home placement updates in the product store', () => {
  it('updates the chosen product and releases its category’s former selection together', () => {
    useProductStore.setState({ products: [item('1', 'Prasadam', 3), item('2'), item('3', 'Books', 3)] });
    useProductStore.getState().updateProduct('2', { homePosition: 3, showOnHome: true });
    const [previous, chosen, otherCategory] = useProductStore.getState().products;
    expect(previous.homePosition).toBeNull();
    expect(previous.showOnHome).toBe(false);
    expect(chosen.homePosition).toBe(3);
    expect(otherCategory.homePosition).toBe(3);
  });
  it('does not lose a forced save refresh behind an older in-flight catalog request', async () => {
    let finishOld: (value: Product[]) => void;
    vi.mocked(fetchProducts).mockImplementationOnce(() => new Promise<Product[]>((resolve) => { finishOld = resolve; }));
    vi.mocked(fetchProducts).mockResolvedValueOnce([item('2', 'Prasadam', 4)]);
    const oldRequest = useProductStore.getState().loadFromApi();
    const afterSave = useProductStore.getState().loadFromApi({ force: true });
    const duplicateRefresh = useProductStore.getState().loadFromApi({ force: true });
    finishOld!([item('1')]);
    await Promise.all([oldRequest, afterSave, duplicateRefresh]);
    expect(fetchProducts).toHaveBeenCalledTimes(2);
    expect(useProductStore.getState().products[0].id).toBe('2');
    expect(useProductStore.getState().products[0].homePosition).toBe(4);
  });
  it('keeps an immediate placement update when an older fetch finishes later', async () => {
    let finish: (value: Product[]) => void;
    useProductStore.setState({ products: [item('1'), item('2')] });
    vi.mocked(fetchProducts).mockImplementationOnce(() => new Promise<Product[]>((resolve) => { finish = resolve; }));
    const stale = useProductStore.getState().loadFromApi({ force: true });
    useProductStore.getState().updateProduct('2', { homePosition: 1, showOnHome: true });
    finish!([item('1'), item('2')]);
    await stale;
    expect(useProductStore.getState().products[1].homePosition).toBe(1);
  });
});
