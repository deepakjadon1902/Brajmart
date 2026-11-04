import { useCallback, useEffect, useRef, useState } from 'react';
import { captureEmailFollowup } from '@/lib/api';

type FollowupPayload = Parameters<typeof captureEmailFollowup>[0];
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

// Save when the customer opts in, even if they never submit an address. A
// serialized queue keeps a slow older request from replacing the latest cart.
export const useCheckoutFollowups = (payload: FollowupPayload, enabled: boolean) => {
  const [state, setState] = useState<SaveState>('idle');
  const lastSaved = useRef('');
  const requestedCartEmails = useRef(new Set<string>());
  const queuedSave = useRef<{ key: string; promise: Promise<void> } | null>(null);
  const pendingCount = useRef(0);
  const tail = useRef<Promise<void>>(Promise.resolve());
  const mounted = useRef(true);
  const email = payload.email.trim().toLowerCase();
  const hasChoice = Object.values(payload.consent).some(Boolean);
  const shouldRevoke = !payload.consent.cartReminder && requestedCartEmails.current.has(email);
  const key = enabled && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    && (hasChoice || shouldRevoke) && (!payload.consent.cartReminder || payload.items.length > 0 || payload.reminderSource === 'saved_products')
    ? JSON.stringify({ ...payload, email, revokeCartReminder: shouldRevoke }) : '';
  const latestKey = useRef(key);
  latestKey.current = key;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const save = useCallback((): Promise<void> => {
    if (!key || (lastSaved.current === key && pendingCount.current === 0)) return Promise.resolve();
    if (queuedSave.current?.key === key) return queuedSave.current.promise;
    const request: FollowupPayload = JSON.parse(key);
    if (request.consent.cartReminder) requestedCartEmails.current.add(request.email);
    pendingCount.current++;
    if (mounted.current) setState('saving');
    const pending = tail.current.catch(() => {}).then(async () => {
      await captureEmailFollowup(request);
      lastSaved.current = key;
      if (request.revokeCartReminder && latestKey.current === key) requestedCartEmails.current.delete(request.email);
      if (mounted.current && latestKey.current === key) setState('saved');
    }).catch((error) => {
      if (mounted.current && latestKey.current === key) setState('error');
      throw error;
    }).finally(() => {
      pendingCount.current--;
      if (queuedSave.current?.promise === pending) queuedSave.current = null;
    });
    queuedSave.current = { key, promise: pending };
    tail.current = pending;
    return pending;
  }, [key]);

  useEffect(() => {
    if (!key) { setState('idle'); return; }
    if (shouldRevoke) { void save().catch(() => {}); return; }
    const timer = window.setTimeout(() => { void save().catch(() => {}); }, 600);
    return () => window.clearTimeout(timer);
  }, [key, save, shouldRevoke]);

  // A new preference is still saving during the debounce interval; do not
  // display the previous request's successful result for a changed checkbox.
  return { save, state: key && lastSaved.current !== key && state !== 'error' ? 'saving' as const : state };
};
