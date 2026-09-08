import * as React from "react";
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, CreditCard, CheckCircle2, Copy, ShieldCheck, Smartphone, Check, Minus, Plus, Trash2, Landmark, WalletCards, Truck, Tag, X } from 'lucide-react';
import { SiRazorpay } from 'react-icons/si';
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
import { fetchPublicSettings, createOrder, createRazorpayOrder, verifyRazorpayPayment, reportRazorpayPaymentFailed, checkDeliveryServicePincode, validateCoupon, validateCart, type CartValidationResponse, type PersistedProductInterestItem } from '@/lib/api';
import { trackMetaPixelEvent } from '@/lib/metaPixel';
import { clearCheckoutDraft, readCheckoutDraft, saveCheckoutDraft } from '@/lib/checkoutDraft';

const steps = ['Delivery Details', 'Payment', 'Confirmation'];
const DEFAULT_FREE_SHIPPING_THRESHOLD = 299;
const DEFAULT_SHIPPING_FEE = 49;
const CHECKOUT_IDEMPOTENCY_STORAGE_KEY = 'brajmart-checkout-idempotency';
type ServiceabilityState = { pincode: string; serviceable: boolean; codAvailable: boolean; manualReview?: boolean; message?: string };
type DeliveryCheckResponse = Partial<Omit<ServiceabilityState, 'pincode'>>;
type CreatedOrderResponse = { orderId?: string | number; _id?: string | number; id?: string | number };
type AddressValidationResult = { valid: true } | { valid: false; message: string };
type BundleSnapshot = {
  name: string;
  total: number;
  savings: number;
  products: Array<{ id: string; slug: string; name: string; category: string; price: number; image: string }>;
};
type AppliedCoupon = {
  code: string;
  discountAmount: number;
  description?: string;
};
type CouponValidationResponse = {
  coupon?: AppliedCoupon;
  message?: string;
};

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const DUMMY_TEXT_PATTERN = /^(test|testing|demo|dummy|fake|sample|asdf|qwerty|abc|abcd|aaaa|xxxxx|none|null|unknown|na|n\/a)$/i;
const DUMMY_EMAIL_PATTERN = /@(example\.com|test\.com|fake\.com|dummy\.com)$/i;

