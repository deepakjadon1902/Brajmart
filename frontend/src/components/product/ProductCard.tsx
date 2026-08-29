import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, ShoppingCart, Star, Eye } from 'lucide-react';
import { Product } from '@/types/product';
import { formatPrice } from '@/utils/formatPrice';
import { toSquareImageUrl } from '@/utils/image';
import { useCartStore } from '@/store/cartStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { productToMetaPixelParams, trackMetaPixelEvent } from '@/lib/metaPixel';
import { toast } from 'sonner';
import {
  getValidDiscountPercent,
  getValidMrp,
  getValidSavings,
  hasReviewRating,
  isProductPurchasable,
} from '@/utils/productPresentation';

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

  const discount = getValidDiscountPercent(product);
  const mrp = getValidMrp(product);
  const savings = getValidSavings(product);
  const purchasable = isProductPurchasable(product);
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
  const openCartDrawer = useCartStore(s => s.openDrawer);
  const { toggleItem, isInWishlist } = useWishlistStore();
  const inWishlist = isInWishlist(product.id);
  const navigate = useNavigate();

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!purchasable) {
      toast.error('This product is out of stock');
      return;
    }
    addToCart(product);
    openCartDrawer(product.id);
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
    if (!purchasable) {
      toast.error('This product is out of stock');
      return;
    }
    addToCart(product);
    trackMetaPixelEvent('AddToCart', productToMetaPixelParams(product));
    navigate('/checkout');
  };

  const isCompact = variant === 'compact';
  const mediaAspectClass = 'aspect-square';
  const mediaFitClass = isCompact ? 'object-contain p-2.5' : 'object-cover';
  const ratingValue = Number(product.rating || 0);
  const reviewCount = Number(product.reviewCount || 0);

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
      className={`product-card group relative flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-gold/50 hover:shadow-md content-visibility-auto ${isCompact ? 'min-h-[312px] sm:min-h-[335px]' : 'min-h-[375px]'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`image-wrap relative ${mediaAspectClass} overflow-hidden bg-brand-raised`}>
        <Link to={`/product/${product.slug}`} aria-label={`View ${product.name}`} className="block h-full w-full">
        <img
          src={toSquareImageUrl(displayImage)}
          alt={product.name}
          loading={isAboveTheFold ? 'eager' : 'lazy'}
          decoding="async"
          {...({ fetchpriority: isAboveTheFold ? 'high' : 'low' } as Record<string, string>)}
          className={`w-full h-full ${mediaFitClass} transition-all duration-300 ease-out group-hover:scale-[1.02]`}
        />
        </Link>

        {!purchasable && (
          <span className="absolute bottom-2 right-2 px-2 py-0.5 text-[0.62rem] font-extrabold rounded-full bg-destructive text-primary-foreground tracking-wide">
            OUT OF STOCK
          </span>
        )}

        {badge && (
          <span className={`absolute top-2 left-2 px-2 py-0.5 text-[0.62rem] font-semibold rounded-full tracking-wide ${badgeStyles[badge]}`}>
            {badgeLabels[badge] || badge}
          </span>
        )}

        <div className="absolute top-2 right-2 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={handleToggleWishlist}
            className={`flex h-11 w-11 items-center justify-center rounded-full shadow transition-colors sm:h-9 sm:w-9 ${inWishlist ? 'bg-saffron text-primary-foreground' : 'bg-card/95 text-foreground hover:bg-saffron hover:text-primary-foreground'}`}
            aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            <Heart size={15} className={inWishlist ? 'fill-current' : ''} />
          </button>
          <Link
            to={`/product/${product.slug}`}
            className="hidden h-9 w-9 items-center justify-center rounded-full bg-card/95 text-foreground shadow transition-colors hover:bg-saffron hover:text-primary-foreground sm:flex"
            aria-label={`Quick view ${product.name}`}
          >
            <Eye size={15} />
          </Link>
        </div>

        {discount > 0 && (
          <span className="discount-badge absolute bottom-3 right-3 rounded bg-brand-structure px-2 py-0.5 text-xs font-bold text-primary-foreground">
            -{discount}%
          </span>
        )}

        {hasReviewRating(product) && (
          <span className="absolute bottom-3 left-3 inline-flex h-[22px] items-center gap-0.5 rounded-sm bg-[#388e3c] px-1.5 text-[11px] font-semibold leading-none text-white shadow-sm">
            <span>{ratingValue.toFixed(1).replace(/\.0$/, '')}</span>
            <Star size={10} strokeWidth={2.4} className="fill-white text-white" aria-hidden="true" />
          </span>
        )}
      </div>

      <div className={`flex flex-col ${isCompact ? 'gap-1.5 p-2.5' : 'gap-2 p-2.5'} sm:p-3 flex-1`}>
        <Link to={`/product/${product.slug}`} className="min-w-0">
          <h3 className="min-h-[34px] font-sans text-[13px] font-semibold leading-[1.28] text-[#212121] line-clamp-2 transition-colors hover:text-maroon sm:text-[14px]">
              {product.name}
          </h3>
        </Link>

        <div className="min-h-[18px]">
          {hasReviewRating(product) ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              <Star size={12} className="fill-[#d69a00] text-[#d69a00]" aria-hidden="true" />
              {ratingValue.toFixed(1).replace(/\.0$/, '')} ({reviewCount})
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">No reviews yet</span>
          )}
        </div>

        <div className="mt-auto flex items-baseline gap-1.5 leading-tight">
          <div className="price-current font-sans text-[15px] font-bold text-[#212121] sm:text-[16px]">{formatPrice(product.price)}</div>
          {mrp && (
            <div className="price-original font-sans text-[11px] text-[#878787] line-through sm:text-[12px]">{formatPrice(mrp)}</div>
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
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={!purchasable}
            className={`add-to-cart-btn btn-action w-full !min-h-11 !px-1.5 !py-2 !text-[11px] sm:!px-2.5 sm:!text-[12px] ${purchasable ? '' : 'bg-muted text-muted-foreground hover:bg-muted'}`}
            aria-label={purchasable ? `Add ${product.name} to cart` : `${product.name} is out of stock`}
          >
            <ShoppingCart size={14} className="shrink-0" />
            <span className="truncate">{purchasable ? 'Add Cart' : 'Out Stock'}</span>
          </button>
          <button
            type="button"
            onClick={handleBuyNow}
            disabled={!purchasable}
            className={`buy-now-btn btn-action-secondary w-full !min-h-11 !px-1.5 !py-2 !text-[11px] sm:!px-2.5 sm:!text-[12px] ${purchasable ? '' : 'bg-muted text-muted-foreground hover:bg-muted'}`}
            aria-label={purchasable ? `Buy ${product.name} now` : `${product.name} is out of stock`}
          >
            <span className="truncate">Buy Now</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
