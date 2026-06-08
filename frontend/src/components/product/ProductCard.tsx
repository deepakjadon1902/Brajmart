import { useState } from 'react';
import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, ShoppingCart, Star, Eye } from 'lucide-react';
import { motion } from 'framer-motion';
import { Product } from '@/types/product';
import { formatPrice, calculateDiscount } from '@/utils/formatPrice';
import { toSquareImageUrl } from '@/utils/image';
import { useCartStore } from '@/store/cartStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { toast } from 'sonner';

interface ProductCardProps {
  product: Product;
  index?: number;
  variant?: 'default' | 'compact';
}

const badgeStyles: Record<string, string> = {
  new: 'bg-saffron text-primary-foreground',
  bestseller: 'bg-gold-gradient text-maroon-dark font-bold',
  combo: 'bg-maroon text-primary-foreground',
  exclusive: 'bg-gold-gradient text-maroon-dark',
};

const badgeLabels: Record<string, string> = {
  new: 'NEW',
  bestseller: 'Best Seller',
  combo: 'COMBO',
  exclusive: 'Exclusive',
};

const ProductCard = ({ product, index = 0, variant = 'default' }: ProductCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [hoverImageIndex, setHoverImageIndex] = useState(0);
  const cardImages = Array.isArray(product.images) && product.images.length
    ? product.images
    : (product.image ? [product.image] : []);
  const cardImagesKey = cardImages.join('|');
  const baseImage = cardImages[0] || product.image;
  const isAboveTheFold = index < 4;

  const discount = product.originalPrice ? calculateDiscount(product.price, product.originalPrice) : 0;
  const badge = product.tags?.includes('bestseller')
    ? 'bestseller'
    : product.tags?.includes('new')
    ? 'new'
    : product.tags?.includes('combo')
    ? 'combo'
    : product.tags?.includes('exclusive')
    ? 'exclusive'
    : product.badge;

  const addToCart = useCartStore(s => s.addItem);
  const { toggleItem, isInWishlist } = useWishlistStore();
  const inWishlist = isInWishlist(product.id);
  const navigate = useNavigate();

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!product.inStock) {
      toast.error('This product is out of stock');
      return;
    }
    addToCart(product);
    toast.success(`${product.name} added to cart!`);
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleItem(product);
    toast.success(inWishlist ? 'Removed from wishlist' : 'Added to wishlist');
  };

  const handleBuyNow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!product.inStock) {
      toast.error('This product is out of stock');
      return;
    }
    addToCart(product);
    navigate('/checkout');
  };

  const handleViewProduct = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/product/${product.slug}`);
  };

  const isCompact = variant === 'compact';
  const mediaAspectClass = 'aspect-square';
  const mediaFitClass = isCompact ? 'object-contain p-3' : 'object-cover';

  useEffect(() => {
    if (!isHovered) {
      setHoverImageIndex(0);
      return;
    }
    if (cardImages.length <= 1) return;
    const id = window.setInterval(() => {
      setHoverImageIndex((i) => (i + 1) % cardImages.length);
    }, 900);
    return () => window.clearInterval(id);
  }, [isHovered, cardImages.length, cardImagesKey]);

  const displayImage = isHovered && cardImages.length > 1 ? (cardImages[hoverImageIndex] || baseImage) : baseImage;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      className={`group relative flex flex-col h-full rounded-2xl border border-border bg-card overflow-hidden gold-glow-hover cursor-pointer ${isCompact ? 'min-h-[352px] sm:min-h-[390px]' : 'min-h-[430px]'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link to={`/product/${product.slug}`} className={`relative ${mediaAspectClass} overflow-hidden bg-pearl`}>
        <img
          src={toSquareImageUrl(displayImage)}
          alt={product.name}
          loading={isAboveTheFold ? 'eager' : 'lazy'}
          decoding="async"
          className={`w-full h-full ${mediaFitClass} transition-all duration-300 ease-out group-hover:scale-[1.02]`}
        />

        {!product.inStock && (
          <span className="absolute bottom-3 right-3 px-2.5 py-1 text-[0.65rem] font-extrabold rounded-full bg-destructive text-primary-foreground tracking-wide">
            OUT OF STOCK
          </span>
        )}

        {badge && (
          <span className={`absolute top-3 left-3 px-2.5 py-1 text-[0.65rem] font-semibold rounded-full tracking-wide ${badgeStyles[badge]}`}>
            {badgeLabels[badge] || badge}
          </span>
        )}

        <div className={`absolute top-3 right-3 flex flex-col gap-2 transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
          <button
            onClick={handleToggleWishlist}
            className={`w-8 h-8 rounded-full shadow flex items-center justify-center transition-colors ${inWishlist ? 'bg-saffron text-primary-foreground' : 'bg-card/90 hover:bg-saffron hover:text-primary-foreground'}`}
            aria-label="Wishlist"
          >
            <Heart size={15} className={inWishlist ? 'fill-current' : ''} />
          </button>
          <button
            type="button"
            onClick={handleViewProduct}
            className="w-8 h-8 rounded-full bg-card/90 shadow flex items-center justify-center hover:bg-saffron hover:text-primary-foreground transition-colors"
            aria-label="View product"
          >
            <Eye size={15} />
          </button>
        </div>

        {discount > 0 && (
          <span className="absolute bottom-3 left-3 px-2 py-0.5 text-[0.65rem] font-bold rounded bg-tulsi text-primary-foreground">
            {discount}% OFF
          </span>
        )}
      </Link>

      <div className={`flex flex-col ${isCompact ? 'gap-0.5 p-2.5' : 'gap-1 p-2.5'} sm:p-3 flex-1`}>
        <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground line-clamp-1 min-h-[1rem]">{product.category}</span>

        <div className="flex items-center gap-1 mt-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={12} className={i < Math.floor(product.rating) ? 'fill-gold text-gold' : 'text-border'} />
          ))}
          <span className="text-[0.65rem] text-muted-foreground ml-1">({product.reviewCount})</span>
        </div>

        <Link to={`/product/${product.slug}`} className="mt-auto">
          <h3 className={`font-playfair text-[0.82rem] sm:text-sm font-semibold text-foreground line-clamp-2 leading-snug hover:text-saffron transition-colors ${isCompact ? 'min-h-[2rem]' : 'min-h-[2.2rem]'}`}>
            {product.name}
          </h3>
        </Link>

        <div className="flex items-center gap-2 pt-1 min-h-[1.75rem]">
          <span className="text-saffron font-bold text-sm sm:text-base">{formatPrice(product.price)}</span>
          {product.originalPrice && <span className="text-muted-foreground line-through text-xs">{formatPrice(product.originalPrice)}</span>}
        </div>

        {!isCompact && (
          <div className="min-h-[14px]">
            {product.soldCount ? (
              <span className="text-[0.6rem] text-tulsi font-medium">{product.soldCount} sold this week</span>
            ) : null}
          </div>
        )}
      </div>

      <div className={`px-2.5 sm:px-3 ${isCompact ? 'pb-2.5' : 'pb-3'}`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            onClick={handleAddToCart}
            disabled={!product.inStock}
            className={`w-full ${isCompact ? 'py-1.5' : 'py-2'} rounded-xl text-xs sm:text-sm font-bold transition ${product.inStock ? 'bg-gold-gradient text-maroon-dark shimmer active:scale-[0.97] transition-transform' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
          >
            <ShoppingCart size={14} className="inline mr-1.5 -mt-0.5" /> Add to Cart
          </button>
          <button
            onClick={handleBuyNow}
            disabled={!product.inStock}
            className={`w-full ${isCompact ? 'py-1.5' : 'py-2'} rounded-xl text-xs sm:text-sm font-bold transition ${product.inStock ? 'border border-gold/40 text-gold hover:bg-gold/10' : 'border border-border text-muted-foreground cursor-not-allowed'}`}
          >
            Buy Now
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default ProductCard;
