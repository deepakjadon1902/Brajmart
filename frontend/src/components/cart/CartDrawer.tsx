import { Link } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCartStore } from '@/store/cartStore';
import { useProductStore } from '@/store/productStore';
import { useSettingsStore } from '@/store/settingsStore';
import { formatPrice } from '@/utils/formatPrice';
import FreeShippingProgress from './FreeShippingProgress';
import { compareProductsByQuality, isProductPurchasable } from '@/utils/productPresentation';
import { fetchCartRecommendations } from '@/lib/api';

const CartDrawer = () => {
  const { items, drawerOpen, closeDrawer, lastAddedProductId, updateQuantity, removeItem, totalPrice, addItem } = useCartStore();
  const products = useProductStore((state) => state.products);
  const settings = useSettingsStore((state) => state.settings);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const subtotal = totalPrice();
  const threshold = Number(settings.freeShippingThreshold) > 0 ? Number(settings.freeShippingThreshold) : 299;
  const lastAdded = items.find((item) => item.product.id === lastAddedProductId);
  const cartIds = useMemo(() => new Set(items.map((item) => String(item.product.id).split('::')[0])), [items]);
  const [serverRecommendations, setServerRecommendations] = useState<any[]>([]);
  const recommendation = useMemo(() => {
    const serverProduct = serverRecommendations.map((item) => item.product).find(Boolean);
    if (serverProduct) return serverProduct;
    return products
      .filter((product) => !cartIds.has(String(product.id)) && isProductPurchasable(product))
      .sort(compareProductsByQuality)[0];
  }, [cartIds, products, serverRecommendations]);

  useEffect(() => {
    if (!drawerOpen || !items.length) {
      setServerRecommendations([]);
      return;
    }
    let active = true;
    fetchCartRecommendations([...cartIds], 3)
      .then((data) => {
        if (active) setServerRecommendations(Array.isArray(data.recommendations) ? data.recommendations : []);
      })
      .catch(() => {
        if (active) setServerRecommendations([]);
      });
    return () => {
      active = false;
    };
  }, [cartIds, drawerOpen, items.length]);

  useEffect(() => {
    if (!drawerOpen) return;
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const id = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDrawer();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('keydown', onKeyDown);
      restoreFocusRef.current?.focus?.();
    };
  }, [closeDrawer, drawerOpen]);

  return (
    <AnimatePresence>
      {drawerOpen && (
        <div className="fixed inset-0 z-[120]" role="dialog" aria-modal="true" aria-label="Shopping cart drawer">
          <motion.div className="absolute inset-0 bg-black/35" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeDrawer} />
          <motion.aside
            initial={prefersReducedMotion ? { opacity: 1 } : { x: '100%' }}
            animate={prefersReducedMotion ? { opacity: 1 } : { x: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { x: '100%' }}
            transition={{ duration: prefersReducedMotion ? 0.01 : 0.22, ease: 'easeOut' }}
            className="absolute right-0 top-0 flex h-full w-[min(420px,92vw)] flex-col bg-background shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border p-4">
              <div>
                <h2 className="font-playfair text-xl font-bold text-foreground">Your Cart</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {lastAdded ? `${lastAdded.product.name} added.` : `${items.length} item${items.length === 1 ? '' : 's'} ready.`}
                </p>
              </div>
              <button ref={closeButtonRef} type="button" onClick={closeDrawer} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted" aria-label="Close cart drawer">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {items.length ? (
                <div className="space-y-3">
                  {items.slice(0, 4).map((item) => (
                    <div key={item.product.id} className="grid grid-cols-[72px_1fr] gap-3 rounded-lg border border-border bg-card p-2.5">
                      <Link to={`/product/${item.product.slug}`} onClick={closeDrawer} className="h-[72px] overflow-hidden rounded-md bg-brand-raised">
                        <img src={item.product.image} alt={item.product.name} className="h-full w-full object-contain p-1.5" />
                      </Link>
                      <div className="min-w-0">
                        <Link to={`/product/${item.product.slug}`} onClick={closeDrawer} className="line-clamp-2 text-sm font-bold leading-snug text-foreground hover:text-saffron">
                          {item.product.name}
                        </Link>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <span className="font-sans text-sm font-bold">{formatPrice(item.product.price)}</span>
                          <button type="button" onClick={() => removeItem(item.product.id)} className="text-destructive" aria-label={`Remove ${item.product.name}`}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                        <div className="mt-2 inline-flex items-center rounded-md border border-border bg-background">
                          <button type="button" onClick={() => updateQuantity(item.product.id, item.quantity - 1)} className="flex h-8 w-8 items-center justify-center" aria-label="Decrease quantity">
                            <Minus size={13} />
                          </button>
                          <span className="min-w-8 text-center text-xs font-bold">{item.quantity}</span>
                          <button type="button" onClick={() => updateQuantity(item.product.id, item.quantity + 1)} className="flex h-8 w-8 items-center justify-center" aria-label="Increase quantity">
                            <Plus size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {items.length > 4 && <p className="text-center text-xs text-muted-foreground">View cart to review all {items.length} items.</p>}
                </div>
              ) : (
                <div className="py-16 text-center">
                  <ShoppingBag size={34} className="mx-auto mb-3 text-saffron" />
                  <p className="font-bold text-foreground">Your cart is empty</p>
                </div>
              )}

              {recommendation && (
                <div className="mt-4 rounded-lg border border-border bg-card p-3">
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Pair it with</p>
                  <div className="flex gap-3">
                    <img src={recommendation.image} alt="" className="h-16 w-16 rounded-md bg-brand-raised object-contain p-1" />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-bold text-foreground">{recommendation.name}</p>
                      <p className="mt-1 text-sm font-bold text-saffron">{formatPrice(recommendation.price)}</p>
                    </div>
                    <button type="button" onClick={() => addItem(recommendation)} className="h-9 rounded-md bg-maroon px-3 text-xs font-bold text-white">
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 border-t border-border p-4">
              <FreeShippingProgress cartTotal={subtotal} threshold={threshold} />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-playfair text-xl font-bold text-foreground">{formatPrice(subtotal)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Link to="/cart" onClick={closeDrawer} className="flex min-h-11 items-center justify-center rounded-lg border border-maroon px-3 text-sm font-bold text-maroon">
                  View Cart
                </Link>
                <Link to="/checkout" onClick={closeDrawer} className="flex min-h-11 items-center justify-center rounded-lg bg-saffron px-3 text-sm font-bold text-white">
                  Checkout
                </Link>
              </div>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CartDrawer;
