import { Product } from '@/types/product';

export const getAllProducts = (): Product[] => [];
export const getProductsByCategory = (_category: string): Product[] => [];
export const getProductBySlug = (_slug: string): Product | undefined => undefined;
export const getProductById = (_id: string): Product | undefined => undefined;
export const searchProducts = (_query: string): Product[] => [];
export const getLatestProducts = (): Product[] => [];
export const getBestSellers = (): Product[] => [];

export const categorySlugMap: Record<string, string> = {};
export const categoryToSlug = (name: string): string => {
  return name.toLowerCase().replace(/[&\s]+/g, '-').replace(/--+/g, '-');
};
