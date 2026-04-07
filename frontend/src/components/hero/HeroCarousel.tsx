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
    <section className="relative">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {slides.map((slide, i) => (
            <div key={slide.id} className="flex-none w-full relative h-[60vh] md:h-[85vh]">
              <img
                src={slide.image}
                alt={slide.title}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className={`absolute inset-0 bg-gradient-to-r ${slide.overlay || 'from-black/70 via-black/40 to-transparent'}`} />
              <div className="relative h-full container mx-auto px-6 flex items-center">
                <div className="max-w-xl">
                  <AnimatePresence mode="wait">
                    {selectedIndex === i && (
                      <motion.div
                        key={slide.id}
                        initial={{ opacity: 0, y: 30, filter: 'blur(6px)' }}
                        animate={{ opacity: 1, y: 0, filter: 'blur(0)' }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                      >
                        {slide.tag && (
                          <span className="inline-block px-3 py-1 rounded-full bg-primary-foreground/15 backdrop-blur text-primary-foreground text-xs font-semibold mb-4">
                            {slide.tag}
                          </span>
                        )}
                        <h1 className="font-cinzel text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-primary-foreground leading-[1.1] mb-4">
                          {slide.title}
                        </h1>
                        {slide.subtitle && (
                          <p className="text-primary-foreground/80 text-base md:text-lg mb-6 max-w-md">
                            {slide.subtitle}
                          </p>
                        )}
                        {slide.cta && (
                          <button className="px-7 py-3 rounded-full bg-gold-gradient text-maroon-dark font-bold text-sm shimmer active:scale-[0.97] transition-transform shadow-lg">
                            {slide.cta}
                          </button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button onClick={scrollPrev} className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full glass border border-primary-foreground/20 flex items-center justify-center hover:bg-primary-foreground/10 active:scale-95 transition-all" aria-label="Previous slide">
        <ChevronLeft size={18} className="text-primary-foreground" />
      </button>
      <button onClick={scrollNext} className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full glass border border-primary-foreground/20 flex items-center justify-center hover:bg-primary-foreground/10 active:scale-95 transition-all" aria-label="Next slide">
        <ChevronRight size={18} className="text-primary-foreground" />
      </button>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => emblaApi?.scrollTo(i)}
            className={`h-2 rounded-full transition-all duration-300 ${selectedIndex === i ? 'w-8 bg-gold' : 'w-2 bg-primary-foreground/40'}`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-card/90 backdrop-blur border-t border-gold/10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-center gap-6 md:gap-10 flex-wrap text-sm font-medium text-foreground">
          {(heroBadges || []).map((b, i) => (
            <span key={i}>{b}</span>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroCarousel;
