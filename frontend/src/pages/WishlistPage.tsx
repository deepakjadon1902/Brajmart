import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import { useWishlistStore } from '@/store/wishlistStore';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ProductCard from '@/components/product/ProductCard';

const WishlistPage = () => {
  const { items } = useWishlistStore();

  if (items.length === 0) {
    return (
      <div className="min-h-screen overflow-x-hidden bg-background pb-20 md:pb-0">
        <AnnouncementBar />
        <Navbar />
        <div className="mx-auto w-full max-w-6xl px-3 py-16 text-center sm:px-4 sm:py-20">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Heart size={64} className="mx-auto text-muted-foreground/30 mb-4" />
            <h1 className="font-cinzel text-2xl font-bold text-foreground mb-2">Your Wishlist is Empty</h1>
            <p className="text-muted-foreground text-sm mb-6">Save items you love for later</p>
            <Link to="/" className="inline-block px-6 py-3 rounded-full bg-gold-gradient text-maroon-dark font-bold text-sm shimmer">
              Explore Products →
            </Link>
          </motion.div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-background pb-20 md:pb-0">
      <AnnouncementBar />
      <Navbar />
      <main className="mx-auto w-full max-w-6xl px-3 py-5 sm:px-4 sm:py-8">
        <h1 className="mb-5 font-cinzel text-[1.65rem] font-bold leading-tight text-foreground sm:mb-6 sm:text-2xl">My Wishlist ({items.length})</h1>
        <div className="product-grid grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2.5 sm:grid-cols-[repeat(auto-fill,218px)] sm:justify-center sm:gap-3 md:grid-cols-[repeat(auto-fill,236px)] md:gap-4 lg:grid-cols-[repeat(auto-fill,250px)]">
          {items.map((product, i) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="h-full"
            >
              <ProductCard product={product} index={i} variant="compact" />
            </motion.div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default WishlistPage;
