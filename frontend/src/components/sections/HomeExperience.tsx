import { ArrowUpRight, MessageCircle, ShieldCheck, Truck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Category, Product } from '@/types/product';
import SectionHeader from '@/components/ui/SectionHeader';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { formatPrice } from '@/utils/formatPrice';
import { useCartStore } from '@/store/cartStore';
import { productToMetaPixelParams, trackMetaPixelEvent } from '@/lib/metaPixel';
import { toast } from 'sonner';
import ProductCard from '@/components/product/ProductCard';

const purposeCards = [
  { title: 'Daily Puja', text: 'Dhoop, itra, chandan and sacred home-puja essentials.', purpose: 'daily-puja' },
  { title: 'Japa & Meditation', text: 'Tulsi malas, japa malas and bead bags.', purpose: 'japa-meditation' },
  { title: 'Spiritual Reading', text: 'Gita, Prabhupada books and devotional study.', purpose: 'spiritual-reading' },
  { title: 'Devotional Gifting', text: 'Thoughtful bhakti gifts for family and friends.', purpose: 'devotional-gifting' },
  { title: 'Home Temple', text: 'Laddu Gopal, shringar and altar accessories.', purpose: 'home-temple' },
  { title: 'Prasadam', text: 'Blessed sweets and offerings from Braj.', purpose: 'prasadam' },
  { title: 'Accessories', text: 'Bracelets, lockets, bags and daily bhakti items.', purpose: 'accessories' },
];

const storyLinks = [
  { name: 'Vrindavan', slug: 'vrindavan', copy: 'Temple lanes, kirtan, seva and the devotional pulse of Braj.' },
  { name: 'Mathura', slug: 'mathura', copy: 'The birthplace of Krishna and the historic heart of sacred commerce.' },
  { name: 'Govardhan', slug: 'govardhan', copy: 'A place of remembrance, pilgrimage and humble offerings.' },
  { name: 'Barsana', slug: 'barsana', copy: "Radha Rani's land, known for devotion, color and celebration." },
];

