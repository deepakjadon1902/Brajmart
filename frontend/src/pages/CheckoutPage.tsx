import * as React from "react";
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, CreditCard, CheckCircle2, Copy, ShieldCheck, Smartphone, Check, Minus, Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';
import { Address } from '@/store/orderStore';
import { useSettingsStore } from '@/store/settingsStore';
import { formatPrice } from '@/utils/formatPrice';
import { toast } from 'sonner';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { fetchPublicSettings, createPayuOrder } from '@/lib/api';

const steps = ['Delivery Details', 'Payment', 'Confirmation'];

const emptyAddress: Address = { fullName: '', mobile: '', street: '', city: '', state: '', pincode: '' };

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const INDIA_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
] as const;

const CheckoutPage = () => {
  const { items, totalPrice, totalSavings, updateQuantity, removeItem } = useCartStore();
  const { user, isAuthenticated } = useAuthStore();
  const { settings, updateSettings } = useSettingsStore();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [placedOrderId, setPlacedOrderId] = useState('');
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [customerEmail, setCustomerEmail] = useState(user?.email || '');

  const shipping = totalPrice() >= settings.freeShippingThreshold ? 0 : settings.shippingFee;
  const packagingRate = Math.max(0, Number(settings.packagingRate) || 0);
  const packagingCost = Math.round(totalPrice() * packagingRate / 100);
  const grandTotal = totalPrice() + packagingCost + shipping;

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
  const effectiveEmail = String(isAuthenticated ? user?.email || '' : customerEmail || '').trim();

  // Payment status is now handled on the dedicated Payment Status page.

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
          packagingRate: data.packagingRate,
          minOrderAmount: data.minOrderAmount,
          maxOrderQuantity: data.maxOrderQuantity,
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

  useEffect(() => {
    const available: string[] = [];
    if (settings.upiEnabled) available.push('upi');
    if (settings.cardEnabled) available.push('card');
    if (available.length > 0 && !available.includes(paymentMethod)) {
      setPaymentMethod(available[0]);
    }
  }, [settings.upiEnabled, settings.cardEnabled, paymentMethod]);

  useEffect(() => {
    if (user?.email) setCustomerEmail(user.email);
  }, [user?.email]);

  const shouldRedirectToCart = items.length === 0 && step < 2;
  useEffect(() => {
    if (shouldRedirectToCart) navigate('/cart');
  }, [shouldRedirectToCart, navigate]);
  if (shouldRedirectToCart) return null;

  const validateAddress = (addr: Address) => addr.fullName && addr.mobile && addr.street && addr.pincode && addr.city && addr.state;

  const validateContactAndAddress = () => {
    if (!isValidEmail(effectiveEmail)) {
      toast.error('Please enter a valid email address for order updates');
      setStep(0);
      return false;
    }
    if (!validateAddress(billingAddress)) {
      toast.error('Please fill all billing address details');
      setStep(0);
      return false;
    }
    if (!sameAsBilling && !validateAddress(shippingAddress)) {
      toast.error('Please fill all shipping address details');
      setStep(0);
      return false;
    }
    return true;
  };

  const submitPayuForm = (actionUrl: string, fields: Record<string, string>) => {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = actionUrl;
    Object.entries(fields).forEach(([key, value]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = value;
      form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
  };

  const startPayuPayment = async (method: 'upi' | 'card') => {
    if (!validateContactAndAddress()) return;
    setProcessing(true);
    try {
        const orderPayload = {
          userId: isAuthenticated ? user?.id : undefined,
          items: items.map((i) => ({
            productId: i.product.id,
            name: i.product.name,
            image: i.product.image,
            quantity: i.quantity,
            price: i.product.price,
            selectedSize: i.product.selectedSize,
            selectedPieces: i.product.selectedPieces,
            selectedAttributes: i.product.selectedAttributes,
          })),
          total: grandTotal,
          status: 'confirmed',
          customerName: billingAddress.fullName,
        customerEmail: effectiveEmail,
        shippingAddress: effectiveShipping,
        billingAddress,
        paymentMethod: method === 'upi' ? 'PayU UPI' : 'PayU Card',
      };
      const result = await createPayuOrder({
        amount: grandTotal,
        method,
        order: orderPayload,
        customer: { name: billingAddress.fullName, email: effectiveEmail, phone: billingAddress.mobile },
      });
      submitPayuForm(result.actionUrl, result.fields);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      toast.error(message || 'Unable to start payment. Please try again.');
      setProcessing(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!validateContactAndAddress()) return;

    if (settings.minOrderAmount && grandTotal < settings.minOrderAmount) {
      toast.error(`Minimum order amount is ${formatPrice(settings.minOrderAmount)}.`);
      return;
    }


    if (paymentMethod === 'upi') {
      startPayuPayment('upi');
    } else if (paymentMethod === 'card') {
      startPayuPayment('card');
    }
  };

  const addressFields = [
    { key: 'fullName', label: 'Full Name', type: 'text', full: false },
    { key: 'mobile', label: 'Mobile Number', type: 'tel', full: false },
    { key: 'street', label: 'Full Address', type: 'text', full: true, multiline: true },
    { key: 'city', label: 'City', type: 'text', full: false },
    { key: 'state', label: 'State', type: 'text', full: false },
    { key: 'pincode', label: 'Pincode', type: 'text', full: false },
  ];

  const paymentOptions = [
    ...(settings.upiEnabled ? [{
      value: 'upi',
      title: 'UPI',
      subtitle: 'Pay securely using UPI',
      icon: Smartphone,
      pills: ['GPay', 'PhonePe', 'Paytm', 'BHIM'],
      badge: 'Recommended',
    }] : []),
    ...(settings.cardEnabled ? [{
      value: 'card',
      title: 'Credit or Debit Card',
      subtitle: 'Visa, Mastercard, RuPay, Amex',
      icon: CreditCard,
      pills: ['Visa', 'Mastercard', 'RuPay', 'Amex', 'Maestro'],
      badge: 'Bank Offers',
    }] : []),
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
            {f.multiline ? (
              <textarea
                rows={3}
                value={addr[f.key as keyof Address]}
                onChange={(e) => setAddr((a) => ({ ...a, [f.key]: e.target.value }))}
                placeholder="House/Flat no, Building, Area, Landmark"
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-gold transition-colors resize-none"
              />
            ) : f.key === 'state' ? (
              <select
                value={String(addr.state || '')}
                onChange={(e) => setAddr((a) => ({ ...a, state: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-gold transition-colors"
              >
                <option value="" disabled>Select state</option>
                {INDIA_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            ) : (
              <input
                type={f.type}
                value={addr[f.key as keyof Address]}
                onChange={(e) => setAddr((a) => ({ ...a, [f.key]: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-gold transition-colors"
              />
            )}
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

                    <div>
                      <h3 className="text-sm font-semibold text-foreground mb-3">Contact Details</h3>
                      <label className="block text-sm font-medium mb-1">Email Address</label>
                      <input
                        type="email"
                        value={effectiveEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        disabled={isAuthenticated}
                        placeholder="you@example.com"
                        className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-gold transition-colors disabled:opacity-70"
                      />
                    </div>

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

                    <button onClick={() => validateContactAndAddress() && setStep(1)} className="w-full py-3 rounded-xl bg-gold-gradient text-maroon-dark font-bold text-sm shimmer active:scale-[0.97] transition-transform">
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

                    {paymentMethod === 'upi' && (
                      <div className="mt-5 grid lg:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <div className="text-sm font-semibold text-foreground">UPI Payments</div>
                          <div className="grid sm:grid-cols-2 gap-3">
                            <div className="text-left p-4 rounded-xl border border-border bg-muted/30">
                              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                <CheckCircle2 size={16} className="text-tulsi" />
                                Instant confirmation
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">Pay using any UPI app. No extra steps.</div>
                            </div>
                            <div className="text-left p-4 rounded-xl border border-border bg-muted/30">
                              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                <ShieldCheck size={16} className="text-gold" />
                                Safe & encrypted
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">Your UPI PIN is never shared with BrajMart.</div>
                            </div>
                          </div>
                          <div className="rounded-xl border border-border bg-pearl p-3 text-xs text-muted-foreground">
                            Works with GPay, PhonePe, Paytm, BHIM, Amazon Pay, and all UPI apps.
                          </div>
                        </div>

                        <div className="rounded-2xl border border-border bg-muted/30 p-4">
                          <div className="text-sm font-semibold text-foreground mb-2">How UPI payment works</div>
                          <div className="space-y-2 text-xs text-muted-foreground">
                            <div className="flex items-start gap-2">
                              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold/10 text-gold font-bold text-[11px]">1</span>
                              <span>Choose UPI and place the order.</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold/10 text-gold font-bold text-[11px]">2</span>
                              <span>Approve the payment request in your UPI app.</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold/10 text-gold font-bold text-[11px]">3</span>
                              <span>Enter UPI PIN to complete payment.</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {paymentMethod === 'card' && (
                      <div className="mt-5 rounded-2xl border border-brand-gold/20 bg-gradient-to-br from-brand-deep via-brand-structure to-brand-deep p-5 text-primary-foreground shadow-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-widest text-primary-foreground/60">Secure Payments</p>
                            <h3 className="text-lg font-semibold">Card Payment</h3>
                            <p className="text-xs text-primary-foreground/70 mt-1">Cards • NetBanking • Wallets • EMI</p>
                          </div>
                          <div className="flex gap-2">
                            {['VISA', 'MC', 'RUPAY', 'AMEX'].map((b) => (
                              <span key={b} className="px-2 py-1 rounded-lg bg-primary-foreground/10 text-[10px] font-bold tracking-wide">
                                {b}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="mt-4 grid sm:grid-cols-3 gap-3">
                          {['Instant Bank Offers', 'Zero-Cost EMI', '100% Secure'].map((t) => (
                            <div key={t} className="rounded-xl border border-primary-foreground/10 bg-primary-foreground/5 px-3 py-2 text-xs">
                              {t}
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 text-xs text-primary-foreground/70">
                          You may be redirected to a secure payment page to complete payment.
                        </div>
                      </div>
                    )}


                    <div className="mt-5 p-4 rounded-xl border border-gold/30 bg-gold/5 text-sm">
                      <div className="flex items-center gap-2 text-foreground font-medium">
                        <ShieldCheck size={16} className="text-gold" />
                        100% Secure Checkout
                      </div>
                      <p className="text-muted-foreground text-xs mt-1">
                        Payments are encrypted end-to-end. BrajMart never stores your card details or UPI PIN.
                      </p>
                    </div>

                    <button
                      onClick={handlePlaceOrder}
                      disabled={processing || paymentOptions.length === 0}
                      className="mt-6 w-full py-3 rounded-xl bg-gold-gradient text-maroon-dark font-bold text-sm shimmer active:scale-[0.97] transition-transform disabled:opacity-60"
                    >
                      {processing
                        ? 'Processing Payment...'
                        : `Pay Now - ${formatPrice(grandTotal)}`}
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
              <div className="bg-card rounded-2xl border border-border p-6 lg:sticky lg:top-24">
                <h3 className="font-cinzel text-lg font-bold mb-4">Order Summary</h3>
                <div className="space-y-3 mb-5">
                  {items.map((item) => (
                    <div key={item.product.id} className="flex gap-3">
                      <img src={item.product.image} alt={item.product.name} className="w-12 h-12 rounded-lg object-cover border border-border" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground line-clamp-1">{item.product.name}</p>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <div className="inline-flex items-center border border-border rounded-lg overflow-hidden bg-background">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                              className="px-2.5 py-1.5 hover:bg-muted transition-colors"
                              aria-label={`Decrease quantity of ${item.product.name}`}
                            >
                              <Minus size={14} />
                            </button>
                            <span className="px-3 text-xs font-semibold tabular-nums">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                              className="px-2.5 py-1.5 hover:bg-muted transition-colors"
                              aria-label={`Increase quantity of ${item.product.name}`}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(item.product.id)}
                            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                            aria-label={`Remove ${item.product.name} from order`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-xs font-semibold tabular-nums">{formatPrice(item.product.price * item.quantity)}</div>
                        <div className="text-[0.7rem] text-muted-foreground tabular-nums">{formatPrice(item.product.price)} each</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="space-y-2 text-sm border-t border-border pt-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Product price</span>
                    <span>{formatPrice(totalPrice())}</span>
                  </div>
                  {totalSavings() > 0 && (
                    <div className="flex justify-between text-tulsi">
                      <span>Savings</span>
                      <span>-{formatPrice(totalSavings())}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Packaging cost ({packagingRate}%)</span>
                    <span>{formatPrice(packagingCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shipping charge</span>
                    <span className={shipping === 0 ? 'text-tulsi font-medium' : ''}>{shipping === 0 ? 'FREE' : formatPrice(shipping)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-base border-t border-border pt-2">
                    <span>Total</span>
                    <span className="text-saffron">{formatPrice(grandTotal)}</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-pearl px-3 py-2 text-xs text-muted-foreground">
                  <ShieldCheck size={16} className="text-tulsi" />
                  <span>Secure checkout. Prices update with quantity.</span>
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
