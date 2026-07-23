import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  BadgeCheck,
  CreditCard,
  Minus,
  PackageCheck,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Truck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCartStore } from '@/store/cartStore';
import { useSettingsStore } from '@/store/settingsStore';
import { formatPrice } from '@/utils/formatPrice';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

const DEFAULT_FREE_SHIPPING_THRESHOLD = 299;
const DEFAULT_SHIPPING_FEE = 49;

function ShippingProgressBar({ cartTotal, threshold }: { cartTotal: number; threshold: number }) {
  const remaining = threshold - cartTotal;
  const percentage = Math.min((cartTotal / threshold) * 100, 100);

  return (
    <div className="rounded-lg border border-[#CFE8D2] bg-[#F1FAF2] px-4 py-3">
      <div className="mb-2 flex items-start gap-2">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white text-[#2E7D32] shadow-sm">
          <Truck size={15} />
        </span>
        <div>
          <p className="text-[13px] font-bold text-[#2E7D32]">
            {remaining > 0 ? `Add ${formatPrice(Math.ceil(remaining))} more for free shipping` : 'Free shipping unlocked'}
          </p>
          <p className="text-[11px] text-[#4B6F4E]">Delivery charges update automatically before payment.</p>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-[#DCEBDD]">
        <div
          className="h-1.5 rounded-full bg-[#2E7D32] transition-[width] duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

const CartPage = () => {
  const { items, removeItem, updateQuantity, clearCart, totalPrice, totalSavings } = useCartStore();
  const { settings } = useSettingsStore();
  const freeShippingThreshold = Number(settings.freeShippingThreshold) > 0 ? Number(settings.freeShippingThreshold) : DEFAULT_FREE_SHIPPING_THRESHOLD;
  const shippingFee = Number(settings.shippingFee) > 0 ? Number(settings.shippingFee) : DEFAULT_SHIPPING_FEE;
  const packagingRate = Math.max(0, Number(settings.packagingRate) || 0);
  const subtotal = totalPrice();
  const packagingCost = Math.round(subtotal * packagingRate / 100);
  const shipping = subtotal >= freeShippingThreshold ? 0 : shippingFee;
  const grandTotal = subtotal + packagingCost + shipping;
  const itemCount = items.reduce((count, item) => count + item.quantity, 0);

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <AnnouncementBar />
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-border bg-card shadow-sm">
              <ShoppingBag size={36} className="text-saffron" />
            </div>
            <h1 className="font-cinzel text-2xl font-bold text-foreground mb-2">Your Cart is Empty</h1>
            <p className="text-muted-foreground text-sm mb-6">Add your favorite BrajMart products and checkout securely.</p>
            <Link to="/" className="inline-block rounded-lg bg-gold-gradient px-6 py-3 text-sm font-bold text-maroon-dark shadow-sm shimmer">
              Continue Shopping
            </Link>
          </motion.div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AnnouncementBar />
      <Navbar />
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link to="/" className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-saffron">
              <ArrowLeft size={16} /> Continue shopping
            </Link>
            <h1 className="font-cinzel text-2xl font-bold text-foreground sm:text-3xl">Shopping Cart</h1>
            <p className="mt-1 text-sm text-muted-foreground">{itemCount} item{itemCount === 1 ? '' : 's'} in your cart, ready for secure checkout.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[#D8EAD9] bg-[#F4FBF4] px-3 py-2 text-xs font-semibold text-[#2E7D32]">
              <ShieldCheck size={14} /> Secure checkout
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[#E7D8C7] bg-brand-raised px-3 py-2 text-xs font-semibold text-foreground">
              <PackageCheck size={14} /> Verified items
            </span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_416px]">
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-cinzel text-lg font-bold text-foreground">Cart Items</h2>
                  <p className="text-sm text-muted-foreground">Review quantity, price, and product details before payment.</p>
                </div>
                <button onClick={clearCart} className="inline-flex w-fit items-center gap-2 rounded-md border border-destructive/25 px-3 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10">
                  <Trash2 size={15} /> Clear Cart
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <AnimatePresence>
                  {items.map(item => (
                    <motion.div
                      key={item.product.id}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20, height: 0 }}
                      className="rounded-lg border border-border bg-background/70 p-3 shadow-sm transition-shadow hover:shadow-md sm:p-4"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row">
                        <Link to={`/product/${item.product.slug}`} className="shrink-0">
                          <span className="block h-28 w-28 overflow-hidden rounded-lg border border-border bg-brand-raised sm:h-32 sm:w-32">
                            <img src={item.product.image} alt={item.product.name} className="h-full w-full object-contain p-2 transition-transform duration-300 hover:scale-[1.03]" />
                          </span>
                        </Link>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <Link to={`/product/${item.product.slug}`}>
                                <h3 className="font-playfair text-base font-semibold leading-snug text-foreground line-clamp-2 transition-colors hover:text-saffron">{item.product.name}</h3>
                              </Link>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                <span className="rounded-full border border-border bg-card px-2.5 py-1 font-medium text-muted-foreground">{item.product.category}</span>
                                <span className="inline-flex items-center gap-1 rounded-full border border-[#D8EAD9] bg-[#F4FBF4] px-2.5 py-1 font-semibold text-[#2E7D32]">
                                  <BadgeCheck size={12} /> In cart
                                </span>
                              </div>
                              <div className="mt-3 flex items-center gap-2">
                                <span className="font-playfair text-lg font-bold text-saffron">{formatPrice(item.product.price)}</span>
                                {item.product.originalPrice && (
                                  <span className="text-xs text-muted-foreground line-through">{formatPrice(item.product.originalPrice)}</span>
                                )}
                              </div>
                            </div>
                            <div className="text-left sm:text-right">
                              <p className="text-xs text-muted-foreground">Item total</p>
                              <span className="font-playfair text-lg font-bold text-foreground">{formatPrice(item.product.price * item.quantity)}</span>
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                            <div className="flex items-center rounded-md border border-border bg-card shadow-sm">
                              <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)} className="flex h-9 w-9 items-center justify-center rounded-l-md transition-colors hover:bg-muted" aria-label="Decrease quantity">
                                <Minus size={14} />
                              </button>
                              <span className="min-w-10 px-3 text-center text-sm font-bold">{item.quantity}</span>
                              <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)} className="flex h-9 w-9 items-center justify-center rounded-r-md transition-colors hover:bg-muted" aria-label="Increase quantity">
                                <Plus size={14} />
                              </button>
                            </div>
                            <button onClick={() => removeItem(item.product.id)} className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10">
                              <Trash2 size={15} /> Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-card p-4">
                <ShieldCheck size={18} className="mb-2 text-[#2E7D32]" />
                <p className="text-sm font-bold text-foreground">Protected Payment</p>
                <p className="mt-1 text-xs text-muted-foreground">Razorpay and PayU secure gateways.</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <Truck size={18} className="mb-2 text-saffron" />
                <p className="text-sm font-bold text-foreground">DTDC Delivery</p>
                <p className="mt-1 text-xs text-muted-foreground">Pincode check continues at checkout.</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <PackageCheck size={18} className="mb-2 text-brand-gold" />
                <p className="text-sm font-bold text-foreground">Careful Packing</p>
                <p className="mt-1 text-xs text-muted-foreground">Packaging fee shown before payment.</p>
              </div>
            </div>
          </div>

          <div>
            <div className="sticky top-24 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="border-b border-border bg-brand-raised px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-cinzel text-lg font-bold text-foreground">Order Summary</h3>
                    <p className="text-xs text-muted-foreground">Transparent total before checkout.</p>
                  </div>
                  <span className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-bold text-foreground">{itemCount} item{itemCount === 1 ? '' : 's'}</span>
                </div>
              </div>
              <div className="space-y-5 p-5">
                <ShippingProgressBar cartTotal={subtotal} threshold={freeShippingThreshold} />
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4"><span className="text-muted-foreground">Product subtotal</span><span className="font-semibold">{formatPrice(subtotal)}</span></div>
                  {totalSavings() > 0 && (
                    <div className="flex justify-between gap-4 text-tulsi"><span>Savings</span><span className="font-semibold">-{formatPrice(totalSavings())}</span></div>
                  )}
                  <div className="flex justify-between gap-4"><span className="text-muted-foreground">Packaging cost ({packagingRate}%)</span><span className="font-semibold">{formatPrice(packagingCost)}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-muted-foreground">Shipping charge</span><span className="font-semibold">{shipping === 0 ? <span className="text-tulsi">FREE</span> : formatPrice(shipping)}</span></div>
                  {shipping > 0 && <p className="rounded-md bg-brand-raised px-3 py-2 text-xs text-muted-foreground">Free shipping applies on orders above {formatPrice(freeShippingThreshold)}.</p>}
                  <div className="border-t border-border pt-4">
                    <div className="flex justify-between gap-4 font-bold text-base">
                      <span>Payable Total</span><span className="font-playfair text-xl text-saffron">{formatPrice(grandTotal)}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Final payment gateway opens on the next step.</p>
                  </div>
                </div>
                <Link
                  to="/checkout"
                  className="checkout-btn flex w-full items-center justify-center gap-2 rounded-lg bg-gold-gradient py-3.5 text-sm font-bold text-maroon-dark shadow-sm shimmer active:scale-[0.98] transition-transform"
                >
                  <CreditCard size={17} /> Proceed to Checkout
                </Link>
                <Link to="/" className="block text-center text-sm font-semibold text-saffron hover:underline">
                  Continue Shopping
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default CartPage;
