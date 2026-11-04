import { createContext, useContext, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { useAuthStore, type User } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { useCheckoutFollowups } from '@/hooks/useCheckoutFollowups';
import type { Product } from '@/types/product';

type ReminderContext = {
  email: string; setEmail: (value: string) => void;
  optedIn: boolean; setOptedIn: (value: boolean) => void;
  state: 'idle' | 'saving' | 'saved' | 'error'; retry: () => void;
};
const ReminderContext = createContext<ReminderContext | null>(null);
const toItem = (product: Product, quantity = 1) => ({
  productId: product.id.split('::')[0], quantity,
  selectedSize: product.selectedSize, selectedPieces: product.selectedPieces, selectedAttributes: product.selectedAttributes,
});

const ReminderProvider = ({ children, customer }: { children: ReactNode; customer: User | null }) => {
  const cart = useCartStore((s) => s.items);
  const favorites = useWishlistStore((s) => s.items);
  const { pathname } = useLocation();
  const [email, setEmail] = useState(customer?.email || '');
  const [optedIn, setOptedIn] = useState(false);
  const followup = useCheckoutFollowups({
    email, customerName: customer?.fullName || '',
    items: cart.map((item) => toItem(item.product, item.quantity)),
    favoriteItems: favorites.map((product) => toItem(product)),
    reminderSource: 'saved_products',
    consent: { cartReminder: optedIn, offerEmail: false, whatsappFollowup: false },
  }, !/^\/(admin|checkout|payment-status|order-success|thank-you)(\/|$)/.test(pathname));

  return <ReminderContext.Provider value={{ email, setEmail, optedIn, setOptedIn, state: followup.state, retry: () => { void followup.save().catch(() => {}); } }}>
    {children}
  </ReminderContext.Provider>;
};

// Keep one controller across storefront navigation, scoped to the current user.
export const SavedProductsReminderProvider = ({ children }: { children: ReactNode }) => {
  const customer = useAuthStore((s) => s.user);
  return <ReminderProvider key={customer?.id || 'guest'} customer={customer}>{children}</ReminderProvider>;
};

export const SavedProductsReminder = () => {
  const reminder = useContext(ReminderContext);
  if (!reminder) return null;
  const { email, setEmail, optedIn, setOptedIn, state, retry } = reminder;
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  return <section aria-label="Saved product reminder" className="mb-6 rounded-xl border border-border bg-card p-4 sm:p-5">
    <div className="flex items-center gap-2 font-semibold"><Mail size={18} className="text-saffron" />Save it for later</div>
    <p className="mt-1 text-sm text-muted-foreground">Get an email reminder after 3 hours if you leave products in your cart or favorites without completing an order.</p>
    <div className="mt-3 max-w-md">
      <label htmlFor="saved-products-email" className="text-sm font-medium">Reminder email</label>
      <input id="saved-products-email" type="email" autoComplete="email" value={email} readOnly={optedIn}
        onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com"
        className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm read-only:bg-muted/50" />
      {optedIn && <p className="mt-1 text-xs text-muted-foreground">Uncheck the reminder to change this email address.</p>}
    </div>
    <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm">
      <input type="checkbox" checked={optedIn} disabled={!validEmail} onChange={(event) => setOptedIn(event.target.checked)} className="mt-0.5 h-4 w-4 accent-amber-600 disabled:opacity-50" />
      <span>Email me a reminder about my cart and favorites. I can unsubscribe at any time.</span>
    </label>
    <div role="status" aria-live="polite" className="mt-2 text-xs text-muted-foreground">
      {email && !validEmail ? 'Enter a valid email address to save your reminder.'
        : state === 'saving' ? 'Saving your preference…'
        : state === 'saved' ? optedIn ? 'Reminder saved. We will check current prices and availability before sending.' : 'Reminder turned off.'
        : state === 'error' ? <>Could not save your preference. <button type="button" onClick={retry} className="font-semibold underline">Try again</button></>
        : 'Optional. No payment or checkout is needed to save this reminder.'}
    </div>
  </section>;
};
