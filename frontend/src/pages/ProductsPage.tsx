import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X } from 'lucide-react';
import { useProductStore } from '@/store/productStore';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ProductCard from '@/components/product/ProductCard';
import ProductGridSkeleton from '@/components/product/ProductGridSkeleton';
import CommerceEmptyState from '@/components/ui/CommerceEmptyState';
import SEO from '@/components/seo/SEO';
import { breadcrumbSchema } from '@/lib/seo';
import { fetchCollectionProducts, type PublicCollection } from '@/lib/api';
import type { Product } from '@/types/product';
import { compareProductsByQuality, hasReviewRating, isProductPurchasable } from '@/utils/productPresentation';

const tagLabels: Record<string, string> = {
  latest: 'Latest Products',
  new: 'New Arrivals',
  bestseller: 'Featured Products',
  accessories: 'Top Devotional Accessories',
  prasadam: 'Sacred Prasadam',
  exclusive: 'BrajMart Exclusive',
};

const purposeCollections: Record<string, { title: string; description: string; categories?: string[]; terms: string[] }> = {
  'daily-puja': {
    title: 'Daily Puja Essentials',
    description: 'Diyas, dhoop, thalis, fragrance, offerings and simple altar care for everyday worship.',
    categories: ['Incense/Pooja Items'],
    terms: ['puja', 'pooja', 'dhoop', 'diya', 'deepak', 'agarbatti', 'incense', 'chandan', 'itra', 'attar', 'kumkum', 'roli', 'kapoor', 'camphor', 'thali', 'tilak'],
  },
  'japa-meditation': {
    title: 'Japa & Meditation',
    description: 'Malas, bead bags and quiet devotional accessories for chanting and meditation.',
    categories: ['Accessories'],
    terms: ['japa', 'mala', 'tulsi', 'kanthi', 'kanti', 'bead', 'bag', 'rudraksha', 'chanting', 'meditation'],
  },
  'spiritual-reading': {
    title: 'Spiritual Reading',
    description: 'Bhagavad Gita, Prabhupada books and short devotional study titles.',
    categories: ['Books', 'Spiritual Books'],
    terms: ['book', 'books', 'gita', 'bhagavad', 'srimad', 'prabhupad', 'prabhupada', 'reading', 'hindi', 'bengali', 'yoga'],
  },
  'devotional-gifting': {
    title: 'Devotional Gifting',
    description: 'Meaningful devotional gifts across books, prasadam, idols and accessories.',
    categories: ['Prasadam', 'Books', 'Spiritual Books', 'Idols & Shringar', 'Accessories'],
    terms: ['gift', 'combo', 'set', 'prasadam', 'gita', 'idol', 'laddu gopal', 'bracelet', 'locket', 'mala'],
  },
  'home-temple': {
    title: 'Home Temple Essentials',
    description: 'Laddu Gopal products, shringar, idols and altar items for a clean home temple setup.',
    categories: ['Idols & Shringar', 'Incense/Pooja Items'],
    terms: ['laddu gopal', 'idol', 'idols', 'shringar', 'mukut', 'dress', 'altar', 'mandir', 'temple', 'brass', 'singhasan'],
  },
  prasadam: {
    title: 'Prasadam',
    description: 'Prasadam and devotional food offerings from the BrajMart catalog.',
    categories: ['Prasadam'],
    terms: ['prasadam', 'prasad', 'mahaprasadam', 'soan papdi', 'kuliya', 'temple prasadam'],
  },
  accessories: {
    title: 'Devotional Accessories',
    description: 'Bracelets, lockets, bags and everyday bhakti accessories.',
    categories: ['Accessories'],
    terms: ['accessories', 'bracelet', 'locket', 'bag', 'japa', 'mala', 'tulsi', 'ghungroo'],
  },
};

const normalize = (value: unknown) => String(value || '').toLowerCase().trim();

