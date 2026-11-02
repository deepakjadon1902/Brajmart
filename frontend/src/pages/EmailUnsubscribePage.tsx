import { useEffect, useState } from 'react';
import { unsubscribeEmailFollowups } from '@/lib/api';

const EmailUnsubscribePage = () => {
  const [token, setToken] = useState(() => {
    if (typeof window === 'undefined') return '';
    const match = window.location.hash.match(/(?:^#|&)token=([a-f0-9]{64})(?:&|$)/i);
    return match ? decodeURIComponent(match[1]) : '';
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!window.location.hash) return;
    window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`);
  }, []);

  const handleUnsubscribe = async () => {
    if (!token || loading || done) return;
    setLoading(true);
    try {
      const result = await unsubscribeEmailFollowups(token);
      setMessage(result.message);
      setDone(true);
      setToken('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'We could not update your preferences. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-lg sm:p-8">
        <h1 className="font-cinzel text-2xl font-bold text-foreground">Email preferences</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Stop BrajMart cart reminders, offer emails, and WhatsApp cart follow-ups. This will not stop essential order and delivery updates.
        </p>
        {message && <p role="status" className="mt-4 rounded-lg bg-muted p-3 text-sm text-foreground">{message}</p>}
        {!done && (
          <button
            type="button"
            onClick={() => { void handleUnsubscribe(); }}
            disabled={!token || loading}
            className="mt-6 min-h-11 rounded-lg bg-gold-gradient px-5 py-2.5 text-sm font-bold text-maroon-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Updating…' : 'Unsubscribe'}
          </button>
        )}
        {!token && !done && <p className="mt-4 text-xs text-muted-foreground">This link is missing or invalid. Please contact BrajMart support for help.</p>}
      </section>
    </main>
  );
};

export default EmailUnsubscribePage;
