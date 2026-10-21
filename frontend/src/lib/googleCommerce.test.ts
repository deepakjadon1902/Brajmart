import { beforeEach, expect, it, vi } from 'vitest';
import { publishGoogleCommerceIntent } from './googleCommerce';
import { hasCookieConsent } from './cookieConsent';
vi.mock('./cookieConsent', () => ({ hasCookieConsent: vi.fn() }));
const state = window as Window & { dataLayer?: unknown[] };
beforeEach(() => { state.dataLayer = []; vi.mocked(hasCookieConsent).mockReturnValue(true); });
it('publishes actual checkout intent using the app event and sanitized ecommerce fields', () => {
  publishGoogleCommerceIntent('InitiateCheckout', { value: 159, contents: [{ id: '101', quantity: 1, item_price: 100 }], email: 'private@example.com' }, 'intent-1');
  expect(state.dataLayer).toEqual([{ event: 'begin_checkout', event_id: 'intent-1', ecommerce: { currency: 'INR', value: 159, items: [{ item_id: '101', quantity: 1, price: 100 }] } }]);
});
it('cannot publish any browser Purchase or arbitrary custom event', () => {
  for (const event of ['Purchase', 'purchase', 'conversion', 'PageView', 'constructor', 'toString', '__proto__']) publishGoogleCommerceIntent(event, { value: 100 }, 'fake');
  expect(state.dataLayer).toEqual([]);
});
it('does not publish advertising funnel data without consent', () => {
  vi.mocked(hasCookieConsent).mockReturnValue(false);
  publishGoogleCommerceIntent('AddToCart', { value: 100 }, 'intent-1');
  expect(state.dataLayer).toEqual([]);
});
