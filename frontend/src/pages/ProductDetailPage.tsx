import { Link, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  const { getProductBySlug, products, loading } = useProductStore();
  const product = getProductBySlug(slug || '');
  const [quantity, setQuantity] = useState(1);
  const galleryImages = product?.images && product.images.length
    ? product.images
    : (product?.image ? [product.image] : []);
  const [activeImage, setActiveImage] = useState(galleryImages[0] || product?.image || '');
  const [zoomOpen, setZoomOpen] = useState(false);
  const thumbsColRef = useRef<HTMLDivElement | null>(null);
  const thumbsRowRef = useRef<HTMLDivElement | null>(null);
  const addToCart = useCartStore(s => s.addItem);
  const { toggleItem, isInWishlist } = useWishlistStore();
  const navigate = useNavigate();

  const pieceOptions = useMemo(() => {
    if (!product) return [];
    const tiers = Array.isArray(product.piecePricing) ? product.piecePricing : [];
    const normalized = tiers
      .map((t) => ({ pieces: Number(t?.pieces), price: Number(t?.price) }))
      .filter((t) => Number.isFinite(t.pieces) && t.pieces >= 2 && Number.isFinite(t.price) && t.price > 0)
      .sort((a, b) => a.pieces - b.pieces);
    const base = [{ pieces: 1, price: product.price }];
    // de-dupe by pieces, prefer explicit tier (2+)
    const seen = new Set<number>([1]);
    const rest = normalized.filter((t) => (seen.has(t.pieces) ? false : (seen.add(t.pieces), true)));
    return [...base, ...rest];
  }, [product?.id]);

  const sizeOptions = useMemo(() => {
    if (!product) return [];
    const sizes = Array.isArray(product.sizes) ? product.sizes : [];
    return sizes.map((s) => String(s).trim()).filter(Boolean);
  }, [product?.id]);

  const sizePricingMap = useMemo(() => {
    if (!product) return new Map<string, number>();
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
  }, [product?.id]);

  const [selectedPieces, setSelectedPieces] = useState<number>(1);
  const [selectedSize, setSelectedSize] = useState<string>('');

  useEffect(() => {
    setSelectedPieces(1);
    setSelectedSize(sizeOptions[0] || '');
  }, [product?.id, sizeOptions.join('|')]);

  useEffect(() => {
    if (galleryImages[0]) {
      setActiveImage(galleryImages[0]);
    }
  }, [product?.id]);

  const computedPrice = useMemo(() => {
    if (!product) return 0;
    if (selectedPieces <= 1) {
      const sized = selectedSize ? sizePricingMap.get(selectedSize) : undefined;
      if (sized && Number.isFinite(sized)) return sized;
      return product.price;
    }
    const explicit = pieceOptions.find((o) => o.pieces === selectedPieces)?.price;
    if (explicit && Number.isFinite(explicit)) return explicit;
    return product.price * selectedPieces;
  }, [pieceOptions, product, selectedPieces, selectedSize, sizePricingMap]);

  const discount = useMemo(() => {
    if (!product) return 0;
    return product.originalPrice ? calculateDiscount(product.price, product.originalPrice) : 0;
  }, [product]);

  const inWishlist = useMemo(() => {
    if (!product) return false;
    return isInWishlist(product.id);
  }, [isInWishlist, product]);

  const relatedProducts = useMemo(() => {
    if (!product) return [];
    return products.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 6);
  }, [product, products]);

  const variantSuffix = useMemo(() => {
    const parts: string[] = [];
    if (selectedSize) parts.push(`Size: ${selectedSize}`);
    if (selectedPieces && selectedPieces > 1) parts.push(`${selectedPieces} pcs`);
    return parts.length ? ` (${parts.join(', ')})` : '';
  }, [selectedPieces, selectedSize]);

  const variantProduct = useMemo(() => {
    if (!product) return null;
    const variantIdParts: string[] = [];
    if (selectedSize) variantIdParts.push(`s=${encodeURIComponent(selectedSize)}`);
    if (selectedPieces && selectedPieces > 1) variantIdParts.push(`p=${selectedPieces}`);
    const suffix = variantIdParts.length ? `::${variantIdParts.join('::')}` : '';
    return {
      ...product,
      id: `${product.id}${suffix}`,
      price: computedPrice,
      selectedSize: selectedSize || undefined,
      selectedPieces: selectedPieces || undefined,
      name: `${product.name}${variantSuffix}`,
    };
  }, [computedPrice, product, selectedPieces, selectedSize, variantSuffix]);

  const handleAddToCart = () => {
    if (!variantProduct) return;
    for (let i = 0; i < quantity; i++) addToCart(variantProduct);
    toast.success(`${variantProduct.name} added to cart!`);
  };

  const handleBuyNow = () => {
    if (!variantProduct) return;
    for (let i = 0; i < quantity; i++) addToCart(variantProduct);
    navigate('/checkout');
  };

  if (!product) {
    if (loading || products.length === 0) {
      return (
        <div className="min-h-screen bg-background">
          <AnnouncementBar /><Navbar />
          <div className="container mx-auto px-4 py-20 text-center">
            <div className="inline-flex items-center gap-2 text-muted-foreground">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
              <span>Loading product…</span>
            </div>
          </div>
          <Footer />
        </div>
      );
    }
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

  // Thumbnails scroll naturally (wheel / touch); hover swaps active image.

  const renderInline = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={`b-${idx}`}>{part.slice(2, -2)}</strong>;
      }
      return <span key={`t-${idx}`}>{part}</span>;
    });
  };

  const renderDescription = (text: string) => {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const blocks: JSX.Element[] = [];
    let buffer: string[] = [];
    const flushList = () => {
      if (!buffer.length) return;
      blocks.push(
        <ul key={`list-${blocks.length}`} className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
          {buffer.map((item, idx) => (
            <li key={`li-${idx}`}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      buffer = [];
    };

    lines.forEach((line) => {
      const isBullet = /^[-*•]\s+/.test(line);
      if (isBullet) {
        buffer.push(line.replace(/^[-*•]\s+/, ''));
      } else {
        flushList();
        blocks.push(
          <p key={`p-${blocks.length}`} className="text-sm text-muted-foreground leading-relaxed">
            {renderInline(line)}
          </p>
        );
      }
    });
    flushList();
    return blocks;
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
            <div className="flex flex-col sm:flex-row gap-3">
              {galleryImages.length > 1 && (
                <div className="sm:hidden">
                  <div ref={thumbsRowRef} className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
                    {galleryImages.map((img, idx) => (
                      <button
                        key={`${img}-${idx}`}
                        type="button"
                        onMouseEnter={() => setActiveImage(img)}
                        onFocus={() => setActiveImage(img)}
                        onClick={() => setActiveImage(img)}
                        className={`shrink-0 rounded-xl border ${activeImage === img ? 'border-saffron' : 'border-border'} overflow-hidden bg-pearl w-16 h-16`}
                        aria-label={`View image ${idx + 1}`}
                      >
                        <img src={img} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {galleryImages.length > 1 && (
                <div className="hidden sm:flex flex-col items-center gap-2 w-20">
                  <div ref={thumbsColRef} className="w-full flex flex-col gap-2 overflow-y-auto scrollbar-hide max-h-[420px] pr-1">
                    {galleryImages.map((img, idx) => (
                      <button
                        key={`${img}-${idx}`}
                        type="button"
                        onMouseEnter={() => setActiveImage(img)}
                        onFocus={() => setActiveImage(img)}
                        onClick={() => setActiveImage(img)}
                        className={`rounded-xl border ${activeImage === img ? 'border-saffron' : 'border-border'} overflow-hidden bg-pearl aspect-square w-full`}
                        aria-label={`View image ${idx + 1}`}
                      >
                        <img src={img} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setZoomOpen(true)}
                className="relative rounded-2xl overflow-hidden border border-border bg-pearl aspect-square w-full md:max-w-[520px] md:mx-auto text-left"
              >
              <img
                src={activeImage || product.image}
                alt={product.name}
                loading="eager"
                decoding="async"
                fetchPriority="high"
                className="w-full h-full object-cover"
              />
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
              </button>
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
              <span className="text-3xl font-bold text-saffron">{formatPrice(computedPrice)}</span>
              {product.originalPrice && (
                <>
                  <span className="text-lg text-muted-foreground line-through">{formatPrice(product.originalPrice)}</span>
                  <span className="px-2 py-0.5 bg-tulsi/10 text-tulsi text-sm font-semibold rounded">Save {formatPrice(product.originalPrice - computedPrice)}</span>
                </>
              )}
            </div>

            {/* Size & Pieces */}
            {(sizeOptions.length > 0 || pieceOptions.length > 1) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {sizeOptions.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Size</label>
                    <select
                      value={selectedSize}
                      onChange={(e) => setSelectedSize(e.target.value)}
                      className="w-full px-4 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-saffron/40"
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
                  </div>
                )}

                {pieceOptions.length > 1 && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Pieces</label>
                    <select
                      value={String(selectedPieces)}
                      onChange={(e) => setSelectedPieces(Number(e.target.value) || 1)}
                      className="w-full px-4 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-saffron/40"
                    >
                      {pieceOptions.map((o) => (
                        <option key={o.pieces} value={String(o.pieces)}>
                          {o.pieces} {o.pieces === 1 ? 'piece' : 'pieces'} — {formatPrice(o.price)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

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
              <button onClick={handleAddToCart} className="flex-1 py-3.5 rounded-xl bg-gold-gradient text-maroon-dark font-bold text-base shimmer active:scale-[0.97] transition-transform">
                <ShoppingCart size={18} className="inline mr-2 -mt-0.5" />Add to Cart
              </button>
              <button
                onClick={handleBuyNow}
                className="flex-1 py-3.5 rounded-xl bg-saffron text-primary-foreground font-bold text-base hover:brightness-95 active:scale-[0.97] transition-transform"
              >
                Buy Now
              </button>
              <button
                onClick={() => { toggleItem(product); toast.success(inWishlist ? 'Removed from wishlist' : 'Added to wishlist ❤️'); }}
                className={`px-4 py-3.5 rounded-xl border-2 transition-colors active:scale-[0.97] ${inWishlist ? 'border-saffron bg-saffron/10 text-saffron' : 'border-border text-foreground hover:border-saffron hover:text-saffron'}`}
              >
                <Heart size={18} className={inWishlist ? 'fill-current' : ''} />
              </button>
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border">
              {[
                { icon: Truck, label: 'Delivery', sub: 'Arrives in 3-7 days' },
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

            {product.description && product.description.trim() ? (
              <div className="space-y-3 pt-2">
                {renderDescription(product.description)}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground/70 italic pt-2">
                No description yet.
              </p>
            )}
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
      {zoomOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setZoomOpen(false)}>
          <div className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setZoomOpen(false)}
              className="absolute -top-4 -right-4 bg-white text-black rounded-full w-9 h-9 flex items-center justify-center shadow"
              aria-label="Close zoom"
            >
              ✕
            </button>
            <div className="rounded-2xl overflow-hidden border border-border bg-black">
              <img
                src={activeImage || product.image}
                alt={product.name}
                loading="eager"
                decoding="async"
                fetchPriority="high"
                className="w-full h-full object-contain max-h-[80vh]"
              />
            </div>
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
};

export default ProductDetailPage;



