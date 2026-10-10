import { Check, ShieldCheck, X } from 'lucide-react';
import { useState } from 'react';
import { acceptCookieConsent, dismissCookieNotice, hasSeenCookieNotice } from '@/lib/cookieConsent';

type CookieConsentBannerProps = {
  onAccept?: () => void;
};

const CookieConsentBanner = ({ onAccept }: CookieConsentBannerProps) => {
  const [visible, setVisible] = useState(() => !hasSeenCookieNotice());

  if (!visible) return null;

  const handleAccept = () => {
    acceptCookieConsent();
    onAccept?.();
    setVisible(false);
  };

  const handleClose = () => {
    dismissCookieNotice();
    setVisible(false);
  };

  return (
    <section
      className="fixed inset-x-3 bottom-[76px] z-[95] mx-auto max-w-3xl rounded-lg border border-gold/30 bg-card/95 p-3 text-card-foreground shadow-2xl shadow-black/15 backdrop-blur supports-[backdrop-filter]:bg-card/90 sm:bottom-5 sm:p-4"
      aria-label="Cookie and performance notice"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tulsi/10 text-tulsi">
          <ShieldCheck size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-cinzel text-sm font-bold text-foreground sm:text-base">Make Brajmart faster for you</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            We use essential cookies plus local browser memory to keep your cart, wishlist, checkout progress, and frequently viewed pages ready faster.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleAccept}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-saffron px-4 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-saffron/90 focus:outline-none focus:ring-2 focus:ring-saffron focus:ring-offset-2"
            >
              <Check size={16} />
              Accept cookies
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Close cookie notice"
        >
          <X size={16} />
        </button>
      </div>
    </section>
  );
};

export default CookieConsentBanner;
