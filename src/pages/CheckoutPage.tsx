import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, CreditCard, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';
import { formatPrice } from '@/utils/formatPrice';
import { toast } from 'sonner';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

const steps = ['Delivery Details', 'Payment', 'Confirmation'];

const CheckoutPage = () => {
  const [step, setStep] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [orderId] = useState(`BM${Date.now().toString(36).toUpperCase()}`);
  const { items, totalPrice, totalSavings, clearCart } = useCartStore();
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const shipping = totalPrice() >= 499 ? 0 : 49;
  const grandTotal = totalPrice() + shipping;

  const [address, setAddress] = useState({
    fullName: user?.fullName || '',
    mobile: user?.mobile || '',
    street: user?.address || '',
    city: user?.city || '',
    state: user?.state || '',
    pincode: user?.pincode || '',
  });

  if (items.length === 0 && step < 2) {
    navigate('/cart');
    return null;
  }

  const handlePlaceOrder = () => {
    if (!address.fullName || !address.mobile || !address.street || !address.pincode) {
      toast.error('Please fill all delivery details');
      setStep(0);
      return;
    }
    clearCart();
    setStep(2);
    toast.success('Order placed successfully! 🙏');
  };

  return (
    <div className="min-h-screen bg-background">
      <AnnouncementBar /><Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => step > 0 ? setStep(step - 1) : navigate('/cart')} className="text-muted-foreground hover:text-foreground">
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
                  <div className="bg-card rounded-2xl border border-border p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <MapPin size={18} className="text-gold" />
                      <h2 className="font-cinzel text-lg font-bold">Delivery Address</h2>
                    </div>
                    {!isAuthenticated && (
                      <div className="mb-4 p-3 bg-pearl rounded-xl text-sm">
                        <Link to="/login" className="text-saffron font-semibold hover:underline">Sign in</Link> for faster checkout with saved addresses.
                      </div>
                    )}
                    <div className="grid md:grid-cols-2 gap-4">
                      {[
                        { key: 'fullName', label: 'Full Name', type: 'text', full: false },
                        { key: 'mobile', label: 'Mobile Number', type: 'tel', full: false },
                        { key: 'street', label: 'Street Address', type: 'text', full: true },
                        { key: 'city', label: 'City', type: 'text', full: false },
                        { key: 'state', label: 'State', type: 'text', full: false },
                        { key: 'pincode', label: 'Pincode', type: 'text', full: false },
                      ].map(f => (
                        <div key={f.key} className={f.full ? 'md:col-span-2' : ''}>
                          <label className="block text-sm font-medium mb-1">{f.label}</label>
                          <input
                            type={f.type}
                            value={address[f.key as keyof typeof address]}
                            onChange={e => setAddress(a => ({ ...a, [f.key]: e.target.value }))}
                            className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-gold transition-colors"
                          />
                        </div>
                      ))}
                    </div>
                    <button onClick={() => setStep(1)} className="mt-6 w-full py-3 rounded-xl bg-gold-gradient text-maroon-dark font-bold text-sm shimmer active:scale-[0.97] transition-transform">
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
                        { value: 'cod', label: 'Cash on Delivery', sub: 'Pay when delivered', icon: '📦' },
                        { value: 'upi', label: 'UPI Payment', sub: 'GPay, PhonePe, Paytm', icon: '📱' },
                        { value: 'card', label: 'Credit/Debit Card', sub: 'Visa, Mastercard', icon: '💳' },
                      ].map(m => (
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
                    <button onClick={handlePlaceOrder} className="mt-6 w-full py-3 rounded-xl bg-gold-gradient text-maroon-dark font-bold text-sm shimmer active:scale-[0.97] transition-transform">
                      Place Order — {formatPrice(grandTotal)}
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
                    <div className="inline-block px-4 py-2 bg-pearl rounded-xl mb-4">
                      <span className="text-xs text-muted-foreground">Order ID: </span>
                      <span className="font-bold text-saffron">{orderId}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-6">Estimated delivery in 3-5 business days</p>
                    <div className="flex gap-3 justify-center">
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
                  {items.map(item => (
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
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatPrice(totalPrice())}</span></div>
                  {totalSavings() > 0 && <div className="flex justify-between text-tulsi"><span>Savings</span><span>-{formatPrice(totalSavings())}</span></div>}
                  <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>{shipping === 0 ? 'FREE' : formatPrice(shipping)}</span></div>
                  <div className="flex justify-between font-bold text-base border-t border-border pt-2"><span>Total</span><span className="text-saffron">{formatPrice(grandTotal)}</span></div>
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
