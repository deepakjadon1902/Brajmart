import type { CartItem } from '@/store/cartStore';
import type { Product } from '@/types/product';
import { getValidMrp, getValidSavings, isProductPurchasable } from '@/utils/productPresentation';

export const getCartItemSavings = (product: Product, quantity = 1) => getValidSavings(product) * Math.max(1, quantity);

export const getCartTotal = (items: CartItem[]) =>
  items.reduce((sum, item) => sum + Number(item.product.price || 0) * Math.max(1, item.quantity), 0);

export const getCartSavings = (items: CartItem[]) =>
  items.reduce((sum, item) => sum + getCartItemSavings(item.product, item.quantity), 0);

export const getCartItemAvailabilityLabel = (product: Product) =>
  isProductPurchasable(product) ? 'Available' : 'Currently unavailable';

export const hasValidMrp = (product: Product) => Boolean(getValidMrp(product));
