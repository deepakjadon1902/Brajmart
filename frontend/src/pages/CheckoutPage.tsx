import * as React from "react";
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, CreditCard, CheckCircle2, Copy, ShieldCheck, Smartphone, Check, Minus, Plus, Trash2, Landmark, WalletCards, Truck } from 'lucide-react';
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
import { fetchPublicSettings, createPayuOrder, createRazorpayOrder, verifyRazorpayPayment, reportRazorpayPaymentFailed, checkDtdcPincode } from '@/lib/api';
import { trackMetaPixelEvent } from '@/lib/metaPixel';

const steps = ['Delivery Details', 'Payment', 'Confirmation'];
const DEFAULT_FREE_SHIPPING_THRESHOLD = 299;
const DEFAULT_SHIPPING_FEE = 49;
const COD_CHARGE = 40;
type ServiceabilityState = { pincode: string; serviceable: boolean; codAvailable: boolean; message?: string };

const emptyAddress: Address = { fullName: '', mobile: '', street: '', city: '', state: '', pincode: '' };

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: unknown) => void) => void;
    };
  }
}

const loadRazorpayCheckout = () =>
  new Promise<boolean>((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

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
  const [paymentMethod, setPaymentMethod] = useState('razorpay');
  const [placedOrderId, setPlacedOrderId] = useState('');
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [customerEmail, setCustomerEmail] = useState(user?.email || '');
  const [serviceability, setServiceability] = useState<ServiceabilityState | null>(null);
  const [checkingPincode, setCheckingPincode] = useState(false);
  const [wantsCodService, setWantsCodService] = useState(false);

  const freeShippingThreshold = Number(settings.freeShippingThreshold) > 0 ? Number(settings.freeShippingThreshold) : DEFAULT_FREE_SHIPPING_THRESHOLD;
  const shippingFee = Number(settings.shippingFee) > 0 ? Number(settings.shippingFee) : DEFAULT_SHIPPING_FEE;
  const shipping = totalPrice() >= freeShippingThreshold ? 0 : shippingFee;
  const packagingRate = Math.max(0, Number(settings.packagingRate) || 0);
  const packagingCost = Math.round(totalPrice() * packagingRate / 100);
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
  const effectivePincode = String(effectiveShipping.pincode || '').trim();
  const codAvailable = Boolean(serviceability?.pincode === effectivePincode && serviceability.serviceable && serviceability.codAvailable);
  const canUseCodService = Boolean(settings.codEnabled && codAvailable);
  const codCharge = wantsCodService && canUseCodService ? COD_CHARGE : 0;
  const grandTotal = totalPrice() + packagingCost + shipping + codCharge;

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
          packagingRate: data.packagingRate ?? data.taxRate ?? 0,
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

  useEffect(() => {
    const available: string[] = ['razorpay'];
    if (settings.upiEnabled) available.push('upi');
    if (settings.cardEnabled) available.push('card');
    if (available.length > 0 && !available.includes(paymentMethod)) {
      setPaymentMethod(available[0]);
    }
  }, [settings.upiEnabled, settings.cardEnabled, paymentMethod]);

  useEffect(() => {
    if (serviceability && serviceability.pincode !== effectivePincode) {
      setServiceability(null);
      setWantsCodService(false);
    }
  }, [effectivePincode, serviceability]);

  useEffect(() => {
    if (wantsCodService && !canUseCodService) setWantsCodService(false);
  }, [canUseCodService, wantsCodService]);

  useEffect(() => {
    if (!/^\d{6}$/.test(effectivePincode)) return;
    if (serviceability?.pincode === effectivePincode) return;

    let active = true;
    const timer = window.setTimeout(async () => {
      setCheckingPincode(true);
      try {
        const result: any = await checkDtdcPincode({ desPincode: effectivePincode });
        if (!active) return;
        setServiceability({
          pincode: effectivePincode,
          serviceable: Boolean(result?.serviceable),
          codAvailable: Boolean(result?.codAvailable),
          message: typeof result?.message === 'string' ? result.message : '',
        });
      } catch {
        if (active) setServiceability(null);
      } finally {
        if (active) setCheckingPincode(false);
      }
    }, 600);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [effectivePincode, serviceability?.pincode]);

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

  const verifyDeliveryPincode = async () => {
    const pincode = String(effectiveShipping.pincode || '').trim();
    if (!/^\d{6}$/.test(pincode)) {
      toast.error('Please enter a valid 6 digit delivery pincode');
      setStep(0);
      return false;
    }
    if (serviceability?.pincode === pincode && serviceability.serviceable) return true;

    setCheckingPincode(true);
    try {
      const result: any = await checkDtdcPincode({ desPincode: pincode });
      const next = {
        pincode,
        serviceable: Boolean(result?.serviceable),
        codAvailable: Boolean(result?.codAvailable),
        message: typeof result?.message === 'string' ? result.message : '',
      };
      setServiceability(next);
      if (!next.serviceable) {
        toast.error(next.message || 'DTDC delivery is not available for this pincode right now');
        return false;
      }
      toast.success('Delivery pincode verified');
      return true;
    } catch {
      setServiceability(null);
      toast.info('Could not verify courier serviceability right now. You can continue and our team will confirm dispatch.');
      return true;
    } finally {
      setCheckingPincode(false);
    }
  };

  const handleContinueToPayment = async () => {
    if (!validateContactAndAddress()) return;
    const canDeliver = await verifyDeliveryPincode();
    if (canDeliver) setStep(1);
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
        codRequested: codCharge > 0,
        codAmount: codCharge,
        codPincode: codCharge > 0 ? effectivePincode : undefined,
        codMessage: codCharge > 0 ? serviceability?.message || `COD available for ${effectivePincode}` : undefined,
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

  const startRazorpayPayment = async () => {
    if (!validateContactAndAddress()) return;
    setProcessing(true);
    try {
      const loaded = await loadRazorpayCheckout();
      if (!loaded || !window.Razorpay) {
        throw new Error('Unable to load Razorpay checkout. Please try again.');
      }

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
        paymentMethod: 'Razorpay',
        codRequested: codCharge > 0,
        codAmount: codCharge,
        codPincode: codCharge > 0 ? effectivePincode : undefined,
        codMessage: codCharge > 0 ? serviceability?.message || `COD available for ${effectivePincode}` : undefined,
      };

      const result = await createRazorpayOrder({
        amount: grandTotal,
        order: orderPayload,
        customer: { name: billingAddress.fullName, email: effectiveEmail, phone: billingAddress.mobile },
      });

      const checkout = new window.Razorpay({
        key: result.keyId,
        amount: result.amount,
        currency: result.currency,
        name: result.name,
        description: result.description,
        image: settings.storeLogo || '/logo.png',
        order_id: result.orderId,
        prefill: result.prefill,
        notes: {
          source: 'brajmart_checkout',
        },
        theme: {
          color: '#E8680A',
        },
        modal: {
          ondismiss: () => setProcessing(false),
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
            navigate(`/payment-status/${encodeURIComponent(result.statusToken)}`);
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : '';
            toast.error(message || 'Payment completed, but verification failed. We will verify it automatically.');
            navigate(`/payment-status/${encodeURIComponent(result.statusToken)}`);
          } finally {
            setProcessing(false);
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
            customer_email: effectiveEmail,
            reason,
          });
        } catch {
          // Webhooks may still reconcile this. Keep the user moving to the status page.
        }
        toast.error('Razorpay payment failed. Please try again.');
        setProcessing(false);
        navigate(`/payment-status/${encodeURIComponent(result.statusToken)}`);
      });
      checkout.open();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      toast.error(message || 'Unable to start Razorpay payment. Please try again.');
      setProcessing(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!validateContactAndAddress()) return;
    const canDeliver = await verifyDeliveryPincode();
    if (!canDeliver) return;

    if (settings.minOrderAmount && grandTotal < settings.minOrderAmount) {
      toast.error(`Minimum order amount is ${formatPrice(settings.minOrderAmount)}.`);
      return;
    }

    trackMetaPixelEvent('AddPaymentInfo', {
      content_ids: items.map((i) => String(i.product.id || i.product.slug || i.product.name)),
      content_type: 'product',
      contents: items.map((i) => ({
        id: String(i.product.id || i.product.slug || i.product.name),
        item_price: Number(i.product.price) || 0,
        quantity: Number(i.quantity) || 1,
      })),
      num_items: items.reduce((sum, i) => sum + (Number(i.quantity) || 1), 0),
      value: grandTotal,
      payment_method: paymentMethod,
    });

    if (paymentMethod === 'razorpay') {
      startRazorpayPayment();
    } else if (paymentMethod === 'upi') {
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
    {
      value: 'razorpay',
      title: 'Razorpay',
      subtitle: 'Official Razorpay Checkout for UPI, cards, netbanking, wallets, and EMI',
      icon: CreditCard,
      pills: ['Primary', 'UPI', 'Cards', 'NetBanking', 'Wallets'],
      badge: 'Primary',
    },
    ...(settings.upiEnabled ? [{
      value: 'upi',
      title: 'PayU UPI',
      subtitle: 'Secondary PayU fallback for UPI payments',
      icon: Smartphone,
      pills: ['GPay', 'PhonePe', 'Paytm', 'BHIM'],
      badge: 'Secondary',
    }] : []),
    ...(settings.cardEnabled ? [{
      value: 'card',
      title: 'PayU Card',
      subtitle: 'Secondary PayU fallback for cards',
      icon: CreditCard,
      pills: ['Visa', 'Mastercard', 'RuPay', 'Amex', 'Maestro'],
      badge: 'Secondary',
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

                    <div className="rounded-xl border border-border bg-muted/30 p-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Truck size={16} className="text-gold" />
                        DTDC delivery check
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {serviceability?.pincode === String(effectiveShipping.pincode || '').trim()
                          ? serviceability.serviceable
                            ? serviceability.codAvailable
                              ? `Delivery and COD available for ${serviceability.pincode}. COD Handle Fee ${formatPrice(COD_CHARGE)} applies only when COD is selected.`
                              : `Delivery available for ${serviceability.pincode}. COD is not available for this pincode.`
                            : serviceability.message || `Delivery needs review for ${serviceability.pincode}.`
                          : checkingPincode
                            ? 'Checking this pincode with DTDC...'
                            : 'Your delivery pincode is verified automatically when you enter 6 digits.'}
                      </p>
                    </div>

                    <button
                      onClick={handleContinueToPayment}
                      disabled={checkingPincode}
                      className="w-full py-3 rounded-xl bg-gold-gradient text-maroon-dark font-bold text-sm shimmer active:scale-[0.97] transition-transform disabled:opacity-60"
                    >
                      {checkingPincode ? 'Checking Delivery...' : 'Continue to Payment'}
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 1 && (
                <motion.div key="payment" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                  <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
                    <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <CreditCard size={18} className="text-gold" />
                          <h2 className="font-cinzel text-lg font-bold">Payment Method</h2>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">Choose a secure payment gateway to complete your BrajMart order.</p>
                      </div>
                      <div className="rounded-xl border border-gold/25 bg-gold/5 px-4 py-3 text-right">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Payable Now</p>
                        <p className="text-xl font-bold text-saffron tabular-nums">{formatPrice(grandTotal)}</p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      {[
                        { icon: ShieldCheck, title: 'Secure gateway', text: 'Encrypted checkout' },
                        { icon: CheckCircle2, title: 'Verified order', text: 'Email confirmation' },
                        { icon: Truck, title: 'DTDC checked', text: codAvailable ? 'COD serviceable' : 'Delivery verified' },
                      ].map((item) => (
                        <div key={item.title} className="flex items-center gap-3 rounded-xl border border-border bg-pearl/60 px-3 py-2.5">
                          <item.icon size={16} className="shrink-0 text-tulsi" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground">{item.title}</p>
                            <p className="text-[11px] text-muted-foreground">{item.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {paymentOptions.length === 0 ? (
                      <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                        No payment methods are currently available. Please contact support.
                      </div>
                    ) : (
                      <div className="mt-5 space-y-3">
                        {paymentOptions.map((m) => {
                          const Icon = m.icon;
                          const selected = paymentMethod === m.value;
                          return (
                            <label
                              key={m.value}
                              className={`group flex items-center gap-4 rounded-xl border p-4 cursor-pointer transition-all ${selected ? 'border-gold bg-gold/5 shadow-[0_0_0_1px_rgba(218,165,32,0.2)]' : 'border-border bg-background hover:border-gold/50 hover:bg-pearl/50'}`}
                            >
                              <input
                                type="radio"
                                name="payment"
                                value={m.value}
                                checked={selected}
                                onChange={() => setPaymentMethod(m.value)}
                                className="sr-only"
                              />
                              <div className={`h-12 w-12 rounded-xl flex items-center justify-center border ${selected ? 'border-gold/40 bg-gold/10 text-gold' : 'border-border bg-pearl text-muted-foreground'}`}>
                                <Icon size={18} />
                              </div>
                              <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-semibold">{m.title}</span>
                                  <span className={`text-[11px] px-2 py-0.5 rounded-full border bg-background ${selected ? 'border-gold text-gold' : 'border-border text-muted-foreground'}`}>
                                    {m.badge}
                                  </span>
                                  {selected && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-tulsi">
                                      <CheckCircle2 size={12} />
                                      Selected
                                    </span>
                                  )}
                                </div>
                                <span className="block text-xs text-muted-foreground mt-0.5">{m.subtitle}</span>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {m.pills.map((p) => (
                                    <span key={p} className="text-[11px] px-2 py-0.5 rounded-full border border-border bg-background text-muted-foreground">
                                      {p}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selected ? 'border-gold bg-gold/10' : 'border-border bg-background'}`}>
                                {selected && <div className="w-3 h-3 rounded-full bg-gold" />}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {settings.codEnabled && (
                      <div className={`mt-5 rounded-xl border p-4 transition-colors ${canUseCodService ? 'border-tulsi/30 bg-tulsi/5' : 'border-border bg-muted/30'}`}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 h-10 w-10 rounded-xl flex items-center justify-center border ${canUseCodService ? 'border-tulsi/30 bg-tulsi/10 text-tulsi' : 'border-border bg-background text-muted-foreground'}`}>
                              <Truck size={17} />
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-foreground">DTDC COD service</p>
                                <span className={`text-[11px] px-2 py-0.5 rounded-full border ${canUseCodService ? 'border-tulsi/30 text-tulsi' : 'border-border text-muted-foreground'}`}>
                                  {canUseCodService ? 'Available' : checkingPincode ? 'Checking' : 'Not available'}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {canUseCodService
                                  ? `Want COD service for this shipment? COD Handle Fee ${formatPrice(COD_CHARGE)} will be added to your online payment total.`
                                  : 'Enter a DTDC COD serviceable pincode in delivery details to enable this service.'}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => canUseCodService && setWantsCodService((value) => !value)}
                            disabled={!canUseCodService}
                            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${wantsCodService ? 'bg-tulsi text-white' : 'border border-border bg-background text-foreground hover:border-tulsi/50'}`}
                          >
                            {wantsCodService ? 'COD Added' : 'Want COD'}
                          </button>
                        </div>
                      </div>
                    )}

                    {paymentMethod === 'upi' && (
                      <div className="mt-5 rounded-xl border border-border bg-pearl/50 p-4">
                        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                          <Smartphone size={16} className="text-tulsi" />
                          PayU UPI selected
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">Complete payment from GPay, PhonePe, Paytm, BHIM, or any UPI app through PayU.</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {['GPay', 'PhonePe', 'Paytm', 'BHIM', 'UPI'].map((item) => (
                            <span key={item} className="rounded-lg border border-border bg-background px-3 py-1 text-[11px] font-medium text-muted-foreground">{item}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {paymentMethod === 'card' && (
                      <div className="mt-5 rounded-xl border border-border bg-pearl/50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">PayU Secure Card</p>
                            <h3 className="text-sm font-semibold text-foreground">Card payment selected</h3>
                            <p className="text-xs text-muted-foreground mt-1">Cards, netbanking, wallets, and EMI through PayU</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {['VISA', 'MC', 'RUPAY', 'AMEX'].map((b) => (
                              <span key={b} className="rounded-lg border border-border bg-background px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                                {b}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="mt-4 grid sm:grid-cols-3 gap-3 text-foreground">
                          {['Instant Bank Offers', 'Zero-Cost EMI', '100% Secure'].map((t) => (
                            <div key={t} className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                              {t}
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 text-xs text-muted-foreground">
                          PayU verifies the payment with bank authentication before order confirmation.
                        </div>
                      </div>
                    )}

                    {paymentMethod === 'razorpay' && (
                      <div className="mt-5 overflow-hidden rounded-xl border border-[#cfe0ff] bg-white shadow-sm">
                        <div className="border-b border-[#e6efff] bg-[#0b72e7] px-5 py-4 text-white">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wide text-white/75">Razorpay Secure Checkout</p>
                              <h3 className="mt-1 text-base font-semibold">Official Razorpay payment window</h3>
                              <p className="mt-1 text-xs text-white/80">Your payable amount and BrajMart order reference are sent to Razorpay securely.</p>
                            </div>
                            <div className="rounded-lg bg-white px-3 py-1.5 text-sm font-black tracking-tight text-[#0b72e7]">
                              Razorpay
                            </div>
                          </div>
                        </div>
                        <div className="grid gap-3 p-5 sm:grid-cols-3">
                          {[
                            { icon: Smartphone, title: 'UPI', text: 'GPay, PhonePe, Paytm, BHIM' },
                            { icon: WalletCards, title: 'Cards & EMI', text: 'Visa, Mastercard, RuPay, Amex' },
                            { icon: Landmark, title: 'NetBanking', text: 'Major Indian banks supported' },
                          ].map((item) => (
                            <div key={item.title} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                                <item.icon size={16} className="text-[#0b72e7]" />
                                {item.title}
                              </div>
                              <p className="mt-1 text-xs text-slate-600">{item.text}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-5 rounded-xl border border-gold/25 bg-gold/5 p-4 text-sm">
                      <div className="flex items-center gap-2 font-medium text-foreground">
                        <ShieldCheck size={16} className="text-gold" />
                        Protected payment
                      </div>
                      <p className="text-muted-foreground text-xs mt-1">
                        BrajMart never stores card details or UPI PIN. Payment status is confirmed by the gateway before your order is marked successful.
                      </p>
                    </div>

                    <button
                      onClick={handlePlaceOrder}
                      disabled={processing || paymentOptions.length === 0}
                      className="mt-6 w-full py-3 rounded-xl bg-gold-gradient text-maroon-dark font-bold text-sm shimmer active:scale-[0.97] transition-transform disabled:opacity-60"
                    >
                      {processing
                        ? 'Processing Payment...'
                        : paymentMethod === 'razorpay'
                          ? `Pay with Razorpay - ${formatPrice(grandTotal)}`
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
              <div className="bg-card rounded-2xl border border-border p-6 shadow-sm lg:sticky lg:top-24">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-cinzel text-lg font-bold">Order Summary</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{items.length} item{items.length === 1 ? '' : 's'} in this order</p>
                  </div>
                  <span className="rounded-full border border-tulsi/25 bg-tulsi/5 px-2.5 py-1 text-[11px] font-semibold text-tulsi">Verified</span>
                </div>
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
                  <div className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <span>Price Details</span>
                    <span>INR</span>
                  </div>
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
                  {codCharge > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">COD Handle Fee</span>
                      <span>{formatPrice(codCharge)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base border-t border-border pt-3">
                    <span>Payable Total</span>
                    <span className="text-saffron">{formatPrice(grandTotal)}</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 rounded-xl border border-tulsi/20 bg-tulsi/5 px-3 py-2 text-xs text-muted-foreground">
                  <ShieldCheck size={16} className="text-tulsi" />
                  <span>Final amount is verified again before payment gateway opens.</span>
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
