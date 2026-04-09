import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product, Category } from '@/types/product';
import { fetchProducts, fetchCategories } from '@/lib/api';

interface ProductStore {
  products: Product[];
  categories: Category[];
  setProducts: (products: Product[]) => void;
  setCategories: (categories: Category[]) => void;
  loadFromApi: () => Promise<void>;

  addProduct: (product: Product) => void;
  updateProduct: (id: string, data: Partial<Product>) => void;
  deleteProduct: (id: string) => void;

  addCategory: (category: Category) => void;
  updateCategory: (id: string, data: Partial<Category>) => void;
  deleteCategory: (id: string) => void;

  getProductsByCategory: (category: string) => Product[];
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

      setProducts: (products) => set({ products }),
      setCategories: (categories) => set({ categories }),
      loadFromApi: async () => {
        const [products, categories] = await Promise.all([fetchProducts(), fetchCategories()]);
        const mappedProducts = (Array.isArray(products) ? products : []).map((p: any) => {
          const tags = Array.isArray(p.tags) ? p.tags : (p.badge ? [p.badge] : []);
          return { ...p, id: p.id || p._id, tags };
        });
        const mappedCategories = (Array.isArray(categories) ? categories : []).map((c: any) => ({ ...c, id: c.id || c._id }));
        set({ products: mappedProducts, categories: mappedCategories });
      },

      addProduct: (product) => set((s) => ({ products: [product, ...s.products] })),
      updateProduct: (id, data) => set((s) => ({
        products: s.products.map((p) => (p.id === id ? { ...p, ...data } : p)),
      })),
      deleteProduct: (id) => set((s) => ({ products: s.products.filter((p) => p.id !== id) })),

      addCategory: (category) => set((s) => ({ categories: [...s.categories, category] })),
      updateCategory: (id, data) => set((s) => ({
        categories: s.categories.map((c) => (c.id === id ? { ...c, ...data } : c)),
      })),
      deleteCategory: (id) => set((s) => ({ categories: s.categories.filter((c) => c.id !== id) })),

      getProductsByCategory: (category) => get().products.filter((p) => p.category.toLowerCase() === category.toLowerCase()),
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
        categories: state.categories.map((c) => ({
          ...c,
          icon: typeof c.icon === 'string' && c.icon.startsWith('data:') ? '' : c.icon,
        })),
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.setProducts([]);
        state.setCategories([]);
      },
    }
  )
);

export const categorySlugMap: Record<string, string> = {
  'prasadam': 'Prasadam',
  'spiritual-books': 'Spiritual Books',
  'idols-shringar': 'Idols & Shringar',
  'incense-pooja': 'Incense & Pooja',
  'accessories': 'Accessories',
  'clothing': 'Clothing',
  'groceries': 'Groceries',
  'braj-yatra': 'Braj Yatra',
};

export const categoryToSlug = (name: string): string => {
  return name.toLowerCase().replace(/[&\s]+/g, '-').replace(/--+/g, '-');
};
