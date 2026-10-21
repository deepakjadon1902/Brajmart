import { hasCookieConsent } from './cookieConsent';

export const GOOGLE_MEASUREMENT_ID = 'G-CWTBY3XKNW';
type GoogleContext = { measurementId: string; analyticsConsent: boolean; clientId?: string; sessionId?: string };

export const getGooglePurchaseContext = async (): Promise<GoogleContext> => {
  const measurementId = import.meta.env.VITE_GA4_MEASUREMENT_ID || GOOGLE_MEASUREMENT_ID;
  const base = { measurementId, analyticsConsent: hasCookieConsent() };
  if (!base.analyticsConsent || typeof window === 'undefined') return base;
  const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof gtag !== 'function') return base;
  const get = (field: string) => new Promise<string>((resolve) => {
    const timer = window.setTimeout(() => resolve(''), 400);
    try { gtag('get', measurementId, field, (value: unknown) => { window.clearTimeout(timer); resolve(String(value ?? '')); }); }
    catch { window.clearTimeout(timer); resolve(''); }
  });
  const [clientId, sessionId] = await Promise.all([get('client_id'), get('session_id')]);
  return { ...base, ...(/^\d{1,20}\.\d{1,20}$/.test(clientId) ? { clientId } : {}), ...(/^\d{1,20}$/.test(sessionId) ? { sessionId } : {}) };
};