export const PurposeDiscovery = ({ categories }: { categories: Category[] }) => {
  void categories;

  return (
    <section className="bg-background py-8 sm:py-10 md:py-12">
      <div className="storefront-shell">
        <div className="mb-5 flex flex-col gap-2 border-b border-border pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold">Shop by purpose</span>
            <h2 className="mt-1 font-playfair text-2xl font-bold leading-tight text-foreground md:text-3xl">
              What brings you here today?
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-muted-foreground">
            Choose the devotional need first, then browse the right BrajMart collection.
          </p>
        </div>

        <div className="grid overflow-hidden rounded-lg border border-border bg-card shadow-sm sm:grid-cols-2 lg:grid-cols-7">
          {purposeCards.map((card, index) => {
            const to = `/products?purpose=${encodeURIComponent(card.purpose)}`;

            return (
              <Link
                key={card.title}
                to={to}
                className={[
                  'group flex min-h-[118px] flex-col justify-between border-border bg-card p-4 transition-colors hover:bg-brand-soft/55 premium-focus',
                  index % 2 === 0 ? 'bg-white' : 'bg-brand-raised',
                  'border-b sm:border-r lg:border-b-0',
                ].join(' ')}
              >
                <span>
                  <span className="block font-sans text-[12px] font-bold uppercase tracking-[0.08em] text-maroon">
                    {card.title}
                  </span>
                  <span className="mt-2 block text-[13px] leading-5 text-muted-foreground">
                    {card.text}
                  </span>
                </span>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-saffron">
                  Explore
                  <ArrowUpRight size={13} aria-hidden="true" />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export const WhyBrajMart = () => (
  <section className="storefront-band bg-pearl">
    <div className="storefront-shell">
      <SectionHeader
        tag="WHY BRAJMART"
        title="Devotional shopping, made reassuring"
        subtitle="Clear pricing, secure payment, careful packing and support for your order journey."
      />
      <div className="grid gap-3 md:grid-cols-3">
        {[
          { icon: ShieldCheck, title: 'Authentic Selection', text: "Products are curated around BrajMart's devotional catalog and real product data." },
          { icon: Truck, title: 'Delivery Clarity', text: 'Shipping fees, free-shipping threshold and delivery checks use configured settings.' },
          { icon: MessageCircle, title: 'Human Support', text: 'WhatsApp, email, order tracking and customer-service routes stay close at hand.' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <ScrollReveal key={item.title}>
              <div className="h-full rounded-lg border border-border bg-card p-5 shadow-sm">
                <Icon size={22} className="text-saffron" aria-hidden="true" />
                <h3 className="mt-4 text-lg font-bold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
              </div>
            </ScrollReveal>
          );
        })}
      </div>
    </div>
  </section>
);

export const BrajStory = () => (
  <section className="bg-background py-5 sm:py-6 md:py-8">
    <div className="storefront-shell grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
      <ScrollReveal>
        <span className="text-xs font-bold uppercase tracking-[0.18em] text-gold">BRAJ DARSHAN</span>
        <h2 className="mt-3 font-playfair text-3xl font-bold leading-tight text-foreground md:text-4xl">
          From the land of Krishna to your doorstep.
        </h2>
        <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground md:text-base">
          BrajMart's difference is not just a catalog. It is the emotional geography of Vrindavan, Mathura,
          Govardhan and Barsana expressed through useful devotional products for daily life.
        </p>
        <Link
          to="/braj-darshan/vrindavan"
          className="mt-6 inline-flex rounded-lg bg-maroon px-5 py-3 text-sm font-bold text-white transition hover:bg-saffron premium-focus"
        >
          Explore Braj Darshan
        </Link>
      </ScrollReveal>
      <div className="grid gap-3 sm:grid-cols-2">
        {storyLinks.map((item) => (
          <ScrollReveal key={item.slug}>
            <Link
              to={`/braj-darshan/${item.slug}`}
              className="block rounded-lg border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-gold/50 premium-focus"
            >
              <span className="font-playfair text-xl font-bold text-foreground">{item.name}</span>
              <span className="mt-2 block text-sm leading-relaxed text-muted-foreground">{item.copy}</span>
            </Link>
          </ScrollReveal>
        ))}
      </div>
    </div>
  </section>
);

export const NewsletterEngagement = () => (
  <section className="storefront-band bg-maroon text-white">
    <div className="storefront-shell flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
      <div>
        <span className="text-xs font-bold uppercase tracking-[0.18em] text-gold-light">STAY CONNECTED</span>
        <h2 className="mt-2 font-playfair text-3xl font-bold text-white">Bring a little Braj home, again and again.</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/78">
          Get product updates, devotional reading picks and order support through BrajMart's existing contact channels.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link to="/contact" className="rounded-lg bg-white px-5 py-3 text-sm font-bold text-maroon transition hover:bg-gold-light premium-focus">
          Contact Us
        </Link>
        <Link to="/blog" className="rounded-lg border border-white/30 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10 premium-focus">
          Read Stories
        </Link>
      </div>
    </div>
  </section>
);

const pickBundleProducts = (products: Product[]) => {
  const seen = new Set<string>();
  const available = products
    .filter((product) => product.inStock !== false && product.price > 0)
    .filter((product) => {
      const key = product.id || product.slug || product.name;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .filter((product) => String(product.category || '').trim());

  const scoreProduct = (product: Product) => {
    const bestsellerBoost = product.tags?.includes('bestseller') || product.badge === 'bestseller' ? 1000 : 0;
    return Number(product.soldCount || 0) * 10 + bestsellerBoost + Number(product.rating || 0);
  };

  const twoDayBucket = Math.floor(Date.now() / (2 * 24 * 60 * 60 * 1000));
  const grouped = available.reduce<Record<string, Product[]>>((acc, product) => {
    const category = String(product.category || '').trim();
    acc[category] = [...(acc[category] || []), product];
    return acc;
  }, {});

  const eligibleGroups = Object.entries(grouped)
    .filter(([, groupProducts]) => groupProducts.length >= 5)
    .sort((a, b) => {
      const scoreA = a[1].reduce((sum, product) => sum + scoreProduct(product), 0);
      const scoreB = b[1].reduce((sum, product) => sum + scoreProduct(product), 0);
      return scoreB - scoreA || a[0].localeCompare(b[0]);
    });

  if (eligibleGroups.length) {
    const [category, groupProducts] = eligibleGroups[twoDayBucket % eligibleGroups.length];
    const ranked = [...groupProducts].sort((a, b) => scoreProduct(b) - scoreProduct(a));
    const offset = Math.floor(twoDayBucket / Math.max(1, eligibleGroups.length)) % ranked.length;
    const rotated = [...ranked.slice(offset), ...ranked.slice(0, offset)];
    return rotated.slice(0, 5).map((product) => ({ ...product, category }));
  }

  return [...available]
    .sort((a, b) => scoreProduct(b) - scoreProduct(a))
    .slice(0, 5);
};

const bundleNameForProducts = (products: Product[]) => {
  const counts = products.reduce<Record<string, number>>((acc, product) => {
    const category = String(product.category || '').trim();
    if (!category) return acc;
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});
  const [category = 'Devotional'] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || [];
  const normalized = category.toLowerCase();
  if (normalized.includes('prasadam') || normalized.includes('prasad')) return 'Braj Prasadam Favorites';
  if (normalized.includes('book')) return 'Spiritual Reading Combo';
  if (normalized.includes('accessor') || normalized.includes('mala') || normalized.includes('japa')) return 'Japa & Bhakti Essentials';
  if (normalized.includes('idol') || normalized.includes('shringar')) return 'Home Temple Shringar Set';
  if (normalized.includes('puja') || normalized.includes('pooja') || normalized.includes('incense')) return 'Daily Puja Essentials';
  if (normalized.includes('cloth')) return 'Devotional Clothing Set';
  return `${category} Perfect Combo`;
};

export const BundledFavorites = ({ products }: { products: Product[] }) => {
  const navigate = useNavigate();
  const addItem = useCartStore((state) => state.addItem);
  const bundleProducts = pickBundleProducts(products);
  if (bundleProducts.length < 5) return null;
  const bundleTotal = bundleProducts.reduce((sum, product) => sum + product.price, 0);
  const mrpTotal = bundleProducts.reduce((sum, product) => sum + (product.originalPrice || product.price), 0);
  const savings = Math.max(0, mrpTotal - bundleTotal);
  const bundleName = bundleNameForProducts(bundleProducts);
  const saveBundleSnapshot = () => {
    try {
      sessionStorage.setItem('brajmart-last-bundle', JSON.stringify({
        name: bundleName,
        total: bundleTotal,
        savings,
        products: bundleProducts.map((product) => ({
          id: product.id,
          slug: product.slug,
          name: product.name,
          category: product.category,
          price: product.price,
          image: product.image,
        })),
      }));
    } catch {
      // Checkout still has the individual cart items if session storage is unavailable.
    }
  };
  const addCompleteSet = () => {
    bundleProducts.forEach((product) => {
      addItem(product);
      trackMetaPixelEvent('AddToCart', productToMetaPixelParams(product));
    });
    saveBundleSnapshot();
    toast.success('Complete set added to cart');
  };
  const buyCompleteSet = () => {
    addCompleteSet();
    navigate('/checkout');
  };

  return (
    <section className="bg-pearl py-5 sm:py-6 md:py-7">
      <div className="storefront-shell">
        <SectionHeader
          tag="PERFECT COMBO"
          title="Frequently ordered together"
          subtitle="Five popular products, refreshed automatically every 2 days from current product data."
        />
        <div className="grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
          <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
            <h3 className="font-playfair text-xl font-bold leading-tight text-foreground">{bundleName}</h3>
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
              Five frequently ordered products from one relevant category.
            </p>
            <div className="mt-3 max-h-[210px] space-y-1.5 overflow-y-auto pr-1">
              {bundleProducts.map((product) => (
                <Link key={product.id} to={`/product/${product.slug}`} className="grid grid-cols-[34px_1fr_auto] items-center gap-2 rounded-md p-1 transition hover:bg-muted/60 premium-focus">
                  <img src={product.image} alt="" className="h-8 w-8 rounded border border-border bg-brand-raised object-contain p-0.5" />
                  <span className="min-w-0">
                    <span className="block line-clamp-1 text-xs font-semibold leading-snug text-foreground">{product.name}</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">{product.category}</span>
                  </span>
                  <span className="shrink-0 text-xs font-bold text-foreground">{formatPrice(product.price)}</span>
                </Link>
              ))}
            </div>
            <div className="mt-3 border-t border-border pt-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Bundle price</span>
                <span className="font-playfair text-xl font-bold text-saffron">
                  {formatPrice(bundleTotal)}
                </span>
              </div>
              {savings > 0 && <p className="mt-0.5 text-xs font-semibold text-tulsi">You save {formatPrice(savings)}</p>}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={addCompleteSet}
                className="min-h-10 rounded-lg border border-maroon bg-white px-3 py-2 text-xs font-bold text-maroon transition hover:bg-brand-soft premium-focus"
              >
                Add Set
              </button>
              <button
                type="button"
                onClick={buyCompleteSet}
                className="min-h-10 rounded-lg bg-saffron px-3 py-2 text-xs font-bold text-white transition hover:bg-maroon premium-focus"
              >
                Buy Now
              </button>
            </div>
          </div>
          <div className="overflow-x-auto pb-3">
            <div className="flex gap-3">
            {bundleProducts.map((product) => (
              <div key={product.id} className="w-[250px] flex-none sm:w-[248px] lg:w-[calc((100%_-_1.5rem)/3)] lg:min-w-[236px] lg:max-w-[260px]">
                <ProductCard product={product} variant="compact" />
              </div>
            ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
