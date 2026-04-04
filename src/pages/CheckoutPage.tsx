import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, CreditCard, CheckCircle2, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';
import { useOrderStore, Address } from '@/store/orderStore';
import { usePaymentStore } from '@/store/paymentStore';
import { useSettingsStore } from '@/store/settingsStore';
import { formatPrice } from '@/utils/formatPrice';
import { toast } from 'sonner';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

declare global {
  interface Window {
    Razorpay: any;
  }
}

const steps = ['Delivery Details', 'Payment', 'Confirmation'];

const emptyAddress: Address = { fullName: '', mobile: '', street: '', city: '', state: '', pincode: '' };

const RAZORPAY_KEY = 'rzp_test_YourKeyHere'; // Replace with your Razorpay key or use env
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const CheckoutPage = () => {
  const [step, setStep] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [placedOrderId, setPlacedOrderId] = useState('');
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [processing, setProcessing] = useState(false);

  const { items, totalPrice, totalSavings, clearCart } = useCartStore();
  const { user, isAuthenticated } = useAuthStore();
  const { addOrder } = useOrderStore();
  const { addPayment } = usePaymentStore();
  const { settings } = useSettingsStore();
  const navigate = useNavigate();

  const shipping = totalPrice() >= settings.freeShippingThreshold ? 0 : settings.shippingFee;
  const taxAmount = settings.taxRate > 0 ? Math.round(totalPrice() * settings.taxRate / 100) : 0;
  const grandTotal = totalPrice() + shipping + taxAmount;

  const [billingAddress, setBillingAddress] = useState<Address>({
    fullName: user?.fullName || '',
    mobile: user?.mobile || '',
    street: user?.address || '',
    city: user?.city || '',
    state: user?.state || '',
    pincode: user?.pincode || '',
  });

  const [shippingAddress, setShippingAddress] = useState<Address>({
    fullName: user?.fullName || '',
    mobile: user?.mobile || '',
    street: user?.address || '',
    city: user?.city || '',
    state: user?.state || '',
    pincode: user?.pincode || '',
  });

  const effectiveShipping = sameAsBilling ? billingAddress : shippingAddress;

  if (items.length === 0 && step < 2) {
    navigate('/cart');
    return null;
  }

  const validateAddress = (addr: Address) => addr.fullName && addr.mobile && addr.street && addr.pincode && addr.city && addr.state;

  const createOrderAndRecord = (paymentMethodLabel: string, paymentStatus: 'paid' | 'pending', transactionId: string) => {
    const orderId = addOrder({
      userId: user?.id || 'guest',
      items: items.map((i) => ({ product: i.product, quantity: i.quantity, price: i.product.price })),
      total: grandTotal,
      status: 'confirmed',
      shippingAddress: effectiveShipping,
      billingAddress,
      paymentMethod: paymentMethodLabel,
    });

    addPayment({
      orderId,
      customerName: billingAddress.fullName,
      customerEmail: user?.email || 'guest@brajmart.com',
      method: paymentMethodLabel,
      amount: grandTotal,
      status: paymentStatus,
      transactionId,
    });

    clearCart();
    setPlacedOrderId(orderId);
    setStep(2);
    toast.success('Order placed successfully! 🙏');
    return orderId;
  };

  const openRazorpay = (prefill: Record<string, string>, method?: string) => {
    if (!validateAddress(billingAddress)) {
      toast.error('Please fill all billing address details');
      setStep(0);
      return;
    }
    if (!sameAsBilling && !validateAddress(shippingAddress)) {
      toast.error('Please fill all shipping address details');
      setStep(0);
      return;
    }

    setProcessing(true);

    const options: Record<string, any> = {
      key: RAZORPAY_KEY,
      amount: Math.round(grandTotal * 100),
      currency: 'INR',
      name: settings.storeName || 'BrajMart',
      description: `Order — ${items.length} item(s)`,
      image: settings.storeLogo || '',
      handler: (response: any) => {
        const txnId = response.razorpay_payment_id || `TXN-${Date.now().toString(36).toUpperCase()}`;
        createOrderAndRecord(method === 'upi' ? 'UPI' : 'Card', 'paid', txnId);
        setProcessing(false);
      },
      prefill: {
        name: billingAddress.fullName,
        email: user?.email || '',
        contact: billingAddress.mobile,
        ...prefill,
      },
      theme: { color: '#d4a017' },
      modal: {
        ondismiss: () => {
          setProcessing(false);
          toast.error('Payment cancelled');
        },
      },
    };

    // If method specified, try to set preferred method
    if (method === 'upi') {
      options.config = {
        display: {
          blocks: { upi: { name: 'UPI', instruments: [{ method: 'upi' }] } },
          sequence: ['block.upi'],
          preferences: { show_default_blocks: false },
        },
      };
    } else if (method === 'card') {
      options.config = {
        display: {
          blocks: { card: { name: 'Card', instruments: [{ method: 'card' }] } },
          sequence: ['block.card'],
          preferences: { show_default_blocks: false },
        },
      };
    }

    try {
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (res: any) => {
        setProcessing(false);
        // Record failed payment
        const txnId = res.error?.metadata?.payment_id || `FAIL-${Date.now().toString(36).toUpperCase()}`;
        addPayment({
          orderId: 'N/A',
          customerName: billingAddress.fullName,
          customerEmail: user?.email || 'guest@brajmart.com',
          method: method === 'upi' ? 'UPI' : 'Card',
          amount: grandTotal,
          status: 'failed',
          transactionId: txnId,
        });
        toast.error(`Payment failed: ${res.error?.description || 'Unknown error'}`);
      });
      rzp.open();
    } catch (err) {
      setProcessing(false);
      toast.error('Razorpay failed to load. Using demo mode.');
      // Fallback: simulate payment
      setTimeout(() => {
        createOrderAndRecord(method === 'upi' ? 'UPI' : 'Card', 'paid', `DEMO-${Date.now().toString(36).toUpperCase()}`);
        setProcessing(false);
      }, 1500);
    }
  };

  const handlePlaceOrder = () => {
    if (!validateAddress(billingAddress)) {
      toast.error('Please fill all billing address details');
      setStep(0);
      return;
    }
    if (!sameAsBilling && !validateAddress(shippingAddress)) {
      toast.error('Please fill all shipping address details');
      setStep(0);
      return;
    }

    if (paymentMethod === 'cod') {
      setProcessing(true);
      setTimeout(() => {
        createOrderAndRecord('COD', 'pending', `COD-${Date.now().toString(36).toUpperCase()}`);
        setProcessing(false);
      }, 1000);
    } else if (paymentMethod === 'upi') {
      openRazorpay({}, 'upi');
    } else if (paymentMethod === 'card') {
      openRazorpay({}, 'card');
    }
  };

  const addressFields = [
    { key: 'fullName', label: 'Full Name', type: 'text', full: false },
    { key: 'mobile', label: 'Mobile Number', type: 'tel', full: false },
    { key: 'street', label: 'Street Address', type: 'text', full: true },
    { key: 'city', label: 'City', type: 'text', full: false },
    { key: 'state', label: 'State', type: 'text', full: false },
    { key: 'pincode', label: 'Pincode', type: 'text', full: false },
  ];

  const renderAddressForm = (
    addr: Address,
    setAddr: React.Dispatch<React.SetStateAction<Address>>,
    label: string
  ) => (
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-3">{label}</h3>
      <div className="grid md:grid-cols-2 gap-4">
        {addressFields.map((f) => (
          <div key={f.key} className={f.full ? 'md:col-span-2' : ''}>
            <label className="block text-sm font-medium mb-1">{f.label}</label>
            <input
              type={f.type}
              value={addr[f.key as keyof Address]}
              onChange={(e) => setAddr((a) => ({ ...a, [f.key]: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-gold transition-colors"
            />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <AnnouncementBar />
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => (step > 0 ? setStep(step - 1) : navigate('/cart'))} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-cinzel text-2xl font-bold text-foreground">Checkout</h1>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${i <= step ? 'bg-gold-gradient text-maroon-dark' : 'bg-muted text-muted-foreground'}`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className={`text-sm hidden sm:block ${i <= step ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{s}</span>
              {i < steps.length - 1 && <span className="w-8 h-px bg-border mx-1" />}
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {step === 0 && (
                <motion.div key="delivery" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                  <div className="bg-card rounded-2xl border border-border p-6 space-y-6">
                    <div className="flex items-center gap-2">
                      <MapPin size={18} className="text-gold" />
                      <h2 className="font-cinzel text-lg font-bold">Delivery Details</h2>
                    </div>
                    {!isAuthenticated && (
                      <div className="p-3 bg-pearl rounded-xl text-sm">
                        <Link to="/login" className="text-saffron font-semibold hover:underline">Sign in</Link> for faster checkout with saved addresses.
                      </div>
                    )}

                    {renderAddressForm(billingAddress, setBillingAddress, '📋 Billing Address')}

                    <label className="flex items-center gap-3 cursor-pointer py-2 px-4 rounded-xl border border-border hover:border-gold/40 transition-colors">
                      <input
                        type="checkbox"
                        checked={sameAsBilling}
                        onChange={() => setSameAsBilling(!sameAsBilling)}
                        className="w-4 h-4 accent-saffron rounded"
                      />
                      <span className="text-sm font-medium text-foreground">Shipping address same as billing address</span>
                    </label>

                    {!sameAsBilling && renderAddressForm(shippingAddress, setShippingAddress, '📦 Shipping Address')}

                    <button onClick={() => setStep(1)} className="w-full py-3 rounded-xl bg-gold-gradient text-maroon-dark font-bold text-sm shimmer active:scale-[0.97] transition-transform">
                      Continue to Payment →
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 1 && (
                <motion.div key="payment" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                  <div className="bg-card rounded-2xl border border-border p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <CreditCard size={18} className="text-gold" />
                      <h2 className="font-cinzel text-lg font-bold">Payment Method</h2>
                    </div>
                    <div className="space-y-3">
                      {[
                        ...(settings.codEnabled ? [{ value: 'cod', label: 'Cash on Delivery', sub: 'Pay when delivered', icon: '📦' }] : []),
                        ...(settings.upiEnabled ? [{ value: 'upi', label: 'UPI Payment', sub: 'GPay, PhonePe, Paytm via Razorpay', icon: '📱' }] : []),
                        ...(settings.cardEnabled ? [{ value: 'card', label: 'Credit/Debit Card', sub: 'Visa, Mastercard, RuPay via Razorpay', icon: '💳' }] : []),
                      ].map((m) => (
                        <label key={m.value} className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-colors ${paymentMethod === m.value ? 'border-gold bg-gold/5' : 'border-border hover:border-gold/40'}`}>
                          <input type="radio" name="payment" value={m.value} checked={paymentMethod === m.value} onChange={() => setPaymentMethod(m.value)} className="sr-only" />
                          <span className="text-2xl">{m.icon}</span>
                          <div className="flex-1">
                            <span className="block text-sm font-semibold">{m.label}</span>
                            <span className="block text-xs text-muted-foreground">{m.sub}</span>
                          </div>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === m.value ? 'border-gold' : 'border-border'}`}>
                            {paymentMethod === m.value && <div className="w-2.5 h-2.5 rounded-full bg-gold" />}
                          </div>
                        </label>
                      ))}
                    </div>

                    {/* Info note for online payments */}
                    {(paymentMethod === 'upi' || paymentMethod === 'card') && (
                      <div className="mt-4 p-4 rounded-xl border border-gold/30 bg-gold/5 text-sm">
                        <p className="text-foreground font-medium mb-1">
                          {paymentMethod === 'upi' ? '📱 UPI Payment' : '💳 Card Payment'} — Powered by Razorpay
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Clicking "Place Order" will open the secure Razorpay payment window where you can complete {paymentMethod === 'upi' ? 'your UPI payment via GPay, PhonePe, Paytm, etc.' : 'your card payment securely.'}
                        </p>
                      </div>
                    )}

                    <button
                      onClick={handlePlaceOrder}
                      disabled={processing}
                      className="mt-6 w-full py-3 rounded-xl bg-gold-gradient text-maroon-dark font-bold text-sm shimmer active:scale-[0.97] transition-transform disabled:opacity-60"
                    >
                      {processing ? 'Processing Payment...' : `Place Order — ${formatPrice(grandTotal)}`}
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="confirmation" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                  <div className="bg-card rounded-2xl border border-border p-8 text-center">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
                      <CheckCircle2 size={64} className="mx-auto text-tulsi mb-4" />
                    </motion.div>
                    <h2 className="font-cinzel text-2xl font-bold text-foreground mb-2">Order Placed Successfully! 🙏</h2>
                    <p className="text-muted-foreground text-sm mb-2">Your order has been confirmed</p>
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-pearl rounded-xl mb-4">
                      <span className="text-xs text-muted-foreground">Order ID: </span>
                      <span className="font-bold text-saffron font-mono text-lg">{placedOrderId}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(placedOrderId);
                          toast.success('Order ID copied!');
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                    <p className="text-sm text-muted-foreground mb-6">Estimated delivery in 3-5 business days</p>
                    <div className="flex gap-3 justify-center flex-wrap">
                      <Link to="/track-orders" className="px-6 py-3 rounded-xl border border-border text-foreground font-medium text-sm hover:bg-muted transition-colors">
                        Track Order
                      </Link>
                      <Link to="/" className="px-6 py-3 rounded-xl bg-gold-gradient text-maroon-dark font-bold text-sm shimmer">
                        Continue Shopping
                      </Link>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Summary sidebar */}
          {step < 2 && (
            <div className="lg:col-span-1">
              <div className="bg-card rounded-2xl border border-border p-6 sticky top-24">
                <h3 className="font-cinzel text-lg font-bold mb-4">Order Summary</h3>
                <div className="space-y-3 mb-4">
                  {items.map((item) => (
                    <div key={item.product.id} className="flex gap-3">
                      <img src={item.product.image} alt="" className="w-12 h-12 rounded-lg object-cover" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium line-clamp-1">{item.product.name}</p>
                        <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                      </div>
                      <span className="text-xs font-semibold">{formatPrice(item.product.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-2 text-sm border-t border-border pt-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatPrice(totalPrice())}</span>
                  </div>
                  {totalSavings() > 0 && (
                    <div className="flex justify-between text-tulsi">
                      <span>Savings</span>
                      <span>-{formatPrice(totalSavings())}</span>
                    </div>
                  )}
                  {taxAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax ({settings.taxRate}%)</span>
                      <span>{formatPrice(taxAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shipping</span>
                    <span>{shipping === 0 ? 'FREE' : formatPrice(shipping)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-base border-t border-border pt-2">
                    <span>Total</span>
                    <span className="text-saffron">{formatPrice(grandTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default CheckoutPage;
