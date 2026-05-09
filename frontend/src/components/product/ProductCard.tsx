import * as React from "react";
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, ShoppingCart, Star, Eye } from 'lucide-react';
import { motion } from 'framer-motion';
import { Product } from '@/types/product';
import { formatPrice, calculateDiscount } from '@/utils/formatPrice';
import { useCartStore } from '@/store/cartStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { toast } from 'sonner';

interface ProductCardProps {
  product: Product;
  index?: number;
}

const badgeStyles: Record<string, string> = {
  new: 'bg-saffron text-primary-foreground',
  bestseller: 'bg-gold-gradient text-maroon-dark font-bold',
  combo: 'bg-maroon text-primary-foreground',
  exclusive: 'bg-gold-gradient text-maroon-dark',
};

const badgeLabels: Record<string, string> = {
  new: 'NEW',
  bestseller: '🔥 Best Seller',
  combo: 'COMBO',
  exclusive: '✨ Exclusive',
};

const ProductCard = ({ product, index = 0 }: ProductCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const cardImages = Array.isArray(product.images) && product.images.length
    ? product.images
    : (product.image ? [product.image] : []);
  const hoverImage = cardImages.length > 1 ? cardImages[1] : cardImages[0];
  const isAboveTheFold = index < 4;

  const sizeOptions = useMemo(() => {
    const raw = Array.isArray(product.sizes) ? product.sizes : [];
    const cleaned = raw.map((s) => String(s).trim()).filter(Boolean);

    const parseUnitSize = (rawSize: string) => {
      const s = rawSize.toLowerCase().trim().replace(/\s+/g, ' ');
      const match = s.match(/^(\d+(?:\.\d+)?)\s*([a-z]+)$/i) || s.match(/^(\d+(?:\.\d+)?)\s+([a-z]+)$/i);
      if (!match) return null;
      const n = Number(match[1]);
      if (!Number.isFinite(n) || n <= 0) return null;
      const unit = String(match[2] || '').toLowerCase();

      // liquids
      if (unit === 'ml') return { group: 1, value: n };
      if (unit === 'l' || unit === 'lt' || unit === 'ltr' || unit === 'lit' || unit === 'litre' || unit === 'liter' || unit === 'liters' || unit === 'litres') {
        return { group: 1, value: n * 1000 };
      }

      // solids
      if (unit === 'g' || unit === 'gm' || unit === 'grm' || unit === 'gram' || unit === 'grams') return { group: 2, value: n };
      if (unit === 'kg' || unit === 'kgs' || unit === 'kilogram' || unit === 'kilograms') return { group: 2, value: n * 1000 };

      return null;
    };

    const allNumeric = cleaned.length > 0 && cleaned.every((s) => /^\d+$/.test(s));
    if (allNumeric) return [...cleaned].sort((a, b) => Number(a) - Number(b));

    const parsed = cleaned.map((s) => ({ s, k: parseUnitSize(s) }));
    const allParsed = parsed.length > 0 && parsed.every((x) => x.k);
    if (allParsed) {
      return parsed
        .sort((a, b) => (a.k!.group - b.k!.group) || (a.k!.value - b.k!.value) || a.s.localeCompare(b.s))
        .map((x) => x.s);
    }

    return cleaned;
  }, [product.id, JSON.stringify(product.sizes || [])]);

  const sizePricingMap = useMemo(() => {
    const entries = Array.isArray(product.sizePricing) ? product.sizePricing : [];
    const map = new Map<string, number>();
    for (const e of entries) {
      const key = String(e?.size ?? '').trim();
      const price = Number(e?.price);
      if (!key) continue;
      if (!Number.isFinite(price) || price <= 0) continue;
      map.set(key, price);
    }
    return map;
  }, [product.id, JSON.stringify(product.sizePricing || [])]);

  const [selectedSize, setSelectedSize] = useState<string>('');
  const effectiveSelectedSize = selectedSize || sizeOptions[0] || '';
  const sizedPrice = effectiveSelectedSize ? sizePricingMap.get(effectiveSelectedSize) : undefined;
  const displayPrice = typeof sizedPrice === 'number' && Number.isFinite(sizedPrice) && sizedPrice > 0 ? sizedPrice : product.price;
  const variantProduct = useMemo(() => {
    if (!effectiveSelectedSize) return product;
    if (!sizePricingMap.has(effectiveSelectedSize)) return product;
    const suffix = `::s=${encodeURIComponent(effectiveSelectedSize)}`;
    return {
      ...product,
      id: `${product.id}${suffix}`,
      price: displayPrice,
      selectedSize: effectiveSelectedSize,
      name: `${product.name} — Size: ${effectiveSelectedSize}`,
    };
  }, [product, effectiveSelectedSize, displayPrice, sizePricingMap]);

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
    addToCart(variantProduct);
    toast.success(`${variantProduct.name} added to cart!`);
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
    addToCart(variantProduct);
    navigate('/checkout');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      className="group relative flex flex-col rounded-2xl border border-border bg-card overflow-hidden gold-glow-hover cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image */}
      <Link to={`/product/${product.slug}`} className="relative aspect-square overflow-hidden bg-pearl">
        <img
          src={cardImages[0] || product.image}
          alt={product.name}
          loading={isAboveTheFold ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={index < 2 ? 'high' : 'auto'}
          className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
        />
        {hoverImage && hoverImage !== (cardImages[0] || product.image) && (
          <img
            src={hoverImage}
            alt={`${product.name} alternate`}
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
          />
        )}
        {badge && (
          <span className={`absolute top-3 left-3 px-2.5 py-1 text-[0.65rem] font-semibold rounded-full tracking-wide ${badgeStyles[badge]}`}>
            {badgeLabels[badge]}
          </span>
        )}
        <div className={`absolute top-3 right-3 flex flex-col gap-2 transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
          <button onClick={handleToggleWishlist} className={`w-8 h-8 rounded-full shadow flex items-center justify-center transition-colors ${inWishlist ? 'bg-saffron text-primary-foreground' : 'bg-card/90 hover:bg-saffron hover:text-primary-foreground'}`} aria-label="Wishlist">
            <Heart size={15} className={inWishlist ? 'fill-current' : ''} />
          </button>
          <Link to={`/product/${product.slug}`} className="w-8 h-8 rounded-full bg-card/90 shadow flex items-center justify-center hover:bg-saffron hover:text-primary-foreground transition-colors" aria-label="Quick view">
            <Eye size={15} />
          </Link>
        </div>
        {discount > 0 && (
          <span className="absolute bottom-3 left-3 px-2 py-0.5 text-[0.65rem] font-bold rounded bg-tulsi text-primary-foreground">{discount}% OFF</span>
        )}
      </Link>

      {/* Details */}
      <div className="flex flex-col gap-1.5 p-3 sm:p-4 flex-1">
        <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">{product.category}</span>
        <Link to={`/product/${product.slug}`}>
          <h3 className="font-playfair text-[0.85rem] sm:text-sm font-semibold text-foreground line-clamp-2 leading-snug hover:text-saffron transition-colors">{product.name}</h3>
        </Link>
        {sizeOptions.length > 0 && sizePricingMap.size > 0 && (
          <select
            value={effectiveSelectedSize}
            onChange={(e) => setSelectedSize(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 w-full px-3 py-2 bg-card border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-saffron/40"
            aria-label="Select size"
          >
            {sizeOptions.map((s) => (
              <option key={s} value={s}>
                {s}
                {(() => {
                  const p = sizePricingMap.get(s);
                  if (!p) return '';
                  return ` — ${formatPrice(p)}`;
                })()}
              </option>
            ))}
          </select>
        )}
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={12} className={i < Math.floor(product.rating) ? 'fill-gold text-gold' : 'text-border'} />
          ))}
          <span className="text-[0.65rem] text-muted-foreground ml-1">({product.reviewCount})</span>
        </div>
        <div className="flex items-center gap-2 mt-auto pt-1">
          <span className="text-saffron font-bold text-sm sm:text-base">{formatPrice(displayPrice)}</span>
          {product.originalPrice && <span className="text-muted-foreground line-through text-xs">{formatPrice(product.originalPrice)}</span>}
        </div>
        {product.soldCount && <span className="text-[0.6rem] text-tulsi font-medium">{product.soldCount} sold this week</span>}
      </div>

      <div className="px-3 sm:px-4 pb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button onClick={handleAddToCart} className="w-full py-2.5 rounded-xl bg-gold-gradient text-maroon-dark text-xs sm:text-sm font-bold shimmer active:scale-[0.97] transition-transform">
            <ShoppingCart size={14} className="inline mr-1.5 -mt-0.5" /> Add to Cart
          </button>
          <button onClick={handleBuyNow} className="w-full py-2.5 rounded-xl border border-gold/40 text-gold text-xs sm:text-sm font-bold hover:bg-gold/10 transition-colors">
            Buy Now
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default ProductCard;










