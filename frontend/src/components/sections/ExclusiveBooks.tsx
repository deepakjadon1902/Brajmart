import { Link } from 'react-router-dom';
import { ScrollReveal } from '../ui/ScrollReveal';
import { useProductStore } from '@/store/productStore';

const isBookCategory = (value: string) => value.toLowerCase().includes('book');

const ExclusiveBooks = () => {
  const { products } = useProductStore();
  const exclusiveBooks = products.filter(
    (p) => (p.tags || []).includes('exclusive') && isBookCategory(p.category || '')
  );
  const bookProducts = products.filter((p) => isBookCategory(p.category || ''));
  const heroBooks = [
    ...exclusiveBooks,
    ...bookProducts.filter((book) => !exclusiveBooks.some((exclusive) => exclusive.id === book.id)),
  ].slice(0, 4);

  return (
    <section className="relative py-16 md:py-28 overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=1600&h=700&fit=crop')] bg-cover bg-center" />
      <div className="absolute inset-0 bg-gradient-to-r from-maroon-dark/95 via-maroon/85 to-maroon-dark/75" />
      <div className="absolute right-0 top-0 hidden h-full w-[48%] md:block">
        <div className="absolute -right-20 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-gold/20 blur-2xl" />
        <div className="absolute right-10 top-1/2 grid -translate-y-1/2 grid-cols-4 gap-3 lg:right-14 lg:gap-4">
          {heroBooks.map((book, index) => (
            <Link
              key={book.id}
              to="/category/spiritual-books"
              className={`block h-44 w-24 overflow-hidden rounded-sm border border-gold/30 bg-card shadow-2xl transition-transform hover:-translate-y-1 lg:h-48 lg:w-28 xl:w-32 ${
                index % 2 === 1 ? 'mt-10' : ''
              }`}
              aria-label={`Browse books like ${book.name}`}
            >
              <img src={book.image} alt={book.name} className="h-full w-full object-cover" loading="lazy" decoding="async" />
            </Link>
          ))}
        </div>
      </div>

      <div className="relative container mx-auto px-4 text-center">
        <ScrollReveal>
          <span className="inline-block px-4 py-1.5 rounded-full bg-gold-gradient text-maroon-dark text-xs font-bold mb-4">
              BRAJMART EXCLUSIVE
          </span>
          <h2 className="font-cinzel text-2xl sm:text-3xl md:text-5xl font-bold text-primary-foreground leading-tight mb-3">
            Brajmart Exclusive Books
          </h2>
          <h3 className="font-playfair italic text-gold-light text-lg mb-6">
            Read, Reflect & Realize the Divine
          </h3>
          <p className="text-primary-foreground/70 text-sm max-w-lg mx-auto mb-8">
            Explore Srila Prabhupada&apos;s timeless wisdom, Bhagavad Gita As It Is, Srimad Bhagavatam, and sacred scriptures for sincere devotees.
          </p>
          <Link
            to="/products?tag=exclusive&category=Books"
            className="inline-flex px-8 py-3.5 rounded-full bg-gold-gradient text-maroon-dark font-bold shimmer active:scale-[0.97] transition-transform shadow-xl text-sm"
          >
            Browse All Books -&gt;
          </Link>
        </ScrollReveal>
      </div>
    </section>
  );
};

export default ExclusiveBooks;
