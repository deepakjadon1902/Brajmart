import { Link } from 'react-router-dom';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Navbar from '@/components/layout/Navbar';
import CategoryNavbar from '@/components/layout/CategoryNavbar';
import Footer from '@/components/layout/Footer';
import SEO from '@/components/seo/SEO';
import { breadcrumbSchema, categorySeo } from '@/lib/seo';
import { useProductStore, categoryToSlug } from '@/store/productStore';

const CategoriesPage = () => {
  const categories = useProductStore((s) => s.categories);

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="All Categories | Brajmart"
        description="Browse all Brajmart categories including spiritual books, puja items, prasadam, idols, incense, accessories and Braj Yatra essentials."
        path="/categories"
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Categories', path: '/categories' },
          ]),
        ]}
      />
      <AnnouncementBar />
      <Navbar />
      <CategoryNavbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-7 max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-saffron">Brajmart collections</p>
          <h1 className="mt-2 font-cinzel text-2xl md:text-3xl font-bold text-maroon">All Categories</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Browse every Brajmart category with automatically generated page titles, descriptions, and SEO-ready meta descriptions for each collection.
          </p>
        </div>
        {categories.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">No categories yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => {
              const seo = categorySeo(cat.name);
              return (
                <Link
                  key={cat.id}
                  to={`/category/${categoryToSlug(cat.name)}`}
                  className="group flex min-h-[154px] gap-4 rounded-lg border border-border bg-card p-4 transition hover:border-saffron/50 hover:shadow-md"
                >
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-gold/30 bg-pearl text-3xl">
                    {cat.icon && (cat.icon.startsWith('data:') || cat.icon.startsWith('http') || cat.icon.startsWith('/uploads')) ? (
                      <img src={cat.icon} alt={cat.name} className="w-full h-full object-cover" />
                    ) : (
                      cat.icon
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-cinzel text-base font-bold text-maroon transition-colors group-hover:text-saffron">{seo.heading}</h2>
                    <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{seo.description}</p>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-saffron">
                      {cat.subcategories?.length ? `${cat.subcategories.length} subcategories` : 'View products'}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default CategoriesPage;
