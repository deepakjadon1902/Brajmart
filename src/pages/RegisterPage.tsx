import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, Phone } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

const RegisterPage = () => {
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '', mobile: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const register = useAuthStore(s => s.register);
  const navigate = useNavigate();

  const update = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName || !form.email || !form.password) { toast.error('Please fill required fields'); return; }
    if (form.password !== form.confirmPassword) { toast.error('Passwords do not match'); return; }
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setLoading(true);
    const success = await register(form);
    setLoading(false);
    if (success) {
      toast.success('Account created! Welcome to BrajMart 🙏');
      navigate('/');
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
            <span className="text-3xl">🪷</span>
            <span className="font-cinzel text-2xl font-bold text-maroon-gold-gradient">BrajMart</span>
          </Link>
          <h1 className="font-cinzel text-2xl font-bold text-foreground">Create Account</h1>
          <p className="text-muted-foreground text-sm mt-1">Join our devotee community</p>
        </div>

        <div className="bg-card rounded-2xl border border-border p-8 shadow-sm">
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
              {loading ? 'Creating Account...' : 'Create Account 🙏'}
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
