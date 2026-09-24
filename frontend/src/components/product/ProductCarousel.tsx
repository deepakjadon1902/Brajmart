import { useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Product } from '@/types/product';
import ProductCard from './ProductCard';

interface ProductCarouselProps {
  products: Product[];
  priority?: boolean;
}

const ProductCarousel = ({ products, priority = false }: ProductCarouselProps) => {
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const scrollByPage = useCallback((direction: -1 | 1) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollBy({
      left: direction * Math.max(scroller.clientWidth * 0.86, 260),
      behavior: 'smooth',
    });
  }, []);

  const scrollPrev = useCallback(() => scrollByPage(-1), [scrollByPage]);
  const scrollNext = useCallback(() => scrollByPage(1), [scrollByPage]);

  return (
    <div className="relative group/carousel">
      <div
        ref={scrollerRef}
        className="overflow-x-auto overscroll-x-contain scroll-smooth scrollbar-hide"
      >
        <div className="flex snap-x snap-mandatory gap-2.5 sm:gap-3 md:gap-4">
          {products.map((product, i) => (
            <div key={product.id} className="flex-none snap-start w-[calc((100vw-0.625rem)/2)] min-w-0 sm:w-[218px] md:w-[236px] lg:w-[250px]">
              <ProductCard product={product} index={i} variant="compact" priority={priority} />
            </div>
          ))}
        </div>
      </div>

      {/* Arrows */}
      <button
        onClick={scrollPrev}
        className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 w-10 h-10 rounded-full glass border border-gold/30 shadow-lg items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-gold/10 active:scale-95 z-10"
        aria-label="Previous"
      >
        <ChevronLeft size={18} className="text-maroon" />
      </button>
      <button
        onClick={scrollNext}
        className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 w-10 h-10 rounded-full glass border border-gold/30 shadow-lg items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-gold/10 active:scale-95 z-10"
        aria-label="Next"
      >
        <ChevronRight size={18} className="text-maroon" />
      </button>
    </div>
  );
};

export default ProductCarousel;
