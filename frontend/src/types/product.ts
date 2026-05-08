export interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  originalPrice?: number;
  image: string;
  images?: string[];
  category: string;
  description?: string;
  rating: number;
  reviewCount: number;
  badge?: 'new' | 'bestseller' | 'combo' | 'exclusive';
  tags?: string[];
  inStock: boolean;
  soldCount?: number;
  sizes?: string[];
  sizePricing?: Array<{ size: string; price: number }>;
  piecePricing?: Array<{ pieces: number; price: number }>;
  selectedSize?: string;
  selectedPieces?: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  productCount: number;
  displayOrder?: number;
}
