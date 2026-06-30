import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { getInitialData } from '@/lib/initialData';

const labels: Record<string, string> = {
  products: 'All Products', categories: 'Categories', about: 'About Us', contact: 'Contact Us',
  blog: 'Blog', 'help-center': 'Help Center', 'customer-service': 'Customer Service',
  'shipping-delivery': 'Shipping and Delivery', 'return-policy': 'Return Policy',
  'privacy-policy': 'Privacy Policy', 'payment-method': 'Payment Methods', terms: 'Terms and Conditions',
  'braj-darshan': 'Braj Darshan',
};

const indexableRoots = new Set(Object.keys(labels));

const titleCase = (value: string) => value.split('-').filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');

const PublicBreadcrumbs = () => {
  const { pathname } = useLocation();
  if (pathname === '/' || pathname.startsWith('/category/') || pathname.startsWith('/product/')) return null;
  const parts = pathname.split('/').filter(Boolean);
  if (!parts.length || !indexableRoots.has(parts[0])) return null;
  const initialData = getInitialData();
  return (
    <nav aria-label="Breadcrumb" className="border-b border-border bg-background">
      <ol className="container mx-auto flex flex-wrap items-center gap-1.5 px-4 py-2 text-xs text-muted-foreground">
        <li><Link to="/" className="hover:text-saffron">Home</Link></li>
        {parts.map((part, index) => {
          const href = `/${parts.slice(0, index + 1).join('/')}`;
          const blogTitle = parts[0] === 'blog' && index === 1
            ? initialData?.blogs.find((post) => post.slug === part)?.title
            : '';
          const label = blogTitle || labels[part] || titleCase(part);
          const current = index === parts.length - 1;
          return (
            <li key={href} className="flex items-center gap-1.5">
              <ChevronRight size={12} aria-hidden="true" />
              {current ? <span aria-current="page" className="text-foreground">{label}</span> : <Link to={href} className="hover:text-saffron">{label}</Link>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default PublicBreadcrumbs;
