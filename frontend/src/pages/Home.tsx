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
import { useProductStore } from '@/store/productStore';

const ICONS = {
  ornament: 'https://unpkg.com/lucide-static@latest/icons/flower-2.svg',
  latest: 'https://unpkg.com/lucide-static@latest/icons/sparkles.svg',
  newArrivals: 'https://unpkg.com/lucide-static@latest/icons/sparkle.svg',
  bestSellers: 'https://unpkg.com/lucide-static@latest/icons/trophy.svg',
  accessories: 'https://unpkg.com/lucide-static@latest/icons/gem.svg',
  prasadam: 'https://unpkg.com/lucide-static@latest/icons/leaf.svg',
  viewAll: 'https://unpkg.com/lucide-static@latest/icons/view.svg',
};

const Home = () => {
  const { products, getLatestProducts, getBestSellers, getNewArrivals, getByTag } = useProductStore();
  const latestProducts = getLatestProducts();
  const newArrivals = getNewArrivals();
  const bestSellingProducts = getBestSellers();
  const devotionalAccessories = getByTag('accessories');
  const sacredPrasadam = getByTag('prasadam');

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
        tag="JUST IN"
        title="New Arrivals"
        subtitle="Discover what's new at BrajMart"
        products={newArrivals}
        bgClass="bg-pearl"
        viewAllLink="/products?tag=new"
        titleIconUrl={ICONS.newArrivals}
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

      <BrajYatra />
      <Testimonials />
      <Footer />
    </div>
  );
};

export default Home;
