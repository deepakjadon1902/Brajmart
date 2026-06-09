import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSettingsStore } from '@/store/settingsStore';
import { useHeroStore } from '@/store/heroStore';
import { toResponsiveImageUrl } from '@/utils/responsiveImage';

const HeroCarousel = () => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isDesktop, setIsDesktop] = useState(false);
  const slides = useHeroStore((s) => s.slides);
  const loadSlides = useHeroStore((s) => s.loadFromApi);
  const heroBadges = useSettingsStore((s) => s.settings.heroBadges);
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
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(min-width: 768px)');
    const update = () => setIsDesktop(media.matches);
    update();
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', update);
      return () => media.removeEventListener('change', update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  useEffect(() => {
    if (!isDesktop) return;
    loadSlides();
  }, [isDesktop, loadSlides]);

  const visibleSlide = useMemo(() => (isDesktop ? (slides[selectedIndex] || slides[0] || fallbackSlide) : fallbackSlide), [isDesktop, slides, selectedIndex, fallbackSlide]);

  useEffect(() => {
    if (!isDesktop) return;
    const preload = slides.slice(0, 2).map((slide) => slide.image).filter((url): url is string => Boolean(url));
    for (const url of preload) {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
    }
  }, [isDesktop, slides]);

  return (
    <section className="relative bg-background">
      <div className="container mx-auto px-4 py-6 md:py-10">
        <div className="relative">
          <div className="overflow-hidden rounded-[22px] md:rounded-[28px] border border-border shadow-lg bg-white">
            <div className="grid md:grid-cols-[1fr_2fr] min-h-[320px] md:min-h-[420px] lg:h-[460px] bg-white">
              <div className="bg-[#FBF4EC] px-5 sm:px-6 md:px-10 py-6 md:py-8 flex items-center justify-center md:justify-start">
                <div className="max-w-sm text-center md:text-left">
                  {visibleSlide && (
                    <div>
                      {visibleSlide.tag && (
                        <span className="inline-block text-[#8A6D4E] font-semibold text-[0.65rem] uppercase tracking-[0.2em] mb-3">
                          {visibleSlide.tag}
                        </span>
                      )}
                      <h1 className="font-cinzel text-2xl sm:text-3xl md:text-5xl lg:text-5xl font-bold text-[#3B4F66] leading-[1.12] mb-3">
                        {visibleSlide.title}
                      </h1>
                      {visibleSlide.subtitle && (
                        <p className="text-[#6B7A8E] text-sm md:text-base leading-relaxed font-playfair mb-5 max-w-md mx-auto md:mx-0">
                          {visibleSlide.subtitle}
                        </p>
                      )}
                      {visibleSlide.cta && (
                        <button className="px-6 py-2.5 rounded-xl bg-[#3B4F66] text-white font-bold text-sm active:scale-[0.97] transition-transform shadow">
                          {visibleSlide.cta}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {isDesktop && visibleSlide?.image ? (
                <div className="relative bg-white min-h-[220px] sm:min-h-[280px] md:min-h-0 overflow-hidden">
                  <img
                    src={toResponsiveImageUrl(visibleSlide.image, { width: 900, height: 506, quality: 72 })}
                    alt={visibleSlide.title}
                    loading="eager"
                    decoding="async"
                    fetchPriority="high"
                    sizes="(max-width: 767px) 100vw, 66vw"
                    className="absolute inset-0 w-full h-full object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-black/5" />
                </div>
              ) : (
                <div className="hidden md:block relative bg-white min-h-[220px] sm:min-h-[280px] md:min-h-0 overflow-hidden" aria-hidden="true" />
              )}
            </div>
          </div>

          {slides.length > 1 && (
            <>
              <button
                onClick={() => setSelectedIndex((current) => (current - 1 + slides.length) % slides.length)}
                className="hidden sm:flex absolute -left-3 md:-left-5 top-1/2 -translate-y-1/2 w-9 h-9 md:w-10 md:h-10 rounded-full bg-white border border-border items-center justify-center hover:bg-pearl active:scale-95 transition-all"
                aria-label="Previous slide"
              >
                <ChevronLeft size={18} className="text-[#3B4F66]" />
              </button>
              <button
                onClick={() => setSelectedIndex((current) => (current + 1) % slides.length)}
                className="hidden sm:flex absolute -right-3 md:-right-5 top-1/2 -translate-y-1/2 w-9 h-9 md:w-10 md:h-10 rounded-full bg-white border border-border items-center justify-center hover:bg-pearl active:scale-95 transition-all"
                aria-label="Next slide"
              >
                <ChevronRight size={18} className="text-[#3B4F66]" />
              </button>
            </>
          )}

          <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-white/80 backdrop-blur px-3 py-2 rounded-full border border-border">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setSelectedIndex(i)}
                className={`h-2 rounded-full transition-all duration-300 ${selectedIndex === i ? 'w-8 bg-gold' : 'w-2 bg-[#3B4F66]/30'}`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-gold/10 bg-card/80 backdrop-blur">
        <div className="container mx-auto px-4 py-3 flex items-center justify-center gap-3 sm:gap-6 md:gap-10 flex-wrap text-[0.7rem] sm:text-sm font-medium text-foreground">
          {(heroBadges || []).map((b, i) => (
            <span key={i}>{b}</span>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroCarousel;
