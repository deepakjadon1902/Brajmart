import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, CreditCard, CheckCircle2, Copy, ShieldCheck, Smartphone, Check, Truck } from 'lucide-react';
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
import { createRazorpayOrder, fetchPublicSettings, verifyRazorpayPayment, getApiBase, createOrder, createPayment } from '@/lib/api';

declare global {
  interface Window {
    Razorpay: any;
  }
}

const steps = ['Delivery Details', 'Payment', 'Confirmation'];

const emptyAddress: Address = { fullName: '', mobile: '', street: '', city: '', state: '', pincode: '' };

const RAZORPAY_KEY = import.meta.env.VITE_RAZORPAY_KEY || '';

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
  const { settings, updateSettings } = useSettingsStore();
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

  useEffect(() => {
    let active = true;
    const loadSettings = async () => {
      try {
        const data = await fetchPublicSettings();
        if (!active || !data) return;
        updateSettings({
          storeName: data.storeName,
          tagline: data.tagline,
          currency: data.currency,
          freeShippingThreshold: data.freeShippingThreshold,
          shippingFee: data.shippingFee,
          storeEmail: data.storeEmail,
          storePhone: data.storePhone,
          storeAddress: data.storeAddress,
          taxRate: data.taxRate,
          minOrderAmount: data.minOrderAmount,
          maxOrderQuantity: data.maxOrderQuantity,
          codEnabled: data.codEnabled,
          upiEnabled: data.upiEnabled,
          cardEnabled: data.cardEnabled,
          maintenanceMode: data.maintenanceMode,
          metaTitle: data.metaTitle,
          metaDescription: data.metaDescription,
          storeLogo: data.storeLogo,
          socialLinks: data.socialLinks,
          announcementBar: data.announcementBar,
          notifications: data.notifications,
        });
      } catch {
        // Fallback to locally persisted settings
      }
    };
    loadSettings();
    return () => { active = false; };
  }, [updateSettings]);

  if (items.length === 0 && step < 2) {
    navigate('/cart');
    return null;
  }

  const validateAddress = (addr: Address) => addr.fullName && addr.mobile && addr.street && addr.pincode && addr.city && addr.state;

  const createOrderAndRecord = async (paymentMethodLabel: string, paymentStatus: 'paid' | 'pending', transactionId: string) => {
    const localOrderId = addOrder({
      userId: user?.id || 'guest',
      items: items.map((i) => ({ product: i.product, quantity: i.quantity, price: i.product.price })),
      total: grandTotal,
      status: 'confirmed',
      shippingAddress: effectiveShipping,
      billingAddress,
      paymentMethod: paymentMethodLabel,
    });

    addPayment({
      orderId: localOrderId,
      customerName: billingAddress.fullName,
      customerEmail: user?.email || 'guest@brajmart.com',
      method: paymentMethodLabel,
      amount: grandTotal,
      status: paymentStatus,
      transactionId,
    });

    try {
      const orderPayload = {
        userId: user?.id || undefined,
        items: items.map((i) => ({
          name: i.product.name,
          image: i.product.image,
          quantity: i.quantity,
          price: i.product.price,
        })),
        total: grandTotal,
        status: 'confirmed',
        customerName: billingAddress.fullName,
        customerEmail: user?.email || 'guest@brajmart.com',
        shippingAddress: effectiveShipping,
        billingAddress,
        paymentMethod: paymentMethodLabel,
      };
      const created: any = await createOrder(orderPayload);
      await createPayment({
        orderId: created.orderId || created.orderId === 0 ? created.orderId : created._id,
        customerName: billingAddress.fullName,
        customerEmail: user?.email || 'guest@brajmart.com',
        method: paymentMethodLabel,
        amount: grandTotal,
        status: paymentStatus,
        transactionId,
      });
      setPlacedOrderId(String(created.orderId || localOrderId));
    } catch {
      setPlacedOrderId(localOrderId);
    }

    clearCart();
    setStep(2);
    toast.success('Order placed successfully!');
    return localOrderId;
  };

  const loadRazorpay = () =>
    new Promise<boolean>((resolve) => {
      if (window.Razorpay) return resolve(true);
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const openRazorpay = async (method?: string) => {
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

    let orderData: { orderId: string; amount: number; currency: string; key: string; demo?: boolean };
    try {
      orderData = await createRazorpayOrder({
        amount: grandTotal,
        currency: 'INR',
        receipt: `BM-${Date.now()}`,
        notes: { method: method || 'card' },
      });
    } catch (err: any) {
      setProcessing(false);
      if (err?.message === 'Failed to fetch') {
        toast.error(`Backend not reachable at ${getApiBase()}. Please start the backend server.`);
      } else {
        toast.error(err?.message || 'Unable to start payment. Please try again.');
      }
      return;
    }

    if (orderData.demo) {
      await createOrderAndRecord(method === 'upi' ? 'UPI' : 'Card', 'paid', `DEMO-${Date.now().toString(36).toUpperCase()}`);
      toast.success('Demo payment successful');
      setProcessing(false);
      setStep(2);
      return;
    }

    const razorpayReady = await loadRazorpay();
    if (!razorpayReady) {
      setProcessing(false);
      toast.error('Unable to load Razorpay. Please try again.');
      return;
    }

    const key = orderData.key || RAZORPAY_KEY;
    if (!key) {
      setProcessing(false);
      toast.error('Razorpay key not configured. Please add it in the backend or .env.');
      return;
    }

    const options: Record<string, any> = {
      key,
      order_id: orderData.orderId,
      amount: orderData.amount,
      currency: orderData.currency,
      name: settings.storeName || 'BrajMart',
      description: `Order - ${items.length} item(s)`,
      image: settings.storeLogo || '',
      handler: async (response: any) => {
        try {
          const verification = await verifyRazorpayPayment({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          if (!verification?.verified) {
            throw new Error('Payment verification failed');
          }
          const txnId = response.razorpay_payment_id || `TXN-${Date.now().toString(36).toUpperCase()}`;
          await createOrderAndRecord(method === 'upi' ? 'UPI' : 'Card', 'paid', txnId);
        } catch (verifyErr: any) {
          toast.error(verifyErr?.message || 'Payment verification failed.');
          addPayment({
            orderId: 'N/A',
            customerName: billingAddress.fullName,
            customerEmail: user?.email || 'guest@brajmart.com',
            method: method === 'upi' ? 'UPI' : 'Card',
            amount: grandTotal,
            status: 'failed',
            transactionId: `FAIL-${Date.now().toString(36).toUpperCase()}`,
          });
        } finally {
          setProcessing(false);
        }
      },
      prefill: {
        name: billingAddress.fullName,
        email: user?.email || '',
        contact: billingAddress.mobile,
      },
      theme: { color: '#c58f1f' },
      modal: {
        ondismiss: () => {
          setProcessing(false);
          toast.error('Payment cancelled');
        },
      },
    };

    // Use Razorpay's native UI for a marketplace-style checkout experience.

    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', (res: any) => {
      setProcessing(false);
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
  };

  const handlePlaceOrder = () => {
    if (!isAuthenticated) {
      toast.error('Please sign in to place your order');
      navigate('/login');
      return;
    }
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

    if (settings.minOrderAmount && grandTotal < settings.minOrderAmount) {
      toast.error(`Minimum order amount is ${formatPrice(settings.minOrderAmount)}.`);
      return;
    }

    if (paymentMethod === 'cod') {
      setProcessing(true);
      setTimeout(() => {
        createOrderAndRecord('COD', 'pending', `COD-${Date.now().toString(36).toUpperCase()}`);
        setProcessing(false);
      }, 1000);
    } else if (paymentMethod === 'upi') {
      openRazorpay('upi');
    } else if (paymentMethod === 'card') {
      openRazorpay('card');
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

  const paymentOptions = [
    ...(settings.upiEnabled ? [{
      value: 'upi',
      title: 'UPI',
      subtitle: 'Pay instantly using any UPI app',
      icon: Smartphone,
      pills: ['GPay', 'PhonePe', 'Paytm', 'BHIM'],
      badge: 'Recommended',
    }] : []),
    ...(settings.cardEnabled ? [{
      value: 'card',
      title: 'Credit or Debit Card',
      subtitle: 'Visa, Mastercard, RuPay, Amex',
      icon: CreditCard,
      pills: ['Visa', 'Mastercard', 'RuPay', 'Amex'],
      badge: 'Secure',
    }] : []),
    ...(settings.codEnabled ? [{
      value: 'cod',
      title: 'Cash on Delivery',
      subtitle: 'Pay at your doorstep',
      icon: Truck,
      pills: ['Cash', 'UPI on delivery'],
      badge: 'Flexible',
    }] : []),
  ];

  useEffect(() => {
    const available: string[] = [];
    if (settings.upiEnabled) available.push('upi');
    if (settings.cardEnabled) available.push('card');
    if (settings.codEnabled) available.push('cod');
    if (available.length > 0 && !available.includes(paymentMethod)) {
      setPaymentMethod(available[0]);
    }
  }, [settings.codEnabled, settings.upiEnabled, settings.cardEnabled, paymentMethod]);

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
                {i < step ? <Check size={14} /> : i + 1}
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

                    {renderAddressForm(billingAddress, setBillingAddress, 'Billing Address')}

                    <label className="flex items-center gap-3 cursor-pointer py-2 px-4 rounded-xl border border-border hover:border-gold/40 transition-colors">
                      <input
                        type="checkbox"
                        checked={sameAsBilling}
                        onChange={() => setSameAsBilling(!sameAsBilling)}
                        className="w-4 h-4 accent-saffron rounded"
                      />
                      <span className="text-sm font-medium text-foreground">Shipping address same as billing address</span>
                    </label>

                    {!sameAsBilling && renderAddressForm(shippingAddress, setShippingAddress, 'Shipping Address')}

                    <button onClick={() => setStep(1)} className="w-full py-3 rounded-xl bg-gold-gradient text-maroon-dark font-bold text-sm shimmer active:scale-[0.97] transition-transform">
                      Continue to Payment
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

                    {paymentOptions.length === 0 ? (
                      <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                        No payment methods are currently available. Please contact support.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {paymentOptions.map((m) => {
                          const Icon = m.icon;
                          const selected = paymentMethod === m.value;
                          return (
                            <label
                              key={m.value}
                              className={`group flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-colors ${selected ? 'border-gold bg-gold/5' : 'border-border hover:border-gold/40'}`}
                            >
                              <input
                                type="radio"
                                name="payment"
                                value={m.value}
                                checked={selected}
                                onChange={() => setPaymentMethod(m.value)}
                                className="sr-only"
                              />
                              <div className={`h-11 w-11 rounded-xl flex items-center justify-center border ${selected ? 'border-gold/40 bg-gold/10 text-gold' : 'border-border bg-muted text-muted-foreground'}`}>
                                <Icon size={18} />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold">{m.title}</span>
                                  <span className={`text-[11px] px-2 py-0.5 rounded-full border ${selected ? 'border-gold text-gold' : 'border-border text-muted-foreground'}`}>
                                    {m.badge}
                                  </span>
                                </div>
                                <span className="block text-xs text-muted-foreground mt-0.5">{m.subtitle}</span>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {m.pills.map((p) => (
                                    <span key={p} className="text-[11px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                                      {p}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selected ? 'border-gold' : 'border-border'}`}>
                                {selected && <div className="w-2.5 h-2.5 rounded-full bg-gold" />}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {paymentMethod === 'cod' && (
                      <div className="mt-4 p-4 rounded-xl border border-border bg-muted/30 text-xs text-muted-foreground">
                        Pay by cash or UPI at the time of delivery. Please keep the exact amount ready.
                      </div>
                    )}

                    <div className="mt-5 p-4 rounded-xl border border-gold/30 bg-gold/5 text-sm">
                      <div className="flex items-center gap-2 text-foreground font-medium">
                        <ShieldCheck size={16} className="text-gold" />
                        Secure payments by Razorpay
                      </div>
                      <p className="text-muted-foreground text-xs mt-1">
                        Your payment details are encrypted and processed on Razorpay's PCI DSS compliant infrastructure.
                      </p>
                    </div>

                    <button
                      onClick={handlePlaceOrder}
                      disabled={processing || paymentOptions.length === 0}
                      className="mt-6 w-full py-3 rounded-xl bg-gold-gradient text-maroon-dark font-bold text-sm shimmer active:scale-[0.97] transition-transform disabled:opacity-60"
                    >
                      {processing
                        ? 'Processing Payment...'
                        : paymentMethod === 'cod'
                          ? `Place Order - ${formatPrice(grandTotal)}`
                          : `Pay Securely - ${formatPrice(grandTotal)}`}
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
                    <h2 className="font-cinzel text-2xl font-bold text-foreground mb-2">Order Placed Successfully</h2>
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
                    <p className="text-sm text-muted-foreground mb-6">Estimated delivery in 3-7 business days</p>
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








