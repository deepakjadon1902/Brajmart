import * as React from "react";
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { OrderPaymentBreakdown } from '@/components/orders/OrderPaymentBreakdown';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { Search, Package, CheckCircle2, Truck, MapPin, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { trackOrder, trackOrderById } from '@/lib/api';

const steps = [
  { key: 'confirmed', label: 'Order Placed', icon: Package },
  { key: 'processing', label: 'Processing', icon: CheckCircle2 },
  { key: 'shipped', label: 'Shipped', icon: Truck },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: MapPin },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
];

const statusIdx: Record<string, number> = {
  confirmed: 0,
  processing: 1,
  shipped: 2,
  out_for_delivery: 3,
  delivered: 4,
  cancelled: 0,
};

const TrackOrderPage = () => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [orderId, setOrderId] = useState('');
  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const orderIdParam = searchParams.get('orderId');
    if (orderIdParam) {
      setOrderId(orderIdParam);
    }
  }, [searchParams]);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = orderId.trim();
    if (!input) {
      toast({ title: 'Please enter a valid Order ID or Tracking ID', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      let found;
      // Try tracking by tracking ID first
      try {
        found = await trackOrderById(input);
      } catch {
        // If not found by tracking ID, try by order ID if numeric
        const numeric = input.replace(/\D/g, '');
        if (numeric && numeric === input) {
          found = await trackOrder(numeric);
        } else {
          throw new Error('Order not found');
        }
      }
      setOrder(found);
      toast({ title: 'Order Found!' });
    } catch (err: any) {
      setOrder(null);
      toast({ title: err?.message || 'Order not found', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const currentStep = statusIdx[order?.status || 'confirmed'] ?? 0;
  const etaText = order?.estimatedDelivery ? new Date(order.estimatedDelivery).toLocaleDateString('en-IN') : '';

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="relative bg-maroon-dark text-primary-foreground py-6 md:py-10">
        <div className="container mx-auto px-4 text-center">
          <ScrollReveal>
            <p className="text-gold font-cinzel tracking-[0.2em] text-sm mb-4">ORDER TRACKING</p>
            <h1 className="font-cinzel text-3xl md:text-5xl font-bold mb-6 text-white">Track Your Order</h1>
            <form onSubmit={handleTrack} className="max-w-lg mx-auto flex rounded-full border border-primary-foreground/20 overflow-hidden bg-primary-foreground/5">
              <input value={orderId} onChange={e => setOrderId(e.target.value)} placeholder="Enter Order ID or Tracking ID" className="flex-1 px-5 py-3 bg-transparent text-sm outline-none placeholder:text-primary-foreground/40" />
              <button type="submit" className="px-6 bg-gold-gradient text-maroon-dark font-bold text-sm shimmer" disabled={loading}>
                <Search size={18} />
              </button>
            </form>
          </ScrollReveal>
        </div>
      </section>

      {order && (
        <section className="py-16 bg-background">
          <div className="container mx-auto px-4 max-w-3xl">
            <ScrollReveal>
              <div className="bg-card rounded-2xl border border-border p-6 md:p-8 mb-8">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-cinzel text-lg font-bold text-foreground">Order ID: {order.trackingId || order.orderId || order._id}</h2>
                  <span className="text-xs text-muted-foreground">{order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN') : ''}</span>
                </div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground">System Order No.</p>
                    <p className="font-mono text-sm text-saffron">{order.orderId || order._id}</p>
                  </div>
                  {order.shippingService && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Shipping Service</p>
                      <p className="text-sm font-medium text-foreground">{order.shippingService}</p>
                    </div>
                  )}
                </div>
                {etaText && (
                  <div className="flex items-center gap-2 mb-8">
                    <Clock size={14} className="text-saffron" />
                    <span className="text-sm text-muted-foreground">Estimated delivery: <strong className="text-foreground">{etaText}</strong></span>
                  </div>
                )}

                <div className="relative">
                  <div className="absolute top-5 left-5 right-5 h-0.5 bg-border">
                    <div className="h-full bg-saffron transition-all duration-700" style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }} />
                  </div>
                  <div className="flex justify-between relative">
                    {steps.map((s, i) => {
                      const done = i <= currentStep;
                      return (
                        <div key={s.key} className="flex flex-col items-center text-center w-1/5">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center z-10 border-2 transition-colors ${done ? 'bg-saffron border-saffron text-primary-foreground' : 'bg-card border-border text-muted-foreground'}`}>
                            <s.icon size={16} />
                          </div>
                          <span className={`text-[0.65rem] mt-2 font-medium ${done ? 'text-foreground' : 'text-muted-foreground'}`}>{s.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="bg-card rounded-2xl border border-border p-6">
                <h3 className="font-semibold text-foreground mb-4">Order Items</h3>
                <div className="space-y-3">
                  {(order.items || []).map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                      </div>
                      <p className="text-sm font-semibold text-saffron">?{item.price * item.quantity}</p>
                    </div>
                  ))}
                </div>
                <OrderPaymentBreakdown itemsSubtotal={order.itemsSubtotal} packagingAmount={order.packagingAmount} packagingRate={order.packagingRate} shippingAmount={order.shippingAmount} total={Number(order.total || 0)} calculatedItemsSubtotal={(order.items || []).reduce((sum: number, item: { price?: number; quantity?: number }) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0)} paymentMethod={order.paymentMethod} />
              </div>
            </ScrollReveal>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
};

export default TrackOrderPage;
