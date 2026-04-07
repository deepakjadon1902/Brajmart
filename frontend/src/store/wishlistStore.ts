import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product } from '@/types/product';

interface WishlistStore {
  items: Product[];
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  isInWishlist: (productId: string) => boolean;
  toggleItem: (product: Product) => void;
}

export const useWishlistStore = create<WishlistStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (product) => set((state) => {
        if (state.items.find(i => i.id === product.id)) return state;
        return { items: [...state.items, product] };
      }),
      removeItem: (productId) => set((state) => ({
        items: state.items.filter(i => i.id !== productId),
      })),
      isInWishlist: (productId) => get().items.some(i => i.id === productId),
      toggleItem: (product) => {
        const { items } = get();
        if (items.find(i => i.id === product.id)) {
          set({ items: items.filter(i => i.id !== product.id) });
        } else {
          set({ items: [...items, product] });
        }
      },
    }),
    { name: 'brajmart-wishlist' }
  )
);
