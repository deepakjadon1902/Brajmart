import { Link } from 'react-router-dom';
import { Minus, Plus, Trash2, ShoppingBag, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCartStore } from '@/store/cartStore';
import { formatPrice } from '@/utils/formatPrice';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

const CartPage = () => {
  const { items, removeItem, updateQuantity, clearCart, totalPrice, totalSavings } = useCartStore();
  const shipping = totalPrice() >= 499 ? 0 : 49;
  const grandTotal = totalPrice() + shipping;

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <AnnouncementBar />
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <ShoppingBag size={64} className="mx-auto text-muted-foreground/30 mb-4" />
            <h1 className="font-cinzel text-2xl font-bold text-foreground mb-2">Your Cart is Empty</h1>
            <p className="text-muted-foreground text-sm mb-6">Add some divine products to your cart</p>
            <Link to="/" className="inline-block px-6 py-3 rounded-full bg-gold-gradient text-maroon-dark font-bold text-sm shimmer">
              Continue Shopping →
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
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/" className="text-muted-foreground hover:text-foreground"><ArrowLeft size={20} /></Link>
          <h1 className="font-cinzel text-2xl font-bold text-foreground">Shopping Cart ({items.length})</h1>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart items */}
          <div className="lg:col-span-2 space-y-4">
            <AnimatePresence>
              {items.map(item => (
                <motion.div
                  key={item.product.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20, height: 0 }}
                  className="flex gap-4 bg-card rounded-2xl border border-border p-4"
                >
                  <Link to={`/product/${item.product.slug}`} className="shrink-0">
                    <img src={item.product.image} alt={item.product.name} className="w-24 h-24 rounded-xl object-cover" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/product/${item.product.slug}`}>
                      <h3 className="font-playfair font-semibold text-sm text-foreground line-clamp-2">{item.product.name}</h3>
                    </Link>
                    <span className="text-xs text-muted-foreground">{item.product.category}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-saffron font-bold">{formatPrice(item.product.price)}</span>
                      {item.product.originalPrice && (
                        <span className="text-muted-foreground line-through text-xs">{formatPrice(item.product.originalPrice)}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                      <div className="flex items-center border border-border rounded-lg">
                        <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)} className="p-1.5 hover:bg-muted transition-colors rounded-l-lg">
                          <Minus size={14} />
                        </button>
                        <span className="px-3 text-sm font-semibold">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)} className="p-1.5 hover:bg-muted transition-colors rounded-r-lg">
                          <Plus size={14} />
                        </button>
                      </div>
                      <button onClick={() => removeItem(item.product.id)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-foreground">{formatPrice(item.product.price * item.quantity)}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            <button onClick={clearCart} className="text-sm text-destructive hover:underline">Clear Cart</button>
          </div>

          {/* Order summary */}
          <div className="lg:col-span-1">
            <div className="bg-card rounded-2xl border border-border p-6 sticky top-24">
              <h3 className="font-cinzel text-lg font-bold text-foreground mb-4">Order Summary</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatPrice(totalPrice())}</span></div>
                {totalSavings() > 0 && (
                  <div className="flex justify-between text-tulsi"><span>Savings</span><span>-{formatPrice(totalSavings())}</span></div>
                )}
                <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>{shipping === 0 ? <span className="text-tulsi">FREE</span> : formatPrice(shipping)}</span></div>
                {shipping > 0 && <p className="text-xs text-muted-foreground">Free shipping on orders above ₹499</p>}
                <div className="border-t border-border pt-3 flex justify-between font-bold text-base">
                  <span>Total</span><span className="text-saffron">{formatPrice(grandTotal)}</span>
                </div>
              </div>
              <Link
                to="/checkout"
                className="block w-full mt-6 py-3 rounded-xl bg-gold-gradient text-maroon-dark font-bold text-sm text-center shimmer active:scale-[0.97] transition-transform"
              >
                Proceed to Checkout →
              </Link>
              <Link to="/" className="block mt-3 text-center text-sm text-saffron hover:underline">
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default CartPage;
