import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Package } from 'lucide-react';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ProfileSidebar from '@/components/profile/ProfileSidebar';
import { useAuthStore } from '@/store/authStore';
import { useOrderStore } from '@/store/orderStore';
import { formatPrice } from '@/utils/formatPrice';

const ProfileOrdersPage = () => {
  const { user, isAuthenticated } = useAuthStore();
  const { orders, loadMyOrders } = useOrderStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    loadMyOrders();
  }, [isAuthenticated, loadMyOrders, navigate]);

  if (!isAuthenticated || !user) return null;

  return (
    <div className="min-h-screen bg-background">
      <AnnouncementBar /><Navbar />
      <div className="container mx-auto px-4 py-8">
        <h1 className="font-cinzel text-2xl font-bold text-foreground mb-6">My Orders</h1>

        <div className="grid md:grid-cols-3 gap-6">
          <ProfileSidebar />

          <div className="md:col-span-2 space-y-4">
            {orders.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-2xl border border-border p-8 text-center">
                <Package size={40} className="mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No orders yet. Start shopping to see your orders here.</p>
              </motion.div>
            ) : (
              orders.map((o) => (
                <motion.div key={o.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl border border-border p-5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Order ID</p>
                      <p className="font-mono text-sm text-saffron">{o.trackingId || o.id}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs border border-gold/30 bg-gold/10 text-gold">
                      {o.status}
                    </span>
                  </div>
                  <div className="mt-4 space-y-2">
                    {o.items.map((i, idx) => (
                      <div key={`${o.id}-${idx}`} className="flex items-center gap-3">
                        <img src={i.product.image} alt="" className="w-12 h-12 rounded-lg object-cover" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium line-clamp-1">{i.product.name}</p>
                          <p className="text-xs text-muted-foreground">Qty: {i.quantity}</p>
                        </div>
                        <span className="text-sm font-semibold">{formatPrice(i.price * i.quantity)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between text-sm border-t border-border pt-3">
                    <span className="text-muted-foreground">Payment: {o.paymentMethod}</span>
                    <span className="font-bold text-saffron">{formatPrice(o.total)}</span>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ProfileOrdersPage;
