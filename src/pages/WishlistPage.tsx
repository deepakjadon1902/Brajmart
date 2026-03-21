import { Link } from 'react-router-dom';
import { Heart, ShoppingCart, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useWishlistStore } from '@/store/wishlistStore';
import { useCartStore } from '@/store/cartStore';
import { formatPrice } from '@/utils/formatPrice';
import { toast } from 'sonner';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

const WishlistPage = () => {
  const { items, removeItem } = useWishlistStore();
  const addToCart = useCartStore(s => s.addItem);

  const handleAddToCart = (product: typeof items[0]) => {
    addToCart(product);
    toast.success(`${product.name} added to cart!`);
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <AnnouncementBar />
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center">
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
    <div className="min-h-screen bg-background">
      <AnnouncementBar />
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <h1 className="font-cinzel text-2xl font-bold text-foreground mb-6">My Wishlist ({items.length})</h1>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((product, i) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card rounded-2xl border border-border overflow-hidden group gold-glow-hover"
            >
              <div className="relative aspect-square overflow-hidden">
                <Link to={`/product/${product.slug}`}>
                  <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-[1.06] transition-transform duration-500" />
                </Link>
                <button onClick={() => removeItem(product.id)} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-card/90 shadow flex items-center justify-center text-destructive hover:bg-destructive hover:text-primary-foreground transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="p-4">
                <Link to={`/product/${product.slug}`}>
                  <h3 className="font-playfair text-sm font-semibold text-foreground line-clamp-2">{product.name}</h3>
                </Link>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-saffron font-bold">{formatPrice(product.price)}</span>
                  {product.originalPrice && <span className="text-muted-foreground line-through text-xs">{formatPrice(product.originalPrice)}</span>}
                </div>
                <button
                  onClick={() => handleAddToCart(product)}
                  className="w-full mt-3 py-2 rounded-xl bg-gold-gradient text-maroon-dark text-sm font-bold shimmer active:scale-[0.97] transition-transform"
                >
                  <ShoppingCart size={14} className="inline mr-1 -mt-0.5" /> Add to Cart
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default WishlistPage;
