import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
          const items = (cart?.items || []).map((i) => ({
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
              stockQuantity: i.product?.stockQuantity,
              reservedQuantity: i.product?.reservedQuantity,
              lowStockThreshold: i.product?.lowStockThreshold,
              sku: i.product?.sku,
              selectedSize: i.selectedSize || i.product?.selectedSize,
              selectedPieces: i.selectedPieces || i.product?.selectedPieces,
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
              selectedSize: i.product.selectedSize,
              selectedPieces: i.product.selectedPieces,
              selectedAttributes: i.product.selectedAttributes,
            })));
          }
          return { items, lastAddedProductId: product.id };
        }
        const items = [...state.items, { product, quantity: 1 }];
        if (getAuthToken()) {
          updateCart(items.map((i) => ({
            productId: i.product.id,
            name: i.product.name,
            image: i.product.image,
            quantity: i.quantity,
            price: i.product.price,
            selectedSize: i.product.selectedSize,
            selectedPieces: i.product.selectedPieces,
            selectedAttributes: i.product.selectedAttributes,
          })));
        }
        return { items, lastAddedProductId: product.id };
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
            selectedSize: i.product.selectedSize,
            selectedPieces: i.product.selectedPieces,
            selectedAttributes: i.product.selectedAttributes,
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
            selectedSize: i.product.selectedSize,
            selectedPieces: i.product.selectedPieces,
          })));
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
          updateCart(items.map((i) => ({
            productId: String(i.product.id).split('::')[0],
            name: i.product.name,
            image: i.product.image,
            quantity: i.quantity,
            price: i.product.price,
            selectedSize: i.product.selectedSize,
            selectedPieces: i.product.selectedPieces,
            selectedAttributes: i.product.selectedAttributes,
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
    { name: 'brajmart-cart', storage: createUserScopedStorage('brajmart-cart') }
  )
);
