import { Link } from 'react-router-dom';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { useProductStore, categoryToSlug } from '@/store/productStore';

const CategoriesPage = () => {
  const categories = useProductStore((s) => s.categories);

  return (
    <div className="min-h-screen bg-background">
      <AnnouncementBar />
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <h1 className="font-cinzel text-2xl md:text-3xl font-bold text-maroon mb-6">All Categories</h1>
        {categories.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">No categories yet.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/category/${categoryToSlug(cat.name)}`}
                className="bg-card border border-border rounded-2xl p-4 flex flex-col items-center gap-3 hover:shadow-md transition"
              >
                <div className="w-20 h-20 rounded-full border border-gold/30 bg-pearl flex items-center justify-center text-3xl overflow-hidden">
                  {cat.icon && (cat.icon.startsWith('data:') || cat.icon.startsWith('http') || cat.icon.startsWith('/uploads')) ? (
                    <img src={cat.icon} alt={cat.name} className="w-full h-full object-cover" />
                  ) : (
                    cat.icon
                  )}
                </div>
                <span className="text-sm font-semibold font-cinzel text-foreground text-center">{cat.name}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default CategoriesPage;
