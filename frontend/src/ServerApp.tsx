import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense } from 'react';
import { Helmet } from 'react-helmet-async';
import { Route, Routes } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DEFAULT_IMAGE, SITE_URL } from '@/lib/seo';
import { useSettingsStore } from '@/store/settingsStore';
import Home from '@/pages/Home';
import CategoriesPage from '@/pages/CategoriesPage';
import CategoryPage from '@/pages/CategoryPage';
import ProductDetailPage from '@/pages/ProductDetailPage';
import ProductsPage from '@/pages/ProductsPage';
import AboutPage from '@/pages/AboutPage';
import BlogPage from '@/pages/BlogPage';
import BlogPostPage from '@/pages/BlogPostPage';
import ContactPage from '@/pages/ContactPage';
import HelpCenterPage from '@/pages/HelpCenterPage';
import CustomerServicePage from '@/pages/CustomerServicePage';
import ShippingDeliveryPage from '@/pages/ShippingDeliveryPage';
import ReturnPolicyPage from '@/pages/ReturnPolicyPage';
import PrivacyPolicyPage from '@/pages/PrivacyPolicyPage';
import PaymentMethodPage from '@/pages/PaymentMethodPage';
import TermsPage from '@/pages/TermsPage';
import BrajDarshanPage from '@/pages/BrajDarshanPage';
import NotFound from '@/pages/NotFound';
import RouteSEO from '@/components/seo/RouteSEO';
import WhatsAppButton from '@/components/layout/WhatsAppButton';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const ServerApp = () => {
  const settings = useSettingsStore((state) => state.settings);
  const brandImage = settings.storeLogo || DEFAULT_IMAGE;
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Helmet>
          <meta name="author" content={settings.storeName || 'Brajmart'} />
          <meta property="og:image" content={brandImage} />
          <meta name="twitter:image" content={brandImage} />
          <script type="application/ld+json">{JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            '@id': `${SITE_URL}/#organization`,
            name: settings.storeName || 'Brajmart',
            url: SITE_URL,
            logo: brandImage,
          })}</script>
        </Helmet>
        <Toaster />
        <Sonner />
        <RouteSEO />
        <Suspense fallback={<div className="min-h-screen bg-background" />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/category/:slug" element={<CategoryPage />} />
          <Route path="/category/:slug/:subSlug" element={<CategoryPage />} />
          <Route path="/product/:slug" element={<ProductDetailPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/help-center" element={<HelpCenterPage />} />
          <Route path="/customer-service" element={<CustomerServicePage />} />
          <Route path="/shipping-delivery" element={<ShippingDeliveryPage />} />
          <Route path="/return-policy" element={<ReturnPolicyPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/payment-method" element={<PaymentMethodPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/braj-darshan/:slug" element={<BrajDarshanPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
        <WhatsAppButton />
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default ServerApp;
