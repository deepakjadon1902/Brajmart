import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "./pages/Home";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
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
          <Route path="/track-order" element={<TrackOrderPage />} />
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

export default App;
