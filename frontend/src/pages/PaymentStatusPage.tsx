import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, CreditCard, XCircle, Loader2 } from 'lucide-react';
import { fetchPaymentStatus, reportRazorpayPaymentFailed, retryRazorpayOrder, trackOrder, verifyRazorpayPayment } from '@/lib/api';
import { toPositiveMetaValue, trackMetaPixelEvent } from '@/lib/metaPixel';
import { clearCheckoutDraft } from '@/lib/checkoutDraft';
import { useCartStore } from '@/store/cartStore';
import { formatPrice } from '@/utils/formatPrice';
import { toast } from 'sonner';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

const META_PURCHASE_VALUE = 9.90;

type PaymentStatusResponse = {
  status?: 'paid' | 'pending' | 'failed' | null;
  orderId?: number | null;
  amount?: number | string | null;
  method?: string | null;
};

type OrderItem = {
  productId?: string | number;
  id?: string | number;
  _id?: string | number;
  slug?: string;
  name?: string;
  price?: number | string;
  quantity?: number | string;
};

type TrackedOrder = {
  items?: OrderItem[];
};

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
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
  const [orderItems, setOrderItems] = useState<OrderItem[] | null>(null);
  const purchasePushedRef = useRef<string>('');
  const clearCart = useCartStore((state) => state.clearCart);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!token) return;
      try {
        const data = await fetchPaymentStatus(token) as PaymentStatusResponse;
        if (!active) return;
        setStatus(data.status || null);
        setOrderId(data.orderId || null);
        setAmount(data.amount === null || data.amount === undefined ? null : Number(data.amount));
        setMethod(data.method || null);
      } catch {
        if (active) setStatus('failed');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (!token || status !== 'pending') return;
    const interval = setInterval(async () => {
      try {
        const data = await fetchPaymentStatus(token) as PaymentStatusResponse;
        setStatus(data.status || null);
        setOrderId(data.orderId || null);
        setAmount(data.amount === null || data.amount === undefined ? null : Number(data.amount));
        setMethod(data.method || null);
      } catch {
        // ignore polling errors
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [token, status]);

  useEffect(() => {
    let active = true;
    const loadOrder = async () => {
      if (!orderId) return;
      try {
        const order = await trackOrder(orderId) as TrackedOrder;
        if (!active) return;
        setOrderItems(Array.isArray(order?.items) ? order.items : []);
      } catch {
        if (active) setOrderItems([]);
      }
    };
    if (status === 'paid' && orderId) loadOrder();
    return () => { active = false; };
  }, [status, orderId]);

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

  useEffect(() => {
    const purchaseValue = toPositiveMetaValue(META_PURCHASE_VALUE);
    if (!token || status !== 'paid' || purchaseValue === undefined) return;
    if (purchasePushedRef.current === token) return;
    if (orderId && orderItems === null) return;
    const analyticsValue = toPositiveMetaValue(amount) ?? purchaseValue;

    const items = (Array.isArray(orderItems) ? orderItems : []).map((i) => ({
      item_id: String(i.productId || i.id || i._id || i.slug || i.name || ''),
      item_name: String(i.name || ''),
      price: Number(i.price || 0),
      quantity: Number(i.quantity || 1),
    }));

    trackMetaPixelEvent('Purchase', {
      content_ids: items.map((i) => i.item_id),
      content_type: 'product',
      contents: items.map((i) => ({
        id: i.item_id,
        item_price: i.price,
        quantity: i.quantity,
      })),
      num_items: items.reduce((sum, i) => sum + i.quantity, 0),
      order_id: orderId || undefined,
      payment_type: method || undefined,
      value: purchaseValue,
    });

    // Push GA4 ecommerce purchase event to GTM dataLayer.
    // Use payment token as the stable transaction identifier.
    const dl = window.dataLayer;
    if (Array.isArray(dl)) {
      // GA4 recommended: clear previous ecommerce object to avoid bleed between events.
      dl.push({ ecommerce: null });
      dl.push({
        event: 'purchase',
        ecommerce: {
          transaction_id: String(orderId || token),
          transaction_token: token,
          affiliation: 'BrajMart',
          value: analyticsValue,
          currency: 'INR',
          payment_type: method || undefined,
          order_id: orderId || undefined,
          items,
        },
      });
      purchasePushedRef.current = token;
    }
  }, [token, status, amount, method, orderId, orderItems]);

  const handleRetryPayment = async () => {
    if (!token || retrying || status === 'paid') return;
    setRetrying(true);
    try {
      const loaded = await loadRazorpayCheckout();
      if (!loaded || !window.Razorpay) {
        throw new Error('Unable to load Razorpay checkout. Please disable browser shields/ad blockers and try again.');
      }

      const result = await retryRazorpayOrder(token);
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-xl">
          <div className="bg-card rounded-3xl border border-border p-8 text-center">
            {loading ? (
              <div className="space-y-4">
                <Loader2 size={40} className="mx-auto text-saffron animate-spin" />
                <p className="text-muted-foreground text-sm">Checking payment status...</p>
              </div>
            ) : status === 'paid' ? (
              <>
                <CheckCircle2 size={56} className="mx-auto text-tulsi mb-4" />
                <h1 className="font-cinzel text-2xl font-bold mb-2">Payment Successful</h1>
                <p className="text-muted-foreground text-sm">Your payment has been confirmed.</p>
              </>
            ) : status === 'pending' ? (
              <>
                <Loader2 size={56} className="mx-auto text-saffron animate-spin mb-4" />
                <h1 className="font-cinzel text-2xl font-bold mb-2">Payment Pending</h1>
                <p className="text-muted-foreground text-sm">We are verifying your payment. This may take a few minutes.</p>
              </>
            ) : (
              <>
                <XCircle size={56} className="mx-auto text-red-500 mb-4" />
                <h1 className="font-cinzel text-2xl font-bold mb-2">Payment Failed</h1>
                <p className="text-muted-foreground text-sm">We could not verify the payment. Please try again.</p>
              </>
            )}

            <div className="mt-6 space-y-2 text-sm">
              {orderId && (
                <div className="flex items-center justify-center gap-2">
                  <span className="text-muted-foreground">Order ID:</span>
                  <span className="font-mono text-saffron">{orderId}</span>
                </div>
              )}
              {amount !== null && (
                <div className="flex items-center justify-center gap-2">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-semibold">{formatPrice(amount)}</span>
                </div>
              )}
              {method && (
                <div className="flex items-center justify-center gap-2">
                  <span className="text-muted-foreground">Method:</span>
                  <span className="font-medium">{method}</span>
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-wrap gap-3 justify-center">
              <Link to="/track-orders" className="px-5 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
                Track Order
              </Link>
              {status === 'failed' && method === 'Razorpay' ? (
                <button
                  type="button"
                  onClick={handleRetryPayment}
                  disabled={retrying}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold-gradient text-maroon-dark text-sm font-bold shimmer disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {retrying ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                  {retrying ? 'Opening Payment...' : 'Pay Again'}
                </button>
              ) : (
                <Link to="/checkout" className="px-5 py-2.5 rounded-xl bg-gold-gradient text-maroon-dark text-sm font-bold shimmer">
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
