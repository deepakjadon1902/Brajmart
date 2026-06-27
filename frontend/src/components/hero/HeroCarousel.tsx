import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
            <>
              <button
                onClick={() => setSelectedIndex((current) => (current - 1 + slides.length) % slides.length)}
                className="hidden sm:flex absolute -left-3 md:-left-5 top-1/2 -translate-y-1/2 w-9 h-9 md:w-10 md:h-10 rounded-full bg-brand-raised border border-border items-center justify-center hover:bg-brand-soft active:scale-95 transition-all"
                aria-label="Previous slide"
              >
                <ChevronLeft size={18} className="text-brand-structure" />
              </button>
              <button
                onClick={() => setSelectedIndex((current) => (current + 1) % slides.length)}
                className="hidden sm:flex absolute -right-3 md:-right-5 top-1/2 -translate-y-1/2 w-9 h-9 md:w-10 md:h-10 rounded-full bg-brand-raised border border-border items-center justify-center hover:bg-brand-soft active:scale-95 transition-all"
                aria-label="Next slide"
              >
                <ChevronRight size={18} className="text-brand-structure" />
              </button>
            </>
          )}

          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 scale-75 items-center gap-1.5 rounded-full border border-border bg-brand-raised/90 px-2.5 py-1.5 backdrop-blur sm:bottom-3 sm:scale-100">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setSelectedIndex(i)}
                className={`h-2 rounded-full transition-all duration-300 ${selectedIndex === i ? 'w-8 bg-brand-gold' : 'w-2 bg-brand-structure/30'}`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

    </section>
  );
};

export default HeroCarousel;
