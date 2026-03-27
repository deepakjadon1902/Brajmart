import { Link } from 'react-router-dom';
import { ScrollReveal } from '../ui/ScrollReveal';
import { useProductStore, categoryToSlug } from '@/store/productStore';

const CategoryNavbar = () => {
  const categories = useProductStore((s) => s.categories);
  return (
  <ScrollReveal>
    <section className="py-6 bg-card border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex gap-4 md:gap-6 overflow-x-auto scrollbar-hide pb-2 justify-start md:justify-center">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to={`/category/${categoryToSlug(cat.name)}`}
              className="flex flex-col items-center gap-2 min-w-[72px] group"
            >
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-full border-2 border-gold/30 bg-pearl flex items-center justify-center text-2xl transition-all duration-300 group-hover:border-gold group-hover:shadow-[0_0_16px_rgba(212,175,55,0.25)] group-hover:scale-110">
                {cat.icon}
              </div>
              <span className="text-[0.7rem] font-semibold text-foreground group-hover:text-saffron transition-colors text-center whitespace-nowrap">
                {cat.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  </ScrollReveal>
  );
};

export default CategoryNavbar;
