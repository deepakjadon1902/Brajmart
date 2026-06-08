import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product, Category } from '@/types/product';
import { fetchProducts, fetchCategories } from '@/lib/api';

const STALE_AFTER_MS = 5 * 60 * 1000; // 5 minutes
const PRODUCT_SYNC_KEY = 'brajmart-products-updated-at';
let productListRequest: Promise<void> | null = null;

interface ProductStore {
  products: Product[];
  categories: Category[];
  lastFetchedAt: number;
  loading: boolean;
  error: string | null;
  setProducts: (products: Product[]) => void;
  setCategories: (categories: Category[]) => void;
  loadFromApi: (opts?: { force?: boolean }) => Promise<void>;

  addProduct: (product: Product) => void;
  updateProduct: (id: string, data: Partial<Product>) => void;
  deleteProduct: (id: string) => void;

  addCategory: (category: Category) => void;
  updateCategory: (id: string, data: Partial<Category>) => void;
  deleteCategory: (id: string) => void;

  getProductsByCategory: (category: string) => Product[];
  getProductsBySubcategory: (category: string, subcategory: string) => Product[];
  getProductBySlug: (slug: string) => Product | undefined;
  getProductById: (id: string) => Product | undefined;
  searchProducts: (query: string) => Product[];
  getLatestProducts: () => Product[];
  getNewArrivals: () => Product[];
  getBestSellers: () => Product[];
  getByTag: (tag: string) => Product[];
}

