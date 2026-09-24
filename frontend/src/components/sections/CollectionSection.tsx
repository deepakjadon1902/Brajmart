import SectionHeader from '../ui/SectionHeader';
import ProductCarousel from '../product/ProductCarousel';
import { Product } from '@/types/product';
import { Link } from 'react-router-dom';

interface CollectionSectionProps {
  tag?: string;
  title: string;
  subtitle?: string;
  products: Product[];
  priority?: boolean;
  viewAllLink?: string;
  titleIconUrl?: string;
  viewAllIconUrl?: string;
  ornamentIconUrl?: string;
  bgClass?: string;
  maxProducts?: number;
}

const CollectionSection = ({
  tag,
  title,
  subtitle,
  products,
  priority = false,
  viewAllLink,
  titleIconUrl,
  viewAllIconUrl,
  ornamentIconUrl,
  bgClass = '',
  maxProducts = 12,
}: CollectionSectionProps) => (
  <section className={`pt-3 pb-4 sm:pt-4 sm:pb-5 md:pt-4 md:pb-5 ${bgClass}`}>
    <div className="container mx-auto px-0 sm:px-4">
      <div className="px-3 sm:px-0">
        <SectionHeader
          tag={tag}
          title={title}
          subtitle={subtitle}
          viewAllLink={undefined}
          titleIconUrl={titleIconUrl}
          viewAllIconUrl={viewAllIconUrl}
          ornamentIconUrl={ornamentIconUrl}
        />
      </div>
      {viewAllLink && viewAllLink !== '#' && (
        <div className="flex justify-end -mt-3 mb-2 px-3 sm:px-0">
          <Link
            to={viewAllLink}
            className="inline-flex items-center gap-2 text-saffron font-semibold text-sm hover:underline"
          >
            <span>View More</span>
          </Link>
        </div>
      )}
      <ProductCarousel products={products.slice(0, maxProducts)} priority={priority} />
    </div>
  </section>
);

export default CollectionSection;
