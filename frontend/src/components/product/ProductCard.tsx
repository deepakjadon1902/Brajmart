import { useState } from 'react';
import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, ShoppingCart, Star, Eye } from 'lucide-react';
import { Product } from '@/types/product';
import { formatPrice, calculateDiscount } from '@/utils/formatPrice';
import { toSquareImageUrl } from '@/utils/image';
import { useCartStore } from '@/store/cartStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { productToMetaPixelParams, trackMetaPixelEvent } from '@/lib/metaPixel';
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

const ProductCard = ({ product, index = 0, variant = 'compact', priority = false }: ProductCardProps) => {
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
    trackMetaPixelEvent('AddToCart', productToMetaPixelParams(product));
    toast.success(`${product.name} added to cart!`);
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleItem(product);
    if (!inWishlist) {
      trackMetaPixelEvent('AddToWishlist', productToMetaPixelParams(product));
    }
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
    trackMetaPixelEvent('AddToCart', productToMetaPixelParams(product));
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
  const ratingValue = Number(product.rating || 0);

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
          <span className="discount-badge absolute bottom-3 right-3 rounded bg-brand-structure px-2 py-0.5 text-xs font-bold text-primary-foreground">
            -{discount}%
          </span>
        )}

        {ratingValue > 0 && (
          <span className="absolute bottom-3 left-3 inline-flex h-[22px] items-center gap-0.5 rounded-sm bg-[#388e3c] px-1.5 text-[11px] font-semibold leading-none text-white shadow-sm">
            <span>{ratingValue.toFixed(1).replace(/\.0$/, '')}</span>
            <Star size={10} strokeWidth={2.4} className="fill-white text-white" aria-hidden="true" />
          </span>
        )}
      </Link>

      <div className={`flex flex-col ${isCompact ? 'gap-1.5 p-2.5' : 'gap-2 p-2.5'} sm:p-3 flex-1`}>
        <Link to={`/product/${product.slug}`} className="min-w-0">
          <h3 className="font-sans text-[13px] font-medium leading-[1.25] text-[#212121] line-clamp-2 transition-colors hover:text-[#2874f0] sm:text-[14px]">
              {product.name}
          </h3>
        </Link>

        <div className="mt-auto flex items-baseline gap-1.5 leading-tight">
          <div className="price-current font-sans text-[15px] font-bold text-[#212121] sm:text-[16px]">{formatPrice(product.price)}</div>
          {product.originalPrice && (
            <div className="price-original font-sans text-[11px] text-[#878787] line-through sm:text-[12px]">{formatPrice(product.originalPrice)}</div>
          )}
          {discount > 0 && (
            <div className="font-sans text-[11px] font-semibold text-[#388e3c] sm:text-[12px]">{discount}% off</div>
          )}
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
        <div className="grid grid-cols-2 gap-1 sm:gap-2">
          <button
            onClick={handleAddToCart}
            disabled={!product.inStock}
            className={`add-to-cart-btn btn-action w-full !min-h-[34px] !px-1 !py-2 !text-[9.5px] sm:!min-h-[38px] sm:!px-2.5 sm:!text-[12px] ${product.inStock ? '' : 'bg-muted text-muted-foreground hover:bg-muted'}`}
          >
            <ShoppingCart size={11} className="shrink-0 sm:h-[13px] sm:w-[13px]" /> <span>Add to Cart</span>
          </button>
          <button
            onClick={handleBuyNow}
            disabled={!product.inStock}
            className={`buy-now-btn btn-action-secondary w-full !min-h-[34px] !px-1 !py-2 !text-[9.5px] sm:!min-h-[38px] sm:!px-2.5 sm:!text-[12px] ${product.inStock ? '' : 'bg-muted text-muted-foreground hover:bg-muted'}`}
          >
            <span>Buy Now</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
