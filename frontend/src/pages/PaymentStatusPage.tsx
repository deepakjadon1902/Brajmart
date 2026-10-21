import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CreditCard, XCircle, Loader2 } from 'lucide-react';
import { fetchPaymentStatus, reportRazorpayPaymentFailed, retryRazorpayOrder, trackOrder, verifyRazorpayPayment } from '@/lib/api';
import { clearCheckoutDraft } from '@/lib/checkoutDraft';
import { useCartStore } from '@/store/cartStore';
import { formatPrice } from '@/utils/formatPrice';
import { toast } from 'sonner';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import OrderSuccessCard from '@/components/orders/OrderSuccessCard';
import { getMetaAttributionContext } from '@/lib/metaPixel';
import { getGooglePurchaseContext } from '@/lib/googleAttribution';

type PaymentStatusResponse = {
  status?: 'paid' | 'pending' | 'failed' | null;
  orderId?: number | null;
  amount?: number | string | null;
  method?: string | null;
  paymentId?: string | null;
  customerEmail?: string | null;
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

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      close?: () => void;
      on: (event: string, handler: (response: unknown) => void) => void;
    };
  }
}

let razorpayCheckoutLoadPromise: Promise<boolean> | null = null;

const loadRazorpayCheckout = () =>
  razorpayCheckoutLoadPromise ||= new Promise<boolean>((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if (window.Razorpay) return resolve(true);
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-brajmart-razorpay-checkout="true"]');
    if (existingScript && window.Razorpay) return resolve(true);

    let settled = false;
    const finish = (loaded: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      if (!loaded) razorpayCheckoutLoadPromise = null;
      resolve(loaded);
    };

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.brajmartRazorpayCheckout = 'true';
    script.onload = () => finish(Boolean(window.Razorpay));
    script.onerror = () => finish(false);
    const timeoutId = window.setTimeout(() => finish(false), 12000);
    document.body.appendChild(script);
  });

const PaymentStatusPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [status, setStatus] = useState<'paid' | 'pending' | 'failed' | null>(null);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [method, setMethod] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [customerEmail, setCustomerEmail] = useState<string | null>(null);
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[] | null>(null);
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [estimatedDelivery, setEstimatedDelivery] = useState<string | null>(null);
  const clearCart = useCartStore((state) => state.clearCart);
  const isRazorpayPayment = String(method || '').toLowerCase() === 'razorpay';

  useEffect(() => {
    let active = true;
    setLoading(true);
    setStatus(null);
    setOrderId(null);
    setOrderItems(null);
    setMethod(null);
    setAmount(null);
    setPaymentId(null);
    setCustomerEmail(null);
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
        setCustomerEmail(data.customerEmail || null);
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
    if (!token || (status !== 'pending' && !(status === 'failed' && isRazorpayPayment))) return;
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
        setCustomerEmail(data.customerEmail || null);
        setCustomerPhone(data.customerPhone || null);
        if (Array.isArray(data.items)) setOrderItems(data.items);
      } catch {
        // ignore polling errors
      }
    }, 2000);
    return () => { active = false; clearInterval(interval); };
  }, [token, status, isRazorpayPayment]);

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
      const loaded = await loadRazorpayCheckout();
      if (!loaded || !window.Razorpay) {
        throw new Error('Unable to load Razorpay checkout. Please disable browser shields/ad blockers and try again.');
      }

      const metaContext = { ...getMetaAttributionContext(customerEmail || undefined), googleAnalytics: await getGooglePurchaseContext() };
      const result = await retryRazorpayOrder(token, metaContext);
      const checkout = new window.Razorpay({
        key: result.keyId,
        amount: result.amount,
        currency: result.currency,
        name: result.name,
        description: result.description,
        image: '/logo.png',
        order_id: result.orderId,
        prefill: result.prefill,
        notes: {
          source: 'brajmart_payment_retry',
          previous_status_token: token,
        },
        theme: {
          color: '#E8680A',
        },
        modal: {
          ondismiss: () => setRetrying(false),
        },
        handler: async (response: unknown) => {
          const payment = response as {
            razorpay_order_id?: string;
            razorpay_payment_id?: string;
            razorpay_signature?: string;
          };
          try {
            await verifyRazorpayPayment({
              razorpay_order_id: payment.razorpay_order_id || result.orderId,
              razorpay_payment_id: payment.razorpay_payment_id || '',
              razorpay_signature: payment.razorpay_signature || '',
              metaContext,
            });
            navigate(`/payment-status/${encodeURIComponent(result.statusToken)}`, { replace: true });
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : '';
            toast.error(message || 'Payment completed, but verification is still pending.');
            navigate(`/payment-status/${encodeURIComponent(result.statusToken)}`, { replace: true });
          } finally {
            setRetrying(false);
          }
        },
      });

      checkout.on('payment.failed', async (response: unknown) => {
        const failure = response as {
          error?: {
            description?: string;
            reason?: string;
            metadata?: {
              order_id?: string;
              payment_id?: string;
            };
          };
        };
        const reason = failure?.error?.description || failure?.error?.reason || 'Payment failed';
        try {
          await reportRazorpayPaymentFailed({
            razorpay_order_id: failure?.error?.metadata?.order_id || result.orderId,
            razorpay_payment_id: failure?.error?.metadata?.payment_id,
            reason,
          });
        } catch {
          // Webhooks or the status page can still reconcile this attempt.
        }
        checkout.close?.();
        toast.error('Payment failed. You can try again with the same order.');
        setRetrying(false);
        navigate(`/payment-status/${encodeURIComponent(result.statusToken)}`, { replace: true });
      });

      checkout.open();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      toast.error(message || 'Unable to retry payment. Please try again.');
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
                <p className="text-muted-foreground text-sm">We are verifying your payment. This may take a few minutes.</p>
              </>
            ) : (
              <>
                <XCircle size={56} className="mx-auto text-red-500 mb-4" />
                <h1 className="mb-2 font-cinzel text-[1.65rem] font-bold leading-tight sm:text-2xl">Payment Failed</h1>
                <p className="text-muted-foreground text-sm">
                  {isRazorpayPayment
                    ? 'If money was debited, please wait. We are checking Razorpay before you pay again.'
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
              {(status === 'pending' || status === 'failed') && method === 'Razorpay' ? (
                <button
                  type="button"
                  onClick={handleRetryPayment}
                  disabled={retrying}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gold-gradient px-5 py-2.5 text-sm font-bold text-maroon-dark shimmer disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {retrying ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                  {retrying ? 'Opening Payment...' : 'Pay Again'}
                </button>
              ) : (
                <Link to="/checkout" className="flex min-h-11 items-center justify-center rounded-xl bg-gold-gradient px-5 py-2.5 text-sm font-bold text-maroon-dark shimmer">
                  Back to Checkout
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
