import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

const VerifyOtpPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const emailFromQuery = searchParams.get('email') || '';
  const [email, setEmail] = useState(emailFromQuery);
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const verifyOtp = useAuthStore((s) => s.verifyOtp);
  const resendOtp = useAuthStore((s) => s.resendOtp);

  useEffect(() => {
    if (emailFromQuery) setEmail(emailFromQuery);
  }, [emailFromQuery]);

  useEffect(() => {
    if (!cooldown) return;
    const timer = setInterval(() => {
      setCooldown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const otp = digits.join('');
    if (!email || otp.length !== 6) {
      toast.error('Enter email and code');
      return;
    }
    setLoading(true);
    const result = await verifyOtp({ email, otp });
    setLoading(false);
    if (result.ok) {
      toast.success(result.message || 'Email verified.');
      navigate('/');
    } else {
      toast.error(result.message || 'Verification failed');
    }
  };

  const handleResend = async () => {
    if (!email) {
      toast.error('Enter your email first');
      return;
    }
    if (cooldown > 0) return;
    setLoading(true);
    const result = await resendOtp({ email });
    setLoading(false);
    if (result.ok) toast.success(result.message || 'Code sent');
    else toast.error(result.message || 'Unable to resend code');
    setCooldown(60);
  };

  const setDigit = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    if (value && index < 5) {
      const el = document.getElementById(`otp-${index + 1}`) as HTMLInputElement | null;
      el?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      const el = document.getElementById(`otp-${index - 1}`) as HTMLInputElement | null;
      el?.focus();
    }
  };

  return (
    <div className="min-h-screen bg-pearl flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-card border border-border rounded-2xl p-8 max-w-lg w-full text-center"
      >
        <h1 className="font-cinzel text-2xl font-bold text-foreground mb-2">Verify Your Email</h1>
        <p className="text-muted-foreground text-sm mb-6">Enter the 6‑digit code sent to your email.</p>

        <form onSubmit={handleVerify} className="space-y-4 text-left">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-gold transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Verification Code</label>
            <div className="grid grid-cols-6 gap-2">
              {digits.map((d, i) => (
                <input
                  key={i}
                  id={`otp-${i}`}
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={(e) => setDigit(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className="h-12 rounded-xl border border-border bg-background text-center text-lg font-semibold outline-none focus:border-gold transition-colors"
                />
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gold-gradient text-maroon-dark font-bold text-sm shimmer active:scale-[0.97] transition-transform disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Verify Email'}
          </button>
        </form>

        <button
          type="button"
          onClick={handleResend}
          disabled={loading || cooldown > 0}
          className="mt-4 text-sm text-saffron font-semibold hover:underline disabled:opacity-50"
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
        </button>

        <div className="mt-6 text-center">
          <Link to="/login" className="text-saffron font-semibold hover:underline">Back to Login</Link>
        </div>
      </motion.div>
    </div>
  );
};

export default VerifyOtpPage;
