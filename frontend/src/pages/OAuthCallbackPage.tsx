import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';

const OAuthCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Completing sign in...');
  const completeOAuthLogin = useAuthStore((s) => s.completeOAuthLogin);
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Missing authentication token.');
      return;
    }
    completeOAuthLogin(token)
      .then((res) => {
        if (res.ok) {
          setStatus('success');
          setMessage('Signed in successfully. Redirecting...');
          setTimeout(() => navigate('/'), 800);
        } else {
          setStatus('error');
          setMessage(res.message || 'Authentication failed.');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Authentication failed.');
      });
  }, [searchParams, completeOAuthLogin, navigate]);

  return (
    <div className="min-h-screen bg-pearl flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-card border border-border rounded-2xl p-8 max-w-lg w-full text-center"
      >
        <h1 className="font-cinzel text-2xl font-bold text-foreground mb-2">Signing You In</h1>
        <p className={status === 'error' ? 'text-red-500' : status === 'success' ? 'text-emerald-600' : 'text-muted-foreground'}>
          {message}
        </p>
      </motion.div>
    </div>
  );
};

export default OAuthCallbackPage;
