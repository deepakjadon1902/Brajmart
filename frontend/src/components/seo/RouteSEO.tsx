import { useLocation } from 'react-router-dom';
import SEO from './SEO';
import { breadcrumbSchema } from '@/lib/seo';

const routeMeta: Record<string, { title: string; description: string; label: string }> = {
  '/customer-service': {
    title: 'Customer Service | Brajmart Support',
    description: 'Contact Brajmart customer service for help with orders, delivery, returns, refunds, payments and product concerns.',
    label: 'Customer Service',
  },
  '/shipping-delivery': {
    title: 'Shipping and Delivery Policy | Brajmart',
    description: 'Read Brajmart shipping charges, delivery timelines, Prasadam dispatch information, packaging standards and pan-India coverage.',
    label: 'Shipping and Delivery',
  },
  '/return-policy': {
    title: 'Return and Refund Policy | Brajmart',
    description: 'Understand Brajmart return eligibility, non-returnable products, refund timelines and the process for damaged or incorrect orders.',
    label: 'Return Policy',
  },
  '/privacy-policy': {
    title: 'Privacy Policy | Brajmart',
    description: 'Learn how Brajmart collects, uses, protects and retains customer information for accounts, orders, delivery and support.',
    label: 'Privacy Policy',
  },
  '/payment-method': {
    title: 'Secure Payment Methods | Brajmart',
    description: 'Review the secure payment methods supported by Brajmart, including UPI, cards, net banking and digital wallets.',
    label: 'Payment Methods',
  },
  '/terms': {
    title: 'Terms and Conditions | Brajmart',
    description: 'Read the terms governing Brajmart accounts, products, payments, orders, delivery, returns, intellectual property and website use.',
    label: 'Terms and Conditions',
  },
};

const RouteSEO = () => {
  const { pathname } = useLocation();
  const meta = routeMeta[pathname];
  if (!meta) return null;
  return (
    <SEO
      title={meta.title}
      description={meta.description}
      path={pathname}
      schema={breadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: meta.label, path: pathname },
      ])}
    />
  );
};

export default RouteSEO;
