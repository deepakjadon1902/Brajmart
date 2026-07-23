import * as React from 'react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useOrderStore, OrderStatus } from '@/store/orderStore';
import { useAuthStore } from '@/store/authStore';
import { trackDtdcOrder, trackOrder, trackOrderById } from '@/lib/api';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { OrderPaymentBreakdown } from '@/components/orders/OrderPaymentBreakdown';
import {
  ArrowLeft,
  BadgeCheck,
  BoxIcon,
  CheckCircle,
  Clock,
  Copy,
  ExternalLink,
  MapPin,
  Package,
  PackageCheck,
  Phone,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatPrice } from '@/utils/formatPrice';

const statusSteps: { status: OrderStatus; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { status: 'confirmed', label: 'Confirmed', icon: CheckCircle },
  { status: 'processing', label: 'Processing', icon: BoxIcon },
  { status: 'shipped', label: 'Shipped', icon: Package },
  { status: 'out_for_delivery', label: 'Out for Delivery', icon: Truck },
  { status: 'delivered', label: 'Delivered', icon: MapPin },
];

const statusLabel = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const formatDate = (value?: string | Date) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatDateTime = (value?: string | Date) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const statusPillClass = (status: string) => {
  if (status === 'delivered') return 'border-[#CFE8D2] bg-[#F1FAF2] text-[#2E7D32]';
  if (status === 'cancelled') return 'border-red-200 bg-red-50 text-red-600';
  if (status === 'out_for_delivery') return 'border-blue-200 bg-blue-50 text-blue-700';
  return 'border-amber-200 bg-amber-50 text-amber-700';
};

const canLoadDtdc = (order: any) => {
  const service = String(order?.shippingService || '').toLowerCase();
  const awb = String(order?.trackingId || '').trim();
  const shipped = ['shipped', 'out_for_delivery', 'delivered'].includes(String(order?.status || ''));
  return service.includes('dtdc') && Boolean(awb) && shipped;
};

