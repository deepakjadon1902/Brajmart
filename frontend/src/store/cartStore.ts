import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product } from '@/types/product';
import { fetchCart, updateCart, clearCartApi, getAuthToken } from '@/lib/api';
import { createUserScopedStorage } from '@/lib/userStorage';

export interface CartItem {
  product: Product;
  quantity: number;
}

interface CartStore {
  items: CartItem[];
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  loadFromApi: () => Promise<void>;
  totalItems: () => number;
  totalPrice: () => number;
  totalSavings: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      loadFromApi: async () => {
        try {
          if (!getAuthToken()) return;
          const cart: any = await fetchCart();
          const items = (cart?.items || []).map((i: any) => ({
            product: {
              id: i.productId || i.product?.id || i.product?._id || i.productId || i.id || '',
              name: i.name || i.product?.name || 'Item',
              slug: i.product?.slug || '',
              price: i.price || i.product?.price || 0,
              originalPrice: i.product?.originalPrice,
              image: i.image || i.product?.image || '',
              category: i.product?.category || '',
              rating: i.product?.rating || 0,
              reviewCount: i.product?.reviewCount || 0,
              badge: i.product?.badge,
              inStock: i.product?.inStock ?? true,
            },
            quantity: i.quantity || 1,
          }));
          set({ items });
        } catch {
          // ignore
        }
      },
      addItem: (product) => set((state) => {
        const existing = state.items.find(i => i.product.id === product.id);
        if (existing) {
          const items = state.items.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
          if (getAuthToken()) {
            updateCart(items.map((i) => ({
              productId: i.product.id,
              name: i.product.name,
              image: i.product.image,
              quantity: i.quantity,
              price: i.product.price,
            })));
          }
          return { items };
        }
        const items = [...state.items, { product, quantity: 1 }];
        if (getAuthToken()) {
          updateCart(items.map((i) => ({
            productId: i.product.id,
            name: i.product.name,
            image: i.product.image,
            quantity: i.quantity,
            price: i.product.price,
          })));
        }
        return { items };
      }),
      removeItem: (productId) => set((state) => {
        const items = state.items.filter(i => i.product.id !== productId);
        if (getAuthToken()) {
          updateCart(items.map((i) => ({
            productId: i.product.id,
            name: i.product.name,
            image: i.product.image,
            quantity: i.quantity,
            price: i.product.price,
          })));
        }
        return { items };
      }),
      updateQuantity: (productId, quantity) => set((state) => {
        const items = quantity <= 0
          ? state.items.filter(i => i.product.id !== productId)
          : state.items.map(i => i.product.id === productId ? { ...i, quantity } : i);
        if (getAuthToken()) {
          updateCart(items.map((i) => ({
            productId: i.product.id,
            name: i.product.name,
            image: i.product.image,
            quantity: i.quantity,
            price: i.product.price,
          })));
        }
        return { items };
      }),
      clearCart: () => {
        if (getAuthToken()) {
          clearCartApi();
        }
        set({ items: [] });
      },
      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      totalPrice: () => get().items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),
      totalSavings: () => get().items.reduce((sum, i) => {
        const saving = (i.product.originalPrice || i.product.price) - i.product.price;
        return sum + saving * i.quantity;
      }, 0),
    }),
    { name: 'brajmart-cart', storage: createUserScopedStorage('brajmart-cart') }
  )
);
