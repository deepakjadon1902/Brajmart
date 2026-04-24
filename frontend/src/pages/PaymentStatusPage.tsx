import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { fetchPaymentStatus } from '@/lib/api';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

const PaymentStatusPage = () => {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'paid' | 'pending' | 'failed' | null>(null);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [method, setMethod] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!token) return;
      try {
        const data: any = await fetchPaymentStatus(token);
        if (!active) return;
        setStatus(data.status);
        setOrderId(data.orderId || null);
        setAmount(data.amount || null);
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
        const data: any = await fetchPaymentStatus(token);
        setStatus(data.status);
        setOrderId(data.orderId || null);
        setAmount(data.amount || null);
        setMethod(data.method || null);
      } catch {
        // ignore polling errors
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [token, status]);

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
                <p className="text-muted-foreground text-sm">We are verifying your PayU payment. This may take a few minutes.</p>
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
                  <span className="font-semibold">₹{amount.toLocaleString('en-IN')}</span>
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
              <Link to="/checkout" className="px-5 py-2.5 rounded-xl bg-gold-gradient text-maroon-dark text-sm font-bold shimmer">
                Back to Checkout
              </Link>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default PaymentStatusPage;
