import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { verifyEmail } from '@/lib/api';
import { motion } from 'framer-motion';

const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Verification token is missing.');
      return;
    }
    verifyEmail(token)
      .then((res: any) => {
        setStatus('success');
        setMessage(res?.message || 'Email verified successfully.');
      })
      .catch((err: any) => {
        setStatus('error');
        setMessage(err?.message || 'Verification failed.');
      });
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-pearl flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-card border border-border rounded-2xl p-8 max-w-lg w-full text-center"
      >
        <h1 className="font-cinzel text-2xl font-bold text-foreground mb-2">Email Verification</h1>
        {status === 'loading' && <p className="text-muted-foreground">Verifying your email...</p>}
        {status !== 'loading' && <p className={status === 'success' ? 'text-emerald-600' : 'text-red-500'}>{message}</p>}
        <div className="mt-6">
          <Link to="/login" className="text-saffron font-semibold hover:underline">Go to Login</Link>
        </div>
      </motion.div>
    </div>
  );
};

export default VerifyEmailPage;
