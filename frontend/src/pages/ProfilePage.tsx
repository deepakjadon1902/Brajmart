import { useNavigate } from 'react-router-dom';
import { Edit2, Save } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ProfileSidebar from '@/components/profile/ProfileSidebar';

const ProfilePage = () => {
  const { user, isAuthenticated, updateProfile } = useAuthStore();
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

  useEffect(() => {
    if (!user) return;
    setForm({
      fullName: user.fullName || '',
      email: user.email || '',
      mobile: user.mobile || '',
      address: user.address || '',
      city: user.city || '',
      state: user.state || '',
      pincode: user.pincode || '',
    });
  }, [user]);

  if (!isAuthenticated || !user) {
    navigate('/login');
    return null;
  }

  const handleSave = async () => {
    const result = await updateProfile(form);
    if (result.ok) {
      setEditing(false);
      toast.success(result.message || 'Profile updated!');
    } else {
      toast.error(result.message || 'Profile update failed');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AnnouncementBar /><Navbar />
      <div className="container mx-auto px-4 py-8">
        <h1 className="font-cinzel text-2xl font-bold text-foreground mb-6">My Profile</h1>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Sidebar */}
          <ProfileSidebar />

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
