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
  const orderValue = (value: unknown) => {
    const numeric = typeof value === 'number' ? value : Number(value ?? 0);
    return numeric > 0 ? numeric : Number.MAX_SAFE_INTEGER;
  };
  const categories = (Array.isArray(data.categories) ? data.categories : [])
    .map((category) => ({
      ...category,
      subcategories: (Array.isArray(category.subcategories) ? [...category.subcategories] : [])
        .sort((a, b) => orderValue(a.displayOrder) - orderValue(b.displayOrder) || a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => orderValue(a.displayOrder) - orderValue(b.displayOrder) || a.name.localeCompare(b.name));
  const productState = {
    products: Array.isArray(data.products) ? data.products : [],
    categories,
    lastFetchedAt: data.catalogComplete ? Date.now() : 0,
    loading: false,
    error: null,
  };
  const heroState = {
    slides: Array.isArray(data.heroSlides) ? data.heroSlides : [],
    lastFetchedAt: Date.now(),
    loading: false,
    error: null,
  };
  useProductStore.setState(productState);
  useHeroStore.setState(heroState);
  Object.assign(useProductStore.getInitialState(), productState);
  Object.assign(useHeroStore.getInitialState(), heroState);
  if (data.settings && typeof data.settings === 'object') {
    useSettingsStore.getState().updateSettings(data.settings as never);
    useSettingsStore.getInitialState().settings = useSettingsStore.getState().settings;
  }
};
