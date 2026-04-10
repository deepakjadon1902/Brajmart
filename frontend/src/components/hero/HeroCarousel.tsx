import { useState, useCallback, useEffect } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchHeroSlides } from '@/lib/api';
import { useSettingsStore } from '@/store/settingsStore';

const HeroCarousel = () => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [slides, setSlides] = useState<any[]>([]);
  const heroBadges = useSettingsStore((s) => s.settings.heroBadges);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [
    Autoplay({ delay: 5000, stopOnInteraction: false, stopOnMouseEnter: true }),
  ]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchHeroSlides();
        setSlides(Array.isArray(data) ? data : []);
      } catch {
        setSlides([]);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    emblaApi.on('select', onSelect);
    return () => { emblaApi.off('select', onSelect); };
  }, [emblaApi]);

  if (!slides || slides.length === 0) return null;

  return (
    <section className="relative bg-background">
      <div className="container mx-auto px-4 py-6 md:py-10">
        <div className="relative">
          <div className="overflow-hidden rounded-[22px] md:rounded-[28px] border border-border shadow-lg bg-white" ref={emblaRef}>
            <div className="flex">
              {slides.map((slide, i) => (
                <div key={slide.id} className="flex-none w-full">
                  <div className="grid md:grid-cols-[1fr_2fr] md:h-[420px] lg:h-[460px] bg-white">
                    {/* Text panel */}
                    <div className="bg-[#FBF4EC] px-5 sm:px-6 md:px-10 py-6 md:py-8 flex items-center">
                      <div className="max-w-sm">
                        <AnimatePresence mode="wait">
                          {selectedIndex === i && (
                            <motion.div
                              key={slide.id}
                              initial={{ opacity: 0, y: 20, filter: 'blur(6px)' }}
                              animate={{ opacity: 1, y: 0, filter: 'blur(0)' }}
                              exit={{ opacity: 0, y: -10 }}
                              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                            >
                              {slide.tag && (
                                <span className="inline-block text-[#8A6D4E] font-semibold text-[0.65rem] uppercase tracking-[0.2em] mb-3">
                                  {slide.tag}
                                </span>
                              )}
                              <h1 className="font-cinzel text-2xl sm:text-3xl md:text-5xl lg:text-5xl font-bold text-[#3B4F66] leading-[1.12] mb-3">
                                {slide.title}
                              </h1>
                              {slide.subtitle && (
                                <p className="text-[#6B7A8E] text-sm md:text-base leading-relaxed font-playfair mb-5">
                                  {slide.subtitle}
                                </p>
                              )}
                              {slide.cta && (
                                <button className="px-6 py-2.5 rounded-xl bg-[#3B4F66] text-white font-bold text-sm active:scale-[0.97] transition-transform shadow">
                                  {slide.cta}
                                </button>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Image panel */}
                    <div className="relative bg-white min-h-[190px] sm:min-h-[240px] md:min-h-0">
                      {slide.image ? (
                        <img
                          src={slide.image}
                          alt={slide.title}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-white" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-black/5" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button onClick={scrollPrev} className="hidden sm:flex absolute -left-3 md:-left-5 top-1/2 -translate-y-1/2 w-9 h-9 md:w-10 md:h-10 rounded-full bg-white border border-border items-center justify-center hover:bg-pearl active:scale-95 transition-all" aria-label="Previous slide">
            <ChevronLeft size={18} className="text-[#3B4F66]" />
          </button>
          <button onClick={scrollNext} className="hidden sm:flex absolute -right-3 md:-right-5 top-1/2 -translate-y-1/2 w-9 h-9 md:w-10 md:h-10 rounded-full bg-white border border-border items-center justify-center hover:bg-pearl active:scale-95 transition-all" aria-label="Next slide">
            <ChevronRight size={18} className="text-[#3B4F66]" />
          </button>

          <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-white/80 backdrop-blur px-3 py-2 rounded-full border border-border">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => emblaApi?.scrollTo(i)}
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
