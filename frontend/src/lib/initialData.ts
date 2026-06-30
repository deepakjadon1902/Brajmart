import type { BlogPost } from '@/types/blog';
import type { Category, Product } from '@/types/product';
import type { HeroSlide } from '@/store/heroStore';
import { useHeroStore } from '@/store/heroStore';
import { useProductStore } from '@/store/productStore';
import { useSettingsStore } from '@/store/settingsStore';

export type BrajmartInitialData = {
  products: Product[];
  categories: Category[];
  blogs: BlogPost[];
  heroSlides: HeroSlide[];
  settings?: Record<string, unknown>;
  catalogComplete?: boolean;
  generatedAt: string;
};

let currentInitialData: BrajmartInitialData | null = null;

declare global {
  interface Window {
    __BRAJMART_INITIAL_DATA__?: BrajmartInitialData;
  }
}

export const setInitialData = (data: BrajmartInitialData | null) => {
  currentInitialData = data;
};

export const getInitialData = () => currentInitialData;

export const readInitialData = () =>
  typeof window === 'undefined' ? currentInitialData : window.__BRAJMART_INITIAL_DATA__ || null;

export const applyInitialData = (data: BrajmartInitialData | null) => {
  if (!data) return;
  currentInitialData = data;
  useProductStore.setState({
    products: Array.isArray(data.products) ? data.products : [],
    categories: Array.isArray(data.categories) ? data.categories : [],
    lastFetchedAt: data.catalogComplete ? Date.now() : 0,
    loading: false,
    error: null,
  });
  useHeroStore.setState({
    slides: Array.isArray(data.heroSlides) ? data.heroSlides : [],
    lastFetchedAt: Date.now(),
    loading: false,
    error: null,
  });
  if (data.settings && typeof data.settings === 'object') {
    useSettingsStore.getState().updateSettings(data.settings as never);
  }
};
