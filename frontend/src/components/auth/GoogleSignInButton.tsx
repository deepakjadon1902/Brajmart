import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: {
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              type?: 'standard' | 'icon';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              width?: number;
            }
          ) => void;
        };
      };
    };
  }
}

type GoogleSignInButtonProps = {
  onCredential: (credential: string) => void;
  text?: 'signin_with' | 'signup_with' | 'continue_with';
};

const GOOGLE_SCRIPT_ID = 'google-identity-services';

const loadGoogleScript = () =>
  new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }

    const existing = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Unable to load Google sign in.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = GOOGLE_SCRIPT_ID;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Unable to load Google sign in.'));
    document.head.appendChild(script);
  });

const GoogleSignInButton = ({ onCredential, text = 'continue_with' }: GoogleSignInButtonProps) => {
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

    if (!clientId) {
      setError('Google sign in is not configured.');
      return;
    }

    loadGoogleScript()
      .then(() => {
        if (cancelled || !buttonRef.current || !window.google?.accounts?.id) return;
        buttonRef.current.innerHTML = '';
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response.credential) onCredential(response.credential);
            else setError('Google did not return a sign in credential.');
          },
        });
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          shape: 'rectangular',
          text,
          width: Math.min(buttonRef.current.offsetWidth || 360, 400),
        });
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || 'Unable to load Google sign in.');
      });

    return () => {
      cancelled = true;
    };
  }, [onCredential, text]);

  return (
    <div className="mb-5">
      <div ref={buttonRef} className="min-h-[44px] w-full overflow-hidden rounded-xl" />
      {error ? <p className="mt-2 text-center text-xs text-red-500">{error}</p> : null}
    </div>
  );
};

export default GoogleSignInButton;
