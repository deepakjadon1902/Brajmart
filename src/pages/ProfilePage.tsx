import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Package, Heart, MapPin, LogOut, Edit2, Save } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

const ProfilePage = () => {
  const { user, isAuthenticated, logout, updateProfile } = useAuthStore();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    fullName: user?.fullName || '',
    email: user?.email || '',
    mobile: user?.mobile || '',
    address: user?.address || '',
    city: user?.city || '',
    state: user?.state || '',
    pincode: user?.pincode || '',
  });

  if (!isAuthenticated || !user) {
    navigate('/login');
    return null;
  }

  const handleSave = () => {
    updateProfile(form);
    setEditing(false);
    toast.success('Profile updated!');
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out. Hare Krishna! 🙏');
    navigate('/');
  };

  const menuItems = [
    { icon: Package, label: 'My Orders', to: '/orders', desc: 'Track & manage orders' },
    { icon: Heart, label: 'Wishlist', to: '/wishlist', desc: 'Your saved items' },
    { icon: MapPin, label: 'Addresses', to: '/profile', desc: 'Manage delivery addresses' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <AnnouncementBar /><Navbar />
      <div className="container mx-auto px-4 py-8">
        <h1 className="font-cinzel text-2xl font-bold text-foreground mb-6">My Profile</h1>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Sidebar */}
          <div className="space-y-4">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="bg-card rounded-2xl border border-border p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-gold-gradient flex items-center justify-center text-2xl font-bold text-maroon-dark mx-auto mb-3">
                {user.fullName[0]?.toUpperCase()}
              </div>
              <h3 className="font-playfair font-bold text-foreground">{user.fullName}</h3>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </motion.div>

            <div className="space-y-2">
              {menuItems.map(m => (
                <Link key={m.label} to={m.to} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-gold/40 transition-colors">
                  <m.icon size={18} className="text-gold" />
                  <div>
                    <span className="block text-sm font-semibold">{m.label}</span>
                    <span className="block text-[0.65rem] text-muted-foreground">{m.desc}</span>
                  </div>
                </Link>
              ))}
              <button onClick={handleLogout} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-destructive/40 transition-colors w-full text-left">
                <LogOut size={18} className="text-destructive" />
                <span className="text-sm font-semibold text-destructive">Logout</span>
              </button>
            </div>
          </div>

          {/* Profile form */}
          <div className="md:col-span-2">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl border border-border p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-cinzel text-lg font-bold">Personal Information</h2>
                <button onClick={() => editing ? handleSave() : setEditing(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gold text-gold text-sm font-semibold hover:bg-gold hover:text-maroon-dark transition-colors">
                  {editing ? <><Save size={14} /> Save</> : <><Edit2 size={14} /> Edit</>}
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { key: 'fullName', label: 'Full Name' },
                  { key: 'email', label: 'Email' },
                  { key: 'mobile', label: 'Mobile' },
                  { key: 'address', label: 'Address' },
                  { key: 'city', label: 'City' },
                  { key: 'state', label: 'State' },
                  { key: 'pincode', label: 'Pincode' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">{f.label}</label>
                    <input
                      value={form[f.key as keyof typeof form]}
                      onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))}
                      disabled={!editing}
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-gold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ProfilePage;
