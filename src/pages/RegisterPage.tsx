import * as React from "react";
﻿import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, Phone } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const RegisterPage = () => {
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '', mobile: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register, loginWithGoogle } = useAuthStore();
  const navigate = useNavigate();

  const update = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName || !form.email || !form.password) { toast.error('Please fill required fields'); return; }
    if (form.password !== form.confirmPassword) { toast.error('Passwords do not match'); return; }
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setLoading(true);
    const result = await register(form);
    setLoading(false);
    if (result.ok) {
      toast.success(result.message || 'Account created. You can sign in now.');
      if (!result.message) {
        navigate('/');
      } else {
        navigate('/login');
      }
    } else {
      toast.error(result.message || 'Registration failed');
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    const result = await loginWithGoogle();
    setLoading(false);
    if (result.ok) {
      toast.success('Signed up with Google');
      navigate('/');
    } else {
      toast.error(result.message || 'Google sign up failed');
    }
  };

  const fields = [
    { key: 'fullName', label: 'Full Name', icon: User, placeholder: 'Enter your full name', type: 'text' },
    { key: 'email', label: 'Email', icon: Mail, placeholder: 'your@email.com', type: 'email' },
    { key: 'mobile', label: 'Mobile (Optional)', icon: Phone, placeholder: '10-digit number', type: 'tel' },
  ];

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
          <h1 className="font-cinzel text-2xl font-bold text-foreground">Create Account</h1>
          <p className="text-muted-foreground text-sm mt-1">Join our devotee community</p>
        </div>

        <div className="bg-card rounded-2xl border border-border p-8 shadow-sm">
          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-border bg-background hover:bg-muted text-foreground font-medium text-sm transition-colors disabled:opacity-50 mb-5"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-card px-3 text-muted-foreground">or register with email</span></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {fields.map(f => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-foreground mb-1.5">{f.label}</label>
                <div className="relative">
                  <f.icon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type={f.type}
                    value={form[f.key as keyof typeof form]}
                    onChange={e => update(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-gold transition-colors"
                  />
                </div>
              </div>
            ))}

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => update('password', e.target.value)}
                  placeholder="Min 8 characters"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-gold transition-colors"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Confirm Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={e => update('confirmPassword', e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-gold transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gold-gradient text-maroon-dark font-bold text-sm shimmer active:scale-[0.97] transition-transform disabled:opacity-50"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="text-saffron font-semibold hover:underline">Sign In</Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default RegisterPage;