export const useProductStore = create<ProductStore>()(
  persist(
    (set, get) => ({
      products: [],
      categories: [],
      lastFetchedAt: 0,
      loading: false,
      error: null,

      setProducts: (products) => set({ products }),
      setCategories: (categories) => set({ categories }),
      loadFromApi: async (opts) => {
        const force = Boolean(opts?.force);
        const state = get();
        const hasData = state.products.length > 0 || state.categories.length > 0;
        const isFresh = state.lastFetchedAt > 0 && (Date.now() - state.lastFetchedAt) < STALE_AFTER_MS;

        // If admin updated products in another tab/session, refresh even if our cache is "fresh".
        let shouldSync = false;
        if (typeof window !== 'undefined') {
          try {
            const syncAt = Number(localStorage.getItem(PRODUCT_SYNC_KEY) || '0');
            shouldSync = Number.isFinite(syncAt) && syncAt > state.lastFetchedAt;
          } catch {
            // ignore
          }
        }

        // On hard refresh / new tab, always fetch once to avoid showing stale persisted stock/price.
        const isFirstLoad = state.lastFetchedAt === 0;

        // Admin must always see the latest category names (avoid "refresh shows old name" due to persisted cache).
        const isAdminPath = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
        if (!force && !shouldSync && !isAdminPath && !isFirstLoad && hasData && isFresh) return;

        if (productListRequest) return productListRequest;
        const request = (async () => {
          if (!get().loading) set({ loading: true, error: null });
          try {
            const [products, categories] = await Promise.all([
              fetchProducts({ fresh: force || isAdminPath }),
              fetchCategories({ fresh: force || isAdminPath }),
            ]);
            const mappedProducts = (Array.isArray(products) ? products : []).map((p: any) => {
              const tags = Array.isArray(p.tags) ? p.tags : (p.badge ? [p.badge] : []);
              return { ...p, id: p.id || p._id, tags };
            });
            const orderValue = (value: unknown) => {
              const n = typeof value === 'number' ? value : Number(value ?? 0);
              return n > 0 ? n : Number.MAX_SAFE_INTEGER;
            };
            const mappedCategories = (Array.isArray(categories) ? categories : [])
              .map((c: any) => ({
                ...c,
                id: c.id || c._id,
                displayOrder: typeof c.displayOrder === 'number' ? c.displayOrder : Number(c.displayOrder ?? 0),
                subcategories: (Array.isArray(c.subcategories) ? c.subcategories : [])
                  .map((s: any) => ({
                    ...s,
                    id: s.id || s._id,
                    categoryId: String(s.categoryId ?? s.category_id ?? ''),
                    displayOrder: typeof s.displayOrder === 'number' ? s.displayOrder : Number(s.displayOrder ?? 0),
                  }))
                  .sort((a, b) => orderValue(a.displayOrder) - orderValue(b.displayOrder) || String(a.name).localeCompare(String(b.name))),
              }))
              .sort((a, b) => orderValue(a.displayOrder) - orderValue(b.displayOrder) || String(a.name).localeCompare(String(b.name)));

            set({ products: mappedProducts, categories: mappedCategories, lastFetchedAt: Date.now(), loading: false, error: null });
          } catch (err: any) {
            set({ loading: false, error: String(err?.message || 'Failed to load products') });
          }
        })();
        productListRequest = request;
        try {
          await request;
        } finally {
          if (productListRequest === request) productListRequest = null;
        }
      },

      addProduct: (product) => set((s) => ({ products: [product, ...s.products] })),
      updateProduct: (id, data) => set((s) => ({
        products: s.products.map((p) => (p.id === id ? { ...p, ...data } : p)),
      })),
      deleteProduct: (id) => set((s) => ({ products: s.products.filter((p) => p.id !== id) })),

      addCategory: (category) => set((s) => {
        const orderValue = (value: unknown) => {
          const n = typeof value === 'number' ? value : Number(value ?? 0);
          return n > 0 ? n : Number.MAX_SAFE_INTEGER;
        };
        const categories = [...s.categories, category].sort((a, b) => orderValue(a.displayOrder) - orderValue(b.displayOrder) || String(a.name).localeCompare(String(b.name)));
        return { categories };
      }),
      updateCategory: (id, data) => set((s) => {
        const orderValue = (value: unknown) => {
          const n = typeof value === 'number' ? value : Number(value ?? 0);
          return n > 0 ? n : Number.MAX_SAFE_INTEGER;
        };
        const categories = s.categories
          .map((c) => (c.id === id ? { ...c, ...data } : c))
          .sort((a, b) => orderValue(a.displayOrder) - orderValue(b.displayOrder) || String(a.name).localeCompare(String(b.name)));
        return { categories };
      }),
      deleteCategory: (id) => set((s) => ({ categories: s.categories.filter((c) => c.id !== id) })),

      getProductsByCategory: (category) => {
        const normalize = (value: string) =>
          value
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)+/g, '');
        const target = normalize(category || '');
        return get().products.filter((p) => normalize(p.category || '') === target);
      },
      getProductsBySubcategory: (category, subcategory) => {
        const normalize = (value: string) =>
          value
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)+/g, '');
        const catTarget = normalize(category || '');
        const subTarget = normalize(subcategory || '');
        return get().products.filter((p) => normalize(p.category || '') === catTarget && normalize(String(p.subcategory || '')) === subTarget);
      },
      getProductBySlug: (slug) => {
        const normalize = (value: string) =>
          value
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)+/g, '');
        const target = normalize(slug || '');
        return get().products.find((p) => {
          const bySlug = p.slug ? normalize(p.slug) : '';
          const byName = p.name ? normalize(p.name) : '';
          return bySlug === target || byName === target;
        });
      },
      getProductById: (id) => get().products.find((p) => p.id === id),
      searchProducts: (query) => {
        const q = query.toLowerCase();
        return get().products.filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
      },
      getLatestProducts: () => get().products.filter((p) => p.tags?.includes('latest')),
      getNewArrivals: () => get().products.filter((p) => p.tags?.includes('new')),
      getBestSellers: () => get().products.filter((p) => p.tags?.includes('bestseller')),
      getByTag: (tag) => get().products.filter((p) => p.tags?.includes(tag)),
    }),
    {
      name: 'brajmart-products',
      partialize: (state) => ({
        products: state.products,
        categories: state.categories.map((c) => ({
          ...c,
          icon: typeof c.icon === 'string' && c.icon.startsWith('data:') ? '' : c.icon,
        })),
        lastFetchedAt: state.lastFetchedAt,
      }),
    }
  )
);

// Cross-tab instant refresh when Admin updates products.
// Admin writes to localStorage key `brajmart-products-updated-at`, which triggers `storage` events in other tabs.
if (typeof window !== 'undefined') {
  try {
    window.addEventListener('storage', (e) => {
      if (e.key !== PRODUCT_SYNC_KEY) return;
      const state = useProductStore.getState();
      state.loadFromApi({ force: true }).catch(() => undefined);
    });
  } catch {
    // ignore (older browsers / locked down environments)
  }
}

export const categorySlugMap: Record<string, string> = {
  'prasadam': 'Prasadam',
  'spiritual-books': 'Spiritual Books',
  'idols-shringar': 'Idols & Shringar',
  'incense-pooja': 'Incense & Pooja',
  'incense-pooja-items': 'Incense/Pooja Items',
  'accessories': 'Accessories',
  'clothing': 'Clothing',
  'groceries': 'Groceries',
  'braj-yatra': 'Braj Yatra',
};

export const categoryToSlug = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
};
