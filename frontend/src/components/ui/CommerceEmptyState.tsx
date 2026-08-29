import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';

type CommerceEmptyStateProps = {
  title?: string;
  message?: string;
  suggestions?: string[];
};

const CommerceEmptyState = ({
  title = "We couldn't find that yet",
  message = 'Try a nearby devotional need or browse the full BrajMart collection.',
  suggestions = ['Prasadam', 'Tulsi Mala', 'Bhagavad Gita', 'Puja Items'],
}: CommerceEmptyStateProps) => (
  <div className="mx-auto max-w-2xl rounded-lg border border-border bg-card px-5 py-10 text-center shadow-sm">
    <Search size={34} className="mx-auto mb-4 text-saffron" aria-hidden="true" />
    <h2 className="font-playfair text-2xl font-bold text-foreground">{title}</h2>
    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{message}</p>
    <div className="mt-5 flex flex-wrap justify-center gap-2">
      {suggestions.map((item) => (
        <Link
          key={item}
          to={`/search?q=${encodeURIComponent(item)}`}
          className="min-h-10 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:border-saffron hover:text-saffron premium-focus"
        >
          {item}
        </Link>
      ))}
    </div>
    <Link
      to="/products"
      className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-maroon px-5 py-2 text-sm font-bold text-white transition hover:bg-saffron premium-focus"
    >
      Browse All Products
    </Link>
  </div>
);

export default CommerceEmptyState;
