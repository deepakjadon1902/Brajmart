import * as React from "react";
import { useState } from 'react';
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
    addToCart(product);
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
        <img src={product.image} alt={product.name} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]" />
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
      <div className="flex flex-col gap-1.5 p-4 flex-1">
        <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">{product.category}</span>
        <Link to={`/product/${product.slug}`}>
          <h3 className="font-playfair text-sm font-semibold text-foreground line-clamp-2 leading-snug hover:text-saffron transition-colors">{product.name}</h3>
        </Link>
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={12} className={i < Math.floor(product.rating) ? 'fill-gold text-gold' : 'text-border'} />
          ))}
          <span className="text-[0.65rem] text-muted-foreground ml-1">({product.reviewCount})</span>
        </div>
        <div className="flex items-center gap-2 mt-auto pt-1">
          <span className="text-saffron font-bold text-base">{formatPrice(product.price)}</span>
          {product.originalPrice && <span className="text-muted-foreground line-through text-xs">{formatPrice(product.originalPrice)}</span>}
        </div>
        {product.soldCount && <span className="text-[0.6rem] text-tulsi font-medium">{product.soldCount} sold this week</span>}
      </div>

      <div className="px-4 pb-4">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={handleAddToCart} className="w-full py-2.5 rounded-xl bg-gold-gradient text-maroon-dark text-sm font-bold shimmer active:scale-[0.97] transition-transform">
            <ShoppingCart size={14} className="inline mr-1.5 -mt-0.5" /> Add to Cart
          </button>
          <button onClick={handleBuyNow} className="w-full py-2.5 rounded-xl border border-gold/40 text-gold text-sm font-bold hover:bg-gold/10 transition-colors">
            Buy Now
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default ProductCard;