const TrackingTrustStrip = () => (
  <div className="grid gap-3 sm:grid-cols-3">
    <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
      <ShieldCheck size={18} className="mb-2 text-[#2E7D32]" />
      <p className="text-sm font-bold text-foreground">Secure Lookup</p>
      <p className="mt-1 text-xs text-muted-foreground">Only valid order or AWB details are shown.</p>
    </div>
    <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
      <Truck size={18} className="mb-2 text-saffron" />
      <p className="text-sm font-bold text-foreground">DTDC Updates</p>
      <p className="mt-1 text-xs text-muted-foreground">Courier scans appear when DTDC API returns them.</p>
    </div>
    <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
      <ReceiptText size={18} className="mb-2 text-brand-gold" />
      <p className="text-sm font-bold text-foreground">Order Details</p>
      <p className="mt-1 text-xs text-muted-foreground">Payment, items, and delivery info remain clear.</p>
    </div>
  </div>
);

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
    const awb = String(orderToTrack?.trackingId || '').trim();
    if (!canLoadDtdc(orderToTrack)) return;

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

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
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
  const progressWidth = currentStepIndex > 0 ? (currentStepIndex / (statusSteps.length - 1)) * 100 : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AnnouncementBar />
      <Navbar />

      <section className="relative overflow-hidden bg-maroon-dark text-primary-foreground">
        <div className="container mx-auto px-4 py-10 sm:py-12">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-3 font-cinzel text-xs font-bold uppercase tracking-[0.28em] text-gold">Order Tracking</p>
            <h1 className="font-cinzel text-3xl font-bold text-white md:text-5xl">Track Your Order</h1>
            <p className="mx-auto mt-4 max-w-xl text-sm text-white/75">
              Enter your BrajMart order ID or DTDC AWB number. The tracking ID is sent on your order confirmation email.
            </p>
            <form onSubmit={handleSearch} className="mx-auto mt-7 flex max-w-xl overflow-hidden rounded-lg border border-white/15 bg-white/10 p-1 shadow-sm">
              <input
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                placeholder="Enter order ID or tracking ID"
                className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-white/45"
              />
              <button
                type="submit"
                className="inline-flex min-w-14 items-center justify-center rounded-md bg-gold-gradient px-5 text-maroon-dark shadow-sm shimmer disabled:opacity-60"
                disabled={loading}
                aria-label="Track order"
              >
                {loading ? <RefreshCw size={18} className="animate-spin" /> : <Search size={18} />}
              </button>
            </form>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs text-white/75">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5"><ShieldCheck size={13} /> Private lookup</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5"><Truck size={13} /> DTDC supported</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5"><PackageCheck size={13} /> BrajMart status</span>
            </div>
          </div>
        </div>
      </section>

      <main className="flex-1 container mx-auto max-w-6xl px-4 py-8">
        {selectedOrder ? (
          <div className="space-y-5">
            <button onClick={clearSelectedOrder} className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-saffron">
              <ArrowLeft size={15} /> Back to tracking
            </button>

            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="border-b border-border bg-brand-raised px-5 py-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-saffron">BrajMart Order</p>
                    <div className="mt-1 flex items-center gap-2">
                      <h2 className="font-cinzel text-xl font-bold text-foreground sm:text-2xl">#{selectedOrder.trackingId || selectedOrder.id}</h2>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(selectedOrder.trackingId || selectedOrder.id);
                          toast.success('Copied');
                        }}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                        aria-label="Copy tracking ID"
                      >
                        <Copy size={15} />
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Placed on {formatDate(selectedOrder.createdAt)}</p>
                  </div>
                  <span className={`w-fit rounded-full border px-3 py-1.5 text-xs font-bold ${statusPillClass(String(selectedOrder.status))}`}>
                    {statusLabel(String(selectedOrder.status))}
                  </span>
                </div>
              </div>

              <div className="p-5">
                {String(selectedOrder.shippingService || '').toLowerCase().includes('dtdc') && (
                  <div className="mb-5 rounded-lg border border-[#E7D8C7] bg-background p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-raised text-saffron">
                          <Truck size={18} />
                        </span>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">DTDC Courier Tracking</p>
                          <p className="mt-1 text-sm font-bold text-foreground">{selectedOrder.trackingId ? `AWB ${selectedOrder.trackingId}` : 'AWB pending'}</p>
                          <p className="mt-1 text-xs text-muted-foreground">Live scan history appears after dispatch when DTDC returns data.</p>
                        </div>
                      </div>
                      {dtdcLoading ? (
                        <span className="inline-flex items-center gap-2 text-xs font-semibold text-saffron">
                          <RefreshCw size={13} className="animate-spin" /> Fetching status
                        </span>
                      ) : canLoadDtdc(selectedOrder) ? (
                        <button
                          type="button"
                          onClick={() => loadDtdcTracking(selectedOrder)}
                          className="inline-flex items-center justify-center gap-2 rounded-md border border-saffron/40 px-3 py-2 text-xs font-bold text-saffron transition-colors hover:bg-saffron/10"
                        >
                          <RefreshCw size={13} /> Refresh DTDC
                        </button>
                      ) : (
                        <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">Available after dispatch</span>
                      )}
                    </div>
                    {dtdcTracking && (
                      <div className="mt-4 rounded-lg border border-border bg-card p-4">
                        <p className="text-sm font-bold text-foreground">{dtdcTracking.currentStatus}</p>
                        {dtdcTracking.lastLocation && <p className="mt-1 text-xs text-muted-foreground">Last location: {dtdcTracking.lastLocation}</p>}
                        {dtdcTracking.trackingPortalUrl && (
                          <a href={dtdcTracking.trackingPortalUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-saffron hover:underline">
                            Open DTDC tracking page <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {selectedOrder.status !== 'cancelled' ? (
                  <div className="relative rounded-lg border border-border bg-background p-4">
                    <div className="absolute left-[10%] right-[10%] top-[35px] h-0.5 bg-border">
                      <div className="h-full bg-saffron transition-all" style={{ width: `${progressWidth}%` }} />
                    </div>
                    <div className="relative grid grid-cols-5 gap-2">
                      {statusSteps.map((step, i) => {
                        const done = i <= currentStepIndex;
                        const Icon = step.icon;
                        return (
                          <div key={step.status} className="flex flex-col items-center text-center">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition ${done ? 'border-saffron bg-saffron text-primary-foreground' : 'border-border bg-card text-muted-foreground'}`}>
                              <Icon size={18} />
                            </div>
                            <span className={`mt-2 text-[0.65rem] font-semibold leading-tight ${done ? 'text-foreground' : 'text-muted-foreground'}`}>{step.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-bold text-red-600">Order Cancelled</div>
                )}

                {selectedOrder.estimatedDelivery && (
                  <div className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-[#E7D8C7] bg-brand-raised px-4 py-3">
                    <Clock size={15} className="text-saffron" />
                    <p className="text-sm text-muted-foreground">
                      Estimated delivery: <span className="font-bold text-foreground">{formatDate(selectedOrder.estimatedDelivery)}</span>
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground"><PackageCheck size={16} className="text-saffron" /> Shipping Address</h3>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p className="font-semibold text-foreground">{selectedOrder.shippingAddress.fullName || 'Customer'}</p>
                  <p>{selectedOrder.shippingAddress.street || selectedOrder.shippingAddress.address || 'Address not available'}</p>
                  <p>{selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state} - {selectedOrder.shippingAddress.pincode}</p>
                  {selectedOrder.shippingAddress.mobile && <p className="flex items-center gap-1.5"><Phone size={13} /> {selectedOrder.shippingAddress.mobile}</p>}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground"><ReceiptText size={16} className="text-saffron" /> Billing Address</h3>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p className="font-semibold text-foreground">{selectedOrder.billingAddress.fullName || selectedOrder.shippingAddress.fullName || 'Customer'}</p>
                  <p>{selectedOrder.billingAddress.street || selectedOrder.billingAddress.address || selectedOrder.shippingAddress.street || 'Address not available'}</p>
                  <p>{selectedOrder.billingAddress.city || selectedOrder.shippingAddress.city}, {selectedOrder.billingAddress.state || selectedOrder.shippingAddress.state} - {selectedOrder.billingAddress.pincode || selectedOrder.shippingAddress.pincode}</p>
                  {(selectedOrder.billingAddress.mobile || selectedOrder.shippingAddress.mobile) && <p className="flex items-center gap-1.5"><Phone size={13} /> {selectedOrder.billingAddress.mobile || selectedOrder.shippingAddress.mobile}</p>}
                </div>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
              <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
                <h2 className="mb-4 font-cinzel text-lg font-bold text-foreground">Order Items</h2>
                <div className="divide-y divide-border">
                  {selectedOrder.items.map((item: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <span className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-brand-raised">
                        <img src={item.product.image} alt={item.product.name} className="h-full w-full object-contain p-1.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-foreground line-clamp-2">{item.product.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Qty: {item.quantity}</p>
                      </div>
                      <p className="font-semibold text-foreground">{formatPrice(item.price * item.quantity)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
                <h2 className="mb-4 font-cinzel text-lg font-bold text-foreground">Payment Summary</h2>
                <OrderPaymentBreakdown
                  itemsSubtotal={selectedOrder.itemsSubtotal}
                  packagingAmount={selectedOrder.packagingAmount}
                  packagingRate={selectedOrder.packagingRate}
                  shippingAmount={selectedOrder.shippingAmount}
                  codAmount={selectedOrder.codAmount}
                  codPincode={selectedOrder.codPincode}
                  total={selectedOrder.total}
                  calculatedItemsSubtotal={selectedOrder.items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0)}
                  paymentMethod={selectedOrder.paymentMethod}
                />
              </div>
            </div>

            {selectedOrder.statusHistory?.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
                <h2 className="mb-4 font-cinzel text-lg font-bold text-foreground">Status History</h2>
                <div className="space-y-4">
                  {[...selectedOrder.statusHistory].reverse().map((h: any, i: number) => (
                    <div key={i} className="flex gap-3">
                      <div className={`mt-1 h-3 w-3 shrink-0 rounded-full ${i === 0 ? 'bg-saffron' : 'bg-border'}`} />
                      <div>
                        <p className="text-sm font-bold text-foreground">{statusLabel(String(h.status))}</p>
                        {h.note && <p className="mt-1 text-xs text-muted-foreground">{h.note}</p>}
                        <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(h.date)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <TrackingTrustStrip />
          </div>
        ) : dtdcTracking ? (
          <div className="mx-auto max-w-4xl space-y-5">
            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="border-b border-border bg-brand-raised px-5 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-saffron">DTDC Tracking</p>
                    <h2 className="mt-1 font-cinzel text-2xl font-bold text-foreground">AWB {dtdcTracking.trackingId || searchId}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSearch()}
                    disabled={loading}
                    className="inline-flex w-fit items-center justify-center gap-2 rounded-md border border-saffron/40 px-4 py-2 text-xs font-bold text-saffron transition-colors hover:bg-saffron/10 disabled:opacity-60"
                  >
                    <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
                  </button>
                </div>
              </div>
              <div className="p-5">
                <div className="rounded-lg border border-[#E7D8C7] bg-background p-4">
                  <div className="flex gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-raised text-saffron">
                      <Truck size={18} />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-foreground">{dtdcTracking.currentStatus}</p>
                      {dtdcTracking.lastLocation && <p className="mt-1 text-xs text-muted-foreground">Last location: {dtdcTracking.lastLocation}</p>}
                      <p className="mt-2 text-xs text-muted-foreground">If live scan history is pending, use the official DTDC page with this AWB number.</p>
                      {dtdcTracking.trackingPortalUrl && (
                        <a href={dtdcTracking.trackingPortalUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-saffron hover:underline">
                          Open DTDC tracking page <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {(dtdcTracking.events || []).length > 0 && (
                  <div className="mt-5 rounded-lg border border-border bg-card p-4">
                    <h3 className="mb-4 text-sm font-bold text-foreground">Tracking Activity</h3>
                    <div className="space-y-4">
                      {dtdcTracking.events.map((event: any, idx: number) => (
                        <div key={`${event.status}-${idx}`} className="flex gap-3">
                          <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-saffron" />
                          <div>
                            <p className="text-sm font-bold text-foreground">{statusLabel(String(event.status))}</p>
                            {event.remarks && <p className="mt-1 text-xs text-muted-foreground">{event.remarks}</p>}
                            {event.date && <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(event.date)}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <TrackingTrustStrip />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-lg border border-border bg-card p-6 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-border bg-brand-raised text-saffron">
                <Package size={28} />
              </div>
              <h2 className="font-cinzel text-xl font-bold text-foreground">Track any BrajMart shipment</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Use the search box above with your order ID or DTDC AWB number. For new orders, tracking updates appear after dispatch.
              </p>
              <Link to="/" className="mt-5 inline-flex rounded-lg bg-gold-gradient px-5 py-3 text-sm font-bold text-maroon-dark shadow-sm shimmer">
                Continue Shopping
              </Link>
            </div>

            <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <h2 className="font-cinzel text-lg font-bold text-foreground">Your Orders</h2>
              <p className="mt-1 text-xs text-muted-foreground">Recent orders show here when you are logged in.</p>
              <div className="mt-4 space-y-3">
                {userOrders.length === 0 ? (
                  <div className="rounded-lg border border-border bg-background px-4 py-5 text-center">
                    <Package size={32} className="mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-semibold text-foreground">No orders yet</p>
                    <p className="mt-1 text-xs text-muted-foreground">Your confirmed orders will appear here.</p>
                  </div>
                ) : (
                  userOrders.map((order) => (
                    <button
                      key={order.id}
                      onClick={() => selectOrder(order)}
                      className="w-full rounded-lg border border-border bg-background p-4 text-left transition-colors hover:border-saffron/50 hover:bg-brand-raised"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-sm font-bold text-saffron">#{order.trackingId || order.id}</span>
                        <span className={`rounded-full border px-2.5 py-1 text-[0.65rem] font-bold ${statusPillClass(String(order.status))}`}>
                          {statusLabel(String(order.status))}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{order.items.length} item{order.items.length === 1 ? '' : 's'} - {formatPrice(order.total)} - {order.paymentMethod}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
            <div className="lg:col-span-2">
              <TrackingTrustStrip />
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default UserOrderTracking;
