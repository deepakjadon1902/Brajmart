import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useHeroStore } from '@/store/heroStore';
import { toResponsiveImageSrcSet, toResponsiveImageUrl } from '@/utils/responsiveImage';

const mobileHeroWidths = [360, 480, 640, 720, 840];
const desktopHeroWidths = [768, 960, 1280, 1600];
const mobileHeroSizes = '84vw';
const desktopHeroSizes = '100vw';

const HeroCarousel = () => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [canAutoPlay, setCanAutoPlay] = useState(false);
  const [failedSlideIds, setFailedSlideIds] = useState<Set<string>>(() => new Set());
  const slides = useHeroStore((s) => s.slides);
  const loadSlides = useHeroStore((s) => s.loadFromApi);
  const fallbackSlide = useMemo(
    () => ({
      id: 'fallback-hero',
      tag: 'AUTHENTIC BRAJ DEVOTIONAL GOODS',
      title: 'Bring the Blessings of Vrindavan Home',
      subtitle: 'Authentic devotional products, spiritual books, prasadam and sacred essentials, carefully selected from Braj.',
      cta: 'Explore Divine Collection',
    }),
    []
  );

  useEffect(() => {
    let refreshInterval: number | undefined;
    let focusListenerAttached = false;
    const runAfterStartup = (callback: () => void, delay: number) => {
      const timeout = window.setTimeout(() => {
        if ('requestIdleCallback' in window) {
          window.requestIdleCallback(callback, { timeout: 3000 });
        } else {
          callback();
        }
      }, delay);
      return () => window.clearTimeout(timeout);
    };

    const cleanupInitialLoad = slides.length === 0
      ? runAfterStartup(() => { void loadSlides({ force: true }); }, 2500)
      : undefined;
    const refreshSlides = () => {
      if (document.visibilityState === 'visible') loadSlides({ force: true });
    };
    const cleanupRefresh = runAfterStartup(() => {
      refreshInterval = window.setInterval(refreshSlides, 60_000);
      window.addEventListener('focus', refreshSlides);
      focusListenerAttached = true;
    }, 12_000);
    return () => {
      cleanupInitialLoad?.();
      cleanupRefresh();
      if (refreshInterval) window.clearInterval(refreshInterval);
      if (focusListenerAttached) window.removeEventListener('focus', refreshSlides);
    };
  }, [loadSlides, slides.length]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setCanAutoPlay(true), 4000);
    return () => window.clearTimeout(timeout);
  }, []);

  const displaySlides = useMemo(
    () => slides.filter((slide) => !failedSlideIds.has(slide.id)),
    [failedSlideIds, slides]
  );
  const visibleSlide = useMemo(
    () => displaySlides[selectedIndex] || displaySlides[0] || fallbackSlide,
    [displaySlides, fallbackSlide, selectedIndex]
  );
  const canNavigateSlides = displaySlides.length > 1;
  const goToPreviousSlide = () => {
    if (!canNavigateSlides) return;
    setSelectedIndex((current) => (current - 1 + displaySlides.length) % displaySlides.length);
  };
  const goToNextSlide = () => {
    if (!canNavigateSlides) return;
    setSelectedIndex((current) => (current + 1) % displaySlides.length);
  };

  useEffect(() => {
    if (!canNavigateSlides || !canAutoPlay) return;
    const interval = window.setInterval(() => {
      setSelectedIndex((current) => (current + 1) % displaySlides.length);
    }, 8000);
    return () => window.clearInterval(interval);
  }, [canAutoPlay, canNavigateSlides, displaySlides.length]);

  useEffect(() => {
    if (selectedIndex >= displaySlides.length) setSelectedIndex(0);
  }, [displaySlides.length, selectedIndex]);

  return (
    <section className="relative bg-background">
      <div className="relative w-full">
        <div className="relative overflow-hidden bg-brand-raised">
          <div className="relative aspect-[480/168] w-full sm:aspect-[480/133] sm:min-h-[260px] md:min-h-0">
            {visibleSlide?.image ? (
              <picture>
                <source
                  media="(max-width: 639px)"
                  srcSet={toResponsiveImageSrcSet(visibleSlide.image, {
                    widths: mobileHeroWidths,
                    quality: 70,
                    fit: 'contain',
                  })}
                  sizes={mobileHeroSizes}
                />
                <img
                  src={toResponsiveImageUrl(visibleSlide.image, { width: 960, height: 336, quality: 74, fit: 'cover' })}
                  srcSet={toResponsiveImageSrcSet(visibleSlide.image, {
                    widths: desktopHeroWidths,
                    width: 1600,
                    height: 560,
                    quality: 74,
                    fit: 'cover',
                  })}
                  alt={visibleSlide.title}
                  loading="eager"
                  decoding="async"
                  {...({ fetchpriority: 'high' } as Record<string, string>)}
                  width={1600}
                  height={560}
                  sizes={desktopHeroSizes}
                  className="absolute inset-0 h-full w-full object-contain object-center sm:object-cover"
                  onError={() => {
                    if (visibleSlide.id === fallbackSlide.id) return;
                    setFailedSlideIds((current) => {
                      const next = new Set(current);
                      next.add(visibleSlide.id);
                      return next;
                    });
                  }}
                />
              </picture>
            ) : (
              <div className="absolute inset-0 bg-brand-soft" aria-hidden="true" />
            )}

            <div className="absolute inset-0 bg-gradient-to-r from-black/62 via-black/22 to-transparent md:from-black/48" aria-hidden="true" />

            <div className="absolute inset-x-0 bottom-0 flex items-end justify-start px-4 pb-6 pt-8 sm:px-7 sm:pb-9 md:px-14 md:pb-10 lg:px-20">
              <div className="max-w-[18rem] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)] sm:max-w-sm md:max-w-[34rem]">
                {visibleSlide.tag && (
                  <span className="block text-[0.58rem] font-bold uppercase tracking-[0.16em] text-gold-light sm:text-[0.68rem] md:text-xs">
                    {visibleSlide.tag}
                  </span>
                )}
                <h1 className="mt-2 font-playfair text-2xl font-bold leading-[1.04] text-white sm:text-4xl md:text-5xl">
                  {visibleSlide.title}
                </h1>
                {visibleSlide.subtitle && (
                  <p className="mt-3 line-clamp-3 max-w-xl text-sm font-medium leading-6 text-white/88 sm:text-base md:text-lg">
                    {visibleSlide.subtitle}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2 sm:gap-3">
                  <Link
                    to="/products"
                    className="rounded-lg bg-saffron px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-maroon sm:px-5 sm:py-3 sm:text-sm premium-focus"
                  >
                    {visibleSlide.cta || 'Explore Divine Collection'}
                  </Link>
                  <Link
                    to="/products?tag=bestseller"
                    className="rounded-lg border border-white/40 bg-white/10 px-4 py-2.5 text-xs font-bold text-white backdrop-blur transition hover:bg-white/18 sm:px-5 sm:py-3 sm:text-sm premium-focus"
                  >
                    Shop Best Sellers
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {canNavigateSlides && (
            <>
              <button
                type="button"
                onClick={goToPreviousSlide}
                className="absolute left-4 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/86 text-brand-primary shadow-md backdrop-blur-sm transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent sm:flex"
                aria-label="Previous hero slide"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={goToNextSlide}
                className="absolute right-4 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/86 text-brand-primary shadow-md backdrop-blur-sm transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent sm:flex"
                aria-label="Next hero slide"
              >
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
              <div className="absolute bottom-5 left-1/2 hidden max-w-[calc(100%-2rem)] -translate-x-1/2 items-center justify-center gap-2 sm:flex md:bottom-6 md:gap-2.5">
              {displaySlides.map((slide, i) => (
                <button
                  key={slide.id}
                  onClick={() => setSelectedIndex(i)}
                  className="group flex h-6 w-6 shrink-0 items-center justify-center rounded-full p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  aria-label={`Go to slide ${i + 1}`}
                  aria-current={selectedIndex === i ? 'true' : undefined}
                >
                  <span className={`h-[9px] w-[9px] rounded-full border-2 border-black shadow-[0_1px_4px_rgba(255,255,255,0.65)] transition-transform duration-200 ease-out group-hover:scale-110 sm:h-[11px] sm:w-[11px] md:h-3 md:w-3 ${
                    selectedIndex === i ? 'bg-black' : 'bg-white'
                  }`} aria-hidden="true" />
                </button>
              ))}
              </div>
            </>
          )}
        </div>
      </div>

    </section>
  );
};

export default HeroCarousel;
