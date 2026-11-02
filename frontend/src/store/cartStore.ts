import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Product } from '@/types/product';
import { fetchCart, updateCart, clearCartApi, getAuthToken, type PersistedProductInterestItem } from '@/lib/api';
import { productToMetaPixelParams, trackMetaPixelEvent } from '@/lib/metaPixel';
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
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (item: CartItem) => void;
  updateQuantity: (item: CartItem, quantity: number) => void;
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
    selectedSize?: string;
    selectedPieces?: string | number;
    selectedAttributes?: Record<string, string>;
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

export const getCartLineKey = (item: CartItem | PersistedProductInterestItem) => {
  const persisted = item as PersistedProductInterestItem;
  const product = ('product' in item ? item.product : undefined) as (Partial<Product> & { _id?: string }) | undefined;
  const id = String(persisted.productId || persisted.id || persisted._id || product?.id || product?._id || '').split('::')[0];
  const attrs = persisted.selectedAttributes || product?.selectedAttributes || {};
  return [id, persisted.selectedSize || product?.selectedSize || '', persisted.selectedPieces || product?.selectedPieces || '', JSON.stringify(Object.fromEntries(Object.entries(attrs).sort(([a], [b]) => a.localeCompare(b))))].join('|');
};

let cartSyncQueue: Promise<void> = Promise.resolve();
const queueCartSync = (items: CartItem[]) => {
  if (!getAuthToken()) return Promise.resolve();
  const snapshot = toApiItems(items);
  cartSyncQueue = cartSyncQueue.catch(() => undefined).then(async () => {
    await updateCart(snapshot);
  }).catch(() => undefined);
  return cartSyncQueue;
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
        if (!getAuthToken()) return;
        try {
          const cart = await fetchCart() as CartApiResponse;
          const remoteItems = (cart?.items || []).map(fromApiItem).filter((item) => item.product.id);
          const localItems = get().items.filter((item) => item.product.id);
          const items = [...remoteItems];
          for (const localItem of localItems) {
            const existing = items.find((remoteItem) => getCartLineKey(remoteItem) === getCartLineKey(localItem));
            if (existing) existing.quantity = Math.max(existing.quantity, localItem.quantity);
            else items.push(localItem);
          }
          if (localItems.length && (items.length !== remoteItems.length || items.some((item) => item.quantity !== remoteItems.find((remote) => getCartLineKey(remote) === getCartLineKey(item))?.quantity))) {
            await queueCartSync(items);
          }
          set({ items });
        } catch {
          // ignore
        }
      },
      addItem: (product, quantity = 1) => set((state) => {
        const safeQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
        const candidate: CartItem = { product, quantity: safeQuantity };
        const candidateKey = getCartLineKey(candidate);
        const existing = state.items.find((item) => getCartLineKey(item) === candidateKey);
        let items: CartItem[];
        if (existing) {
          items = state.items.map((item) => getCartLineKey(item) === candidateKey ? { ...item, quantity: item.quantity + safeQuantity } : item);
        } else {
          items = [...state.items, candidate];
        }
        queueCartSync(items);
        trackMetaPixelEvent('AddToCart', productToMetaPixelParams(product, safeQuantity));
        return { items, lastAddedProductId: product.id };
      }),
      removeItem: (target) => set((state) => {
        const key = getCartLineKey(target);
        const items = state.items.filter((item) => getCartLineKey(item) !== key);
        queueCartSync(items);
        return { items };
      }),
      updateQuantity: (target, quantity) => set((state) => {
        const key = getCartLineKey(target);
        const items = quantity <= 0
          ? state.items.filter((item) => getCartLineKey(item) !== key)
          : state.items.map((item) => getCartLineKey(item) === key ? { ...item, quantity } : item);
        queueCartSync(items);
        return { items };
      }),
      reconcileValidatedItems: (validatedItems) => set((state) => {
        const byVariant = new Map(validatedItems.map((item) => [getCartLineKey(item), item]));
        const items = state.items
          .map((item) => {
            const validated = byVariant.get(getCartLineKey(item));
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
          .filter((item) => byVariant.has(getCartLineKey(item)));
        queueCartSync(items);
        return { items };
      }),
      clearCart: () => {
        if (getAuthToken()) clearCartApi().catch(() => undefined);
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
    { name: 'brajmart-cart', storage: createJSONStorage(() => createUserScopedStorage('brajmart-cart')), skipHydration: true }
  )
);
