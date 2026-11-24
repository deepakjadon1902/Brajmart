import type { CashfreeCheckoutSession } from './api';

type CashfreeFactory = (options: { mode: CashfreeCheckoutSession['mode'] }) => {
  checkout: (options: { paymentSessionId: string; redirectTarget: '_self' }) =>
    Promise<{ error?: { message?: string } } | undefined> | undefined;
};

declare global {
  interface Window {
    Cashfree?: CashfreeFactory;
  }
}

let cashfreeLoader: Promise<CashfreeFactory> | undefined;

export const loadCashfree = () => {
  if (window.Cashfree) return Promise.resolve(window.Cashfree);
  cashfreeLoader ??= new Promise<CashfreeFactory>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    script.async = true;
    const finish = () => {
      window.clearTimeout(timeout);
      script.onload = null;
      script.onerror = null;
      if (window.Cashfree) {
        resolve(window.Cashfree);
      } else {
        script.remove();
        reject(new Error('Unable to load Cashfree checkout. Please try again.'));
      }
    };
    const timeout = window.setTimeout(finish, 12_000);
    script.onload = finish;
    script.onerror = finish;
    document.head.appendChild(script);
  }).catch((error) => {
    cashfreeLoader = undefined;
    throw error;
  });
  return cashfreeLoader;
};

export const launchCashfree = async (session: CashfreeCheckoutSession) => {
  const Cashfree = await loadCashfree();
  const result = await Cashfree({ mode: session.mode }).checkout({
    paymentSessionId: session.paymentSessionId,
    redirectTarget: '_self',
  });
  if (result?.error) throw new Error(result.error.message || 'Unable to open Cashfree checkout.');
};
