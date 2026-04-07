import { useSearchParams, Link } from 'react-router-dom';
import { useProductStore } from '@/store/productStore';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ProductCard from '@/components/product/ProductCard';

const tagLabels: Record<string, string> = {
  latest: 'Latest Products',
  new: 'New Arrivals',
  bestseller: 'Best Selling Products',
  accessories: 'Top Devotional Accessories',
  prasadam: 'Sacred Prasadam',
};

const ProductsPage = () => {
  const [params, setParams] = useSearchParams();
  const tag = params.get('tag') || '';
  const category = params.get('category') || '';
  const minPrice = Number(params.get('min') || 0);
  const maxPrice = Number(params.get('max') || 0);
  const minRating = Number(params.get('rating') || 0);
  const { products, categories, getByTag } = useProductStore();

  let filtered = products;
  if (tag) filtered = getByTag(tag);
  if (category) filtered = products.filter((p) => p.category.toLowerCase() === category.toLowerCase());
  if (minPrice) filtered = filtered.filter((p) => Number(p.price) >= minPrice);
  if (maxPrice) filtered = filtered.filter((p) => Number(p.price) <= maxPrice);
  if (minRating) filtered = filtered.filter((p) => Number(p.rating || 0) >= minRating);

  const title = tag ? (tagLabels[tag] || `Products: ${tag}`) : category ? `Category: ${category}` : 'All Products';

  return (
    <div className="min-h-screen bg-background">
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
            {filtered.map((product, i) => (
              <ProductCard key={product.id} product={product} index={i} />
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
