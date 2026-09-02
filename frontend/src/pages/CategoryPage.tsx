import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Truck } from 'lucide-react';
import { useProductStore, categorySlugMap, categoryToSlug } from '@/store/productStore';
import ProductCard from '@/components/product/ProductCard';
import ProductGridSkeleton from '@/components/product/ProductGridSkeleton';
import CommerceEmptyState from '@/components/ui/CommerceEmptyState';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Navbar from '@/components/layout/Navbar';
import CategoryNavbar from '@/components/layout/CategoryNavbar';
import Footer from '@/components/layout/Footer';
import SEO from '@/components/seo/SEO';
import { breadcrumbSchema, categorySeo } from '@/lib/seo';
import { compareProductsByQuality } from '@/utils/productPresentation';

const displayCategoryName = (name: string) =>
  (name || '').trim().toLowerCase() === 'best selling' ? 'Most Selling Products' : name;

const CategoryPage = () => {
  const { slug, subSlug } = useParams();
  const { getProductsByCategory, getProductsBySubcategory, categories, loading, lastFetchedAt, error, loadFromApi } = useProductStore();
  const catMeta = categories.find(c => categoryToSlug(c.name) === slug);
  const categoryName = catMeta?.name || (slug && categorySlugMap[slug]) || (slug ? slug.replace(/-/g, ' ') : '');

  const subMeta = subSlug
    ? (catMeta?.subcategories || []).find((s) => categoryToSlug(s.name) === subSlug)
    : undefined;
  const subcategoryName = subMeta?.name || (subSlug ? subSlug.replace(/-/g, ' ') : '');

  const products = (subSlug
    ? getProductsBySubcategory(categoryName, subcategoryName)
    : getProductsByCategory(categoryName)).sort(compareProductsByQuality);
  useEffect(() => {
    if (products.length > 0 || loading || lastFetchedAt > 0) return;
    loadFromApi({ force: true }).catch(() => undefined);
  }, [lastFetchedAt, loadFromApi, loading, products.length, slug, subSlug]);
  const hasAttemptedCatalogLoad = lastFetchedAt > 0 || Boolean(error);
  const categoryIsMissing = !loading && hasAttemptedCatalogLoad && !catMeta && products.length === 0;
  const subcategoryIsMissing = Boolean(subSlug) && !subMeta && !loading && hasAttemptedCatalogLoad;
  const visibleCategoryName = displayCategoryName(categoryName || 'Devotional Products');
  const seo = categorySeo(visibleCategoryName, subcategoryName, products.length);
  const pageName = seo.pageTitle;
  const path = subSlug ? `/category/${slug}/${subSlug}` : `/category/${slug || ''}`;
  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: pageName,
    description: seo.metaDescription,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: products.slice(0, 24).map((product, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: `https://www.brajmart.com/product/${product.slug}`,
        name: product.name,
      })),
    },
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={seo.metaTitle}
        description={seo.metaDescription}
        path={path}
        robots={categoryIsMissing || subcategoryIsMissing ? 'noindex,follow' : 'index,follow'}
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Categories', path: '/categories' },
            { name: pageName, path },
          ]),
          collectionSchema,
        ]}
      />
      <AnnouncementBar />
      <Navbar />
      <CategoryNavbar />

      {/* Header */}
      <div className="bg-pearl border-b border-border">
        <div className="container mx-auto px-4 py-8">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Link to="/" className="hover:text-saffron">Home</Link>
              <span>/</span>
              <span className="text-foreground">{displayCategoryName(categoryName || 'Category')}</span>
              {subSlug && (
                <>
                  <span>/</span>
                  <span className="text-foreground">{subcategoryName || 'Subcategory'}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              {catMeta && (catMeta.icon?.startsWith('data:') || catMeta.icon?.startsWith('http') || catMeta.icon?.startsWith('/uploads')) ? (
                <img src={catMeta.icon} alt={catMeta.name} className="w-12 h-12 rounded-full object-cover border border-border" />
              ) : (
                catMeta && <span className="text-4xl">{catMeta.icon}</span>
              )}
              <div>
                <h1 className="font-cinzel text-2xl md:text-3xl font-bold text-maroon">
                  {seo.heading}
                </h1>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                  {seo.description}
                </p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-saffron">
                  {products.length} products available
                </p>
                {catMeta?.codEnabled && (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-tulsi/20 bg-tulsi/10 px-3 py-1 text-xs font-semibold text-tulsi">
                    <Truck size={13} aria-hidden="true" />
                    COD available on this category
                  </p>
                )}
              </div>
            </div>
            {!subSlug && catMeta?.subcategories?.length ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {catMeta.subcategories.map((sub) => (
                  <Link
                    key={sub.id}
                    to={`/category/${categoryToSlug(catMeta.name)}/${categoryToSlug(sub.name)}`}
                    className="rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:border-saffron/50 hover:text-saffron"
                  >
                    {sub.name}
                  </Link>
                ))}
              </div>
            ) : null}
          </motion.div>
        </div>
      </div>

      {/* Products grid */}
      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <ProductGridSkeleton count={10} />
        ) : products.length > 0 ? (
          <div className="product-grid grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fill,218px)] sm:justify-center sm:gap-3 md:grid-cols-[repeat(auto-fill,236px)] md:gap-4 lg:grid-cols-[repeat(auto-fill,250px)] xl:grid-cols-5">
            {products.map((product, i) => (
              <ProductCard key={product.id} product={product} index={i} variant="compact" />
            ))}
          </div>
        ) : (
          <CommerceEmptyState
            title="This collection is still being arranged"
            message="Browse nearby devotional products while this category is updated."
            suggestions={['Puja Items', 'Prasadam', 'Bhagavad Gita', 'Accessories']}
          />
        )}
      </div>
      <Footer />
    </div>
  );
};

export default CategoryPage;
