import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Edit2 } from 'lucide-react';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ProfileSidebar from '@/components/profile/ProfileSidebar';
import { useAuthStore } from '@/store/authStore';

const ProfileAddressesPage = () => {
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  if (!isAuthenticated || !user) {
    navigate('/login');
    return null;
  }

  const hasAddress = user.address || user.city || user.state || user.pincode || user.mobile;

  return (
    <div className="min-h-screen bg-background">
      <AnnouncementBar /><Navbar />
      <div className="container mx-auto px-4 py-8">
        <h1 className="font-cinzel text-2xl font-bold text-foreground mb-6">My Addresses</h1>

        <div className="grid md:grid-cols-3 gap-6">
          <ProfileSidebar />

          <div className="md:col-span-2">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl border border-border p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MapPin size={18} className="text-gold" />
                  <h2 className="font-cinzel text-lg font-bold">Default Address</h2>
                </div>
                <button onClick={() => navigate('/profile')} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gold text-gold text-sm font-semibold hover:bg-gold hover:text-maroon-dark transition-colors">
                  <Edit2 size={14} /> Edit
                </button>
              </div>

              {hasAddress ? (
                <div className="text-sm text-muted-foreground space-y-1">
                  <p className="font-semibold text-foreground">{user.fullName}</p>
                  {user.mobile && <p>{user.mobile}</p>}
                  {user.address && <p>{user.address}</p>}
                  <p>{[user.city, user.state, user.pincode].filter(Boolean).join(', ')}</p>
                  {user.email && <p>{user.email}</p>}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No address saved. Click Edit to add your delivery address.</p>
              )}
            </motion.div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ProfileAddressesPage;
