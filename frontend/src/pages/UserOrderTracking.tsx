import * as React from "react";
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useOrderStore, OrderStatus } from '@/store/orderStore';
import { useAuthStore } from '@/store/authStore';
import { trackDtdcOrder, trackOrder, trackOrderById } from '@/lib/api';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { OrderPaymentBreakdown } from '@/components/orders/OrderPaymentBreakdown';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { Search, Package, CheckCircle, Truck, MapPin, BoxIcon, ArrowLeft, Clock, Copy, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const statusSteps: { status: OrderStatus; label: string; icon: any }[] = [
  { status: 'confirmed', label: 'Confirmed', icon: CheckCircle },
  { status: 'processing', label: 'Processing', icon: BoxIcon },
  { status: 'shipped', label: 'Shipped', icon: Package },
  { status: 'out_for_delivery', label: 'Out for Delivery', icon: Truck },
  { status: 'delivered', label: 'Delivered', icon: MapPin },
];

const UserOrderTracking = () => {
  const [searchId, setSearchId] = useState('');
  const [searchParams] = useSearchParams();
  const { user, token } = useAuthStore();
  const { getOrdersByUser, getOrderById, orders, loadMyOrders } = useOrderStore();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [trackedOrder, setTrackedOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [dtdcTracking, setDtdcTracking] = useState<any | null>(null);
  const [dtdcLoading, setDtdcLoading] = useState(false);

  useEffect(() => {
    if (token) {
      loadMyOrders();
    }
  }, [token, loadMyOrders]);

  useEffect(() => {
    const orderIdParam = searchParams.get('orderId');
    if (orderIdParam) {
      setSearchId(orderIdParam);
    }
  }, [searchParams]);

  const userOrders = orders.length ? orders : (user ? getOrdersByUser(user.id) : []);
  const selectedOrder = trackedOrder || (selectedOrderId ? getOrderById(selectedOrderId) : null);

  const normalizeApiOrder = (o: any) => ({
    ...o,
    id: o.orderId ? String(o.orderId) : o._id || o.id,
    userId: o.userId !== undefined && o.userId !== null ? String(o.userId) : 'user',
    items: (o.items || []).map((i: any) => ({
      ...i,
      product: {
        name: i?.name || i?.product?.name || 'Item',
        image: i?.image || i?.product?.image || '',
      },
      quantity: i?.quantity || 1,
      price: Number(i?.price || i?.product?.price || 0),
    })),
    shippingAddress: o.shippingAddress || {},
    billingAddress: o.billingAddress || {},
    statusHistory: o.statusHistory || [],
  });

  const loadDtdcTracking = async (orderToTrack: any) => {
    const service = String(orderToTrack?.shippingService || '').toLowerCase();
    const awb = String(orderToTrack?.trackingId || '').trim();
    const shipped = ['shipped', 'out_for_delivery', 'delivered'].includes(String(orderToTrack?.status || ''));
    if (!service.includes('dtdc') || !awb || !shipped) return;

    setDtdcLoading(true);
    try {
      const data: any = await trackDtdcOrder(awb);
      setDtdcTracking(data?.tracking || null);
    } catch (err: any) {
      setDtdcTracking({
        carrier: 'DTDC',
        trackingId: awb,
        currentStatus: 'Tracking is available from your BrajMart order status',
        events: [{ status: orderToTrack.status, remarks: err?.message || 'Live DTDC tracking is not available right now' }],
      });
    } finally {
      setDtdcLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = searchId.trim();
    if (!id) return;
    setLoading(true);
    setDtdcTracking(null);
    setTrackedOrder(null);
    const found = getOrderById(id);
    if (found) {
      setSelectedOrderId(id);
      loadDtdcTracking(found).catch(() => {});
      setLoading(false);
      return;
    }

    try {
      let apiOrder: any;
      try {
        apiOrder = await trackOrderById(id);
      } catch {
        if (/^\d+$/.test(id)) {
          apiOrder = await trackOrder(id);
        } else {
          throw new Error('Order not found');
        }
      }
      const normalized = normalizeApiOrder(apiOrder);
      setSelectedOrderId(null);
      setTrackedOrder(normalized);
      loadDtdcTracking(normalized).catch(() => {});
      toast.success('Order found');
    } catch (err: any) {
      try {
        const data: any = await trackDtdcOrder(id);
        if (data?.order) {
          const normalized = normalizeApiOrder(data.order);
          setTrackedOrder(normalized);
          setSelectedOrderId(null);
        }
        setDtdcTracking(data?.tracking || null);
        toast.success(data?.order ? 'Order found' : 'DTDC tracking loaded');
      } catch (liveErr: any) {
        toast.error(liveErr?.message || err?.message || 'Order not found. Please check the tracking ID.');
      }
    } finally {
      setLoading(false);
    }
  };

  const selectOrder = (order: any) => {
    setTrackedOrder(order);
    setSelectedOrderId(order.trackingId || order.id);
    setDtdcTracking(null);
    loadDtdcTracking(order).catch(() => {});
  };

  const clearSelectedOrder = () => {
    setSelectedOrderId(null);
    setTrackedOrder(null);
    setDtdcTracking(null);
  };

  const currentStepIndex = selectedOrder ? statusSteps.findIndex((s) => s.status === selectedOrder.status) : -1;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AnnouncementBar />
      <Navbar />

      {/* Hero Search */}
      <section className="relative bg-maroon-dark text-primary-foreground py-6 md:py-10">
        <div className="container mx-auto px-4 text-center">
          <ScrollReveal>
            <p className="text-gold font-cinzel tracking-[0.2em] text-sm mb-4">ORDER TRACKING</p>
            <h1 className="font-cinzel text-3xl md:text-4xl font-bold mb-6 text-white">Track Your Order</h1>
            <p className="text-primary-foreground/60 text-sm mb-6 text-white">Enter the tracking ID sent to your email</p>
            <form onSubmit={handleSearch} className="max-w-md mx-auto flex rounded-full border border-primary-foreground/20 overflow-hidden bg-primary-foreground/5">
              <input
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                placeholder="Enter tracking ID or order ID"
                className="flex-1 px-5 py-3 bg-transparent text-sm outline-none placeholder:text-primary-foreground/40"
              />
              <button type="submit" className="px-6 bg-gold-gradient text-maroon-dark font-bold text-sm shimmer disabled:opacity-60" disabled={loading}>
                {loading ? <RefreshCw size={18} className="animate-spin" /> : <Search size={18} />}
              </button>
            </form>
          </ScrollReveal>
        </div>
      </section>

      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        {selectedOrder ? (
          <div className="space-y-6">
            <button onClick={clearSelectedOrder} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft size={14} /> Back to orders
            </button>

            {/* Order Header */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <p className="text-xs text-muted-foreground">Order ID</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xl font-bold text-saffron font-mono">{selectedOrder.trackingId || selectedOrder.id}</p>
                    <button onClick={() => { navigator.clipboard.writeText(selectedOrder.trackingId || selectedOrder.id); toast.success('Copied!'); }} className="text-muted-foreground hover:text-foreground">
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">System Order No.</p>
                  <p className="font-mono text-foreground">{selectedOrder.id}</p>
                </div>
              </div>

              {String(selectedOrder.shippingService || '').toLowerCase().includes('dtdc') && (
                <div className="mb-6 rounded-xl border border-border bg-muted/30 p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">DTDC Tracking</p>
                      <p className="text-sm font-semibold text-foreground">
                        {selectedOrder.trackingId ? `AWB ${selectedOrder.trackingId}` : 'AWB pending'}
                      </p>
                    </div>
                    {dtdcLoading ? (
                      <span className="inline-flex items-center gap-2 text-xs text-saffron">
                        <RefreshCw size={13} className="animate-spin" />
                        Fetching courier status...
                      </span>
                    ) : selectedOrder.trackingId && ['shipped', 'out_for_delivery', 'delivered'].includes(String(selectedOrder.status)) ? (
                      <button
                        type="button"
                        onClick={() => loadDtdcTracking(selectedOrder)}
                        className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-saffron/40 text-saffron text-xs font-medium hover:bg-saffron/10"
                      >
                        <RefreshCw size={13} />
                        Refresh DTDC
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Available after dispatch</span>
                    )}
                  </div>
                  {dtdcTracking && (
                    <div className="mt-3 rounded-lg border border-border/70 bg-background/40 p-3">
                      <p className="text-sm font-semibold text-foreground">{dtdcTracking.currentStatus}</p>
                      {dtdcTracking.lastLocation && <p className="mt-1 text-xs text-muted-foreground">Last location: {dtdcTracking.lastLocation}</p>}
                      {dtdcTracking.trackingPortalUrl && (
                        <a
                          href={dtdcTracking.trackingPortalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex text-xs font-medium text-saffron hover:underline"
                        >
                          Track on DTDC portal
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}

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
                  <div className="absolute top-5 left-[10%] right-[10%] h-0.5 bg-border -z-0">
                    <div className="h-full bg-saffron transition-all" style={{ width: `${(currentStepIndex / (statusSteps.length - 1)) * 100}%` }} />
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-destructive font-medium">Order Cancelled</div>
              )}

              {selectedOrder.estimatedDelivery && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Clock size={14} className="text-saffron" />
                  <p className="text-sm text-muted-foreground">
                    Estimated Delivery: <span className="font-medium text-foreground">{new Date(selectedOrder.estimatedDelivery).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Shipping & Billing */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="font-semibold text-foreground mb-3 text-sm">📦 Shipping Address</h3>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p className="text-foreground font-medium">{selectedOrder.shippingAddress.fullName}</p>
                  <p>{selectedOrder.shippingAddress.street}</p>
                  <p>{selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state} - {selectedOrder.shippingAddress.pincode}</p>
                  <p>📞 {selectedOrder.shippingAddress.mobile}</p>
                </div>
              </div>
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="font-semibold text-foreground mb-3 text-sm">📋 Billing Address</h3>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p className="text-foreground font-medium">{selectedOrder.billingAddress.fullName}</p>
                  <p>{selectedOrder.billingAddress.street}</p>
                  <p>{selectedOrder.billingAddress.city}, {selectedOrder.billingAddress.state} - {selectedOrder.billingAddress.pincode}</p>
                  <p>📞 {selectedOrder.billingAddress.mobile}</p>
                </div>
              </div>
            </div>

            {/* Status History */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="font-semibold text-foreground mb-4">Status History</h2>
              <div className="space-y-4">
                {[...selectedOrder.statusHistory].reverse().map((h, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className={`w-3 h-3 rounded-full mt-1 shrink-0 ${i === 0 ? 'bg-saffron' : 'bg-muted'}`} />
                    <div>
                      <p className="text-sm font-medium text-foreground">{h.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</p>
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
              <OrderPaymentBreakdown itemsSubtotal={selectedOrder.itemsSubtotal} packagingAmount={selectedOrder.packagingAmount} packagingRate={selectedOrder.packagingRate} shippingAmount={selectedOrder.shippingAmount} total={selectedOrder.total} calculatedItemsSubtotal={selectedOrder.items.reduce((sum, item) => sum + item.price * item.quantity, 0)} paymentMethod={selectedOrder.paymentMethod} />
            </div>
          </div>
        ) : dtdcTracking ? (
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">DTDC Tracking</p>
                <h2 className="font-cinzel text-xl font-bold text-foreground">AWB {dtdcTracking.trackingId || searchId}</h2>
              </div>
              <button
                type="button"
                onClick={handleSearch}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-saffron/40 text-saffron text-xs font-semibold hover:bg-saffron/10 disabled:opacity-60"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-sm font-semibold text-foreground">{dtdcTracking.currentStatus}</p>
              {dtdcTracking.lastLocation && <p className="mt-1 text-xs text-muted-foreground">Last location: {dtdcTracking.lastLocation}</p>}
              {dtdcTracking.trackingPortalUrl && (
                <a href={dtdcTracking.trackingPortalUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-medium text-saffron hover:underline">
                  Track on DTDC portal
                </a>
              )}
            </div>
            {(dtdcTracking.events || []).length > 0 && (
              <div className="mt-4 space-y-4">
                {dtdcTracking.events.map((event: any, idx: number) => (
                  <div key={`${event.status}-${idx}`} className="flex gap-3">
                    <div className="mt-1 h-2.5 w-2.5 rounded-full bg-saffron shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{event.status}</p>
                      {event.remarks && <p className="text-xs text-muted-foreground mt-1">{event.remarks}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                  onClick={() => selectOrder(order)}
                  className="w-full bg-card border border-border rounded-2xl p-5 text-left hover:border-saffron/40 transition"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-saffron text-sm font-bold">#{order.trackingId || order.id}</span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
                      order.status === 'delivered' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                      order.status === 'cancelled' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                      'bg-amber-500/10 text-amber-600 border-amber-500/20'
                    }`}>
                      {order.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{order.items.length} items · ₹{order.total.toLocaleString('en-IN')} · {order.paymentMethod}</p>
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
