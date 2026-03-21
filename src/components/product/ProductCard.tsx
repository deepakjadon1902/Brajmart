import { useState } from 'react';
import { Heart, ShoppingCart, Star, Eye } from 'lucide-react';
import { motion } from 'framer-motion';
import { Product } from '@/types/product';
import { formatPrice, calculateDiscount } from '@/utils/formatPrice';

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
      <div className="relative aspect-square overflow-hidden bg-pearl">
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
        />

        {/* Badge */}
        {product.badge && (
          <span className={`absolute top-3 left-3 px-2.5 py-1 text-[0.65rem] font-semibold rounded-full tracking-wide ${badgeStyles[product.badge]}`}>
            {badgeLabels[product.badge]}
          </span>
        )}

        {/* Wishlist + Quick View on hover */}
        <div className={`absolute top-3 right-3 flex flex-col gap-2 transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
          <button className="w-8 h-8 rounded-full bg-card/90 shadow flex items-center justify-center hover:bg-saffron hover:text-primary-foreground transition-colors" aria-label="Add to wishlist">
            <Heart size={15} />
          </button>
          <button className="w-8 h-8 rounded-full bg-card/90 shadow flex items-center justify-center hover:bg-saffron hover:text-primary-foreground transition-colors" aria-label="Quick view">
            <Eye size={15} />
          </button>
        </div>

        {/* Discount badge */}
        {discount > 0 && (
          <span className="absolute bottom-3 left-3 px-2 py-0.5 text-[0.65rem] font-bold rounded bg-tulsi text-primary-foreground">
            {discount}% OFF
          </span>
        )}
      </div>

      {/* Details */}
      <div className="flex flex-col gap-1.5 p-4 flex-1">
        <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
          {product.category}
        </span>
        <h3 className="font-playfair text-sm font-semibold text-foreground line-clamp-2 leading-snug">
          {product.name}
        </h3>

        {/* Rating */}
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={12} className={i < Math.floor(product.rating) ? 'fill-gold text-gold' : 'text-border'} />
          ))}
          <span className="text-[0.65rem] text-muted-foreground ml-1">({product.reviewCount})</span>
        </div>

        {/* Price */}
        <div className="flex items-center gap-2 mt-auto pt-1">
          <span className="text-saffron font-bold text-base">{formatPrice(product.price)}</span>
          {product.originalPrice && (
            <span className="text-muted-foreground line-through text-xs">{formatPrice(product.originalPrice)}</span>
          )}
        </div>

        {product.soldCount && (
          <span className="text-[0.6rem] text-tulsi font-medium">{product.soldCount} sold this week</span>
        )}
      </div>

      {/* Add to cart button */}
      <div className="px-4 pb-4">
        <button className="w-full py-2.5 rounded-xl bg-gold-gradient text-maroon-dark text-sm font-bold shimmer active:scale-[0.97] transition-transform">
          <ShoppingCart size={14} className="inline mr-1.5 -mt-0.5" />
          Add to Cart
        </button>
      </div>
    </motion.div>
  );
};

export default ProductCard;
