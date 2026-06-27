import { lazy, Suspense } from 'react';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Navbar from '@/components/layout/Navbar';
import CategoryNavbar from '@/components/layout/CategoryNavbar';
import HeroCarousel from '@/components/hero/HeroCarousel';
import DeferredMount from '@/components/ui/DeferredMount';
import { useProductStore, categoryToSlug } from '@/store/productStore';
import SEO from '@/components/seo/SEO';
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, SITE_URL, breadcrumbSchema } from '@/lib/seo';
import TrustBar from '@/components/sections/TrustBar';

const CollectionSection = lazy(() => import('@/components/sections/CollectionSection'));
const ExclusiveBooks = lazy(() => import('@/components/sections/ExclusiveBooks'));
const ExclusiveShop = lazy(() => import('@/components/sections/ExclusiveShop'));
const BrajYatra = lazy(() => import('@/components/sections/BrajYatra'));
const Testimonials = lazy(() => import('@/components/sections/Testimonials'));
const Footer = lazy(() => import('@/components/layout/Footer'));

const Home = () => {
  const { products, categories, getLatestProducts, getBestSellers, getByTag, getProductsByCategory } = useProductStore();
  const latestProducts = getLatestProducts();
  const bestSellingProducts = getBestSellers();
  const devotionalAccessories = getByTag('accessories');
  const sacredPrasadam = getByTag('prasadam');
  // Show every category as a home-page section (even if a category currently has 0 products).
  // This matches the "all categories on home" requirement and avoids hiding categories due to naming mismatches.
  const categorySections = categories || [];
  const isBrajmartSpecial = (name: string) => (name || '').trim().toLowerCase() === 'brajmart special';
  const isPrasadam = (name: string) => (name || '').trim().toLowerCase() === 'prasadam';
  const brajmartSpecialCategory = categorySections.find((c) => isBrajmartSpecial(c.name));
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
      potentialAction: {
        '@type': 'SearchAction',
        target: `${SITE_URL}/search?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
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

      <Suspense fallback={null}>
        <DeferredMount minHeight={390}>
          <CollectionSection
            tag="BRAJMART COLLECTION"
            title="Latest Puja Items & Devotional Products"
            subtitle="Fresh arrivals from the divine lands of Braj"
            products={latestProducts}
            viewAllLink="/products?tag=latest"
          />
        </DeferredMount>

        <DeferredMount minHeight={390}>
          <CollectionSection
            tag="MOST LOVED"
            title="Best-Selling Puja Items & Devotional Products"
            subtitle="Top picks from our devotee community"
            products={bestSellingProducts}
            viewAllLink="/products?tag=bestseller"
          />
        </DeferredMount>

        {categorySections.filter((c) => !isBrajmartSpecial(c.name) && !isPrasadam(c.name)).map((cat, idx) => (
          <DeferredMount key={cat.id} minHeight={390}>
            <CollectionSection
              tag="CATEGORY"
              title={cat.name}
              subtitle={`Explore ${cat.name} collection`}
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

        <DeferredMount minHeight={320}>
          <ExclusiveShop />
        </DeferredMount>

        <DeferredMount minHeight={390}>
          <CollectionSection
            tag="SACRED OFFERINGS"
            title="Sacred Prasadam Collection"
            subtitle="Taste the Blessings of Vrindavan's Sacred Temples"
            products={sacredPrasadam.length ? sacredPrasadam : products.filter(p => p.category === 'Prasadam')}
            viewAllLink="/products?tag=prasadam"
          />
        </DeferredMount>

        {brajmartSpecialCategory && (
          <DeferredMount minHeight={390}>
            <CollectionSection
              tag="CATEGORY"
              title={brajmartSpecialCategory.name}
              subtitle={`Explore ${brajmartSpecialCategory.name} collection`}
              products={getProductsByCategory(brajmartSpecialCategory.name)}
              bgClass="bg-pearl"
              viewAllLink={`/category/${categoryToSlug(brajmartSpecialCategory.name)}`}
            />
          </DeferredMount>
        )}

        <DeferredMount minHeight={360}>
          <BrajYatra />
        </DeferredMount>

        

        <DeferredMount>
          <Footer />
        </DeferredMount>
      </Suspense>
    </div>
  );
};

export default Home;
