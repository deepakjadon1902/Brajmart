import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useProductStore } from '@/store/productStore';
import { Search as SearchIcon, ArrowLeft } from 'lucide-react';
import ProductCard from '@/components/product/ProductCard';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

const SearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const { searchProducts, products } = useProductStore();
  const results = query.length >= 2 ? searchProducts(query) : [];
  const trendingProducts = products.slice(0, 8);

  // Keep local state in sync if the URL query param changes (e.g. navbar search)
  useEffect(() => {
    const q = searchParams.get('q') || '';
    if (q !== query) setQuery(q);
  }, [searchParams]);

  // Keep URL in sync as the user types/searches on this page
  useEffect(() => {
    if (query) {
      setSearchParams({ q: query }, { replace: true });
    } else if (searchParams.get('q')) {
      setSearchParams({}, { replace: true });
    }
  }, [query]);

  return (
    <div className="min-h-screen bg-background">
      <AnnouncementBar /><Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/" className="text-muted-foreground hover:text-foreground"><ArrowLeft size={20} /></Link>
          <h1 className="font-cinzel text-2xl font-bold">Search</h1>
        </div>

        {/* Search input */}
        <div className="relative max-w-2xl mx-auto mb-8">
          <SearchIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search Prasadam, Books, Shringar, Malas..."
            autoFocus
            className="w-full pl-11 pr-4 py-3 rounded-2xl border border-gold/30 bg-card text-sm outline-none focus:border-gold transition-colors"
          />
        </div>

        {/* Trending chips */}
        {query.length < 2 && (
          <div className="flex flex-wrap gap-2 justify-center mb-8">
            {['Prasadam', 'Bhagavad Gita', 'Tulsi Mala', 'Ghee', 'Incense', 'Dhoti'].map(t => (
              <button key={t} onClick={() => setQuery(t)} className="px-4 py-1.5 rounded-full border border-border bg-card text-sm hover:border-gold hover:text-saffron transition-colors">
                {t}
              </button>
            ))}
          </div>
        )}

        {/* Results */}
        {query.length >= 2 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="text-sm text-muted-foreground mb-4">{results.length} results for "{query}"</p>
            {results.length > 0 ? (
              <div className="product-grid grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fill,218px)] sm:justify-center sm:gap-3 md:grid-cols-[repeat(auto-fill,236px)] md:gap-4 lg:grid-cols-[repeat(auto-fill,250px)]">
                {results.map((p, i) => <ProductCard key={p.id} product={p} index={i} variant="compact" />)}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No products found. Try a different search term.</p>
              </div>
            )}
          </motion.div>
        )}

        {/* Trending when no search */}
        {query.length < 2 && (
          <div>
            <h2 className="font-cinzel text-lg font-bold text-foreground mb-4 text-center">Trending Products</h2>
            <div className="product-grid grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fill,218px)] sm:justify-center sm:gap-3 md:grid-cols-[repeat(auto-fill,236px)] md:gap-4 lg:grid-cols-[repeat(auto-fill,250px)]">
              {trendingProducts.map((p, i) => <ProductCard key={p.id} product={p} index={i} variant="compact" />)}
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default SearchPage;
