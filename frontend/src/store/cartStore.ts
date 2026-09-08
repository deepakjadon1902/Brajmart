import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Product } from '@/types/product';
import { fetchCart, updateCart, clearCartApi, getAuthToken, type PersistedProductInterestItem } from '@/lib/api';
import { createUserScopedStorage } from '@/lib/userStorage';
import { getValidSavings } from '@/utils/productPresentation';

export interface CartItem {
  product: Product;
  quantity: number;
}

interface CartStore {
  items: CartItem[];
  drawerOpen: boolean;
  lastAddedProductId: string;
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  reconcileValidatedItems: (items: Array<{
    productId: string;
    quantity: number;
    price: number;
    originalPrice?: number | null;
    name?: string;
    slug?: string;
    image?: string;
    category?: string;
    inStock?: boolean;
    codEnabled?: boolean | null;
    categoryCodEnabled?: boolean;
    availableQuantity?: number | null;
  }>) => void;
  clearCart: () => void;
  openDrawer: (productId?: string) => void;
  closeDrawer: () => void;
  loadFromApi: () => Promise<void>;
  totalItems: () => number;
  totalPrice: () => number;
  totalSavings: () => number;
}

type CartApiResponse = {
  items?: PersistedProductInterestItem[];
};

const toApiItems = (items: CartItem[]) => items.map((i) => ({
  productId: i.product.id,
  name: i.product.name,
  image: i.product.image,
  quantity: i.quantity,
  price: i.product.price,
  slug: i.product.slug,
  category: i.product.category,
  selectedSize: i.product.selectedSize,
  selectedPieces: i.product.selectedPieces,
  selectedAttributes: i.product.selectedAttributes,
}));

const stringField = (value: unknown) => typeof value === 'string' ? value : '';
const numberField = (value: unknown) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
};

const fromApiItem = (i: PersistedProductInterestItem): CartItem => {
  const product = (i.product || {}) as Partial<Product> & { _id?: string };
  return {
    product: {
      id: String(i.productId || product.id || product._id || i.id || ''),
      name: stringField(i.name || product.name) || 'Item',
      slug: stringField(i.slug || product.slug),
      price: numberField(i.price || product.price),
      originalPrice: product.originalPrice,
      image: stringField(i.image || product.image),
      category: stringField(i.category || product.category),
      rating: numberField(product.rating),
      reviewCount: numberField(product.reviewCount),
      badge: product.badge,
      inStock: product.inStock ?? true,
      stockQuantity: product.stockQuantity,
      reservedQuantity: product.reservedQuantity,
      lowStockThreshold: product.lowStockThreshold,
      sku: product.sku,
      selectedSize: i.selectedSize || product.selectedSize,
      selectedPieces: numberField(i.selectedPieces || product.selectedPieces) || undefined,
      selectedAttributes: i.selectedAttributes || product.selectedAttributes,
    },
    quantity: Math.max(1, numberField(i.quantity) || 1),
  };
};

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      drawerOpen: false,
      lastAddedProductId: '',
      loadFromApi: async () => {
        try {
          if (!getAuthToken()) return;
          const cart = await fetchCart() as CartApiResponse;
          const remoteItems = (cart?.items || []).map(fromApiItem).filter((item) => item.product.id);
          const localItems = get().items.filter((item) => item.product.id);
          const items = [...remoteItems];
          for (const localItem of localItems) {
            const existing = items.find((remoteItem) => remoteItem.product.id === localItem.product.id);
            if (existing) existing.quantity = Math.max(existing.quantity, localItem.quantity);
            else items.push(localItem);
          }
          if (localItems.length && (items.length !== remoteItems.length || items.some((item, index) => item.quantity !== remoteItems[index]?.quantity))) {
            updateCart(toApiItems(items)).catch(() => {});
          }
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
            updateCart(toApiItems(items)).catch(() => {});
          }
          return { items, lastAddedProductId: product.id };
        }
        const items = [...state.items, { product, quantity: 1 }];
        if (getAuthToken()) {
          updateCart(toApiItems(items)).catch(() => {});
        }
        return { items, lastAddedProductId: product.id };
      }),
      removeItem: (productId) => set((state) => {
        const items = state.items.filter(i => i.product.id !== productId);
        if (getAuthToken()) {
          updateCart(toApiItems(items)).catch(() => {});
        }
        return { items };
      }),
      updateQuantity: (productId, quantity) => set((state) => {
        const items = quantity <= 0
          ? state.items.filter(i => i.product.id !== productId)
          : state.items.map(i => i.product.id === productId ? { ...i, quantity } : i);
        if (getAuthToken()) {
          updateCart(toApiItems(items)).catch(() => {});
        }
        return { items };
      }),
      reconcileValidatedItems: (validatedItems) => set((state) => {
        const byId = new Map(validatedItems.map((item) => [String(item.productId), item]));
        const items = state.items
          .map((item) => {
            const baseId = String(item.product.id).split('::')[0];
            const validated = byId.get(baseId);
            if (!validated) return item;
            return {
              product: {
                ...item.product,
                id: item.product.id,
                name: validated.name || item.product.name,
                slug: validated.slug || item.product.slug,
                image: validated.image || item.product.image,
                category: validated.category || item.product.category,
                price: Number(validated.price || item.product.price),
                originalPrice: validated.originalPrice === null ? undefined : (validated.originalPrice ?? item.product.originalPrice),
                inStock: validated.inStock ?? item.product.inStock,
                codEnabled: validated.codEnabled === undefined ? item.product.codEnabled : validated.codEnabled,
                categoryCodEnabled: validated.categoryCodEnabled ?? item.product.categoryCodEnabled,
                stockQuantity: validated.availableQuantity ?? item.product.stockQuantity,
                reservedQuantity: 0,
              },
              quantity: Math.max(1, Number(validated.quantity || item.quantity)),
            };
          })
          .filter((item) => byId.has(String(item.product.id).split('::')[0]));
        if (getAuthToken()) {
          updateCart(toApiItems(items).map((item) => ({
            ...item,
            productId: String(item.productId).split('::')[0],
          }))).catch(() => {});
        }
        return { items };
      }),
      clearCart: () => {
        if (getAuthToken()) {
          clearCartApi().catch(() => {});
        }
        set({ items: [] });
      },
      openDrawer: (productId) => set((state) => ({
        drawerOpen: true,
        lastAddedProductId: productId || state.lastAddedProductId,
      })),
      closeDrawer: () => set({ drawerOpen: false }),
      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      totalPrice: () => get().items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),
      totalSavings: () => get().items.reduce((sum, i) => {
        return sum + getValidSavings(i.product) * i.quantity;
      }, 0),
    }),
    { name: 'brajmart-cart', storage: createJSONStorage(() => createUserScopedStorage('brajmart-cart')) }
  )
);
