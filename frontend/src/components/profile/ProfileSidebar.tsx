import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Package, Heart, MapPin, LogOut, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

const ProfileSidebar = () => {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  if (!user) return null;

  const menuItems = [
    { icon: User, label: 'Profile', to: '/profile', desc: 'Personal information' },
    { icon: Package, label: 'My Orders', to: '/profile/orders', desc: 'Track & manage orders' },
    { icon: Heart, label: 'Wishlist', to: '/wishlist', desc: 'Your saved items' },
    { icon: MapPin, label: 'Addresses', to: '/profile/addresses', desc: 'Manage delivery addresses' },
  ];

  const handleLogout = () => {
    logout();
    toast.success('Logged out. Hare Krishna!');
    navigate('/');
  };

  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="bg-card rounded-2xl border border-border p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-gold-gradient flex items-center justify-center text-2xl font-bold text-maroon-dark mx-auto mb-3">
          {user.fullName?.[0]?.toUpperCase() || 'U'}
        </div>
        <h3 className="font-playfair font-bold text-foreground">{user.fullName}</h3>
        <p className="text-xs text-muted-foreground">{user.email}</p>
      </motion.div>

      <div className="space-y-2">
        {menuItems.map((m) => {
          const active = location.pathname === m.to;
          return (
            <Link
              key={m.label}
              to={m.to}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                active ? 'bg-gold/10 border-gold/40' : 'bg-card border-border hover:border-gold/40'
              }`}
            >
              <m.icon size={18} className="text-gold" />
              <div>
                <span className="block text-sm font-semibold">{m.label}</span>
                <span className="block text-[0.65rem] text-muted-foreground">{m.desc}</span>
              </div>
            </Link>
          );
        })}
        <button onClick={handleLogout} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-destructive/40 transition-colors w-full text-left">
          <LogOut size={18} className="text-destructive" />
          <span className="text-sm font-semibold text-destructive">Logout</span>
        </button>
      </div>
    </div>
  );
};

export default ProfileSidebar;
