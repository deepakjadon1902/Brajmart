const CONSENT_KEY = 'brajmart-cookie-consent';
const CONSENT_VERSION = '2026-10';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

type ConsentRecord = {
  accepted: boolean;
  version: string;
  acceptedAt?: string;
  dismissedAt?: string;
};

const readCookie = (name: string) => {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.$?*|{}()[\]\\/+^]/g, '\\$&')}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
};

const readStoredConsent = (): ConsentRecord | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as ConsentRecord : null;
  } catch {
    return null;
  }
};

export const hasCookieConsent = () => {
  const cookieValue = readCookie(CONSENT_KEY);
  if (cookieValue === 'accepted') return true;

  const stored = readStoredConsent();
  return Boolean(stored?.accepted && stored.version === CONSENT_VERSION);
};

export const hasSeenCookieNotice = () => {
  const cookieValue = readCookie(CONSENT_KEY);
  if (cookieValue === 'accepted' || cookieValue === 'dismissed') return true;

  const stored = readStoredConsent();
  return Boolean(stored?.version === CONSENT_VERSION && (stored.accepted || stored.dismissedAt));
};

const saveCookieNoticeChoice = (record: ConsentRecord, cookieValue: 'accepted' | 'dismissed') => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify(record));
  } catch {
    // Consent still falls back to the browser cookie below.
  }

  document.cookie = `${CONSENT_KEY}=${cookieValue}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
};

export const acceptCookieConsent = () => {
  const record: ConsentRecord = {
    accepted: true,
    version: CONSENT_VERSION,
    acceptedAt: new Date().toISOString(),
  };

  saveCookieNoticeChoice(record, 'accepted');
};

export const dismissCookieNotice = () => {
  const record: ConsentRecord = {
    accepted: false,
    version: CONSENT_VERSION,
    dismissedAt: new Date().toISOString(),
  };

  saveCookieNoticeChoice(record, 'dismissed');
};
