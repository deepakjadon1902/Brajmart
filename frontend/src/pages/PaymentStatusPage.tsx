import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CreditCard, XCircle, Loader2 } from 'lucide-react';
import { fetchPaymentStatus, retryPayUPayment, trackOrder } from '@/lib/api';
import { clearCheckoutDraft } from '@/lib/checkoutDraft';
import { useCartStore } from '@/store/cartStore';
import { formatPrice } from '@/utils/formatPrice';
import { toast } from 'sonner';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import OrderSuccessCard from '@/components/orders/OrderSuccessCard';

type PaymentStatusResponse = {
  status?: 'paid' | 'pending' | 'failed' | null;
  orderId?: number | null;
  amount?: number | string | null;
  method?: string | null;
  paymentId?: string | null;
  customerPhone?: string | null;
  items?: OrderItem[];
};

type OrderItem = {
  productId?: string | number;
  id?: string | number;
  _id?: string | number;
  slug?: string;
  name?: string;
  price?: number | string;
  quantity?: number | string;
  image?: string;
};

type TrackedOrder = {
  items?: OrderItem[];
  trackingId?: string | null;
  estimatedDelivery?: string | null;
};

const PaymentStatusPage = () => {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [status, setStatus] = useState<'paid' | 'pending' | 'failed' | null>(null);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [method, setMethod] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[] | null>(null);
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [estimatedDelivery, setEstimatedDelivery] = useState<string | null>(null);
  const clearCart = useCartStore((state) => state.clearCart);
  const isRazorpayPayment = String(method || '').toLowerCase() === 'razorpay';
  const isPayUPayment = String(method || '').toLowerCase() === 'payu';

  useEffect(() => {
    let active = true;
    setLoading(true);
    setStatus(null);
    setOrderId(null);
    setOrderItems(null);
    setMethod(null);
    setAmount(null);
    setPaymentId(null);
    setCustomerPhone(null);
    setTrackingId(null);
    setEstimatedDelivery(null);
    const load = async () => {
      if (!token) return;
      try {
        const data = await fetchPaymentStatus(token) as PaymentStatusResponse;
        if (!active) return;
        setStatus(data.status || null);
        setOrderId(data.orderId || null);
        setAmount(data.amount === null || data.amount === undefined ? null : Number(data.amount));
        setMethod(data.method || null);
        setPaymentId(data.paymentId || null);
        setCustomerPhone(data.customerPhone || null);
        if (Array.isArray(data.items)) setOrderItems(data.items);
      } catch {
        if (active) setStatus('pending');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (!token || status !== 'pending') return;
    let active = true;
    const interval = setInterval(async () => {
      try {
        const data = await fetchPaymentStatus(token) as PaymentStatusResponse;
        if (!active) return;
        setStatus(data.status || null);
        setOrderId(data.orderId || null);
        setAmount(data.amount === null || data.amount === undefined ? null : Number(data.amount));
        setMethod(data.method || null);
        setPaymentId(data.paymentId || null);
        setCustomerPhone(data.customerPhone || null);
        if (Array.isArray(data.items)) setOrderItems(data.items);
      } catch {
        // ignore polling errors
      }
    }, 2000);
    return () => { active = false; clearInterval(interval); };
  }, [token, status]);

  useEffect(() => {
    let active = true;
    const loadOrder = async () => {
      if (!orderId || orderItems !== null) return;
      try {
        const order = await trackOrder(orderId) as TrackedOrder;
        if (!active) return;
        setOrderItems(Array.isArray(order?.items) ? order.items : []);
        setTrackingId(order?.trackingId || null);
        setEstimatedDelivery(order?.estimatedDelivery || null);
      } catch {
        if (active) setOrderItems([]);
      }
    };
    if (status === 'paid' && orderId) loadOrder();
    return () => { active = false; };
  }, [status, orderId, orderItems]);

  useEffect(() => {
    if (status === 'paid') {
      clearCart();
      clearCheckoutDraft();
      try {
        sessionStorage.removeItem('brajmart-checkout-idempotency');
      } catch {
        // ignore storage errors
      }
    }
  }, [status, clearCart]);

  const handleRetryPayment = async () => {
    if (!token || retrying || status === 'paid') return;
    setRetrying(true);
    try {
      const result = await retryPayUPayment(token);
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = result.actionUrl;
      form.style.display = 'none';
      Object.entries(result.fields).forEach(([name, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = String(value ?? '');
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      toast.error(message || 'Unable to retry payment with PayU. Please try again.');
      setRetrying(false);
    }
  };

  if (!loading && status === 'paid') {
    return (
      <div className="min-h-screen overflow-x-hidden bg-background pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
        <Navbar />
        <section className="px-2.5 py-5 sm:px-4 sm:py-10 lg:py-12">
          <OrderSuccessCard
            orderId={orderId}
            amount={amount}
            method={method || 'Razorpay'}
            paymentId={paymentId}
            trackingId={trackingId}
            estimatedDelivery={estimatedDelivery}
            items={orderItems}
            secureLabel="Payment verified and order confirmed"
          />
        </section>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-background pb-20 md:pb-0">
      <Navbar />
      <section className="px-3 py-10 sm:px-4 sm:py-16">
        <div className="mx-auto w-full max-w-xl">
          <div className="rounded-lg border border-border bg-card p-5 text-center shadow-sm sm:rounded-3xl sm:p-8">
            {loading ? (
              <div className="space-y-4">
                <Loader2 size={40} className="mx-auto text-saffron animate-spin" />
                <p className="text-muted-foreground text-sm">Checking payment status...</p>
              </div>
            ) : status === 'pending' ? (
              <>
                <Loader2 size={56} className="mx-auto text-saffron animate-spin mb-4" />
                <h1 className="mb-2 font-cinzel text-[1.65rem] font-bold leading-tight sm:text-2xl">Payment Pending</h1>
                <p className="text-muted-foreground text-sm">
                  {isRazorpayPayment
                    ? 'Razorpay is temporarily unavailable. If money was debited, contact support before making another payment.'
                    : 'We are verifying your payment. This may take a few minutes.'}
                </p>
              </>
            ) : (
              <>
                <XCircle size={56} className="mx-auto text-red-500 mb-4" />
                <h1 className="mb-2 font-cinzel text-[1.65rem] font-bold leading-tight sm:text-2xl">Payment Failed</h1>
                <p className="text-muted-foreground text-sm">
                  {isRazorpayPayment
                    ? 'Razorpay is temporarily unavailable. If money was debited, contact support before making another payment.'
                    : isPayUPayment
                      ? 'The payment was not completed. You can retry securely with PayU.'
                    : 'We could not verify the payment. Please try again.'}
                </p>
              </>
            )}

            <div className="mt-6 space-y-2 text-sm">
              {orderId && (
                <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                  <span className="text-muted-foreground">Order ID:</span>
                  <span className="break-all font-mono text-saffron">{orderId}</span>
                </div>
              )}
              {amount !== null && (
                <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-semibold">{formatPrice(amount)}</span>
                </div>
              )}
              {method && (
                <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                  <span className="text-muted-foreground">Method:</span>
                  <span className="break-all font-medium">{method}</span>
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap">
              <Link to="/track-orders" className="flex min-h-11 items-center justify-center rounded-xl border border-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-muted">
                Track Order
              </Link>
              {status === 'failed' && isPayUPayment ? (
                <button
                  type="button"
                  onClick={handleRetryPayment}
                  disabled={retrying}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gold-gradient px-5 py-2.5 text-sm font-bold text-maroon-dark shimmer disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {retrying ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                  {retrying ? 'Opening PayU...' : 'Pay Again with PayU'}
                </button>
              ) : (
                <Link to={status === 'pending' ? '/' : '/checkout'} className="flex min-h-11 items-center justify-center rounded-xl bg-gold-gradient px-5 py-2.5 text-sm font-bold text-maroon-dark shimmer">
                  {status === 'pending' ? 'Back to Home' : 'Back to Checkout'}
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default PaymentStatusPage;
