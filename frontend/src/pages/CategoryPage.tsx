import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Filter } from 'lucide-react';
import { useProductStore, categorySlugMap, categoryToSlug } from '@/store/productStore';
import ProductCard from '@/components/product/ProductCard';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Navbar from '@/components/layout/Navbar';
import CategoryNavbar from '@/components/layout/CategoryNavbar';
import Footer from '@/components/layout/Footer';
import SEO from '@/components/seo/SEO';
import { breadcrumbSchema, categorySeo } from '@/lib/seo';

const CategoryPage = () => {
  const { slug, subSlug } = useParams();
  const { getProductsByCategory, getProductsBySubcategory, categories, loading, lastFetchedAt, error } = useProductStore();
  const catMeta = categories.find(c => categoryToSlug(c.name) === slug);
  const categoryName = catMeta?.name || (slug && categorySlugMap[slug]) || (slug ? slug.replace(/-/g, ' ') : '');

  const subMeta = subSlug
    ? (catMeta?.subcategories || []).find((s) => categoryToSlug(s.name) === subSlug)
    : undefined;
  const subcategoryName = subMeta?.name || (subSlug ? subSlug.replace(/-/g, ' ') : '');

  const products = subSlug
    ? getProductsBySubcategory(categoryName, subcategoryName)
    : getProductsByCategory(categoryName);
  const hasAttemptedCatalogLoad = lastFetchedAt > 0 || Boolean(error);
  const categoryIsMissing = !loading && hasAttemptedCatalogLoad && !catMeta && products.length === 0;
  const subcategoryIsMissing = Boolean(subSlug) && !subMeta && !loading && hasAttemptedCatalogLoad;
  const seo = categorySeo(categoryName || 'Devotional Products', subcategoryName);
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
              <span className="text-foreground">{categoryName || 'Category'}</span>
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
        {products.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
            {products.map((product, i) => (
              <ProductCard key={product.id} product={product} index={i} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <Filter size={48} className="mx-auto text-muted-foreground/30 mb-4" />
            <h2 className="font-cinzel text-xl font-bold text-foreground mb-2">No Products Found</h2>
            <p className="text-muted-foreground text-sm mb-6">This category is coming soon!</p>
            <Link to="/" className="inline-block px-6 py-3 rounded-full bg-gold-gradient text-maroon-dark font-bold text-sm shimmer">
              Back to Home
            </Link>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default CategoryPage;
