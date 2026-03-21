import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { searchProducts, getAllProducts } from '@/data/productCatalog';
import { Search as SearchIcon, ArrowLeft } from 'lucide-react';
import ProductCard from '@/components/product/ProductCard';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

const SearchPage = () => {
  const [query, setQuery] = useState('');
  const results = query.length >= 2 ? searchProducts(query) : [];
  const trendingProducts = getAllProducts().slice(0, 8);

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
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {results.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {trendingProducts.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default SearchPage;
