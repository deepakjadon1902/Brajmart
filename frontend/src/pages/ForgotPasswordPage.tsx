import * as React from 'react';
import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Mail, ShieldCheck, KeyRound } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState(params.get('email') || '');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const { requestPasswordResetOtp, verifyPasswordResetOtp } = useAuthStore();

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return toast.error('Enter your email');
    setLoading(true);
    const res = await requestPasswordResetOtp({ email });
    setLoading(false);
    if (!res.ok) return toast.error(res.message || 'Unable to send code');
    toast.success(res.message || 'Code sent');
    setStep('otp');
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !otp) return toast.error('Enter email and code');
    setLoading(true);
    const res = await verifyPasswordResetOtp({ email, otp });
    setLoading(false);
    if (!res.ok) return toast.error(res.message || 'Invalid code');
    toast.success('Verified. Please set a new password in your profile.');
    navigate('/profile?reset=1');
  };

  return (
    <div className="min-h-screen bg-pearl flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0)' }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <span className="text-3xl">🙏</span>
            <span className="font-cinzel text-2xl font-bold text-maroon-gold-gradient">BrajMart</span>
          </Link>
          <h1 className="font-cinzel text-2xl font-bold text-foreground">Forgot Password</h1>
          <p className="text-muted-foreground text-sm mt-1">Verify your email with a one-time code</p>
        </div>

        <div className="bg-card rounded-2xl border border-border p-8 shadow-sm">
          {step === 'email' ? (
            <form onSubmit={handleSend} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-gold transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gold-gradient text-maroon-dark font-bold text-sm shimmer active:scale-[0.97] transition-transform disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send OTP'}
              </button>

              <div className="flex items-center gap-2 rounded-xl border border-border bg-pearl px-3 py-2 text-xs text-muted-foreground">
                <ShieldCheck size={16} className="text-tulsi" />
                <span>We’ll send a 6-digit code to your email.</span>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-5">
              <div className="text-xs text-muted-foreground">
                Code sent to <span className="font-semibold text-foreground">{email}</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">OTP Code</label>
                <div className="relative">
                  <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-gold transition-colors tracking-[0.35em] font-semibold"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gold-gradient text-maroon-dark font-bold text-sm shimmer active:scale-[0.97] transition-transform disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify & Login'}
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={async () => {
                  setLoading(true);
                  const res = await requestPasswordResetOtp({ email });
                  setLoading(false);
                  if (!res.ok) return toast.error(res.message || 'Unable to resend code');
                  toast.success(res.message || 'Code resent');
                }}
                className="w-full py-2.5 rounded-xl border border-border bg-background text-foreground font-medium text-sm hover:bg-muted transition-colors disabled:opacity-50"
              >
                Resend OTP
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => setStep('email')}
                className="w-full text-sm text-saffron font-semibold hover:underline"
              >
                Change email
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Remembered your password?{' '}
              <Link to="/login" className="text-saffron font-semibold hover:underline">Sign in</Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ForgotPasswordPage;

