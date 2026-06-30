import { useState } from 'react';
import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, ShoppingCart, Star, Eye } from 'lucide-react';
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
  priority?: boolean;
}

const badgeStyles: Record<string, string> = {
  new: 'bg-brand-accent text-primary-foreground',
  bestseller: 'bg-brand-structure text-primary-foreground',
  combo: 'bg-brand-structure text-primary-foreground',
  exclusive: 'bg-brand-accent text-primary-foreground',
};

const badgeLabels: Record<string, string> = {
  new: 'NEW',
  bestseller: 'Best Seller',
  combo: 'COMBO',
  exclusive: 'Exclusive',
};

const ProductCard = ({ product, index = 0, variant = 'default', priority = false }: ProductCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [hoverImageIndex, setHoverImageIndex] = useState(0);
  const cardImages = Array.isArray(product.images) && product.images.length
    ? product.images
    : (product.image ? [product.image] : []);
  const cardImagesKey = cardImages.join('|');
  const baseImage = cardImages[0] || product.image;
  const isAboveTheFold = priority && index < 2;

  const discount = product.originalPrice ? calculateDiscount(product.price, product.originalPrice) : 0;
  const savings = product.originalPrice ? Math.max(0, product.originalPrice - product.price) : 0;
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
  const mediaFitClass = isCompact ? 'object-contain p-2.5' : 'object-cover';

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
    <div
      className={`product-card group relative flex flex-col h-full rounded-lg border border-border bg-card shadow-sm overflow-hidden gold-glow-hover cursor-pointer content-visibility-auto ${isCompact ? 'min-h-[278px] sm:min-h-[305px]' : 'min-h-[335px]'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link to={`/product/${product.slug}`} className={`image-wrap relative ${mediaAspectClass} overflow-hidden bg-brand-raised`}>
        <img
          src={toSquareImageUrl(displayImage)}
          alt={product.name}
          loading={isAboveTheFold ? 'eager' : 'lazy'}
          decoding="async"
          {...({ fetchpriority: isAboveTheFold ? 'high' : 'low' } as Record<string, string>)}
          className={`w-full h-full ${mediaFitClass} transition-all duration-300 ease-out group-hover:scale-[1.02]`}
        />

        {!product.inStock && (
          <span className="absolute bottom-2 right-2 px-2 py-0.5 text-[0.62rem] font-extrabold rounded-full bg-destructive text-primary-foreground tracking-wide">
            OUT OF STOCK
          </span>
        )}

        {badge && (
          <span className={`absolute top-2 left-2 px-2 py-0.5 text-[0.62rem] font-semibold rounded-full tracking-wide ${badgeStyles[badge]}`}>
            {badgeLabels[badge] || badge}
          </span>
        )}

        <div className={`absolute top-2 right-2 flex flex-col gap-1.5 transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
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
          <span className="discount-badge absolute bottom-3 left-3 rounded bg-brand-structure px-2 py-0.5 text-xs font-bold text-primary-foreground">
            -{discount}%
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

        <div className="mt-auto flex items-start justify-between gap-2">
          <Link to={`/product/${product.slug}`} className="min-w-0 flex-1">
            <h3 className="font-playfair text-[0.8rem] sm:text-[0.86rem] font-semibold text-foreground line-clamp-2 leading-snug hover:text-saffron transition-colors">
              {product.name}
            </h3>
          </Link>
          <div className="shrink-0 text-right leading-tight">
            <div className="price-current font-playfair text-base sm:text-lg font-bold text-brand-gold">{formatPrice(product.price)}</div>
            {product.originalPrice && <div className="price-original text-muted-foreground line-through text-[0.65rem]">{formatPrice(product.originalPrice)}</div>}
          </div>
        </div>

        {!isCompact && (
          <div className="min-h-[14px]">
            {savings > 0 ? (
              <span className="save-text text-[13px] text-tulsi font-medium">Save {formatPrice(savings)}</span>
            ) : product.soldCount ? (
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
            className={`add-to-cart-btn btn-action w-full ${isCompact ? 'px-2 py-2' : 'px-2.5 py-2'} text-[12px] sm:text-[13px] ${product.inStock ? '' : 'bg-muted text-muted-foreground hover:bg-muted'}`}
          >
            <ShoppingCart size={14} /> Add to Cart
          </button>
          <button
            onClick={handleBuyNow}
            disabled={!product.inStock}
            className={`buy-now-btn btn-action-secondary w-full ${isCompact ? 'px-2 py-2' : 'px-2.5 py-2'} text-[12px] sm:text-[13px] bg-white text-orange-500 hover:bg-white ${product.inStock ? '' : 'bg-muted text-muted-foreground hover:bg-muted'}`}
          >
            Buy Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
