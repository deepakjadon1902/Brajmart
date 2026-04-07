import { useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Product } from '@/types/product';
import ProductCard from './ProductCard';

interface ProductCarouselProps {
  products: Product[];
}

const ProductCarousel = ({ products }: ProductCarouselProps) => {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: 'start', slidesToScroll: 1, containScroll: 'trimSnaps' },
    [Autoplay({ delay: 4000, stopOnInteraction: true, stopOnMouseEnter: true })]
  );

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  return (
    <div className="relative group/carousel">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-4 md:gap-5">
          {products.map((product, i) => (
            <div key={product.id} className="flex-none w-[260px] sm:w-[240px] md:w-[260px] lg:w-[270px]">
              <ProductCard product={product} index={i} />
            </div>
          ))}
        </div>
      </div>

      {/* Arrows */}
      <button
        onClick={scrollPrev}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 w-10 h-10 rounded-full glass border border-gold/30 shadow-lg flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-gold/10 active:scale-95 z-10"
        aria-label="Previous"
      >
        <ChevronLeft size={18} className="text-maroon" />
      </button>
      <button
        onClick={scrollNext}
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 w-10 h-10 rounded-full glass border border-gold/30 shadow-lg flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-gold/10 active:scale-95 z-10"
        aria-label="Next"
      >
        <ChevronRight size={18} className="text-maroon" />
      </button>
    </div>
  );
};

export default ProductCarousel;
