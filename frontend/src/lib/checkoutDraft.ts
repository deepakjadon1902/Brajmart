import type { Address } from '@/store/orderStore';

const CHECKOUT_DRAFT_BASE_KEY = 'brajmart-checkout-draft';
const GUEST_USER_ID = 'guest';

export type CheckoutDraft = {
  step?: number;
  paymentMethod?: string;
  billingSameAsShipping?: boolean;
  customerEmail?: string;
  shippingAddress?: Address;
  billingAddress?: Address;
  couponCode?: string;
  appliedCoupon?: {
    code: string;
    discountAmount: number;
    description?: string;
  } | null;
  wantsCodService?: boolean;
};

const getCurrentUserId = (userId?: string | null) => {
  if (userId) return userId;
  try {
    const raw = localStorage.getItem('brajmart-auth');
    if (!raw) return GUEST_USER_ID;
    const parsed = JSON.parse(raw);
    return parsed?.state?.user?.id || GUEST_USER_ID;
  } catch {
    return GUEST_USER_ID;
  }
};

const getCheckoutDraftKey = (userId?: string | null) =>
  `${CHECKOUT_DRAFT_BASE_KEY}:${getCurrentUserId(userId)}`;

export const readCheckoutDraft = (userId?: string | null): CheckoutDraft | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(getCheckoutDraftKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as CheckoutDraft : null;
  } catch {
    return null;
  }
};

export const saveCheckoutDraft = (draft: CheckoutDraft, userId?: string | null) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getCheckoutDraftKey(userId), JSON.stringify(draft));
  } catch {
    // Storage may be full or blocked; checkout still works without a draft.
  }
};

export const clearCheckoutDraft = (userId?: string | null) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(getCheckoutDraftKey(userId));
  } catch {
    // ignore storage errors
  }
};
