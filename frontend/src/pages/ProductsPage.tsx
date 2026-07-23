import { useSearchParams, Link, useLocation } from 'react-router-dom';
import { useProductStore } from '@/store/productStore';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ProductCard from '@/components/product/ProductCard';
import SEO from '@/components/seo/SEO';
import { breadcrumbSchema } from '@/lib/seo';

const tagLabels: Record<string, string> = {
  latest: 'Latest Products',
  new: 'New Arrivals',
  bestseller: 'Best Selling Products',
  accessories: 'Top Devotional Accessories',
  prasadam: 'Sacred Prasadam',
  exclusive: 'BrajMart Exclusive',
};

const ProductsPage = () => {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const tag = params.get('tag') || '';
  const category = params.get('category') || '';
  const minPrice = Number(params.get('min') || 0);
  const maxPrice = Number(params.get('max') || 0);
  const minRating = Number(params.get('rating') || 0);
  const { products, categories, getByTag, lastFetchedAt, loading, error } = useProductStore();

  let filtered = products;
  if (tag) filtered = filtered.filter((p) => p.tags?.includes(tag));
  if (category) filtered = filtered.filter((p) => p.category.toLowerCase() === category.toLowerCase());
  if (minPrice) filtered = filtered.filter((p) => Number(p.price) >= minPrice);
  if (maxPrice) filtered = filtered.filter((p) => Number(p.price) <= maxPrice);
  if (minRating) filtered = filtered.filter((p) => Number(p.rating || 0) >= minRating);

  const title = tag ? (tagLabels[tag] || `Products: ${tag}`) : category ? `Category: ${category}` : 'All Products';
  const pageTitle = tag
    ? `${title} | Brajmart`
    : category
    ? `${category} Online | Brajmart`
    : 'Shop Puja Items, Spiritual Books & Prasadam Online | Brajmart';
  const description = tag
    ? `Shop ${title.toLowerCase()} from Brajmart, including authentic puja items, devotional accessories, prasadam and spiritual essentials from Vrindavan.`
    : category
    ? `Shop authentic ${category.toLowerCase()} online from Brajmart. Curated spiritual products from Vrindavan with reliable delivery across India.`
    : 'Shop authentic puja items, spiritual books, prasadam, deity idols and devotional accessories from Vrindavan. Delivered across India by Brajmart.';
  const indexableParams = new URLSearchParams();
  if (tag) indexableParams.set('tag', tag);
  if (category) indexableParams.set('category', category);
  const path = `${location.pathname}${indexableParams.toString() ? `?${indexableParams.toString()}` : ''}`;
  const hasFacetFilters = Boolean(minPrice || maxPrice || minRating);
  const hasAttemptedCatalogLoad = lastFetchedAt > 0 || Boolean(error);
  const collectionIsMissing = !loading && hasAttemptedCatalogLoad && filtered.length === 0 && Boolean(tag || category);
  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: filtered.slice(0, 24).map((product, index) => ({
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
        title={pageTitle}
        description={description}
        path={path}
        robots={hasFacetFilters || collectionIsMissing ? 'noindex,follow' : 'index,follow'}
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Shop', path: '/products' },
          ]),
          collectionSchema,
        ]}
      />
      <AnnouncementBar />
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Link to="/" className="hover:text-saffron">Home</Link>
          <span>/</span>
          <span className="text-foreground">{title}</span>
        </div>
        <h1 className="font-cinzel text-2xl md:text-3xl font-bold text-maroon mb-6">{title}</h1>

        <div className="flex flex-wrap gap-3 mb-6">
          <select
            value={tag}
            onChange={(e) => {
              const next = e.target.value;
              const newParams = new URLSearchParams(params);
              if (next) newParams.set('tag', next); else newParams.delete('tag');
              setParams(newParams);
            }}
            className="px-4 py-2.5 bg-card border border-border rounded-xl text-sm"
          >
            <option value="">All Tags</option>
            <option value="latest">Latest</option>
            <option value="new">New</option>
            <option value="bestseller">Best Seller</option>
            <option value="accessories">Accessories</option>
            <option value="prasadam">Prasadam</option>
            <option value="exclusive">Exclusive</option>
          </select>

          <select
            value={category}
            onChange={(e) => {
              const next = e.target.value;
              const newParams = new URLSearchParams(params);
              if (next) newParams.set('category', next); else newParams.delete('category');
              setParams(newParams);
            }}
            className="px-4 py-2.5 bg-card border border-border rounded-xl text-sm"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>

          <input
            type="number"
            min={0}
            value={minPrice || ''}
            onChange={(e) => {
              const next = e.target.value;
              const newParams = new URLSearchParams(params);
              if (next) newParams.set('min', next); else newParams.delete('min');
              setParams(newParams);
            }}
            placeholder="Min Price"
            className="px-4 py-2.5 bg-card border border-border rounded-xl text-sm w-28"
          />

          <input
            type="number"
            min={0}
            value={maxPrice || ''}
            onChange={(e) => {
              const next = e.target.value;
              const newParams = new URLSearchParams(params);
              if (next) newParams.set('max', next); else newParams.delete('max');
              setParams(newParams);
            }}
            placeholder="Max Price"
            className="px-4 py-2.5 bg-card border border-border rounded-xl text-sm w-28"
          />

          <select
            value={minRating || ''}
            onChange={(e) => {
              const next = e.target.value;
              const newParams = new URLSearchParams(params);
              if (next) newParams.set('rating', next); else newParams.delete('rating');
              setParams(newParams);
            }}
            className="px-4 py-2.5 bg-card border border-border rounded-xl text-sm"
          >
            <option value="">All Ratings</option>
            <option value="4">4★ & up</option>
            <option value="3">3★ & up</option>
            <option value="2">2★ & up</option>
          </select>
        </div>

        {filtered.length > 0 ? (
          <div className="product-grid grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fill,218px)] sm:justify-center sm:gap-3 md:grid-cols-[repeat(auto-fill,236px)] md:gap-4 lg:grid-cols-[repeat(auto-fill,250px)]">
            {filtered.map((product, i) => (
              <ProductCard key={product.id} product={product} index={i} variant="compact" />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <h2 className="font-cinzel text-xl font-bold text-foreground mb-2">No Products Found</h2>
            <p className="text-muted-foreground text-sm mb-6">Try a different category or tag.</p>
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

export default ProductsPage;
