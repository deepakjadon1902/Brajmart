import type { Product } from '../types/product';
export const HOME_PRODUCT_LIMIT: 6;
export function homePositionOf(product: Product): number | null;
export function pickHomeProducts(items: Product[], compare: (a: Product, b: Product) => number, usePositions?: boolean): Product[];
