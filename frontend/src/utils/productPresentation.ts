import type { Product } from '@/types/product';

export const getAvailableQuantity = (product: Product): number | null => {
  if (product.stockQuantity === null || product.stockQuantity === undefined) return null;
  return Math.max(0, Number(product.stockQuantity || 0) - Number(product.reservedQuantity || 0));
};

export const isProductPurchasable = (product: Product) => {
  const price = Number(product.price || 0);
  if (!Number.isFinite(price) || price <= 0) return false;
  const stockQuantity = product.stockQuantity === null || product.stockQuantity === undefined ? null : Number(product.stockQuantity);
  const reservedQuantity = Number(product.reservedQuantity || 0);
  if (stockQuantity !== null && (!Number.isFinite(stockQuantity) || !Number.isFinite(reservedQuantity) || stockQuantity < 0 || reservedQuantity < 0 || reservedQuantity > stockQuantity)) return false;
  const available = getAvailableQuantity(product);
  if (available !== null) return available > 0;
  return product.inStock !== false;
};

export const getValidMrp = (product: Product) => {
  const mrp = Number(product.originalPrice || 0);
  return mrp > Number(product.price || 0) ? mrp : null;
};

export const getValidSavings = (product: Product) => {
  const mrp = getValidMrp(product);
  return mrp ? Math.max(0, mrp - Number(product.price || 0)) : 0;
};

export const getValidDiscountPercent = (product: Product) => {
  const mrp = getValidMrp(product);
  if (!mrp) return 0;
  return Math.round(((mrp - Number(product.price || 0)) / mrp) * 100);
};

export const hasReviewRating = (product: Product) =>
  Number(product.reviewCount || 0) > 0 && Number(product.rating || 0) > 0;

export const compareProductsByQuality = (a: Product, b: Product) => {
  const stockDiff = Number(isProductPurchasable(b)) - Number(isProductPurchasable(a));
  if (stockDiff) return stockDiff;
  const reviewsDiff = Number(b.reviewCount || 0) - Number(a.reviewCount || 0);
  if (reviewsDiff) return reviewsDiff;
  return Number(b.rating || 0) - Number(a.rating || 0);
};
