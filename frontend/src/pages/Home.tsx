import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Navbar from '@/components/layout/Navbar';
import CategoryNavbar from '@/components/layout/CategoryNavbar';
import HeroCarousel from '@/components/hero/HeroCarousel';
import DeferredMount from '@/components/ui/DeferredMount';
import { useProductStore, categoryToSlug } from '@/store/productStore';
import SEO from '@/components/seo/SEO';
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, SITE_URL, breadcrumbSchema } from '@/lib/seo';
import TrustBar from '@/components/sections/TrustBar';
import {
  BrajStory,
  BundledFavorites,
  NewsletterEngagement,
  PurposeDiscovery,
  WhyBrajMart,
} from '@/components/sections/HomeExperience';
import CollectionSection from '@/components/sections/CollectionSection';
import ExclusiveBooks from '@/components/sections/ExclusiveBooks';
import ExclusiveShop from '@/components/sections/ExclusiveShop';
import BrajYatra from '@/components/sections/BrajYatra';
import Testimonials from '@/components/sections/Testimonials';
import Footer from '@/components/layout/Footer';

const displayCategoryName = (name: string) =>
  (name || '').trim().toLowerCase() === 'best selling' ? 'Most Selling Products' : name;

const Home = () => {
  const { products, categories, getBestSellers, getByTag, getProductsByCategory } = useProductStore();
  const bestSellingProducts = getBestSellers();
  const devotionalAccessories = getByTag('accessories');
  // Show every category as a home-page section (even if a category currently has 0 products).
  // This matches the "all categories on home" requirement and avoids hiding categories due to naming mismatches.
  const categorySections = categories || [];
  const isBrajmartSpecial = (name: string) => (name || '').trim().toLowerCase() === 'brajmart special';
  const isPrasadam = (name: string) => (name || '').trim().toLowerCase() === 'prasadam';
  const isBooks = (name: string) => ['books', 'spiritual books'].includes((name || '').trim().toLowerCase());
  const brajmartSpecialCategory = categorySections.find((c) => isBrajmartSpecial(c.name));
  const regularCategories = categorySections.filter((c) => !isBrajmartSpecial(c.name) && !isPrasadam(c.name));
  const prasadamCategory = categorySections.find((c) => isPrasadam(c.name));
  const booksIndex = regularCategories.findIndex((c) => isBooks(c.name));
  const orderedCategories = prasadamCategory
    ? [
        ...regularCategories.slice(0, booksIndex >= 0 ? booksIndex : regularCategories.length),
        prasadamCategory,
        ...regularCategories.slice(booksIndex >= 0 ? booksIndex : regularCategories.length),
      ]
    : regularCategories;
  const homeSchema = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Brajmart',
      url: SITE_URL,
      logo: `${SITE_URL}/logo.png`,
      description:
        'Authentic spiritual and devotional products from Vrindavan, Mathura. Tulsi Malas, Prasadam, Puja Items, Deity Idols and Braj Yatra services delivered across India.',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Vrindavan',
        addressLocality: 'Mathura',
        addressRegion: 'Uttar Pradesh',
        postalCode: '281121',
        addressCountry: 'IN',
      },
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: '+91-9634359003',
        contactType: 'customer service',
        availableLanguage: ['Hindi', 'English'],
      },
      sameAs: [
        'https://www.instagram.com/brajmart_official',
        'https://www.facebook.com/brajmart',
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Brajmart',
      url: SITE_URL,
    },
    breadcrumbSchema([{ name: 'Home', path: '/' }]),
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEO title={DEFAULT_TITLE} description={DEFAULT_DESCRIPTION} path="/" schema={homeSchema} />
      <AnnouncementBar />
      <Navbar />
      <CategoryNavbar />
      <HeroCarousel />
      <TrustBar />
      <PurposeDiscovery categories={categories} />

      {brajmartSpecialCategory && (
        <DeferredMount minHeight={390}>
          <CollectionSection
            tag="BRAJMART COLLECTION"
            title={displayCategoryName(brajmartSpecialCategory.name)}
            subtitle={`Explore ${displayCategoryName(brajmartSpecialCategory.name)} collection`}
            products={getProductsByCategory(brajmartSpecialCategory.name)}
            viewAllLink={`/category/${categoryToSlug(brajmartSpecialCategory.name)}`}
            priority
          />
        </DeferredMount>
      )}

      <DeferredMount minHeight={390}>
        <CollectionSection
          tag="MOST LOVED"
          title="Most Selling Products"
          subtitle="Top picks from our devotee community"
          products={bestSellingProducts}
          viewAllLink="/products?tag=bestseller"
        />
      </DeferredMount>

      {prasadamCategory && (
        <DeferredMount minHeight={390}>
          <CollectionSection
            tag="PRASADAM COLLECTION"
            title={displayCategoryName(prasadamCategory.name)}
            subtitle="Blessed offerings selected for devotees and families"
            products={getProductsByCategory(prasadamCategory.name)}
            bgClass="bg-pearl"
            viewAllLink={`/category/${categoryToSlug(prasadamCategory.name)}`}
          />
        </DeferredMount>
      )}

      {orderedCategories.filter((cat) => !isPrasadam(cat.name)).slice(0, 4).map((cat, idx) => (
        <DeferredMount key={cat.id} minHeight={390}>
          <CollectionSection
            tag="CATEGORY"
            title={displayCategoryName(cat.name)}
            subtitle={`Explore ${displayCategoryName(cat.name)} collection`}
            products={getProductsByCategory(cat.name)}
            bgClass={idx % 2 === 0 ? 'bg-pearl' : ''}
            viewAllLink={`/category/${categoryToSlug(cat.name)}`}
          />
        </DeferredMount>
      ))}

      <DeferredMount minHeight={320}>
        <ExclusiveBooks />
      </DeferredMount>

      <DeferredMount minHeight={390}>
        <CollectionSection
          tag="BRAJMART COLLECTION"
          title="Top Devotional Accessories"
          subtitle="Malas, Rudraksha, Bracelets & More"
          products={devotionalAccessories.length ? devotionalAccessories : products.filter(p => p.category === 'Accessories')}
          bgClass="bg-pearl"
          viewAllLink="/products?tag=accessories"
        />
      </DeferredMount>

      <DeferredMount minHeight={220}>
        <WhyBrajMart />
      </DeferredMount>

      <DeferredMount minHeight={220}>
        <ExclusiveShop />
      </DeferredMount>

      <DeferredMount minHeight={220}>
        <BundledFavorites />
      </DeferredMount>

      <DeferredMount minHeight={120}>
        <BrajYatra />
      </DeferredMount>

      <DeferredMount rootMargin="420px 0px">
        <Testimonials />
      </DeferredMount>

      <DeferredMount minHeight={120} rootMargin="420px 0px">
        <BrajStory />
      </DeferredMount>

      <DeferredMount minHeight={180}>
        <NewsletterEngagement />
      </DeferredMount>

      <DeferredMount>
        <Footer />
      </DeferredMount>
    </div>
  );
};

export default Home;
