import { useState } from 'react';
import { useAdminStore } from '@/store/adminStore';
import { useSettingsStore } from '@/store/settingsStore';
import { Save, Store, Bell, Shield, Truck, CheckCircle } from 'lucide-react';

const AdminSettings = () => {
  const { adminEmail } = useAdminStore();
  const { settings, updateSettings, updateNotifications } = useSettingsStore();
  const [saved, setSaved] = useState(false);

  const [storeName, setStoreName] = useState(settings.storeName);
  const [tagline, setTagline] = useState(settings.tagline);
  const [currency, setCurrency] = useState(settings.currency);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(settings.freeShippingThreshold);
  const [shippingFee, setShippingFee] = useState(settings.shippingFee);

  const handleSave = () => {
    updateSettings({ storeName, tagline, currency, freeShippingThreshold, shippingFee });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-white">Settings</h1>

      {/* Store Settings */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-white mb-2"><Store size={18} /><h2 className="text-lg font-semibold">Store Settings</h2></div>
        <p className="text-xs text-slate-400">Changes here will reflect in the user-facing application instantly.</p>
        <div>
          <label className="block text-sm text-slate-300 mb-1">Store Name</label>
          <input value={storeName} onChange={(e) => setStoreName(e.target.value)} className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">Tagline</label>
          <input value={tagline} onChange={(e) => setTagline(e.target.value)} className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1">Currency</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none">
            <option value="INR">₹ INR</option>
            <option value="USD">$ USD</option>
          </select>
        </div>
      </div>

      {/* Shipping Settings */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-white mb-2"><Truck size={18} /><h2 className="text-lg font-semibold">Shipping Settings</h2></div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1">Free Shipping Above (₹)</label>
            <input type="number" value={freeShippingThreshold} onChange={(e) => setFreeShippingThreshold(Number(e.target.value))} className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Shipping Fee (₹)</label>
            <input type="number" value={shippingFee} onChange={(e) => setShippingFee(Number(e.target.value))} className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-white mb-2"><Bell size={18} /><h2 className="text-lg font-semibold">Notifications</h2></div>
        {Object.entries(settings.notifications).map(([key, val]) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-sm text-slate-300 capitalize">{key} alerts</span>
            <button onClick={() => updateNotifications(key, !val)} className={`w-10 h-5 rounded-full transition ${val ? 'bg-amber-500' : 'bg-slate-600'}`}>
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${val ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        ))}
      </div>

      {/* Admin Info */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2 text-white mb-2"><Shield size={18} /><h2 className="text-lg font-semibold">Admin Account</h2></div>
        <div className="flex justify-between text-sm"><span className="text-slate-400">Email</span><span className="text-white">{adminEmail}</span></div>
        <div className="flex justify-between text-sm"><span className="text-slate-400">Role</span><span className="text-amber-400 font-medium">Super Admin</span></div>
      </div>

      <button onClick={handleSave} className="flex items-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition">
        {saved ? <><CheckCircle size={16} /> Saved ✓</> : <><Save size={16} /> Save Settings</>}
      </button>
    </div>
  );
};

export default AdminSettings;
