import ProductCarousel from '@/components/product/ProductCarousel';
import SectionHeader from '@/components/ui/SectionHeader';
import { Product } from '@/types/product';

type RecommendationCarouselProps = {
  tag?: string;
  title: string;
  subtitle?: string;
  products: Product[];
};

const RecommendationCarousel = ({ tag, title, subtitle, products }: RecommendationCarouselProps) => {
  if (!products.length) return null;
  return (
    <section className="mt-10">
      <SectionHeader tag={tag} title={title} subtitle={subtitle} />
      <ProductCarousel products={products} />
    </section>
  );
};

export default RecommendationCarousel;
