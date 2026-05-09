import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { fetchHeroSlides } from '@/lib/api';

export type HeroSlide = {
  id: string;
  tag?: string;
  title?: string;
  subtitle?: string;
  cta?: string;
  image?: string;
  overlay?: string;
  sortOrder?: number;
  isActive?: boolean;
};

const STALE_AFTER_MS = 30_000; // keep hero fast but reasonably fresh

type HeroStore = {
  slides: HeroSlide[];
  lastFetchedAt: number;
  loading: boolean;
  error: string | null;
  setSlides: (slides: HeroSlide[]) => void;
  loadFromApi: (opts?: { force?: boolean }) => Promise<void>;
};

export const useHeroStore = create<HeroStore>()(
  persist(
    (set, get) => ({
      slides: [],
      lastFetchedAt: 0,
      loading: false,
      error: null,
      setSlides: (slides) => set({ slides }),
      loadFromApi: async (opts) => {
        const force = Boolean(opts?.force);
        const state = get();
        const hasData = state.slides.length > 0;
        const isFresh = state.lastFetchedAt > 0 && (Date.now() - state.lastFetchedAt) < STALE_AFTER_MS;
        if (!force && hasData && isFresh) return;

        if (!get().loading) set({ loading: true, error: null });
        try {
          const data: any = await fetchHeroSlides();
          const slides = Array.isArray(data) ? data : [];
          set({ slides, lastFetchedAt: Date.now(), loading: false, error: null });
        } catch (err: any) {
          set({ loading: false, error: String(err?.message || 'Failed to load hero slides') });
        }
      },
    }),
    { name: 'brajmart-hero' }
  )
);

