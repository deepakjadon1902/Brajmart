import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Navbar from '@/components/layout/Navbar';
import CategoryNavbar from '@/components/layout/CategoryNavbar';
import HeroCarousel from '@/components/hero/HeroCarousel';
import CollectionSection from '@/components/sections/CollectionSection';
import ExclusiveBooks from '@/components/sections/ExclusiveBooks';
import ExclusiveShop from '@/components/sections/ExclusiveShop';
import BrajYatra from '@/components/sections/BrajYatra';
import Testimonials from '@/components/sections/Testimonials';
import Footer from '@/components/layout/Footer';
import { useProductStore, categoryToSlug } from '@/store/productStore';

const ICONS = {
  ornament: 'https://unpkg.com/lucide-static@latest/icons/flower-2.svg',
  latest: 'https://unpkg.com/lucide-static@latest/icons/sparkles.svg',
  bestSellers: 'https://unpkg.com/lucide-static@latest/icons/trophy.svg',
  accessories: 'https://unpkg.com/lucide-static@latest/icons/gem.svg',
  prasadam: 'https://unpkg.com/lucide-static@latest/icons/leaf.svg',
  viewAll: 'https://unpkg.com/lucide-static@latest/icons/view.svg',
};

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

  return (
    <div className="min-h-screen bg-background">
      <AnnouncementBar />
      <Navbar />
      <CategoryNavbar />
      <HeroCarousel />

      <CollectionSection
        tag="BRAJMART COLLECTION"
        title="Latest Products"
        subtitle="Fresh arrivals from the divine lands of Braj"
        products={latestProducts}
        viewAllLink="/products?tag=latest"
        titleIconUrl={ICONS.latest}
        viewAllIconUrl={ICONS.viewAll}
        ornamentIconUrl={ICONS.ornament}
      />

      <CollectionSection
        tag="MOST LOVED"
        title="Best Selling Products"
        subtitle="Top picks from our devotee community"
        products={bestSellingProducts}
        viewAllLink="/products?tag=bestseller"
        titleIconUrl={ICONS.bestSellers}
        viewAllIconUrl={ICONS.viewAll}
        ornamentIconUrl={ICONS.ornament}
      />

      {categorySections.filter((c) => !isBrajmartSpecial(c.name) && !isPrasadam(c.name)).map((cat, idx) => (
        <CollectionSection
          key={cat.id}
          tag="CATEGORY"
          title={cat.name}
          subtitle={`Explore ${cat.name} collection`}
          products={getProductsByCategory(cat.name).slice(0, 10)}
          bgClass={idx % 2 === 0 ? 'bg-pearl' : ''}
          viewAllLink={`/category/${categoryToSlug(cat.name)}`}
          titleIconUrl={undefined}
          viewAllIconUrl={ICONS.viewAll}
          ornamentIconUrl={ICONS.ornament}
        />
      ))}

      <ExclusiveBooks />

      <CollectionSection
        tag="BRAJMART COLLECTION"
        title="Top Devotional Accessories"
        subtitle="Malas, Rudraksha, Bracelets & More"
        products={(devotionalAccessories.length ? devotionalAccessories : products.filter(p => p.category === 'Accessories')).slice(0, 6)}
        bgClass="bg-pearl"
        viewAllLink="/products?tag=accessories"
        titleIconUrl={ICONS.accessories}
        viewAllIconUrl={ICONS.viewAll}
        ornamentIconUrl={ICONS.ornament}
      />

      <ExclusiveShop />

      <CollectionSection
        tag="SACRED OFFERINGS"
        title="Sacred Prasadam Collection"
        subtitle="Taste the Blessings of Vrindavan's Sacred Temples"
        products={(sacredPrasadam.length ? sacredPrasadam : products.filter(p => p.category === 'Prasadam')).slice(0, 5)}
        viewAllLink="/products?tag=prasadam"
        titleIconUrl={ICONS.prasadam}
        viewAllIconUrl={ICONS.viewAll}
        ornamentIconUrl={ICONS.ornament}
      />

      {brajmartSpecialCategory && (
        <CollectionSection
          tag="CATEGORY"
          title={brajmartSpecialCategory.name}
          subtitle={`Explore ${brajmartSpecialCategory.name} collection`}
          products={getProductsByCategory(brajmartSpecialCategory.name).slice(0, 10)}
          bgClass="bg-pearl"
          viewAllLink={`/category/${categoryToSlug(brajmartSpecialCategory.name)}`}
          titleIconUrl={undefined}
          viewAllIconUrl={ICONS.viewAll}
          ornamentIconUrl={ICONS.ornament}
        />
      )}

      <BrajYatra />
      <Testimonials />
      <Footer />
    </div>
  );
};

export default Home;
