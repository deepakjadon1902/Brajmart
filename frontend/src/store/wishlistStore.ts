import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product } from '@/types/product';
import { createUserScopedStorage } from '@/lib/userStorage';
import { clearWishlistApi, fetchWishlist, getAuthToken, PersistedProductInterestItem, updateWishlist } from '@/lib/api';

interface WishlistStore {
  items: Product[];
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  isInWishlist: (productId: string) => boolean;
  toggleItem: (product: Product) => void;
  clear: () => void;
  loadFromApi: () => Promise<void>;
}

const toApiItems = (items: Product[]) => items.map((item) => ({
  productId: item.id,
  name: item.name,
  image: item.image,
  price: item.price,
  slug: item.slug,
  category: item.category,
  selectedSize: item.selectedSize,
  selectedPieces: item.selectedPieces,
}));

type WishlistApiResponse = {
  items?: PersistedProductInterestItem[];
};

const stringField = (value: unknown) => typeof value === 'string' ? value : '';
const numberField = (value: unknown) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
};

const fromApiItem = (item: PersistedProductInterestItem): Product => ({
  id: String(item.productId || item.id || item._id || ''),
  name: stringField(item.name || item.product?.name) || 'Product',
  slug: stringField(item.slug || item.product?.slug),
  price: numberField(item.price || item.product?.price),
  originalPrice: numberField(item.product?.originalPrice),
  image: stringField(item.image || item.product?.image),
  category: stringField(item.category || item.product?.category),
  rating: numberField(item.product?.rating),
  reviewCount: numberField(item.product?.reviewCount),
  badge: stringField(item.product?.badge) || undefined,
  inStock: item.product?.inStock === undefined ? true : Boolean(item.product.inStock),
  selectedSize: item.selectedSize || stringField(item.product?.selectedSize) || undefined,
  selectedPieces: item.selectedPieces || stringField(item.product?.selectedPieces) || undefined,
});

export const useWishlistStore = create<WishlistStore>()(
  persist(
    (set, get) => ({
      items: [],
      loadFromApi: async () => {
        try {
          if (!getAuthToken()) return;
          const wishlist = await fetchWishlist() as WishlistApiResponse;
          const remoteItems = (wishlist?.items || []).map(fromApiItem).filter((item: Product) => item.id);
          const localItems = get().items.filter((item) => item.id);
          const merged = [...remoteItems];
          for (const localItem of localItems) {
            if (!merged.some((remoteItem) => remoteItem.id === localItem.id)) merged.push(localItem);
          }
          const items = merged;
          if (localItems.length && items.length !== remoteItems.length) {
            updateWishlist(toApiItems(items)).catch(() => {});
          }
          set({ items });
        } catch {
          // keep local wishlist
        }
      },
      addItem: (product) => set((state) => {
        if (state.items.find(i => i.id === product.id)) return state;
        const items = [...state.items, product];
        if (getAuthToken()) updateWishlist(toApiItems(items)).catch(() => {});
        return { items };
      }),
      removeItem: (productId) => set((state) => {
        const items = state.items.filter(i => i.id !== productId);
        if (getAuthToken()) updateWishlist(toApiItems(items)).catch(() => {});
        return { items };
      }),
      isInWishlist: (productId) => get().items.some(i => i.id === productId),
      toggleItem: (product) => {
        const { items } = get();
        if (items.find(i => i.id === product.id)) {
          const nextItems = items.filter(i => i.id !== product.id);
          if (getAuthToken()) updateWishlist(toApiItems(nextItems)).catch(() => {});
          set({ items: nextItems });
        } else {
          const nextItems = [...items, product];
          if (getAuthToken()) updateWishlist(toApiItems(nextItems)).catch(() => {});
          set({ items: nextItems });
        }
      },
      clear: () => {
        if (getAuthToken()) clearWishlistApi().catch(() => {});
        set({ items: [] });
      },
    }),
    { name: 'brajmart-wishlist', storage: createUserScopedStorage('brajmart-wishlist') }
  )
);
