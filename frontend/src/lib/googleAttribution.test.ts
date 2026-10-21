import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { hasCookieConsent } from './cookieConsent';
import { getGooglePurchaseContext } from './googleAttribution';

vi.mock('./cookieConsent', () => ({ hasCookieConsent: vi.fn() }));
type GoogleWindow = Window & { gtag?: (...args: unknown[]) => void };
beforeEach(() => { vi.mocked(hasCookieConsent).mockReturnValue(true); delete (window as GoogleWindow).gtag; });
afterEach(() => { vi.useRealTimers(); delete (window as GoogleWindow).gtag; });
it('uses the real SDK client and session identifiers after consent', async () => {
  (window as GoogleWindow).gtag = (...args) => (args[3] as (value: string) => void)(args[2] === 'client_id' ? '123.456' : '1790000000');
  expect(await getGooglePurchaseContext()).toEqual({ measurementId: 'G-CWTBY3XKNW', analyticsConsent: true, clientId: '123.456', sessionId: '1790000000' });
});
it('does not read analytics identifiers without consent', async () => {
  vi.mocked(hasCookieConsent).mockReturnValue(false);
  const gtag = vi.fn(); (window as GoogleWindow).gtag = gtag;
  expect((await getGooglePurchaseContext()).analyticsConsent).toBe(false);
  expect(gtag).not.toHaveBeenCalled();
});
it('does not invent a client ID when the SDK is unavailable', async () => {
  expect((await getGooglePurchaseContext()).clientId).toBeUndefined();
});
it('an ad blocker or SDK failure cannot prevent checkout', async () => {
  vi.useFakeTimers();
  (window as GoogleWindow).gtag = vi.fn();
  const context = getGooglePurchaseContext();
  await vi.advanceTimersByTimeAsync(400);
  expect((await context).clientId).toBeUndefined();
  (window as GoogleWindow).gtag = () => { throw new Error('SDK unavailable'); };
  expect((await getGooglePurchaseContext()).clientId).toBeUndefined();
});
it('does not treat customer emails or malformed IDs as Google client IDs', async () => {
  (window as GoogleWindow).gtag = (...args) => (args[3] as (value: string) => void)('customer@example.com');
  const context = await getGooglePurchaseContext();
  expect(context.clientId).toBeUndefined(); expect(context.sessionId).toBeUndefined();
});