const productSearchText = (product: Product) =>
  [
    product.name,
    product.category,
    product.subcategory,
    product.description,
    product.badge,
    ...(product.tags || []),
    ...(product.attributes || []).flatMap((attribute) => [attribute.name, attribute.slug, ...(attribute.terms || [])]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const purposeProductScore = (
  product: Product,
  collection: { categories?: string[]; terms: string[] },
) => {
  const category = normalize(product.category);
  const text = productSearchText(product);
  const categoryScore = collection.categories?.some((item) => normalize(item) === category) ? 8 : 0;
  const termScore = collection.terms.reduce((score, term) => score + (text.includes(normalize(term)) ? 2 : 0), 0);
  return categoryScore + termScore;
};

const mapApiProducts = (items: unknown[]): Product[] =>
  items.map((item) => {
    const product = item as Product & { _id?: string };
    const tags = Array.isArray(product.tags) ? product.tags : (product.badge ? [product.badge] : []);
    return { ...product, id: product.id || product._id || '', tags };
  });

const setOrDelete = (params: URLSearchParams, key: string, value: string) => {
  if (value) params.set(key, value);
  else params.delete(key);
};

const ProductsPage = () => {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [managedCollection, setManagedCollection] = useState<PublicCollection | null>(null);
  const [managedProducts, setManagedProducts] = useState<Product[] | null>(null);
  const [collectionLoading, setCollectionLoading] = useState(false);

  const tag = params.get('tag') || '';
  const category = params.get('category') || '';
  const purpose = params.get('purpose') || '';
  const sort = params.get('sort') || 'featured';
  const availability = params.get('availability') || '';
  const minPrice = Number(params.get('min') || 0);
  const maxPrice = Number(params.get('max') || 0);
  const minRating = Number(params.get('rating') || 0);
  const purposeCollection = purposeCollections[purpose];
  const { products, categories, lastFetchedAt, loading, error, loadFromApi } = useProductStore();

  useEffect(() => {
    if (products.length > 0 || loading || lastFetchedAt > 0) return;
    loadFromApi({ force: true }).catch(() => undefined);
  }, [lastFetchedAt, loadFromApi, loading, products.length]);

  useEffect(() => {
    let cancelled = false;
    setManagedCollection(null);
    setManagedProducts(null);
    if (!purpose) return;

    setCollectionLoading(true);
    fetchCollectionProducts(purpose)
      .then((data) => {
        if (cancelled) return;
        setManagedCollection(data.collection);
        setManagedProducts(mapApiProducts(Array.isArray(data.products) ? data.products : []));
      })
      .catch(() => {
        if (cancelled) return;
        setManagedCollection(null);
        setManagedProducts(null);
      })
      .finally(() => {
        if (!cancelled) setCollectionLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [purpose]);

  const baseProducts = useMemo(() => {
    if (purpose && managedProducts) return managedProducts;
    if (purposeCollection) {
      return products
        .map((product) => ({ product, score: purposeProductScore(product, purposeCollection) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score || compareProductsByQuality(a.product, b.product))
        .map((item) => item.product);
    }
    if (tag) return products.filter((product) => product.tags?.includes(tag));
    if (category) return products.filter((product) => product.category.toLowerCase() === category.toLowerCase());
    return products;
  }, [category, managedProducts, products, purpose, purposeCollection, tag]);

  const hasRealRatings = baseProducts.some(hasReviewRating);

  const filtered = useMemo(() => {
    const next = baseProducts
      .filter((product) => !minPrice || Number(product.price) >= minPrice)
      .filter((product) => !maxPrice || Number(product.price) <= maxPrice)
      .filter((product) => !minRating || (hasReviewRating(product) && Number(product.rating || 0) >= minRating))
      .filter((product) => availability !== 'in_stock' || isProductPurchasable(product));

    const sorted = [...next];
    if (sort === 'price_asc') sorted.sort((a, b) => Number(a.price) - Number(b.price));
    else if (sort === 'price_desc') sorted.sort((a, b) => Number(b.price) - Number(a.price));
    else if (sort === 'popular') sorted.sort(compareProductsByQuality);
    else if (sort === 'newest') sorted.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    else sorted.sort(compareProductsByQuality);
    return sorted;
  }, [availability, baseProducts, maxPrice, minPrice, minRating, sort]);

  const title = managedCollection?.name
    || purposeCollection?.title
    || (tag ? (tagLabels[tag] || `Products: ${tag}`) : category ? `Category: ${category}` : 'All Products');
  const description = managedCollection?.description
    || (tag
      ? `Shop ${title.toLowerCase()} from BrajMart, including puja items, devotional accessories, prasadam and spiritual essentials from Vrindavan.`
      : purposeCollection
      ? `${purposeCollection.description} Carefully selected spiritual products from BrajMart.`
      : category
      ? `Shop authentic ${category.toLowerCase()} online from BrajMart. Curated spiritual products from Vrindavan with reliable delivery across India.`
      : 'Shop authentic puja items, spiritual books, prasadam, deity idols and devotional accessories from Vrindavan. Delivered across India by BrajMart.');
  const pageTitle = purposeCollection || managedCollection
    ? `${title} Online | BrajMart`
    : category
    ? `${category} Online | BrajMart`
    : tag
    ? `${title} | BrajMart`
    : 'Shop Puja Items, Spiritual Books & Prasadam Online | BrajMart';
  const indexableParams = new URLSearchParams();
  if (purposeCollection || managedCollection) indexableParams.set('purpose', purpose);
  if (tag) indexableParams.set('tag', tag);
  if (category) indexableParams.set('category', category);
  const path = `${location.pathname}${indexableParams.toString() ? `?${indexableParams.toString()}` : ''}`;
  const hasFacetFilters = Boolean(minPrice || maxPrice || minRating || availability || sort !== 'featured');
  const hasAttemptedCatalogLoad = lastFetchedAt > 0 || Boolean(error);
  const collectionIsMissing = !loading && hasAttemptedCatalogLoad && filtered.length === 0 && Boolean(tag || category || purposeCollection || managedCollection);
  const isPageLoading = loading || collectionLoading;

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    setOrDelete(next, key, value);
    setParams(next);
  };

  const clearFilters = () => {
    const next = new URLSearchParams(params);
    ['min', 'max', 'rating', 'availability', 'sort'].forEach((key) => next.delete(key));
    setParams(next);
  };

  const activeChips = [
    minPrice ? `From ${minPrice}` : '',
    maxPrice ? `Up to ${maxPrice}` : '',
    availability === 'in_stock' ? 'In stock' : '',
    minRating ? `${minRating}+ rated` : '',
    sort !== 'featured' ? `Sort: ${sort.replace('_', ' ')}` : '',
  ].filter(Boolean);

  const filterControls = (
    <div className="space-y-4">
      <label className="block text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
        Category
        <select value={category} onChange={(e) => updateParam('category', e.target.value)} className="mt-2 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-normal normal-case tracking-normal">
          <option value="">All Categories</option>
          {categories.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
        </select>
      </label>
      <label className="block text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
        Tag
        <select value={tag} onChange={(e) => updateParam('tag', e.target.value)} className="mt-2 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-normal normal-case tracking-normal">
          <option value="">All Tags</option>
          <option value="latest">Latest</option>
          <option value="new">New</option>
          <option value="bestseller">Featured</option>
          <option value="accessories">Accessories</option>
          <option value="prasadam">Prasadam</option>
          <option value="exclusive">Exclusive</option>
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <input type="number" min={0} value={minPrice || ''} onChange={(e) => updateParam('min', e.target.value)} placeholder="Min price" className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm" />
        <input type="number" min={0} value={maxPrice || ''} onChange={(e) => updateParam('max', e.target.value)} placeholder="Max price" className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm" />
      </div>
      <label className="block text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
        Availability
        <select value={availability} onChange={(e) => updateParam('availability', e.target.value)} className="mt-2 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-normal normal-case tracking-normal">
          <option value="">All products</option>
          <option value="in_stock">In stock only</option>
        </select>
      </label>
      {hasRealRatings && (
        <label className="block text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Rating
          <select value={minRating || ''} onChange={(e) => updateParam('rating', e.target.value)} className="mt-2 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-normal normal-case tracking-normal">
            <option value="">All Ratings</option>
            <option value="4">4 star and up</option>
            <option value="3">3 star and up</option>
          </select>
        </label>
      )}
    </div>
  );

  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: filtered.slice(0, 24).map((product, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: `https://www.brajmart.com/product/${product.slug}`,
        name: product.name,
      })),
    },
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={pageTitle}
        description={description}
        path={path}
        robots={hasFacetFilters || collectionIsMissing ? 'noindex,follow' : 'index,follow'}
        schema={[breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Shop', path: '/products' }]), collectionSchema]}
      />
      <AnnouncementBar />
      <Navbar />

      <main className="container mx-auto px-4 py-6 md:py-8">
        <div className="mb-5 flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-saffron">Home</Link>
          <span>/</span>
          <span className="text-foreground">{title}</span>
        </div>

        <div className="mb-6 flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-playfair text-3xl font-bold leading-tight text-maroon md:text-4xl">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setMobileFiltersOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-bold lg:hidden">
              <SlidersHorizontal size={16} />
              Filter
            </button>
            <select value={sort} onChange={(e) => updateParam('sort', e.target.value)} className="min-h-11 rounded-lg border border-border bg-card px-3 py-2 text-sm">
              <option value="featured">Featured</option>
              <option value="popular">Recommended</option>
              <option value="newest">Newest</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
            </select>
          </div>
        </div>

        {activeChips.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {activeChips.map((chip) => (
              <span key={chip} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground">{chip}</span>
            ))}
            <button type="button" onClick={clearFilters} className="rounded-full px-3 py-1.5 text-xs font-bold text-saffron hover:bg-brand-soft">
              Clear All
            </button>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="hidden rounded-lg border border-border bg-card p-4 shadow-sm lg:block">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground">Filters</h2>
              {activeChips.length > 0 && <button type="button" onClick={clearFilters} className="text-xs font-bold text-saffron">Clear</button>}
            </div>
            {filterControls}
          </aside>

          <section>
            <div className="mb-4 text-sm text-muted-foreground">{filtered.length} products</div>
            {isPageLoading ? (
              <ProductGridSkeleton count={10} />
            ) : filtered.length > 0 ? (
              <div className="product-grid grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fill,218px)] sm:justify-center sm:gap-3 md:grid-cols-[repeat(auto-fill,236px)] md:gap-4 lg:grid-cols-[repeat(auto-fill,250px)]">
                {filtered.map((product, i) => (
                  <ProductCard key={product.id} product={product} index={i} variant="compact" />
                ))}
              </div>
            ) : (
              <CommerceEmptyState message="Try another devotional need, remove filters, or browse the complete BrajMart catalog." />
            )}
          </section>
        </div>
      </main>

      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 lg:hidden" role="dialog" aria-modal="true" aria-label="Product filters">
          <div className="ml-auto flex h-full w-[min(88vw,360px)] flex-col bg-background shadow-xl">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h2 className="font-bold text-foreground">Filter Products</h2>
              <button type="button" onClick={() => setMobileFiltersOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted" aria-label="Close filters">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">{filterControls}</div>
            <div className="border-t border-border p-4">
              <button type="button" onClick={() => setMobileFiltersOpen(false)} className="min-h-11 w-full rounded-lg bg-maroon px-4 py-2 text-sm font-bold text-white">
                Show Products
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default ProductsPage;
