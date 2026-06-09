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
}: CollectionSectionProps) => (
  <section className={`py-10 sm:py-12 md:py-20 ${bgClass}`}>
    <div className="container mx-auto px-4">
      <SectionHeader
        tag={tag}
        title={title}
        subtitle={subtitle}
        viewAllLink={undefined}
        titleIconUrl={titleIconUrl}
        viewAllIconUrl={viewAllIconUrl}
        ornamentIconUrl={ornamentIconUrl}
      />
      {viewAllLink && viewAllLink !== '#' && (
        <div className="flex justify-end -mt-6 mb-4">
          <Link
            to={viewAllLink}
            className="inline-flex items-center gap-2 text-saffron font-semibold text-sm hover:underline"
          >
            <span>View More</span>
          </Link>
        </div>
      )}
      <ProductCarousel products={products} priority={priority} />
    </div>
  </section>
);

export default CollectionSection;
