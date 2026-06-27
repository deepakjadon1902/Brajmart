import { useEffect, useMemo, useState } from 'react';
import { useHeroStore } from '@/store/heroStore';
import { toResponsiveImageUrl } from '@/utils/responsiveImage';

const HeroCarousel = () => {
  const [selectedIndex, setSelectedIndex] = useState(0);
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
    loadSlides();
  }, [loadSlides]);

  const visibleSlide = useMemo(() => slides[selectedIndex] || slides[0] || fallbackSlide, [slides, selectedIndex, fallbackSlide]);

  useEffect(() => {
    const preload = slides.slice(0, 2).map((slide) => slide.image).filter((url): url is string => Boolean(url));
    for (const url of preload) {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
    }
  }, [slides]);

  return (
    <section className="relative bg-background">
      <div className="relative w-full">
        <div className="relative overflow-hidden bg-brand-raised">
          <div className="relative aspect-[480/133] min-h-[210px] w-full sm:min-h-[260px] md:min-h-0">
            {visibleSlide?.image ? (
              <img
                src={toResponsiveImageUrl(visibleSlide.image, { width: 1920, height: 532, quality: 76 })}
                alt={visibleSlide.title}
                loading="eager"
                decoding="async"
                fetchPriority="high"
                sizes="100vw"
                className="absolute inset-0 h-full w-full object-cover object-center"
              />
            ) : (
              <div className="absolute inset-0 bg-brand-soft" aria-hidden="true" />
            )}

            <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/10 to-transparent md:from-black/42" aria-hidden="true" />

            <div className="absolute inset-x-0 bottom-0 flex items-end justify-start px-3 pb-16 pt-16 sm:px-7 sm:pb-9 md:px-14 md:pb-10 lg:px-20">
              <div className="max-w-[13.25rem] rounded-md bg-white/76 px-2.5 py-2 shadow-lg backdrop-blur-sm sm:max-w-xs sm:px-3.5 sm:py-2.5 md:max-w-[21rem] md:px-4 md:py-3">
                {visibleSlide.tag && (
                  <span className="block text-[0.48rem] font-bold uppercase tracking-[0.14em] text-brand-gold sm:text-[0.58rem] md:text-[0.66rem]">
                    {visibleSlide.tag}
                  </span>
                )}
                <h1 className="mt-0.5 font-cinzel text-base font-bold leading-tight text-black sm:text-xl md:text-2xl">
                  {visibleSlide.title}
                </h1>
                {visibleSlide.subtitle && (
                  <p className="mt-0.5 line-clamp-1 text-[0.65rem] font-medium leading-snug text-white sm:mt-1 sm:text-xs md:line-clamp-2 md:text-sm">
                    {visibleSlide.subtitle}
                  </p>
                )}
                {visibleSlide.cta && (
                  <button className="mt-1.5 max-w-full rounded bg-brand-accent px-2.5 py-1.5 text-[0.64rem] font-bold leading-snug text-primary-foreground shadow-sm transition-colors hover:bg-brand-structure sm:mt-2 sm:px-3 sm:text-xs md:px-4 md:py-2 md:text-sm">
                    {visibleSlide.cta}
                  </button>
                )}
              </div>
            </div>
          </div>

          {slides.length > 1 && (
            <div className="absolute bottom-4 left-1/2 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center justify-center gap-1.5 sm:bottom-5 sm:gap-2 md:bottom-6 md:gap-2.5">
              {slides.map((_, i) => (
                <button
                  key={i}
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
          )}
        </div>
      </div>

    </section>
  );
};

export default HeroCarousel;
