import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "./pages/Home";
import { fetchPublicSettings } from "./lib/api";
import { useSettingsStore } from "./store/settingsStore";
import { useProductStore } from "./store/productStore";
import { useCartStore } from "./store/cartStore";
import { useAuthStore } from "./store/authStore";
import { useWishlistStore } from "./store/wishlistStore";
import { DEFAULT_IMAGE, SITE_URL } from "./lib/seo";
import WhatsAppButton from "./components/layout/WhatsAppButton";

const queryClient = new QueryClient();
const DEFAULT_FAVICON_URL = "/favicon.ico";
const runWhenIdle = (callback: () => void, timeout = 1200) => {
  if (typeof window === 'undefined') {
    callback();
    return () => undefined;
  }
  const requestIdle = window.requestIdleCallback;
  if (requestIdle) {
    const id = requestIdle(callback, { timeout });
    return () => window.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(callback, timeout);
  return () => window.clearTimeout(id);
};
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage"));
const OAuthCallbackPage = lazy(() => import("./pages/OAuthCallbackPage"));
const VerifyOtpPage = lazy(() => import("./pages/VerifyOtpPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const CartPage = lazy(() => import("./pages/CartPage"));
const WishlistPage = lazy(() => import("./pages/WishlistPage"));
const CategoryPage = lazy(() => import("./pages/CategoryPage"));
const ProductDetailPage = lazy(() => import("./pages/ProductDetailPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const BlogPage = lazy(() => import("./pages/BlogPage"));
const BlogPostPage = lazy(() => import("./pages/BlogPostPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const HelpCenterPage = lazy(() => import("./pages/HelpCenterPage"));
const CustomerServicePage = lazy(() => import("./pages/CustomerServicePage"));
const ShippingDeliveryPage = lazy(() => import("./pages/ShippingDeliveryPage"));
const ReturnPolicyPage = lazy(() => import("./pages/ReturnPolicyPage"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));
const PaymentMethodPage = lazy(() => import("./pages/PaymentMethodPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const ComparePage = lazy(() => import("./pages/ComparePage"));
const ProductsPage = lazy(() => import("./pages/ProductsPage"));
const CategoriesPage = lazy(() => import("./pages/CategoriesPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const BrajDarshanPage = lazy(() => import("./pages/BrajDarshanPage"));
const UserOrderTracking = lazy(() => import("./pages/UserOrderTracking"));
const PaymentStatusPage = lazy(() => import("./pages/PaymentStatusPage"));
const ProfileOrdersPage = lazy(() => import("./pages/ProfileOrdersPage"));
const ProfileAddressesPage = lazy(() => import("./pages/ProfileAddressesPage"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts"));
const AdminCategories = lazy(() => import("./pages/admin/AdminCategories"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminShipments = lazy(() => import("./pages/admin/AdminShipments"));
const AdminPayments = lazy(() => import("./pages/admin/AdminPayments"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminHero = lazy(() => import("./pages/admin/AdminHero"));
const AdminBlogs = lazy(() => import("./pages/admin/AdminBlogs"));

const LegacyCategoryRedirect = () => {
  const { slug } = useParams();
  return <Navigate to={`/category/${slug || ''}`} replace />;
};

const App = () => {
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const settings = useSettingsStore((s) => s.settings);
  const loadProducts = useProductStore((s) => s.loadFromApi);
  const loadCart = useCartStore((s) => s.loadFromApi);
  const clearWishlist = useWishlistStore((s) => s.clear);
  const authToken = useAuthStore((s) => s.token);
  const brandImage = settings.storeLogo || DEFAULT_IMAGE;
  const favicon = settings.favicon || DEFAULT_FAVICON_URL;
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Brajmart",
    url: SITE_URL,
    logo: DEFAULT_IMAGE,
  };
  const sanitizeBadges = (badges?: string[]) =>
    (badges || []).filter((b) => !/\bCOD\b/i.test(b) && !/cash on delivery/i.test(b));

  useEffect(() => {
    let active = true;
    const loadSettings = async () => {
      try {
        const data = await fetchPublicSettings();
        if (!active || !data) return;
          updateSettings({
          storeName: data.storeName,
          tagline: data.tagline,
          currency: data.currency,
          freeShippingThreshold: data.freeShippingThreshold,
          shippingFee: data.shippingFee,
          storeEmail: data.storeEmail,
          storePhone: data.storePhone,
          storeAddress: data.storeAddress,
          taxRate: data.taxRate,
          minOrderAmount: data.minOrderAmount,
          maxOrderQuantity: data.maxOrderQuantity,
          deliveryEtaMinDays: data.deliveryEtaMinDays ?? 3,
          deliveryEtaMaxDays: data.deliveryEtaMaxDays ?? 7,
          upiEnabled: data.upiEnabled,
          cardEnabled: data.cardEnabled,
          maintenanceMode: data.maintenanceMode,
          metaTitle: data.metaTitle,
          metaDescription: data.metaDescription,
          storeLogo: data.storeLogo,
          favicon: data.favicon,
          socialLinks: data.socialLinks,
          announcementBar: data.announcementBar,
          notifications: data.notifications,
          heroBadges: sanitizeBadges(data.heroBadges),
        });
      } catch {
        // Keep locally persisted defaults
      }
    };
    loadSettings();
    return () => { active = false; };
  }, [updateSettings]);

  useEffect(() => {
    const isAdminPath = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
    if (isAdminPath) {
      loadProducts();
      return;
    }
    return runWhenIdle(() => {
      loadProducts();
    });
  }, [loadProducts]);

  useEffect(() => {
    if (authToken) loadCart();
  }, [authToken, loadCart]);

  useEffect(() => {
    if (!authToken) {
      clearWishlist();
      return;
    }
    useWishlistStore.persist.rehydrate();
  }, [authToken, clearWishlist]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Helmet>
          <meta name="author" content={settings.storeName} />
          <meta property="og:image" content={brandImage} />
          <meta name="twitter:image" content={brandImage} />
          <link rel="icon" href={favicon} />
          <script type="application/ld+json">{JSON.stringify(organizationSchema)}</script>
        </Helmet>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<div className="min-h-screen bg-background" />}>
          <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/verify-otp" element={<VerifyOtpPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/oauth-callback" element={<OAuthCallbackPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/wishlist" element={<WishlistPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/orders" element={<ProfileOrdersPage />} />
          <Route path="/profile/addresses" element={<ProfileAddressesPage />} />
          <Route path="/orders" element={<ProfileOrdersPage />} />
          <Route path="/track-orders" element={<UserOrderTracking />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/category/:slug" element={<CategoryPage />} />
          <Route path="/category/:slug/:subSlug" element={<CategoryPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/product/:slug" element={<ProductDetailPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/shop" element={<ProductsPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/help-center" element={<HelpCenterPage />} />
          <Route path="/customer-service" element={<CustomerServicePage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/track-order" element={<UserOrderTracking />} />
          <Route path="/shipping-delivery" element={<ShippingDeliveryPage />} />
          <Route path="/return-policy" element={<ReturnPolicyPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/payment-method" element={<PaymentMethodPage />} />
          <Route path="/payment-status/:token" element={<PaymentStatusPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/braj-darshan/:slug" element={<BrajDarshanPage />} />
          <Route path="/product-category/:slug" element={<LegacyCategoryRedirect />} />

          {/* Admin Routes */}
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/*" element={<AdminLayout />}>
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="blogs" element={<AdminBlogs />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="shipments" element={<AdminShipments />} />
            <Route path="payments" element={<AdminPayments />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="hero" element={<AdminHero />} />
          </Route>

          <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          <WhatsAppButton />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
