import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "./pages/Home";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import CartPage from "./pages/CartPage";
import WishlistPage from "./pages/WishlistPage";
import CategoryPage from "./pages/CategoryPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import CheckoutPage from "./pages/CheckoutPage";
import ProfilePage from "./pages/ProfilePage";
import SearchPage from "./pages/SearchPage";
import AboutPage from "./pages/AboutPage";
import BlogPage from "./pages/BlogPage";
import ContactPage from "./pages/ContactPage";
import HelpCenterPage from "./pages/HelpCenterPage";
import CustomerServicePage from "./pages/CustomerServicePage";
import TrackOrderPage from "./pages/TrackOrderPage";
import ShippingDeliveryPage from "./pages/ShippingDeliveryPage";
import ReturnPolicyPage from "./pages/ReturnPolicyPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import PaymentMethodPage from "./pages/PaymentMethodPage";
import TermsPage from "./pages/TermsPage";
import ComparePage from "./pages/ComparePage";
import NotFound from "./pages/NotFound";
import BrajDarshanPage from "./pages/BrajDarshanPage";
import UserOrderTracking from "./pages/UserOrderTracking";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminShipments from "./pages/admin/AdminShipments";
import AdminPayments from "./pages/admin/AdminPayments";
import AdminSettings from "./pages/admin/AdminSettings";
import { fetchPublicSettings } from "./lib/api";
import { useSettingsStore } from "./store/settingsStore";
import { useProductStore } from "./store/productStore";
import { useCartStore } from "./store/cartStore";
import { useAuthStore } from "./store/authStore";

const queryClient = new QueryClient();

const App = () => {
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const settings = useSettingsStore((s) => s.settings);
  const loadProducts = useProductStore((s) => s.loadFromApi);
  const loadCart = useCartStore((s) => s.loadFromApi);
  const authToken = useAuthStore((s) => s.token);

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
          codEnabled: data.codEnabled,
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
        });
      } catch {
        // Keep locally persisted defaults
      }
    };
    loadSettings();
    return () => { active = false; };
  }, [updateSettings]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    if (authToken) loadCart();
  }, [authToken, loadCart]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Helmet>
          <title>{settings.metaTitle || settings.storeName}</title>
          <meta name="description" content={settings.metaDescription} />
          <meta name="author" content={settings.storeName} />
          <meta property="og:type" content="website" />
          <meta property="og:site_name" content={settings.storeName} />
          <meta property="og:title" content={settings.metaTitle || settings.storeName} />
          <meta property="og:description" content={settings.metaDescription} />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content={settings.metaTitle || settings.storeName} />
          <meta name="twitter:description" content={settings.metaDescription} />
          {settings.storeLogo || settings.favicon ? (
            <>
              <meta property="og:image" content={settings.storeLogo || settings.favicon} />
              <meta name="twitter:image" content={settings.storeLogo || settings.favicon} />
              <link rel="icon" href={settings.favicon || settings.storeLogo} />
            </>
          ) : null}
        </Helmet>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/wishlist" element={<WishlistPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/orders" element={<ProfilePage />} />
          <Route path="/track-orders" element={<UserOrderTracking />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/category/:slug" element={<CategoryPage />} />
          <Route path="/product/:slug" element={<ProductDetailPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/help-center" element={<HelpCenterPage />} />
          <Route path="/customer-service" element={<CustomerServicePage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/track-order" element={<UserOrderTracking />} />
          <Route path="/shipping-delivery" element={<ShippingDeliveryPage />} />
          <Route path="/return-policy" element={<ReturnPolicyPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/payment-method" element={<PaymentMethodPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/braj-darshan/:slug" element={<BrajDarshanPage />} />

          {/* Admin Routes */}
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="shipments" element={<AdminShipments />} />
            <Route path="payments" element={<AdminPayments />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>

          <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