const cleanText = (value?: string) => String(value || '').trim().replace(/\s+/g, ' ');
const isRepeatedCharacters = (value: string) => /^([a-z0-9])\1+$/i.test(value.replace(/\s+/g, ''));
const isDummyText = (value?: string) => {
  const cleaned = cleanText(value);
  return !cleaned || DUMMY_TEXT_PATTERN.test(cleaned) || isRepeatedCharacters(cleaned);
};
const isValidIndianMobile = (value?: string) => {
  const digits = String(value || '').replace(/\D/g, '');
  return /^[6-9]\d{9}$/.test(digits) && !isRepeatedCharacters(digits);
};
const isValidPincode = (value?: string) => {
  const digits = String(value || '').replace(/\D/g, '');
  return /^[1-9]\d{5}$/.test(digits) && !isRepeatedCharacters(digits) && digits !== '123456';
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

const isTransientRazorpayFailure = (reason: string) =>
  /too many requests|rate limit|payment processing|request timed out|timeout|upi request/i.test(reason);

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

const RazorpayLogo = () => (
  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#0b72e7]/25 bg-[#0b72e7]/10 text-[#0b72e7]">
    <SiRazorpay size={24} />
  </div>
);

const CodLogo = () => (
  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-tulsi/25 bg-tulsi/10 text-tulsi">
    <Truck size={23} />
  </div>
);

const getDefaultAddress = (user: ReturnType<typeof useAuthStore.getState>['user']): Address => ({
  fullName: user?.fullName || '',
  mobile: user?.mobile || '',
  street: user?.address || '',
  addressLine2: '',
  city: user?.city || '',
  state: user?.state || '',
  pincode: user?.pincode || '',
  email: user?.email || '',
});

const CheckoutPage = () => {
  const { items, totalPrice, totalSavings, updateQuantity, removeItem, clearCart, reconcileValidatedItems } = useCartStore();
  const { user, isAuthenticated } = useAuthStore();
  const { settings, updateSettings } = useSettingsStore();
  const navigate = useNavigate();
  const [initialCheckoutDraft] = useState(() => readCheckoutDraft(user?.id));
  const defaultAddress = getDefaultAddress(user);

  const [step, setStep] = useState(() => initialCheckoutDraft?.step && initialCheckoutDraft.step > 0 ? initialCheckoutDraft.step : 0);
  const [paymentMethod, setPaymentMethod] = useState(initialCheckoutDraft?.paymentMethod || 'razorpay');
  const [placedOrderId, setPlacedOrderId] = useState('');
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(initialCheckoutDraft?.billingSameAsShipping ?? true);
  const [processing, setProcessing] = useState(false);
  const [customerEmail, setCustomerEmail] = useState(initialCheckoutDraft?.customerEmail || user?.email || '');
  const [serviceability, setServiceability] = useState<ServiceabilityState | null>(null);
  const [checkingPincode, setCheckingPincode] = useState(false);
  const [wantsCodService, setWantsCodService] = useState(initialCheckoutDraft?.wantsCodService ?? false);
  const [couponCode, setCouponCode] = useState(initialCheckoutDraft?.couponCode || '');
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(initialCheckoutDraft?.appliedCoupon || null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [bundleSnapshot, setBundleSnapshot] = useState<BundleSnapshot | null>(null);
  const [checkoutValidation, setCheckoutValidation] = useState<CartValidationResponse | null>(null);
  const [checkoutValidationError, setCheckoutValidationError] = useState('');
  const [checkoutValidating, setCheckoutValidating] = useState(false);

  const freeShippingThreshold = Number(settings.freeShippingThreshold) > 0 ? Number(settings.freeShippingThreshold) : DEFAULT_FREE_SHIPPING_THRESHOLD;
  const shippingFee = Number(settings.shippingFee) > 0 ? Number(settings.shippingFee) : DEFAULT_SHIPPING_FEE;
  const localSubtotal = totalPrice();
  const shipping = localSubtotal >= freeShippingThreshold ? 0 : shippingFee;
  const packagingRate = Math.max(0, Number(settings.packagingRate) || 0);
  const packagingCost = Math.round(localSubtotal * packagingRate / 100);
  const codFee = Math.max(0, Number(settings.codFee ?? 40) || 0);
  const [billingAddress, setBillingAddress] = useState<Address>(initialCheckoutDraft?.billingAddress || defaultAddress);

  const [shippingAddress, setShippingAddress] = useState<Address>(initialCheckoutDraft?.shippingAddress || defaultAddress);

  const effectiveShipping = shippingAddress;
  const effectiveEmail = String(billingAddress.email || shippingAddress.email || customerEmail || user?.email || '').trim();
  const effectivePincode = String(effectiveShipping.pincode || '').trim();
  const codDecisionItems = checkoutValidation?.items?.length
    ? checkoutValidation.items
    : items.map((i) => i.product);
  const hasPrasadamItems = codDecisionItems.some((item: any) => {
    const text = `${item.category || ''} ${item.name || ''} ${item.slug || ''}`.toLowerCase();
    return /\bprasadam\b|\bprasad\b/.test(text);
  });
  const codEligibleItems = codDecisionItems.every((product: any) => {
    if (product.codEnabled !== null && product.codEnabled !== undefined) return Boolean(product.codEnabled);
    if (product.categoryCodEnabled !== undefined) return Boolean(product.categoryCodEnabled);
    return true;
  });
  const deliveryServiceable = Boolean(serviceability?.pincode === effectivePincode && serviceability.serviceable);
  const partnerCodAvailable = Boolean(deliveryServiceable && serviceability?.codAvailable);
  const canUseCodService = Boolean(partnerCodAvailable && !hasPrasadamItems && codEligibleItems);
  const codUnavailableReason = hasPrasadamItems
    ? 'COD is not available for Prasadam products.'
    : !codEligibleItems
      ? 'COD is enabled only for selected products and categories in this order.'
      : !deliveryServiceable
        ? 'Enter a serviceable delivery pincode to enable COD.'
        : !partnerCodAvailable
          ? 'COD is not available for this delivery pincode.'
          : 'COD is currently unavailable.';
  const validatedSubtotal = checkoutValidation?.subtotal ?? localSubtotal;
  const validatedShipping = checkoutValidation?.shipping ?? shipping;
  const validatedPackaging = checkoutValidation?.packaging ?? packagingCost;
  const validatedCodFee = checkoutValidation?.codFee ?? codFee;
  const codCharge = wantsCodService && canUseCodService ? validatedCodFee : 0;
  const couponDiscount = Number(appliedCoupon?.discountAmount || 0);
  const grandTotalBeforeCoupon = validatedSubtotal + validatedPackaging + validatedShipping + codCharge;
  const grandTotal = Math.max(0, grandTotalBeforeCoupon - couponDiscount);
  const hasCheckoutValidationChanges = Boolean(checkoutValidation?.changes?.length);
  const hasCheckoutUnavailableItems = Boolean(checkoutValidation?.unavailableItems?.length);
  const checkoutValidatedCleanly = Boolean(checkoutValidation && !checkoutValidationError && !hasCheckoutValidationChanges && !hasCheckoutUnavailableItems);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('brajmart-last-bundle');
      if (!raw) return;
      const parsed = JSON.parse(raw) as BundleSnapshot;
      if (!parsed?.name || !Array.isArray(parsed.products) || parsed.products.length !== 5) return;
      const cartIds = new Set(items.map((item) => item.product.id));
      const bundleStillInCart = parsed.products.every((product) => cartIds.has(product.id));
      setBundleSnapshot(bundleStillInCart ? parsed : null);
      if (!bundleStillInCart) sessionStorage.removeItem('brajmart-last-bundle');
    } catch {
      setBundleSnapshot(null);
    }
  }, [items]);

  // Payment status is now handled on the dedicated Payment Status page.

  useEffect(() => {
    let active = true;
    const loadSettings = async () => {
      try {
        const data = await fetchPublicSettings({ fresh: true });
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
          codFee: data.codFee ?? 40,
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
    if (serviceability && serviceability.pincode !== effectivePincode) {
      setServiceability(null);
      setWantsCodService(false);
      if (paymentMethod === 'cod') setPaymentMethod('razorpay');
    }
  }, [effectivePincode, paymentMethod, serviceability]);

  useEffect(() => {
    if (paymentMethod === 'cod') {
      if (canUseCodService) setWantsCodService(true);
      else {
        setPaymentMethod('razorpay');
        setWantsCodService(false);
      }
      return;
    }
    if (wantsCodService) setWantsCodService(false);
  }, [canUseCodService, paymentMethod, wantsCodService]);

  const couponItemSignature = items
    .map((i) => `${i.product.id}:${i.quantity}:${i.product.selectedSize || ''}:${i.product.selectedPieces || ''}`)
    .join('|');

  useEffect(() => {
    setAppliedCoupon((current) => current ? null : current);
    setCheckoutValidation(null);
    setCheckoutValidationError('');
  }, [couponItemSignature]);

  const checkoutItemsPayload = (): PersistedProductInterestItem[] => items.map((i) => ({
    productId: i.product.id,
    name: i.product.name,
    image: i.product.image,
    quantity: i.quantity,
    price: i.product.price,
    selectedSize: i.product.selectedSize,
    selectedPieces: i.product.selectedPieces,
    selectedAttributes: i.product.selectedAttributes,
  }));

  const runCheckoutValidation = async (mode: 'silent' | 'submit' = 'submit') => {
    setCheckoutValidating(true);
    setCheckoutValidationError('');
    try {
      const result = await validateCart(checkoutItemsPayload());
      setCheckoutValidation(result);

      if (result.unavailableItems.length > 0) {
        const message = result.unavailableItems[0]?.message || 'Some products are not available right now.';
        if (mode === 'submit') toast.error(message);
        return false;
      }
      if (result.changes.length > 0) {
        const message = result.changes[0]?.message || 'Your cart changed. Please review the updated cart before payment.';
        if (mode === 'submit') toast.info(message);
        return false;
      }
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to validate your cart right now.';
      setCheckoutValidationError(message);
      if (mode === 'submit') toast.error(message);
      return false;
    } finally {
      setCheckoutValidating(false);
    }
  };

  useEffect(() => {
    if (!items.length) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const result = await validateCart(checkoutItemsPayload());
        if (active) setCheckoutValidation(result);
      } catch {
        // Submit still performs a blocking validation.
      }
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [couponItemSignature]);

  const applyCheckoutUpdates = () => {
    if (!checkoutValidation) return;
    reconcileValidatedItems(checkoutValidation.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      price: item.price,
      originalPrice: item.originalPrice,
      name: item.name,
      slug: item.slug,
      image: item.image,
      category: item.category,
      inStock: item.inStock,
      codEnabled: item.codEnabled,
      categoryCodEnabled: item.categoryCodEnabled,
      availableQuantity: item.availableQuantity,
    })));
    setCheckoutValidation(null);
    setAppliedCoupon(null);
    toast.success('Cart updated with current prices and availability.');
  };

  const handleApplyCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) {
      toast.error('Enter coupon code');
      return;
    }
    setCouponLoading(true);
    try {
      const result = await validateCoupon({ code, items: checkoutItemsPayload() }) as CouponValidationResponse;
      setAppliedCoupon(result.coupon || null);
      setCouponCode(result.coupon?.code || code);
      toast.success(result.message || 'Coupon applied');
    } catch (err: unknown) {
      setAppliedCoupon(null);
      toast.error(err instanceof Error ? err.message : 'Coupon is not valid for this order');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
  };

  useEffect(() => {
    if (!/^\d{6}$/.test(effectivePincode)) return;
    if (serviceability?.pincode === effectivePincode) return;

    let active = true;
    const timer = window.setTimeout(async () => {
      setCheckingPincode(true);
      try {
        const result = await checkDeliveryServicePincode({ desPincode: effectivePincode }) as DeliveryCheckResponse;
        if (!active) return;
        setServiceability({
          pincode: effectivePincode,
          serviceable: Boolean(result?.serviceable),
          codAvailable: Boolean(result?.codAvailable),
          manualReview: Boolean(result?.manualReview),
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
    if (!user?.email) return;
    setCustomerEmail(user.email);
    setBillingAddress((addr) => ({ ...addr, email: addr.email || user.email || '' }));
    setShippingAddress((addr) => ({ ...addr, email: addr.email || user.email || '' }));
  }, [user?.email]);

  useEffect(() => {
    if (billingSameAsShipping) setBillingAddress({ ...shippingAddress });
  }, [billingSameAsShipping, shippingAddress]);

  useEffect(() => {
    if (!items.length || step >= 2) return;
    saveCheckoutDraft({
      step,
      paymentMethod,
      billingSameAsShipping,
      customerEmail,
      shippingAddress,
      billingAddress,
      couponCode,
      appliedCoupon,
      wantsCodService,
    }, user?.id);
  }, [appliedCoupon, billingAddress, billingSameAsShipping, couponCode, customerEmail, items.length, paymentMethod, shippingAddress, step, user?.id, wantsCodService]);

  const shouldRedirectToCart = items.length === 0 && step < 2;
  useEffect(() => {
    if (shouldRedirectToCart) navigate('/cart');
  }, [shouldRedirectToCart, navigate]);
  if (shouldRedirectToCart) return null;

  const validateAddress = (addr: Address, section: 'Shipping' | 'Billing'): AddressValidationResult => {
    const fullName = cleanText(addr.fullName);
    const street = cleanText(addr.street);
    const city = cleanText(addr.city);
    const state = cleanText(addr.state);
    const email = cleanText(addr.email);

    if (isDummyText(fullName) || fullName.length < 3 || /\d/.test(fullName)) {
      return { valid: false, message: `${section}: enter the customer's real full name` };
    }
    if (isDummyText(street) || street.length < 10) {
      return { valid: false, message: `${section}: enter a complete Address Line 1 for parcel delivery` };
    }
    if (isDummyText(city) || city.length < 2 || /\d/.test(city)) {
      return { valid: false, message: `${section}: enter a valid city name` };
    }
    if (!INDIA_STATES.includes(state as (typeof INDIA_STATES)[number])) {
      return { valid: false, message: `${section}: select a valid state from the dropdown` };
    }
    if (!isValidPincode(addr.pincode)) {
      return { valid: false, message: `${section}: enter a valid 6 digit delivery pincode` };
    }
    if (!isValidIndianMobile(addr.mobile)) {
      return { valid: false, message: `${section}: enter a valid 10 digit Indian mobile number` };
    }
    if (!isValidEmail(email) || DUMMY_EMAIL_PATTERN.test(email)) {
      return { valid: false, message: `${section}: enter a real email address for order updates` };
    }
    return { valid: true };
  };

  const validateContactAndAddress = () => {
    const shippingResult = validateAddress(shippingAddress, 'Shipping');
    if (shippingResult.valid === false) {
      toast.error(shippingResult.message);
      setStep(0);
      return false;
    }
    const billingResult = validateAddress(billingAddress, 'Billing');
    if (billingResult.valid === false) {
      toast.error(billingResult.message);
      setStep(0);
      return false;
    }
    return true;
  };

  const cleanAddressForOrder = (addr: Address): Address => ({
    ...addr,
    fullName: cleanText(addr.fullName),
    mobile: String(addr.mobile || '').replace(/\D/g, ''),
    street: cleanText(addr.street),
    addressLine2: cleanText(addr.addressLine2),
    city: cleanText(addr.city),
    state: cleanText(addr.state),
    pincode: String(addr.pincode || '').replace(/\D/g, ''),
    email: cleanText(addr.email).toLowerCase(),
  });

  const getCheckoutIdempotencyKey = (fingerprint: unknown) => {
    const fingerprintText = JSON.stringify(fingerprint || null);
    try {
      const raw = sessionStorage.getItem(CHECKOUT_IDEMPOTENCY_STORAGE_KEY);
      const existing = raw ? JSON.parse(raw) : null;
      if (existing?.fingerprint === fingerprintText && existing?.key) return String(existing.key);
      const key = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      sessionStorage.setItem(CHECKOUT_IDEMPOTENCY_STORAGE_KEY, JSON.stringify({ fingerprint: fingerprintText, key }));
      return key;
    } catch {
      return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
  };

  const verifyDeliveryPincode = async () => {
    const pincode = String(effectiveShipping.pincode || '').trim();
    if (!isValidPincode(pincode)) {
      toast.error('Please enter a valid 6 digit delivery pincode');
      setStep(0);
      return false;
    }
    if (serviceability?.pincode === pincode && serviceability.serviceable) return true;

    setCheckingPincode(true);
    try {
      const result = await checkDeliveryServicePincode({ desPincode: pincode }) as DeliveryCheckResponse;
      const next = {
        pincode,
        serviceable: Boolean(result?.serviceable),
        codAvailable: Boolean(result?.codAvailable),
        manualReview: Boolean(result?.manualReview),
        message: typeof result?.message === 'string' ? result.message : '',
      };
      setServiceability(next);
      if (next.manualReview) {
        toast.info(next.message || 'Delivery partner auto-check is unavailable. You can continue and our team will confirm dispatch.');
        return true;
      }
      if (!next.serviceable) {
        toast.error(next.message || 'Delivery partner is not available for this pincode right now');
        return false;
      }
      toast.success('Delivery pincode verified');
      return true;
    } catch {
      setServiceability(null);
      toast.info('Could not verify delivery partner serviceability right now. You can continue and our team will confirm dispatch.');
      return true;
    } finally {
      setCheckingPincode(false);
    }
  };

  const handleContinueToPayment = async () => {
    if (!validateContactAndAddress()) return;
    const canDeliver = await verifyDeliveryPincode();
    if (!canDeliver) return;
    try {
      const data = await fetchPublicSettings({ fresh: true });
      updateSettings({
        freeShippingThreshold: data.freeShippingThreshold,
        shippingFee: data.shippingFee,
        packagingRate: data.packagingRate ?? data.taxRate ?? 0,
        minOrderAmount: data.minOrderAmount,
        maxOrderQuantity: data.maxOrderQuantity,
        codEnabled: data.codEnabled,
        codFee: data.codFee ?? 40,
        upiEnabled: data.upiEnabled,
        cardEnabled: data.cardEnabled,
      });
    } catch {
      // Keep current settings if the refresh fails; backend validation still protects the order.
    }
    const cartIsCurrent = await runCheckoutValidation('submit');
    if (!cartIsCurrent) return;
    setStep(1);
  };

  const startRazorpayPayment = async () => {
    if (processing || checkoutValidating) return;
    if (!validateContactAndAddress()) return;
    setProcessing(true);
    try {
      const cartIsCurrent = await runCheckoutValidation('submit');
      if (!cartIsCurrent) {
        setProcessing(false);
        return;
      }
      const cleanShippingAddress = cleanAddressForOrder(effectiveShipping);
      const cleanBillingAddress = cleanAddressForOrder(billingAddress);
      const loaded = await loadRazorpayCheckout();
      if (!loaded || !window.Razorpay) {
        throw new Error('Unable to load Razorpay checkout. Please disable browser shields/ad blockers for this payment page and try again.');
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
        customerName: cleanBillingAddress.fullName,
        customerEmail: effectiveEmail,
        shippingAddress: cleanShippingAddress,
        billingAddress: cleanBillingAddress,
        paymentMethod: 'Razorpay',
        codRequested: false,
        codAmount: 0,
        couponCode: appliedCoupon?.code || undefined,
      };

      const result = await createRazorpayOrder({
        amount: grandTotal,
        idempotencyKey: getCheckoutIdempotencyKey({
          email: effectiveEmail,
          couponCode: appliedCoupon?.code || '',
          codFee,
          items: items.map((item) => ({
            id: item.product.id,
            quantity: item.quantity,
            selectedSize: item.product.selectedSize || '',
            selectedPieces: item.product.selectedPieces || '',
            selectedAttributes: item.product.selectedAttributes || {},
          })),
        }),
        order: orderPayload,
        customer: { name: cleanBillingAddress.fullName, email: effectiveEmail, phone: cleanBillingAddress.mobile },
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
        const isTransientFailure = isTransientRazorpayFailure(reason);
        if (!isTransientFailure) {
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
        }
        checkout.close?.();
        toast[isTransientFailure ? 'info' : 'error'](
          isTransientFailure
            ? 'Payment is being verified. Please wait on the status page.'
            : 'Razorpay payment failed. Please try again.'
        );
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
    if (processing || checkoutValidating) return;
    if (!validateContactAndAddress()) return;
    const canDeliver = await verifyDeliveryPincode();
    if (!canDeliver) return;
    const cartIsCurrent = await runCheckoutValidation('submit');
    if (!cartIsCurrent) return;

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

    if (wantsCodService) {
      setProcessing(true);
      try {
        const cleanShippingAddress = cleanAddressForOrder(effectiveShipping);
        const cleanBillingAddress = cleanAddressForOrder(billingAddress);
        const order = await createOrder({
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
          customerName: cleanBillingAddress.fullName,
          customerEmail: effectiveEmail,
          shippingAddress: cleanShippingAddress,
          billingAddress: cleanBillingAddress,
          paymentMethod: 'COD',
          codRequested: true,
          codAmount: codFee,
          codPincode: effectivePincode,
          codMessage: serviceability?.message || `COD available for ${effectivePincode}`,
          couponCode: appliedCoupon?.code || undefined,
          statusHistory: [{ status: 'confirmed', date: new Date().toISOString(), note: 'Order confirmed with Cash on Delivery' }],
        }) as CreatedOrderResponse;
        setPlacedOrderId(String(order?.orderId || order?._id || order?.id || ''));
        sessionStorage.removeItem('brajmart-last-bundle');
        clearCheckoutDraft(user?.id);
        clearCart();
        setStep(2);
        toast.success('COD order confirmed successfully');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '';
        toast.error(message || 'Unable to confirm COD order. Please try again.');
      } finally {
        setProcessing(false);
      }
      return;
    }

    if (paymentMethod === 'razorpay') {
      startRazorpayPayment();
    }
  };

  const addressFields = [
    { key: 'fullName', label: 'Full Name', type: 'text', full: false, required: true },
    { key: 'street', label: 'Address Line 1', type: 'text', full: true, multiline: true, required: true, placeholder: 'House/Flat no, Building, Area' },
    { key: 'addressLine2', label: 'Address Line 2', type: 'text', full: true, required: false, placeholder: 'Landmark, nearby temple, floor, or company (optional)' },
    { key: 'city', label: 'City', type: 'text', full: false, required: true },
    { key: 'state', label: 'State', type: 'text', full: false, required: true },
    { key: 'pincode', label: 'Pincode', type: 'text', full: false, required: true },
    { key: 'mobile', label: 'Mobile Number', type: 'tel', full: false, required: true },
    { key: 'email', label: 'Email Address', type: 'email', full: false, required: true },
  ];

  const paymentOptions = [
    {
      value: 'razorpay',
      title: 'Razorpay',
      subtitle: 'Official Razorpay Checkout for UPI, cards, netbanking, wallets, and EMI',
      logo: RazorpayLogo,
      pills: ['Primary', 'UPI', 'Cards', 'NetBanking', 'Wallets'],
      badge: 'Primary',
      brandColor: 'text-[#0b72e7]',
      disabled: false,
    },
    ...(!hasPrasadamItems && codEligibleItems ? [{
      value: 'cod',
      title: 'Cash on Delivery',
      subtitle: canUseCodService
        ? `Pay the full order total at delivery. COD Handle Fee ${formatPrice(validatedCodFee)} applies.`
        : codUnavailableReason,
      logo: CodLogo,
      pills: ['Pay at delivery', 'Cash collection', 'COD fee'],
      badge: canUseCodService ? 'Available' : 'Unavailable',
      brandColor: canUseCodService ? 'text-tulsi' : 'text-muted-foreground',
      disabled: !canUseCodService,
    }] : []),
  ];

  const renderAddressForm = (
    addr: Address,
    setAddr: React.Dispatch<React.SetStateAction<Address>>,
    label: string,
    disabled = false
  ) => (
    <div>
      <h3 className="text-sm font-semibold text-foreground mb-3">{label}</h3>
      <div className="grid md:grid-cols-2 gap-4">
        {addressFields.map((f) => {
          const fieldId = `${label.replace(/\s+/g, '-').toLowerCase()}-${f.key}`;
          return (
          <div key={f.key} className={f.full ? 'md:col-span-2' : ''}>
            <label htmlFor={fieldId} className="block text-sm font-medium mb-1">
              {f.label}
              {f.required ? <span className="text-saffron"> *</span> : <span className="text-muted-foreground"> (optional)</span>}
            </label>
            {f.multiline ? (
              <textarea
                id={fieldId}
                rows={3}
                value={String(addr[f.key as keyof Address] || '')}
                onChange={(e) => setAddr((a) => ({ ...a, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                disabled={disabled}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-gold transition-colors resize-none disabled:cursor-not-allowed disabled:opacity-70"
              />
            ) : f.key === 'state' ? (
              <select
                id={fieldId}
                value={String(addr.state || '')}
                onChange={(e) => setAddr((a) => ({ ...a, state: e.target.value }))}
                disabled={disabled}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-gold transition-colors disabled:cursor-not-allowed disabled:opacity-70"
              >
                <option value="" disabled>Select state</option>
                {INDIA_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            ) : (
              <input
                id={fieldId}
                type={f.type}
                value={String(addr[f.key as keyof Address] || '')}
                onChange={(e) => setAddr((a) => ({ ...a, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                disabled={disabled}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-gold transition-colors disabled:cursor-not-allowed disabled:opacity-70"
              />
            )}
          </div>
          );
        })}
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

        {step < 2 && bundleSnapshot && (
          <div className="mb-5 rounded-lg border border-gold/30 bg-card p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gold">Perfect Combo</p>
                <h2 className="mt-1 font-playfair text-xl font-bold text-foreground">{bundleSnapshot.name}</h2>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xs text-muted-foreground">Combo total</p>
                <p className="font-playfair text-xl font-bold text-saffron">{formatPrice(bundleSnapshot.total)}</p>
                {bundleSnapshot.savings > 0 && <p className="text-xs font-semibold text-tulsi">Saved {formatPrice(bundleSnapshot.savings)}</p>}
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-5">
              {bundleSnapshot.products.map((product) => (
                <Link
                  key={product.id}
                  to={`/product/${product.slug}`}
                  className="grid grid-cols-[42px_1fr] items-center gap-2 rounded-md border border-border bg-background p-2 transition hover:border-gold/50 premium-focus sm:block"
                >
                  <img src={product.image} alt="" className="h-10 w-10 rounded border border-border bg-card object-contain p-1 sm:h-14 sm:w-full" />
                  <span className="min-w-0 sm:mt-2 sm:block">
                    <span className="block line-clamp-1 text-xs font-semibold text-foreground">{product.name}</span>
                    <span className="mt-0.5 block text-xs font-bold text-saffron">{formatPrice(product.price)}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="grid min-w-0 lg:grid-cols-3 gap-8">
          <div className="min-w-0 lg:col-span-2">
            <AnimatePresence mode="wait">
              {step === 0 && (
                <motion.div key="delivery" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
                  <div className="min-w-0 bg-card rounded-2xl border border-border p-6 space-y-6">
                    <div className="flex items-center gap-2">
                      <MapPin size={18} className="text-gold" />
                      <h2 className="font-cinzel text-lg font-bold">Delivery Details</h2>
                    </div>
                    {renderAddressForm(shippingAddress, setShippingAddress, 'Shipping Details')}

                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3 transition-colors hover:border-gold/40">
                      <input
                        type="checkbox"
                        checked={billingSameAsShipping}
                        onChange={(event) => {
                          setBillingSameAsShipping(event.target.checked);
                          if (event.target.checked) setBillingAddress({ ...shippingAddress });
                        }}
                        className="h-4 w-4 rounded accent-saffron"
                      />
                      <span className="text-sm font-medium text-foreground">Billing details same as shipping details</span>
                    </label>

                    {!billingSameAsShipping && renderAddressForm(billingAddress, setBillingAddress, 'Billing Details')}

                    <div className="rounded-xl border border-border bg-muted/30 p-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Truck size={16} className="text-gold" />
                        Delivery partner check
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {serviceability?.pincode === String(effectiveShipping.pincode || '').trim()
                          ? serviceability.manualReview
                            ? serviceability.message || 'Delivery partner auto-check is unavailable. Our team will confirm dispatch.'
                            : serviceability.serviceable
                            ? serviceability.codAvailable
                              ? `Delivery and COD available for ${serviceability.pincode}. COD Handle Fee ${formatPrice(codFee)} applies only when COD is selected.`
                              : `Delivery available for ${serviceability.pincode}. COD is not available for this pincode.`
                            : serviceability.message || `Delivery needs review for ${serviceability.pincode}.`
                          : checkingPincode
                            ? 'Checking this pincode with delivery partner...'
                            : 'Your delivery pincode is verified automatically when you enter 6 digits.'}
                      </p>
                    </div>

                  </div>
                </motion.div>
              )}

              {step === 1 && (
                <motion.div key="payment" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
                  <div className="min-w-0 bg-card rounded-2xl border border-border p-4 shadow-sm sm:p-6">
                    <div className="flex min-w-0 flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
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
                        { icon: Truck, title: serviceability?.manualReview ? 'Partner review' : 'Partner checked', text: serviceability?.manualReview ? 'Dispatch confirmed by team' : partnerCodAvailable ? 'Partner COD serviceable' : 'Delivery verified' },
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
                          const Logo = m.logo;
                          const selected = paymentMethod === m.value;
                          return (
                            <div
                              key={m.value}
                              role="radio"
                              aria-checked={selected}
                              aria-disabled={m.disabled}
                              tabIndex={m.disabled ? -1 : 0}
                              onClick={() => {
                                if (m.disabled) return;
                                setPaymentMethod(m.value);
                                setWantsCodService(m.value === 'cod');
                              }}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  if (m.disabled) return;
                                  setPaymentMethod(m.value);
                                  setWantsCodService(m.value === 'cod');
                                }
                              }}
                              className={`group flex min-w-0 items-center gap-3 rounded-xl border p-3 transition-all sm:gap-4 sm:p-4 ${m.disabled ? 'cursor-not-allowed border-border bg-muted/30 opacity-70' : selected ? 'cursor-pointer border-gold bg-gold/5 shadow-[0_0_0_1px_rgba(218,165,32,0.2)]' : 'cursor-pointer border-border bg-background hover:border-gold/50 hover:bg-pearl/50'}`}
                            >
                              <input
                                type="radio"
                                name="payment"
                                value={m.value}
                                checked={selected}
                                disabled={m.disabled}
                                onChange={() => {
                                  if (m.disabled) return;
                                  setPaymentMethod(m.value);
                                  setWantsCodService(m.value === 'cod');
                                }}
                                className="sr-only"
                              />
                              <Logo />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`text-sm font-semibold ${m.brandColor}`}>{m.title}</span>
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
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {!hasPrasadamItems && codEligibleItems && (
                      <div className={`mt-5 rounded-xl border p-4 transition-colors ${canUseCodService ? 'border-tulsi/30 bg-tulsi/5' : 'border-border bg-muted/30'}`}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 h-10 w-10 rounded-xl flex items-center justify-center border ${canUseCodService ? 'border-tulsi/30 bg-tulsi/10 text-tulsi' : 'border-border bg-background text-muted-foreground'}`}>
                              <Truck size={17} />
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-foreground">Delivery partner COD</p>
                                <span className={`text-[11px] px-2 py-0.5 rounded-full border ${canUseCodService ? 'border-tulsi/30 text-tulsi' : 'border-border text-muted-foreground'}`}>
                                {canUseCodService ? 'Available' : checkingPincode ? 'Checking' : 'Not available'}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {hasPrasadamItems
                                  ? 'COD is not available for Prasadam products. Please continue with online payment.'
                                  : !codEligibleItems
                                    ? 'COD is enabled only for selected products and categories in this order.'
                                  : canUseCodService
                                    ? `Select COD to confirm this order without online payment. COD Handle Fee ${formatPrice(codFee)} will be collected with the order total.`
                                    : 'Enter a delivery partner COD serviceable pincode in delivery details to enable this service.'}
                              </p>
                            </div>
                          </div>
                          <span className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold ${wantsCodService ? 'bg-tulsi text-white' : 'border border-border bg-background text-muted-foreground'}`}>
                            {wantsCodService ? 'COD selected' : 'Select COD above'}
                          </span>
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
                        <div className="grid min-w-0 gap-3 p-4 sm:grid-cols-3 sm:p-5">
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
                        {wantsCodService
                          ? 'COD orders are confirmed directly. Please keep the payable amount ready at delivery.'
                          : 'BrajMart never stores card details or UPI PIN. Payment status is confirmed by the gateway before your order is marked successful.'}
                      </p>
                    </div>

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
            <div className="min-w-0 lg:col-span-1">
              <div className="min-w-0 bg-card rounded-2xl border border-border p-4 shadow-sm sm:p-6 lg:sticky lg:top-24">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-cinzel text-lg font-bold">Order Summary</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{items.length} item{items.length === 1 ? '' : 's'} in this order</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${checkoutValidatedCleanly ? 'border-tulsi/25 bg-tulsi/5 text-tulsi' : 'border-gold/30 bg-gold/5 text-gold'}`}>
                    {checkoutValidatedCleanly ? 'Verified' : 'Preview'}
                  </span>
                </div>
                {(checkoutValidationError || hasCheckoutValidationChanges || hasCheckoutUnavailableItems) && (
                  <div className="mb-4 rounded-xl border border-gold/30 bg-gold/5 p-3 text-sm">
                    <p className="font-semibold text-foreground">
                      {checkoutValidationError
                        ? 'Cart validation needed'
                        : hasCheckoutUnavailableItems
                          ? 'Some items need attention'
                          : 'Cart updates available'}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {checkoutValidationError
                        || checkoutValidation?.unavailableItems?.[0]?.message
                        || checkoutValidation?.changes?.[0]?.message
                        || 'Review the latest prices and quantities before payment.'}
                    </p>
                    {checkoutValidation && (hasCheckoutValidationChanges || hasCheckoutUnavailableItems) && (
                      <button
                        type="button"
                        onClick={applyCheckoutUpdates}
                        className="mt-3 rounded-lg border border-maroon/30 bg-background px-3 py-2 text-xs font-bold text-maroon hover:bg-pearl"
                      >
                        Apply cart updates
                      </button>
                    )}
                  </div>
                )}
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
                <div className="mb-5 rounded-xl border border-border bg-background/60 p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Tag size={14} />
                    <span>Coupon Code</span>
                  </div>
                  {appliedCoupon ? (
                    <div className="flex items-start justify-between gap-3 rounded-lg border border-tulsi/25 bg-tulsi/5 p-3">
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-bold text-tulsi">{appliedCoupon.code}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{appliedCoupon.description || 'Coupon benefit applied'}</p>
                        <p className="mt-1 text-xs font-semibold text-tulsi">Saved {formatPrice(couponDiscount)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveCoupon}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"
                        aria-label="Remove coupon"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                        placeholder="Enter code"
                        className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold uppercase outline-none focus:ring-2 focus:ring-saffron/30"
                      />
                      <button
                        type="button"
                        onClick={handleApplyCoupon}
                        disabled={couponLoading}
                        className="shrink-0 rounded-lg bg-saffron px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
                      >
                        {couponLoading ? 'Checking' : 'Apply'}
                      </button>
                    </div>
                  )}
                </div>
                <div className="space-y-2 text-sm border-t border-border pt-3">
                  <div className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <span>Price Details</span>
                    <span>INR</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Product price</span>
                    <span>{formatPrice(validatedSubtotal)}</span>
                  </div>
                  {totalSavings() > 0 && (
                    <div className="flex justify-between text-tulsi">
                      <span>Savings</span>
                      <span>-{formatPrice(totalSavings())}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Packaging cost ({packagingRate}%)</span>
                    <span>{formatPrice(validatedPackaging)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shipping charge</span>
                    <span className={validatedShipping === 0 ? 'text-tulsi font-medium' : ''}>{validatedShipping === 0 ? 'FREE' : formatPrice(validatedShipping)}</span>
                  </div>
                  {codCharge > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">COD Handle Fee</span>
                      <span>{formatPrice(codCharge)}</span>
                    </div>
                  )}
                  {couponDiscount > 0 && (
                    <div className="flex justify-between text-tulsi">
                      <span>Coupon discount</span>
                      <span>-{formatPrice(couponDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base border-t border-border pt-3">
                    <span>Payable Total</span>
                    <span className="text-saffron">{formatPrice(grandTotal)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={step === 0 ? handleContinueToPayment : handlePlaceOrder}
                  disabled={step === 0
                    ? checkingPincode || checkoutValidating || hasCheckoutValidationChanges || hasCheckoutUnavailableItems
                    : processing || checkoutValidating || !checkoutValidatedCleanly || (!wantsCodService && paymentOptions.length === 0)}
                  className="mt-4 w-full rounded-xl bg-gold-gradient px-4 py-3 text-sm font-bold text-maroon-dark shimmer transition-transform active:scale-[0.97] disabled:opacity-60"
                >
                  {step === 0
                    ? checkingPincode
                      ? 'Checking Delivery...'
                      : checkoutValidating
                        ? 'Validating cart...'
                        : hasCheckoutValidationChanges || hasCheckoutUnavailableItems
                          ? 'Apply cart updates first'
                          : 'Continue to Payment'
                    : processing
                      ? wantsCodService ? 'Confirming COD Order...' : 'Processing Payment...'
                      : checkoutValidating
                        ? 'Validating cart...'
                        : !checkoutValidatedCleanly
                          ? 'Validate cart before payment'
                      : wantsCodService
                        ? `Confirm COD Order - ${formatPrice(grandTotal)}`
                        : `Pay with Razorpay - ${formatPrice(grandTotal)}`}
                </button>
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
