import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Category } from '@/types/product';

const purposeCards = [
  { title: 'Daily Puja', text: 'Dhoop, itra, chandan and sacred home-puja essentials.', purpose: 'daily-puja' },
  { title: 'Japa & Meditation', text: 'Tulsi malas, japa malas and bead bags.', purpose: 'japa-meditation' },
  { title: 'Spiritual Reading', text: 'Gita, Prabhupada books and devotional study.', purpose: 'spiritual-reading' },
  { title: 'Devotional Gifting', text: 'Thoughtful bhakti gifts for family and friends.', purpose: 'devotional-gifting' },
  { title: 'Home Temple', text: 'Laddu Gopal, shringar and altar accessories.', purpose: 'home-temple' },
  { title: 'Prasadam', text: 'Blessed sweets and offerings from Braj.', purpose: 'prasadam' },
  { title: 'Accessories', text: 'Bracelets, lockets, bags and daily bhakti items.', purpose: 'accessories' },
];

const PurposeDiscovery = ({ categories }: { categories: Category[] }) => {
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

export default PurposeDiscovery;
