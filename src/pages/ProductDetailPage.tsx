import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { Star, Heart, ShoppingCart, Truck, Shield, RotateCcw, ChevronRight, Minus, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { useProductStore } from '@/store/productStore';
import { useCartStore } from '@/store/cartStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { formatPrice, calculateDiscount } from '@/utils/formatPrice';
import { toast } from 'sonner';
import ProductCarousel from '@/components/product/ProductCarousel';
import SectionHeader from '@/components/ui/SectionHeader';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

const ProductDetailPage = () => {
  const { slug } = useParams();
  const { getProductBySlug, products } = useProductStore();
  const product = getProductBySlug(slug || '');
  const [quantity, setQuantity] = useState(1);
  const addToCart = useCartStore(s => s.addItem);
  const { toggleItem, isInWishlist } = useWishlistStore();

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <AnnouncementBar /><Navbar />
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="font-cinzel text-2xl font-bold mb-4">Product Not Found</h1>
          <Link to="/" className="text-saffron hover:underline">Back to Home</Link>
        </div>
        <Footer />
      </div>
    );
  }

  const discount = product.originalPrice ? calculateDiscount(product.price, product.originalPrice) : 0;
  const inWishlist = isInWishlist(product.id);
  const relatedProducts = products.filter(p => p.category === product.category && p.id !== product.id).slice(0, 6);

  const handleAddToCart = () => {
    for (let i = 0; i < quantity; i++) addToCart(product);
    toast.success(`${product.name} added to cart!`);
  };

  return (
    <div className="min-h-screen bg-background">
      <AnnouncementBar /><Navbar />

      <div className="container mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6 flex-wrap">
          <Link to="/" className="hover:text-saffron">Home</Link>
          <ChevronRight size={14} />
          <Link to={`/category/${product.category.toLowerCase().replace(/[&\s]+/g, '-')}`} className="hover:text-saffron">{product.category}</Link>
          <ChevronRight size={14} />
          <span className="text-foreground line-clamp-1">{product.name}</span>
        </div>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          {/* Image */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
            <div className="relative rounded-2xl overflow-hidden border border-border bg-pearl aspect-square">
              <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
              {product.badge && (
                <span className={`absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-bold ${product.badge === 'bestseller' ? 'bg-gold-gradient text-maroon-dark' : 'bg-saffron text-primary-foreground'}`}>
                  {product.badge === 'bestseller' ? '🔥 Best Seller' : 'NEW'}
                </span>
              )}
              {discount > 0 && (
                <span className="absolute top-4 right-4 px-3 py-1 rounded-full bg-tulsi text-primary-foreground text-xs font-bold">
                  {discount}% OFF
                </span>
              )}
            </div>
          </motion.div>

          {/* Details */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }} className="space-y-5">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{product.category}</span>
              <h1 className="font-playfair text-2xl md:text-3xl font-bold text-foreground mt-1 leading-tight">{product.name}</h1>
            </div>

            {/* Rating */}
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={16} className={i < Math.floor(product.rating) ? 'fill-gold text-gold' : 'text-border'} />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">{product.rating} ({product.reviewCount} reviews)</span>
            </div>

            {/* Price */}
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold text-saffron">{formatPrice(product.price)}</span>
              {product.originalPrice && (
                <>
                  <span className="text-lg text-muted-foreground line-through">{formatPrice(product.originalPrice)}</span>
                  <span className="px-2 py-0.5 bg-tulsi/10 text-tulsi text-sm font-semibold rounded">Save {formatPrice(product.originalPrice - product.price)}</span>
                </>
              )}
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              Authentic {product.category.toLowerCase()} directly sourced from the sacred land of Vrindavan.
              Each product is blessed with devotion and delivered with care to your doorstep.
            </p>

            {/* Quantity */}
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">Quantity:</span>
              <div className="flex items-center border border-border rounded-xl">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-2 hover:bg-muted transition-colors rounded-l-xl"><Minus size={16} /></button>
                <span className="px-4 font-semibold">{quantity}</span>
                <button onClick={() => setQuantity(quantity + 1)} className="p-2 hover:bg-muted transition-colors rounded-r-xl"><Plus size={16} /></button>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button onClick={handleAddToCart} className="flex-1 py-3 rounded-xl bg-gold-gradient text-maroon-dark font-bold text-sm shimmer active:scale-[0.97] transition-transform">
                <ShoppingCart size={16} className="inline mr-2 -mt-0.5" />Add to Cart
              </button>
              <button
                onClick={() => { toggleItem(product); toast.success(inWishlist ? 'Removed from wishlist' : 'Added to wishlist ❤️'); }}
                className={`px-4 py-3 rounded-xl border-2 transition-colors active:scale-[0.97] ${inWishlist ? 'border-saffron bg-saffron/10 text-saffron' : 'border-border text-foreground hover:border-saffron hover:text-saffron'}`}
              >
                <Heart size={18} className={inWishlist ? 'fill-current' : ''} />
              </button>
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border">
              {[
                { icon: Truck, label: 'Free Delivery', sub: 'On orders above ₹499' },
                { icon: Shield, label: 'Authentic', sub: 'Temple verified' },
                { icon: RotateCcw, label: 'Easy Returns', sub: '7 day policy' },
              ].map(b => (
                <div key={b.label} className="text-center">
                  <b.icon size={20} className="mx-auto text-gold mb-1" />
                  <span className="block text-xs font-semibold text-foreground">{b.label}</span>
                  <span className="block text-[0.6rem] text-muted-foreground">{b.sub}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Related */}
        {relatedProducts.length > 0 && (
          <div className="mt-16">
            <SectionHeader title="You May Also Like" subtitle={`More from ${product.category}`} />
            <ProductCarousel products={relatedProducts} />
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default ProductDetailPage;
