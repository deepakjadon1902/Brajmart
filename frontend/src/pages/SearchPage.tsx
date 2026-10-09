import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useProductStore } from '@/store/productStore';
import { Search as SearchIcon, ArrowLeft } from 'lucide-react';
import ProductCard from '@/components/product/ProductCard';
import ProductGridSkeleton from '@/components/product/ProductGridSkeleton';
import CommerceEmptyState from '@/components/ui/CommerceEmptyState';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { compareProductsByQuality } from '@/utils/productPresentation';
import { trackMetaPixelEvent } from '@/lib/metaPixel';

const SearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const { searchProducts, products, loading, lastFetchedAt, loadFromApi } = useProductStore();
  const trackedSearchRef = useRef('');
  const results = query.length >= 2 ? [...searchProducts(query)].sort(compareProductsByQuality) : [];
  const featuredProducts = [...products].sort(compareProductsByQuality).slice(0, 8);

  useEffect(() => {
    if (products.length > 0 || loading || lastFetchedAt > 0) return;
    loadFromApi({ force: true }).catch(() => undefined);
  }, [lastFetchedAt, loadFromApi, loading, products.length]);

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

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2 || trackedSearchRef.current === term.toLowerCase()) return;
    const timer = window.setTimeout(() => {
      trackedSearchRef.current = term.toLowerCase();
      try {
        const recent = JSON.parse(sessionStorage.getItem('brajmart-last-search-track') || '{}');
        if (recent?.term === term.toLowerCase() && Date.now() - Number(recent?.at || 0) < 3000) return;
        sessionStorage.setItem('brajmart-last-search-track', JSON.stringify({ term: term.toLowerCase(), at: Date.now() }));
      } catch {
        // Search analytics should not affect browsing.
      }
      trackMetaPixelEvent('Search', { search_string: term, content_type: 'product' });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-background pb-20 md:pb-0">
      <AnnouncementBar /><Navbar />
      <main className="mx-auto w-full max-w-6xl px-3 py-5 sm:px-4 sm:py-8">
        <div className="mb-5 flex items-center gap-3 sm:mb-6">
          <Link to="/" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Back to home"><ArrowLeft size={20} /></Link>
          <h1 className="font-cinzel text-[1.65rem] font-bold leading-tight sm:text-2xl">Search</h1>
        </div>

        {/* Search input */}
        <div className="relative mx-auto mb-6 max-w-2xl sm:mb-8">
          <SearchIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search Prasadam, Books, Shringar, Malas..."
            autoFocus
            className="min-h-12 w-full rounded-xl border border-gold/30 bg-card py-3 pl-11 pr-4 text-sm outline-none transition-colors focus:border-gold sm:rounded-2xl"
          />
        </div>

        {/* Quick search chips */}
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
            {loading ? (
              <ProductGridSkeleton count={8} />
            ) : results.length > 0 ? (
              <div className="product-grid grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2.5 sm:grid-cols-[repeat(auto-fill,218px)] sm:justify-center sm:gap-3 md:grid-cols-[repeat(auto-fill,236px)] md:gap-4 lg:grid-cols-[repeat(auto-fill,250px)]">
                {results.map((p, i) => <ProductCard key={p.id} product={p} index={i} variant="compact" />)}
              </div>
            ) : (
              <CommerceEmptyState
                title="We couldn't find that yet"
                message="Try a related devotional word, category, or one of the common searches below."
                suggestions={['Puja Items', 'Prasadam', 'Bhagavad Gita', 'Tulsi Mala']}
              />
            )}
          </motion.div>
        )}

        {/* Featured products when no search */}
        {query.length < 2 && (
          <div>
            <h2 className="font-cinzel text-lg font-bold text-foreground mb-4 text-center">Featured Products</h2>
            {loading ? (
              <ProductGridSkeleton count={8} />
            ) : (
              <div className="product-grid grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2.5 sm:grid-cols-[repeat(auto-fill,218px)] sm:justify-center sm:gap-3 md:grid-cols-[repeat(auto-fill,236px)] md:gap-4 lg:grid-cols-[repeat(auto-fill,250px)]">
                {featuredProducts.map((p, i) => <ProductCard key={p.id} product={p} index={i} variant="compact" />)}
              </div>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default SearchPage;
