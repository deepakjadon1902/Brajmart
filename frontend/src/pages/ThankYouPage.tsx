import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Footer from '@/components/layout/Footer';
import Navbar from '@/components/layout/Navbar';
import OrderSuccessCard from '@/components/orders/OrderSuccessCard';
import { trackOrder } from '@/lib/api';

type ThankYouOrder = {
  orderId?: string | number;
  total?: number;
  paymentMethod?: string;
  trackingId?: string;
  estimatedDelivery?: string;
  items?: Array<{ name?: string; quantity?: number | string; image?: string }>;
};

const readSessionOrder = (): ThankYouOrder | null => {
  try {
    const raw = sessionStorage.getItem('brajmart-last-success-order');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const ThankYouPage = () => {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId') || searchParams.get('order') || '';
  const [loading, setLoading] = useState(Boolean(orderId));
  const [order, setOrder] = useState<ThankYouOrder | null>(() => readSessionOrder());

  useEffect(() => {
    let active = true;
    const loadOrder = async () => {
      if (!orderId) {
        setLoading(false);
        return;
      }
      try {
        const data = await trackOrder(orderId) as ThankYouOrder;
        if (!active) return;
        setOrder((current) => ({
          ...current,
          ...data,
          total: data.total ?? current?.total,
          paymentMethod: data.paymentMethod ?? current?.paymentMethod,
          items: data.items ?? current?.items,
        }));
      } catch {
        if (active) setOrder((current) => current || { orderId });
      } finally {
        if (active) setLoading(false);
      }
    };
    loadOrder();
    return () => { active = false; };
  }, [orderId]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-background pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
      <Navbar />
      <main className="px-2.5 py-5 sm:px-4 sm:py-10 lg:py-12">
        {loading ? (
          <div className="mx-auto flex min-h-[320px] max-w-xl flex-col items-center justify-center rounded-lg border border-border bg-card p-6 text-center shadow-sm sm:min-h-[360px] sm:p-8">
            <Loader2 size={40} className="mb-4 animate-spin text-saffron" />
            <h1 className="font-cinzel text-[1.55rem] font-bold leading-tight text-foreground sm:text-2xl">Opening your order confirmation</h1>
            <p className="mt-2 text-sm text-muted-foreground">Please wait while we verify the order details.</p>
          </div>
        ) : order ? (
          <OrderSuccessCard
            orderId={order.orderId || orderId}
            amount={typeof order.total === 'number' ? order.total : null}
            method={order.paymentMethod || null}
            trackingId={order.trackingId || null}
            estimatedDelivery={order.estimatedDelivery || null}
            items={order.items || null}
          />
        ) : (
          <div className="mx-auto max-w-xl rounded-lg border border-border bg-card p-5 text-center shadow-sm sm:p-8">
            <h1 className="font-cinzel text-[1.55rem] font-bold leading-tight text-foreground sm:text-2xl">Order confirmation</h1>
            <p className="mt-2 text-sm text-muted-foreground">We could not find a recent order on this device. You can track your order using your Order ID.</p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/track-orders" className="flex min-h-11 items-center justify-center rounded-lg bg-gold-gradient px-5 py-2.5 text-sm font-bold text-maroon-dark shimmer">
                Track Order
              </Link>
              <Link to="/" className="flex min-h-11 items-center justify-center rounded-lg border border-border px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted">
                Continue Shopping
              </Link>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default ThankYouPage;
