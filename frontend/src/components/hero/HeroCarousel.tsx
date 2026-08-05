import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useHeroStore } from '@/store/heroStore';
import { toResponsiveImageUrl } from '@/utils/responsiveImage';

const HeroCarousel = () => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [failedSlideIds, setFailedSlideIds] = useState<Set<string>>(() => new Set());
  const slides = useHeroStore((s) => s.slides);
  const loadSlides = useHeroStore((s) => s.loadFromApi);
  const fallbackSlide = useMemo(
    () => ({
      id: 'fallback-hero',
      tag: 'BRAJMART COLLECTION',
      title: 'Spiritual Books, Puja Items & Sacred Goods from Vrindavan',
      subtitle: 'A faster, cleaner home experience for devotees discovering authentic BrajMart offerings.',
      cta: 'Shop Now',
    }),
    []
  );

  useEffect(() => {
    loadSlides({ force: true });
    const refreshSlides = () => {
      if (document.visibilityState === 'visible') loadSlides({ force: true });
    };
    const interval = window.setInterval(refreshSlides, 60_000);
    window.addEventListener('focus', refreshSlides);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshSlides);
    };
  }, [loadSlides]);

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
    if (selectedIndex >= displaySlides.length) setSelectedIndex(0);
  }, [displaySlides.length, selectedIndex]);

  useEffect(() => {
    const preload = displaySlides.slice(0, 2).map((slide) => slide.image).filter((url): url is string => Boolean(url));
    for (const url of preload) {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
    }
  }, [displaySlides]);

  return (
    <section className="relative bg-background">
      <div className="relative w-full">
        <div className="relative overflow-hidden bg-brand-raised">
          <div className="relative aspect-[480/133] min-h-[205px] w-full sm:min-h-[260px] md:min-h-0">
            {visibleSlide?.image ? (
              <img
                src={toResponsiveImageUrl(visibleSlide.image, { width: 1920, height: 532, quality: 76 })}
                alt={visibleSlide.title}
                loading="eager"
                decoding="async"
                {...({ fetchpriority: 'high' } as Record<string, string>)}
                sizes="100vw"
                className="absolute inset-0 h-full w-full object-cover object-center sm:object-center"
                onError={() => {
                  if (visibleSlide.id === fallbackSlide.id) return;
                  setFailedSlideIds((current) => {
                    const next = new Set(current);
                    next.add(visibleSlide.id);
                    return next;
                  });
                }}
              />
            ) : (
              <div className="absolute inset-0 bg-brand-soft" aria-hidden="true" />
            )}

            <div className="absolute inset-0 bg-gradient-to-r from-black/38 via-black/5 to-transparent sm:from-black/50 sm:via-black/10 md:from-black/42" aria-hidden="true" />

            <div className="absolute inset-x-0 bottom-0 flex items-end justify-start px-3 pb-12 pt-12 sm:px-7 sm:pb-9 md:px-14 md:pb-10 lg:px-20">
              <div className="max-w-[10.75rem] px-0 py-0 text-white drop-shadow-[0_2px_5px_rgba(0,0,0,0.55)] sm:max-w-xs sm:rounded-md sm:bg-white/76 sm:px-3.5 sm:py-2.5 sm:text-black sm:shadow-lg sm:backdrop-blur-sm md:max-w-[21rem] md:px-4 md:py-3">
                {visibleSlide.tag && (
                  <span className="block text-[0.48rem] font-bold uppercase tracking-[0.14em] text-brand-gold sm:text-[0.58rem] md:text-[0.66rem]">
                    {visibleSlide.tag}
                  </span>
                )}
                <h1 className="mt-0.5 font-cinzel text-sm font-bold leading-tight sm:text-xl md:text-2xl">
                  {visibleSlide.title}
                </h1>
                {visibleSlide.subtitle && (
                  <p className="mt-0.5 line-clamp-1 text-[0.58rem] font-semibold leading-snug text-white sm:mt-1 sm:text-xs sm:text-brand-primary md:line-clamp-2 md:text-sm">
                    {visibleSlide.subtitle}
                  </p>
                )}
                {visibleSlide.cta && (
                  <button className="mt-1.5 max-w-full rounded bg-brand-accent px-2 py-1 text-[0.56rem] font-bold leading-snug text-primary-foreground shadow-sm transition-colors hover:bg-brand-structure sm:mt-2 sm:px-3 sm:py-1.5 sm:text-xs md:px-4 md:py-2 md:text-sm">
                    {visibleSlide.cta}
                  </button>
                )}
              </div>
            </div>
          </div>

          {canNavigateSlides && (
            <>
              <button
                type="button"
                onClick={goToPreviousSlide}
                className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/86 text-brand-primary shadow-md backdrop-blur-sm transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent sm:left-4 sm:h-10 sm:w-10"
                aria-label="Previous hero slide"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={goToNextSlide}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/86 text-brand-primary shadow-md backdrop-blur-sm transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent sm:right-4 sm:h-10 sm:w-10"
                aria-label="Next hero slide"
              >
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
              <div className="absolute bottom-3 left-1/2 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center justify-center gap-1.5 sm:bottom-5 sm:gap-2 md:bottom-6 md:gap-2.5">
              {displaySlides.map((slide, i) => (
                <button
                  key={slide.id}
                  onClick={() => setSelectedIndex(i)}
                  className={`!h-[9px] !min-h-[9px] !w-[9px] !min-w-[9px] shrink-0 rounded-full border-2 border-black p-0 leading-none shadow-[0_1px_4px_rgba(255,255,255,0.65)] [box-sizing:border-box] transition-transform duration-200 ease-out hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:!h-[11px] sm:!min-h-[11px] sm:!w-[11px] sm:!min-w-[11px] md:!h-[12px] md:!min-h-[12px] md:!w-[12px] md:!min-w-[12px] ${
                    selectedIndex === i
                      ? 'bg-black'
                      : 'bg-white'
                  }`}
                  aria-label={`Go to slide ${i + 1}`}
                  aria-current={selectedIndex === i ? 'true' : undefined}
                />
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
