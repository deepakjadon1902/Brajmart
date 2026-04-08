import SectionHeader from '../ui/SectionHeader';
import ProductCarousel from '../product/ProductCarousel';
import { Product } from '@/types/product';

interface CollectionSectionProps {
  tag?: string;
  title: string;
  subtitle?: string;
  products: Product[];
  viewAllLink?: string;
  titleIconUrl?: string;
  viewAllIconUrl?: string;
  ornamentIconUrl?: string;
  bgClass?: string;
}

const CollectionSection = ({
  tag,
  title,
  subtitle,
  products,
  viewAllLink = '#',
  titleIconUrl,
  viewAllIconUrl,
  ornamentIconUrl,
  bgClass = '',
}: CollectionSectionProps) => (
  <section className={`py-14 md:py-20 ${bgClass}`}>
    <div className="container mx-auto px-4">
      <SectionHeader
        tag={tag}
        title={title}
        subtitle={subtitle}
        viewAllLink={viewAllLink}
        titleIconUrl={titleIconUrl}
        viewAllIconUrl={viewAllIconUrl}
        ornamentIconUrl={ornamentIconUrl}
      />
      <ProductCarousel products={products} />
    </div>
  </section>
);

export default CollectionSection;
