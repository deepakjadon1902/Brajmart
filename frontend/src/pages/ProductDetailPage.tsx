import { Link, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Star, Heart, ShoppingCart, Truck, Shield, RotateCcw, ChevronRight, Minus, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { useProductStore } from '@/store/productStore';
import { useCartStore } from '@/store/cartStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { useSettingsStore } from '@/store/settingsStore';
import { formatPrice, calculateDiscount } from '@/utils/formatPrice';
import { toSquareImageUrl } from '@/utils/image';
import { toast } from 'sonner';
import ProductCarousel from '@/components/product/ProductCarousel';
import SectionHeader from '@/components/ui/SectionHeader';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import SEO from '@/components/seo/SEO';
import { SITE_URL, breadcrumbSchema } from '@/lib/seo';
import { categoryToSlug } from '@/store/productStore';
import { getInitialData } from '@/lib/initialData';

const absoluteUrl = (value: string) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (typeof window === 'undefined') return `${SITE_URL}${raw.startsWith('/') ? raw : `/${raw}`}`;
  return new URL(raw.startsWith('/') ? raw : `/${raw}`, window.location.origin).toString();
};

const toSchemaPrice = (value: number) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return '0.00';
  return amount.toFixed(2);
};

const positiveNumber = (value: unknown, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

const cleanText = (value?: string) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const truncateMeta = (value: string, maxLength: number) => {
  const clean = cleanText(value);
  if (clean.length <= maxLength) return clean;
  const clipped = clean.slice(0, maxLength - 3).trimEnd();
  const lastSpace = clipped.lastIndexOf(' ');
  return `${(lastSpace > 40 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}...`;
};

const safeJsonLd = (value: unknown) =>
  JSON.stringify(value).replace(/</g, '\\u003c');

const ProductDetailPage = () => {
  const { slug } = useParams();
  const { getProductBySlug, products, loading, lastFetchedAt, error, loadFromApi } = useProductStore();
  const settings = useSettingsStore((s) => s.settings);
  const product = getProductBySlug(slug || '');
  const [quantity, setQuantity] = useState(1);
  const baseGalleryImages = product?.images && product.images.length
    ? product.images
    : (product?.image ? [product.image] : []);
  const [activeImage, setActiveImage] = useState(baseGalleryImages[0] || product?.image || '');
  const [zoomOpen, setZoomOpen] = useState(false);
  const thumbsColRef = useRef<HTMLDivElement | null>(null);
  const thumbsRowRef = useRef<HTMLDivElement | null>(null);
  const addToCart = useCartStore(s => s.addItem);
  const { toggleItem, isInWishlist } = useWishlistStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!slug || product || loading) return;
    loadFromApi({ force: products.length === 0 }).catch(() => undefined);
  }, [loadFromApi, loading, product, products.length, slug]);

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
  }, [product?.id, product?.price, product?.piecePricing]);

  const sizeOptions = useMemo(() => {
    if (!product) return [];
    const sizes = Array.isArray(product.sizes) ? product.sizes : [];
    const cleaned = sizes.map((s) => String(s).trim()).filter(Boolean);

    const parseUnitSize = (raw: string) => {
      const s = raw.toLowerCase().trim().replace(/\s+/g, ' ');
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
  }, [product?.id, product?.sizes]);

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
  }, [product?.id, product?.sizePricing]);

  const [selectedPieces, setSelectedPieces] = useState<number>(1);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const customAttributes = useMemo(() => {
    const raw = Array.isArray(product?.attributes) ? product.attributes : [];
    return raw
      .map((attr) => {
        const record = (attr && typeof attr === 'object') ? (attr as Record<string, unknown>) : {};
        const termsRaw = record.terms;
        const terms = Array.isArray(termsRaw) ? termsRaw.map((t) => String(t).trim()).filter(Boolean) : [];
        return {
          name: String(record.name || ''),
          slug: String(record.slug || '').trim(),
          terms,
        };
      })
      .filter((a) => a.slug && a.terms.length > 0);
  }, [product?.id, product?.attributes]);
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});

  const colorVariantImages = useMemo(() => {
    if (!product) return [];
    const variants = Array.isArray(product.colorVariants) ? product.colorVariants : [];
    if (!variants.length) return [];

    const colorAttr = customAttributes.find((a) => a.slug.toLowerCase().includes('color') || a.name.toLowerCase().includes('color'));
    const colorSlug = colorAttr?.slug || '';
    if (!colorSlug) return [];

    const selected = String(selectedAttributes[colorSlug] || '').trim();
    if (!selected) return [];

    const match = variants.find((v) => String(v.color || '').toLowerCase() === selected.toLowerCase());
    const images = Array.isArray(match?.images) ? match.images : [];
    return images.map((x) => String(x).trim()).filter(Boolean);
  }, [customAttributes, product, selectedAttributes]);

  const dedupeImages = (list: string[]) => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const raw of list) {
      const url = String(raw || '').trim();
      if (!url) continue;
      const key = url.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(url);
    }
    return out;
  };

  // Thumbnails should show all images. If a color is selected, show its images first,
  // but still include the base gallery afterwards (like your "pic 2" layout).
  const thumbImages = useMemo(() => {
    const base = Array.isArray(baseGalleryImages) ? baseGalleryImages : [];
    const color = Array.isArray(colorVariantImages) ? colorVariantImages : [];
    return dedupeImages(color.length ? [...color, ...base] : base);
  }, [baseGalleryImages.join('|'), colorVariantImages.join('|'), product?.id]);

  const displayImages = thumbImages;
  const variantPricingList = useMemo(() => {
    const raw = Array.isArray(product?.variantPricing) ? product.variantPricing : [];
    return raw
      .map((v) => {
        const record = (v && typeof v === 'object') ? (v as Record<string, unknown>) : {};
        const selectionsRaw = record.selections;
        const selectionsObj =
          selectionsRaw && typeof selectionsRaw === 'object' && !Array.isArray(selectionsRaw)
            ? (selectionsRaw as Record<string, unknown>)
            : {};
        const selections: Record<string, string> = {};
        for (const [k, val] of Object.entries(selectionsObj)) {
          const value = val === null || val === undefined ? '' : String(val);
          if (!value.trim()) continue;
          selections[String(k)] = value;
        }
        const price = Number(record.price);
        return { selections, price };
      })
      .filter((v) => v.selections && typeof v.selections === 'object' && Object.keys(v.selections).length > 0 && Number.isFinite(v.price) && v.price > 0)
      // Prefer the most specific match (e.g., color+size over color-only).
      .sort((a, b) => Object.keys(b.selections).length - Object.keys(a.selections).length);
  }, [product?.id, product?.variantPricing]);

  useEffect(() => {
    setSelectedPieces(1);
    setSelectedSize(sizeOptions[0] || '');
    const next: Record<string, string> = {};
    for (const attr of customAttributes) {
      next[attr.slug] = attr.terms[0] || '';
    }
    setSelectedAttributes(next);
  }, [product?.id, sizeOptions.join('|'), customAttributes.map((a) => `${a.slug}:${a.terms.join('|')}`).join('||')]);

  useEffect(() => {
    // Keep current image if it still exists; otherwise switch to the first thumbnail (color-first).
    if (!displayImages.length) return;
    const current = String(activeImage || '').trim();
    const stillExists = current && displayImages.some((u) => u === current);
    if (!stillExists) setActiveImage(displayImages[0]);
  }, [product?.id, displayImages[0]]);

  const computedPrice = useMemo(() => {
    if (!product) return 0;

    const selection: Record<string, string> = { ...(selectedAttributes || {}) };
    const colorAttr = customAttributes.find((a) => a.slug.toLowerCase().includes('color') || a.name.toLowerCase().includes('color'));
    if (colorAttr?.slug) delete selection[colorAttr.slug]; // color never affects price
    if (selectedSize) selection.size = selectedSize;
    if (selectedPieces && selectedPieces > 1) selection.pieces = String(selectedPieces);

    const matched = variantPricingList.find((v) => {
      const s = v.selections as Record<string, string>;
      return Object.keys(s).every((k) => String(selection[k] ?? '') === String(s[k] ?? ''));
    });
    if (matched) return matched.price;

    if (selectedPieces <= 1) {
      const sized = selectedSize ? sizePricingMap.get(selectedSize) : undefined;
      if (sized && Number.isFinite(sized)) return sized;
      return product.price;
    }

    const explicit = pieceOptions.find((o) => o.pieces === selectedPieces)?.price;
    if (explicit && Number.isFinite(explicit)) return explicit;
    return product.price * selectedPieces;
  }, [pieceOptions, product, selectedAttributes, selectedPieces, selectedSize, sizePricingMap, variantPricingList]);

  const getPriceForSelection = (override: Partial<Record<string, string>> = {}) => {
    if (!product) return 0;

    const selection: Record<string, string> = { ...(selectedAttributes || {}) };
    const colorAttr = customAttributes.find((a) => a.slug.toLowerCase().includes('color') || a.name.toLowerCase().includes('color'));
    if (colorAttr?.slug) delete selection[colorAttr.slug]; // color never affects price
    if (selectedSize) selection.size = selectedSize;
    if (selectedPieces && selectedPieces > 1) selection.pieces = String(selectedPieces);

    for (const k of Object.keys(override)) {
      const v = override[k];
      if (v === undefined || v === null || String(v) === '') delete selection[k];
      else selection[k] = String(v);
    }

    const matched = variantPricingList.find((v) => {
      const s = v.selections as Record<string, string>;
      return Object.keys(s).every((k) => String(selection[k] ?? '') === String(s[k] ?? ''));
    });
    if (matched) return matched.price;

    const pieces = Number(selection.pieces || 1);
    const size = selection.size || '';

    if (pieces <= 1) {
      const sized = size ? sizePricingMap.get(size) : undefined;
      if (sized && Number.isFinite(sized)) return sized;
      return product.price;
    }

    const explicit = pieceOptions.find((o) => o.pieces === pieces)?.price;
    if (explicit && Number.isFinite(explicit)) return explicit;
    return product.price * pieces;
  };

  const colorHexForTerm = (term: string) => {
    const key = term.toLowerCase().trim().replace(/\s+/g, ' ');
    const map: Record<string, string> = {
      black: '#0b0f19',
      white: '#ffffff',
      red: '#ef4444',
      'dark red': '#991b1b',
      maroon: '#7f1d1d',
      orange: '#f97316',
      yellow: '#facc15',
      'light yellow': '#fde68a',
      green: '#22c55e',
      'light green': '#86efac',
      blue: '#3b82f6',
      'dark blue': '#1d4ed8',
      'light blue': '#7dd3fc',
      'sky blue': '#38bdf8',
      pink: '#ec4899',
      purple: '#a855f7',
      brown: '#92400e',
      grey: '#6b7280',
      gray: '#6b7280',
      'multi color': 'conic-gradient(from 180deg, #ef4444, #f59e0b, #22c55e, #3b82f6, #a855f7, #ef4444)',
    };
    return map[key] || null;
  };

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
    const routeProducts = getInitialData()?.products || [];
    const availableProducts = [...products, ...routeProducts].filter((item, index, list) =>
      list.findIndex((candidate) => candidate.id === item.id || candidate.slug === item.slug) === index
    );
    const candidates = availableProducts.filter((item) => item.id !== product.id && item.slug !== product.slug);
    const sameCategory = candidates.filter((item) =>
      categoryToSlug(item.category || '') === categoryToSlug(product.category || '')
    );
    const fallback = candidates.filter((item) => !sameCategory.some((related) => related.id === item.id));
    return [...sameCategory, ...fallback].slice(0, 6);
  }, [product, products]);
  const [recentSlugs, setRecentSlugs] = useState<string[]>([]);

  useEffect(() => {
    if (!product?.slug) return;
    try {
      const existing = JSON.parse(localStorage.getItem('brajmart-recent-products') || '[]');
      const slugs = Array.isArray(existing) ? existing.map(String) : [];
      setRecentSlugs(slugs.filter((item) => item !== product.slug).slice(0, 8));
      localStorage.setItem('brajmart-recent-products', JSON.stringify([product.slug, ...slugs.filter((item) => item !== product.slug)].slice(0, 12)));
    } catch {
      setRecentSlugs([]);
    }
  }, [product?.slug]);

  const recentlyViewedProducts = useMemo(() => recentSlugs
    .map((recentSlug) => products.find((item) => item.slug === recentSlug))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 6), [products, recentSlugs]);

  const variantSuffix = useMemo(() => {
    const parts: string[] = [];
    if (selectedSize) parts.push(`Size: ${selectedSize}`);
    if (selectedPieces && selectedPieces > 1) parts.push(`${selectedPieces} pcs`);
    for (const attr of customAttributes) {
      const v = selectedAttributes[attr.slug];
      if (v) parts.push(`${attr.name || attr.slug}: ${v}`);
    }
    return parts.length ? ` (${parts.join(', ')})` : '';
  }, [customAttributes, selectedAttributes, selectedPieces, selectedSize]);

  const variantProduct = useMemo(() => {
    if (!product) return null;
    const variantImages = displayImages.length ? displayImages : (product.images && product.images.length ? product.images : (product.image ? [product.image] : []));
    const variantIdParts: string[] = [];
    if (selectedSize) variantIdParts.push(`s=${encodeURIComponent(selectedSize)}`);
    if (selectedPieces && selectedPieces > 1) variantIdParts.push(`p=${selectedPieces}`);
    for (const attr of customAttributes) {
      const v = selectedAttributes[attr.slug];
      if (v) variantIdParts.push(`${encodeURIComponent(attr.slug)}=${encodeURIComponent(v)}`);
    }
    const suffix = variantIdParts.length ? `::${variantIdParts.join('::')}` : '';
    return {
      ...product,
      id: `${product.id}${suffix}`,
      price: computedPrice,
      image: variantImages[0] || product.image,
      images: variantImages,
      selectedSize: selectedSize || undefined,
      selectedPieces: selectedPieces || undefined,
      selectedAttributes,
      name: `${product.name}${variantSuffix}`,
    };
  }, [computedPrice, customAttributes, displayImages, product, selectedAttributes, selectedPieces, selectedSize, variantSuffix]);

  const productSchema = useMemo(() => {
    if (!product) return null;

    const productUrl = `${SITE_URL}/product/${product.slug || slug || ''}`;
    const images = (displayImages.length ? displayImages : (product.images?.length ? product.images : [product.image]))
      .map(absoluteUrl)
      .filter(Boolean);
    const schemaDescription = cleanText(product.description) || `${product.name} from ${settings.storeName || 'BrajMart'}`;
    const price = toSchemaPrice(computedPrice || product.price);
    const shippingFee = positiveNumber(settings.shippingFee, 49);
    const freeShippingThreshold = positiveNumber(settings.freeShippingThreshold, 299);
    const schemaShippingFee = freeShippingThreshold > 0 && computedPrice >= freeShippingThreshold ? 0 : shippingFee;
    const minDeliveryDays = Math.max(1, positiveNumber(settings.deliveryEtaMinDays, 3));
    const maxDeliveryDays = Math.max(minDeliveryDays, positiveNumber(settings.deliveryEtaMaxDays, 7));
    const returnPolicyUrl = typeof window !== 'undefined'
      ? new URL('/return-policy', window.location.origin).toString()
      : '/return-policy';

    return {
      '@context': 'https://schema.org',
      '@type': 'Product',
      '@id': `${productUrl}#product`,
      name: product.name,
      description: schemaDescription,
      image: images,
      sku: String(product.id),
      category: product.category,
      brand: {
        '@type': 'Brand',
        name: 'Brajmart',
      },
      offers: {
        '@type': 'Offer',
        url: productUrl,
        price,
        priceCurrency: 'INR',
        availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        itemCondition: 'https://schema.org/NewCondition',
        seller: {
          '@type': 'Organization',
          name: 'Brajmart',
        },
        shippingDetails: {
          '@type': 'OfferShippingDetails',
          shippingRate: {
            '@type': 'MonetaryAmount',
            value: toSchemaPrice(schemaShippingFee),
            currency: 'INR',
          },
          shippingDestination: {
            '@type': 'DefinedRegion',
            addressCountry: 'IN',
          },
          deliveryTime: {
            '@type': 'ShippingDeliveryTime',
            handlingTime: {
              '@type': 'QuantitativeValue',
              minValue: 0,
              maxValue: 1,
              unitCode: 'd',
            },
            transitTime: {
              '@type': 'QuantitativeValue',
              minValue: minDeliveryDays,
              maxValue: maxDeliveryDays,
              unitCode: 'd',
            },
          },
        },
        hasMerchantReturnPolicy: {
          '@type': 'MerchantReturnPolicy',
          applicableCountry: 'IN',
          returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
          merchantReturnDays: 7,
          returnMethod: 'https://schema.org/ReturnByMail',
          returnFees: 'https://schema.org/FreeReturn',
          url: returnPolicyUrl,
        },
      },
      ...(product.rating > 0 && product.reviewCount > 0
        ? {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: Number(product.rating).toFixed(1),
              reviewCount: Number(product.reviewCount),
            },
          }
        : {}),
    };
  }, [
    computedPrice,
    displayImages,
    product,
    settings.deliveryEtaMaxDays,
    settings.deliveryEtaMinDays,
    settings.freeShippingThreshold,
    settings.shippingFee,
    settings.storeName,
    slug,
  ]);

  const productBreadcrumbSchema = useMemo(() => {
    if (!product) return null;
    const categoryPath = `/category/${categoryToSlug(product.category)}`;
    const items = [
      { name: 'Home', path: '/' },
      { name: product.category, path: categoryPath },
    ];
    if (product.subcategory) {
      items.push({ name: product.subcategory, path: `${categoryPath}/${categoryToSlug(product.subcategory)}` });
    }
    items.push({ name: product.name, path: `/product/${product.slug}` });
    return breadcrumbSchema(items);
  }, [product]);

  const productUrl = useMemo(() => {
    if (!product) return '';
    return `${SITE_URL}/product/${product.slug || slug || ''}`;
  }, [product, slug]);

  const primaryImage = useMemo(() => {
    if (!product) return '';
    return absoluteUrl(displayImages[0] || product.image);
  }, [displayImages, product]);

  const metaTitle = useMemo(() => {
    if (!product) return settings.storeName || 'Brajmart';
    return `${product.name} — Buy Online | Authentic Vrindavan | Brajmart`;
  }, [product, settings.storeName]);

  const metaDescription = useMemo(() => {
    if (!product) return '';
    const shortDescription = cleanText(product.metaDescription || product.description || `${product.category || 'devotional product'} from Vrindavan.`);
    return truncateMeta(
      `Buy authentic ${product.name} from Vrindavan. ${shortDescription}. Free shipping above ₹299. 100% genuine temple-sourced product. Order now at Brajmart.`,
      180
    );
  }, [product]);

  const handleAddToCart = () => {
    if (!variantProduct) return;
    if (!product?.inStock) {
      toast.error('This product is out of stock');
      return;
    }
    for (let i = 0; i < quantity; i++) addToCart(variantProduct);
    toast.success(`${variantProduct.name} added to cart!`);
  };

  const handleBuyNow = () => {
    if (!variantProduct) return;
    if (!product?.inStock) {
      toast.error('This product is out of stock');
      return;
    }
    for (let i = 0; i < quantity; i++) addToCart(variantProduct);
    navigate('/checkout');
  };

  if (!product) {
    const hasAttemptedCatalogLoad = lastFetchedAt > 0 || Boolean(error);
    if (loading || !hasAttemptedCatalogLoad) {
      return (
        <div className="min-h-screen bg-background">
          <SEO
            title="Loading Product | Brajmart"
            description="Brajmart is loading this product page."
            path={slug ? `/product/${slug}` : '/products'}
            robots="noindex,follow"
          />
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
        <SEO
          title="Product Not Found | Brajmart"
          description="This Brajmart product is no longer available."
          path={slug ? `/product/${slug}` : '/products'}
          robots="noindex,follow"
        />
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
      <Helmet>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDescription} />
        <meta name="robots" content="index,follow" />
        <link rel="canonical" href={productUrl} />
        <meta property="og:type" content="product" />
        <meta property="og:site_name" content={settings.storeName || 'Brajmart'} />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:url" content={productUrl} />
        {primaryImage ? <meta property="og:image" content={primaryImage} /> : null}
        <meta property="product:price:amount" content={toSchemaPrice(computedPrice)} />
        <meta property="product:price:currency" content="INR" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={metaTitle} />
        <meta name="twitter:description" content={metaDescription} />
        {primaryImage ? <meta name="twitter:image" content={primaryImage} /> : null}
        {productSchema ? (
          <script type="application/ld+json">
            {safeJsonLd(productSchema)}
          </script>
        ) : null}
        {productBreadcrumbSchema ? (
          <script type="application/ld+json">{safeJsonLd(productBreadcrumbSchema)}</script>
        ) : null}
      </Helmet>
      <AnnouncementBar /><Navbar />

      <div className="container mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6 flex-wrap">
          <Link to="/" className="hover:text-saffron">Home</Link>
          <ChevronRight size={14} />
          <Link to={`/category/${categoryToSlug(product.category)}`} className="hover:text-saffron">{product.category}</Link>
          {product.subcategory ? (
            <><ChevronRight size={14} /><Link to={`/category/${categoryToSlug(product.category)}/${categoryToSlug(product.subcategory)}`} className="hover:text-saffron">{product.subcategory}</Link></>
          ) : null}
          <ChevronRight size={14} />
          <span className="text-foreground line-clamp-1">{product.name}</span>
        </div>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          {/* Image */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
            <div className="flex flex-col sm:flex-row gap-3">
              {thumbImages.length > 1 && (
                <div className="sm:hidden">
                  <div ref={thumbsRowRef} className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
                    {thumbImages.map((img, idx) => (
                      <button
                        key={`${img}-${idx}`}
                        type="button"
                        onMouseEnter={() => setActiveImage(img)}
                        onFocus={() => setActiveImage(img)}
                        onClick={() => setActiveImage(img)}
                        className={`shrink-0 rounded-xl border ${activeImage === img ? 'border-saffron' : 'border-border'} overflow-hidden bg-pearl w-16 h-16`}
                        aria-label={`View image ${idx + 1}`}
                      >
                        <img src={toSquareImageUrl(img)} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {thumbImages.length > 1 && (
                <div className="hidden sm:flex flex-col items-center gap-2 w-20">
                  <div ref={thumbsColRef} className="w-full flex flex-col gap-2 overflow-y-auto scrollbar-hide max-h-[420px] pr-1">
                    {thumbImages.map((img, idx) => (
                      <button
                        key={`${img}-${idx}`}
                        type="button"
                        onMouseEnter={() => setActiveImage(img)}
                        onFocus={() => setActiveImage(img)}
                        onClick={() => setActiveImage(img)}
                        className={`rounded-xl border ${activeImage === img ? 'border-saffron' : 'border-border'} overflow-hidden bg-pearl aspect-square w-full`}
                        aria-label={`View image ${idx + 1}`}
                      >
                        <img src={toSquareImageUrl(img)} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" />
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
                src={toSquareImageUrl(activeImage || product.image)}
                alt={product.name}
                loading="eager"
                decoding="async"
                className="w-full h-full object-cover"
              />
              {product.badge && (
                <span className={`absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-bold ${product.badge === 'bestseller' ? 'bg-gold-gradient text-maroon-dark' : 'bg-saffron text-primary-foreground'}`}>
                  {product.badge === 'bestseller' ? '🔥 Best Seller' : 'NEW'}
                </span>
              )}
              {discount > 0 && (
                <span className="discount-badge absolute top-4 right-4 px-3 py-1 rounded-full bg-tulsi text-primary-foreground text-xs font-bold">
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
              <p className="mt-1 text-xs text-muted-foreground">SKU: {product.id}</p>
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
            <div className="flex flex-wrap items-center gap-3">
              <span className="price-current font-playfair text-3xl font-bold text-brand-gold">{formatPrice(computedPrice)}</span>
              {product.originalPrice && (
                <>
                  <span className="price-original text-lg text-muted-foreground line-through">{formatPrice(product.originalPrice)}</span>
                  <span className="save-text rounded bg-tulsi/10 px-2 py-0.5 text-sm font-semibold text-tulsi">Save {formatPrice(product.originalPrice - computedPrice)}</span>
                </>
              )}
              {!product.inStock && (
                <span className="px-3 py-1 rounded-full bg-destructive text-primary-foreground text-sm font-extrabold tracking-wide">
                  OUT OF STOCK
                </span>
              )}
            </div>

            {/* Size & Pieces */}
            {(sizeOptions.length > 0 || pieceOptions.length > 1) && (
              <div className="space-y-4">
                {sizeOptions.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-end justify-between gap-3">
                      <label className="block text-sm font-semibold">Size</label>
                      {selectedSize && (
                        <span className="text-xs text-muted-foreground">
                          Selected: <span className="font-semibold text-foreground">{selectedSize}</span>
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {sizeOptions.map((s) => {
                        const active = s === selectedSize;
                        const price = getPriceForSelection({ size: s });
                        const delta = price - computedPrice;
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setSelectedSize(s)}
                            className={[
                              'rounded-xl border px-3 py-2 text-left transition active:scale-[0.98]',
                              active ? 'border-saffron bg-saffron/10 shadow-sm' : 'border-border bg-card hover:border-saffron/60 hover:bg-muted/40',
                            ].join(' ')}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold">{s}</span>
                              {Number.isFinite(delta) && Math.abs(delta) >= 1 && (
                                <span className={`text-[0.65rem] font-semibold px-2 py-0.5 rounded-full ${delta > 0 ? 'bg-saffron/15 text-saffron' : 'bg-tulsi/10 text-tulsi'}`}>
                                  {delta > 0 ? '+' : ''}{formatPrice(delta)}
                                </span>
                              )}
                            </div>
                            <div className="text-[0.7rem] text-muted-foreground mt-0.5">{formatPrice(price)}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {pieceOptions.length > 1 && (
                  <div className="space-y-2">
                    <div className="flex items-end justify-between gap-3">
                      <label className="block text-sm font-semibold">Quantity Pack</label>
                      {selectedPieces > 1 && (
                        <span className="text-xs text-muted-foreground">
                          Selected: <span className="font-semibold text-foreground">{selectedPieces} pcs</span>
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {pieceOptions.map((o) => {
                        const value = String(o.pieces);
                        const active = String(selectedPieces) === value;
                        const price = getPriceForSelection({ pieces: value });
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setSelectedPieces(o.pieces)}
                            className={[
                              'rounded-full border px-4 py-2 text-sm font-semibold transition active:scale-[0.98]',
                              active ? 'border-saffron bg-saffron text-primary-foreground shadow-sm' : 'border-border bg-card hover:border-saffron/60',
                            ].join(' ')}
                            aria-pressed={active}
                          >
                            {o.pieces} {o.pieces === 1 ? 'pc' : 'pcs'} · {formatPrice(price)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Custom Attributes */}
            {customAttributes.length > 0 && (
              <div className="space-y-4">
                {customAttributes.map((attr) => {
                  const selected = selectedAttributes[attr.slug] || attr.terms[0] || '';
                  const looksLikeColor = attr.slug.toLowerCase().includes('color') || attr.name.toLowerCase().includes('color');

                  return (
                    <div key={attr.slug} className="space-y-2">
                      <div className="flex items-end justify-between gap-3">
                        <label className="block text-sm font-semibold">{attr.name || attr.slug}</label>
                        {selected && (
                          <span className="text-xs text-muted-foreground">
                            Selected: <span className="font-semibold text-foreground">{selected}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {attr.terms.map((t) => {
                          const active = t === selected;
                          const price = getPriceForSelection({ [attr.slug]: t });
                          const delta = price - computedPrice;
                          const hex = looksLikeColor ? colorHexForTerm(t) : null;
                          const isGradient = typeof hex === 'string' && hex.includes('gradient');

                          return (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setSelectedAttributes((prev) => ({ ...prev, [attr.slug]: t }))}
                              className={[
                                'group rounded-full border px-4 py-2 text-sm font-semibold transition active:scale-[0.98]',
                                active ? 'border-saffron bg-saffron/10 text-foreground shadow-sm' : 'border-border bg-card hover:border-saffron/60',
                              ].join(' ')}
                              aria-pressed={active}
                              title={t}
                            >
                              <span className="inline-flex items-center gap-2">
                                {hex && (
                                  <span
                                    className={['h-4 w-4 rounded-full border border-border/70', active ? 'ring-2 ring-saffron/60 ring-offset-2 ring-offset-background' : ''].join(' ')}
                                    style={isGradient ? { backgroundImage: hex } : { backgroundColor: hex }}
                                  />
                                )}
                                <span>{t}</span>
                                {Number.isFinite(delta) && Math.abs(delta) >= 1 && (
                                  <span className={`text-[0.65rem] font-semibold px-2 py-0.5 rounded-full ${delta > 0 ? 'bg-saffron/15 text-saffron' : 'bg-tulsi/10 text-tulsi'}`}>
                                    {delta > 0 ? '+' : ''}{formatPrice(delta)}
                                  </span>
                                )}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Quantity */}
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">Quantity:</span>
              <div className="qty-selector flex h-11 w-[130px] items-center justify-between rounded-lg border border-border bg-brand-soft">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={!product.inStock}
                  className={`qty-btn flex h-full w-11 items-center justify-center rounded-l-lg ${product.inStock ? 'hover:bg-muted transition-colors' : 'cursor-not-allowed opacity-50'}`}
                  aria-label="Decrease quantity"
                >
                  <Minus size={16} />
                </button>
                <span id="qty-display" className="font-sans text-base font-bold text-brand-deep">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  disabled={!product.inStock}
                  className={`qty-btn flex h-full w-11 items-center justify-center rounded-r-lg ${product.inStock ? 'hover:bg-muted transition-colors' : 'cursor-not-allowed opacity-50'}`}
                  aria-label="Increase quantity"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleAddToCart}
                disabled={!product.inStock}
                className={`add-to-cart-btn btn-action flex-1 ${product.inStock ? '' : 'bg-muted text-muted-foreground hover:bg-muted'}`}
              >
                <ShoppingCart size={18} className="inline mr-2 -mt-0.5" />Add to Cart
              </button>
              <button
                onClick={handleBuyNow}
                disabled={!product.inStock}
                className={`buy-now-btn btn-action-secondary flex-1 ${product.inStock ? '' : 'bg-muted text-muted-foreground hover:bg-muted'}`}
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
        {recentlyViewedProducts.length > 0 && (
          <div className="mt-12">
            <SectionHeader tag="YOUR HISTORY" title="Recently Viewed" subtitle="Continue exploring products you viewed earlier" />
            <ProductCarousel products={recentlyViewedProducts} />
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
                {...({ fetchpriority: 'high' } as Record<string, string>)}
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



