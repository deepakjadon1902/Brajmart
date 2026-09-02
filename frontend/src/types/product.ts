export interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  originalPrice?: number;
  image: string;
  images?: string[];
  colorVariants?: Array<{ color: string; images: string[] }>;
  categoryId?: number;
  category: string;
  subcategoryId?: number;
  subcategory?: string | null;
  description?: string;
  metaTitle?: string;
  metaDescription?: string;
  rating: number;
  reviewCount: number;
  badge?: 'new' | 'bestseller' | 'combo' | 'exclusive';
  tags?: string[];
  inStock: boolean;
  codEnabled?: boolean | null;
  categoryCodEnabled?: boolean;
  stockQuantity?: number | null;
  reservedQuantity?: number;
  lowStockThreshold?: number;
  sku?: string;
  soldCount?: number;
  sizes?: string[];
  sizePricing?: Array<{ size: string; price: number }>;
  piecePricing?: Array<{ pieces: number; price: number }>;
  attributes?: Array<{ name: string; slug: string; terms: string[] }>;
  variantPricing?: Array<{ selections: Record<string, string>; price: number }>;
  selectedSize?: string;
  selectedPieces?: number;
  selectedAttributes?: Record<string, string>;
  createdAt?: string;
  updatedAt?: string;
}

export interface Subcategory {
  id: string;
  categoryId: string;
  name: string;
  displayOrder?: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  productCount: number;
  codEnabled?: boolean;
  displayOrder?: number;
  subcategories?: Subcategory[];
}

export interface Collection {
  id: string;
  slug: string;
  name: string;
  description: string;
  purposeKey?: string;
  sortOrder?: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
