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
          <div className="relative aspect-[480/133] w-full">
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

            <div className="absolute inset-y-0 left-0 flex w-[52%] items-center px-4 sm:px-8 md:px-14 lg:px-20">
              <div className="max-w-[13rem] sm:max-w-sm md:max-w-md rounded-md bg-brand-raised/82 px-3 py-2 shadow-lg backdrop-blur-sm sm:px-5 sm:py-4 md:px-6 md:py-5">
                {visibleSlide.tag && (
                  <span className="block text-[0.48rem] font-bold uppercase tracking-[0.16em] text-brand-gold sm:text-[0.62rem] md:text-xs">
                    {visibleSlide.tag}
                  </span>
                )}
                <h1 className="mt-0.5 font-cinzel text-[0.78rem] font-bold leading-tight text-brand-deep sm:mt-1 sm:text-xl md:text-3xl lg:text-4xl">
                  {visibleSlide.title}
                </h1>
                {visibleSlide.subtitle && (
                  <p className="mt-1 line-clamp-2 text-[0.58rem] font-medium leading-snug text-brand-muted sm:mt-2 sm:text-sm md:text-base">
                    {visibleSlide.subtitle}
                  </p>
                )}
                {visibleSlide.cta && (
                  <button className="mt-1.5 rounded bg-brand-accent px-2.5 py-1 text-[0.58rem] font-bold text-primary-foreground shadow-sm transition-colors hover:bg-brand-structure sm:mt-3 sm:px-4 sm:py-2 sm:text-xs md:text-sm">
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

          <div className="absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 bg-brand-raised/85 backdrop-blur px-2.5 py-1.5 rounded-full border border-border">
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
