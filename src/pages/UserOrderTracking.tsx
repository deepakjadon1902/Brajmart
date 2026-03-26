import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useOrderStore, OrderStatus } from '@/store/orderStore';
import { useAuthStore } from '@/store/authStore';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Search, Package, CheckCircle, Truck, MapPin, BoxIcon, ArrowLeft } from 'lucide-react';

const statusSteps: { status: OrderStatus; label: string; icon: any }[] = [
  { status: 'confirmed', label: 'Confirmed', icon: CheckCircle },
  { status: 'processing', label: 'Processing', icon: BoxIcon },
  { status: 'shipped', label: 'Shipped', icon: Package },
  { status: 'out_for_delivery', label: 'Out for Delivery', icon: Truck },
  { status: 'delivered', label: 'Delivered', icon: MapPin },
];

const UserOrderTracking = () => {
  const [searchId, setSearchId] = useState('');
  const { user } = useAuthStore();
  const { getOrdersByUser, getOrderById } = useOrderStore();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const userOrders = user ? getOrdersByUser(user.id) : useOrderStore.getState().orders;
  const selectedOrder = selectedOrderId ? getOrderById(selectedOrderId) : null;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchId.trim()) setSelectedOrderId(searchId.trim().toUpperCase());
  };

  const currentStepIndex = selectedOrder ? statusSteps.findIndex((s) => s.status === selectedOrder.status) : -1;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-2xl font-bold text-foreground mb-6">Track Your Order</h1>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2 mb-8">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              placeholder="Enter Order ID (e.g. ORD-2026-001)"
              className="w-full pl-10 pr-4 py-3 border border-border rounded-xl bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
            />
          </div>
          <button type="submit" className="px-6 py-3 bg-saffron text-primary-foreground rounded-xl font-medium text-sm hover:bg-saffron-light transition">Track</button>
        </form>

        {selectedOrder ? (
          <div className="space-y-6">
            <button onClick={() => setSelectedOrderId(null)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft size={14} /> Back to orders
            </button>

            {/* Order Header */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <p className="text-xs text-muted-foreground">Order ID</p>
                  <p className="text-lg font-bold text-saffron font-mono">{selectedOrder.id}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Tracking ID</p>
                  <p className="font-mono text-foreground">{selectedOrder.trackingId || 'Pending'}</p>
                </div>
              </div>

              {/* Timeline */}
              {selectedOrder.status !== 'cancelled' ? (
                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    {statusSteps.map((step, i) => {
                      const done = i <= currentStepIndex;
                      const Icon = step.icon;
                      return (
                        <div key={step.status} className="flex flex-col items-center flex-1">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition ${done ? 'bg-saffron border-saffron text-primary-foreground' : 'border-border bg-card text-muted-foreground'}`}>
                            <Icon size={18} />
                          </div>
                          <span className={`text-[0.65rem] mt-1.5 text-center ${done ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{step.label}</span>
                        </div>
                      );
                    })}
                  </div>
                  {/* Progress bar */}
                  <div className="absolute top-5 left-[10%] right-[10%] h-0.5 bg-border -z-0">
                    <div className="h-full bg-saffron transition-all" style={{ width: `${(currentStepIndex / (statusSteps.length - 1)) * 100}%` }} />
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-destructive font-medium">Order Cancelled</div>
              )}

              {selectedOrder.estimatedDelivery && (
                <p className="text-center text-sm text-muted-foreground mt-4">
                  Estimated Delivery: <span className="font-medium text-foreground">{new Date(selectedOrder.estimatedDelivery).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </p>
              )}
            </div>

            {/* Status History */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="font-semibold text-foreground mb-4">Status History</h2>
              <div className="space-y-4">
                {[...selectedOrder.statusHistory].reverse().map((h, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className={`w-3 h-3 rounded-full mt-1 shrink-0 ${i === 0 ? 'bg-saffron' : 'bg-muted'}`} />
                    <div>
                      <p className="text-sm font-medium text-foreground">{h.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</p>
                      {h.note && <p className="text-xs text-muted-foreground">{h.note}</p>}
                      <p className="text-xs text-muted-foreground">{new Date(h.date).toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Items */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="font-semibold text-foreground mb-4">Order Items</h2>
              {selectedOrder.items.map((item, i) => (
                <div key={i} className="flex items-center gap-3 py-3 border-b border-border last:border-0">
                  <img src={item.product.image} alt={item.product.name} className="w-14 h-14 rounded-xl object-cover" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{item.product.name}</p>
                    <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                  </div>
                  <p className="text-sm font-semibold text-foreground">₹{(item.price * item.quantity).toLocaleString('en-IN')}</p>
                </div>
              ))}
              <div className="flex justify-between mt-4 pt-3 border-t border-border">
                <span className="font-semibold text-foreground">Total</span>
                <span className="font-bold text-saffron text-lg">₹{selectedOrder.total.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        ) : (
          /* Order List */
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Your Orders</h2>
            {userOrders.length === 0 ? (
              <div className="text-center py-12">
                <Package size={48} className="mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No orders yet</p>
                <Link to="/" className="inline-block mt-3 text-saffron hover:underline text-sm">Start Shopping</Link>
              </div>
            ) : (
              userOrders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => setSelectedOrderId(order.id)}
                  className="w-full bg-card border border-border rounded-2xl p-5 text-left hover:border-saffron/40 transition"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-saffron text-sm font-bold">{order.id}</span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
                      order.status === 'delivered' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                      order.status === 'cancelled' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                      'bg-amber-500/10 text-amber-600 border-amber-500/20'
                    }`}>
                      {order.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{order.items.length} items · ₹{order.total.toLocaleString('en-IN')}</p>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </button>
              ))
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default UserOrderTracking;
