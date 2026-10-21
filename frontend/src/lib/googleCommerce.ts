import { hasCookieConsent } from './cookieConsent';

const events: Record<string, string> = { AddToCart: 'add_to_cart', InitiateCheckout: 'begin_checkout', AddPaymentInfo: 'add_payment_info' };
export const publishGoogleCommerceIntent = (eventName: string, params: Record<string, unknown>, eventId: string) => {
  const event = Object.prototype.hasOwnProperty.call(events, eventName) ? events[eventName] : undefined;
  if (!event || typeof window === 'undefined' || !hasCookieConsent()) return;
  const state = window as Window & { dataLayer?: unknown[] };
  const contents = Array.isArray(params.contents) ? params.contents : [];
  state.dataLayer ||= [];
  state.dataLayer.push({
    event, event_id: eventId,
    ecommerce: {
      currency: 'INR', ...(typeof params.value === 'number' && Number.isFinite(params.value) && params.value > 0 ? { value: params.value } : {}),
      items: contents.filter((item) => item && typeof item === 'object').map((item) => ({
        item_id: String(item.id || ''), quantity: Number(item.quantity) || 1,
        ...(typeof item.item_price === 'number' && Number.isFinite(item.item_price) ? { price: item.item_price } : {}),
      })),
    },
  });
};
