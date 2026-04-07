import { useEffect, useRef, useState } from 'react';
import { useAdminStore } from '@/store/adminStore';
import { useSettingsStore } from '@/store/settingsStore';
import { Save, Store, Bell, Shield, Truck, CheckCircle, Globe, Megaphone, CreditCard, Image, Search, Settings2, Plus, X, Upload } from 'lucide-react';
import { fetchPublicSettings, updatePublicSettings, uploadImage } from '@/lib/api';
import { toast } from 'sonner';

const AdminSettings = () => {
  const { adminEmail } = useAdminStore();
  const { settings, updateSettings, updateNotifications, updateSocialLinks, updateAnnouncementMessages } = useSettingsStore();
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('store');
  const logoRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const [storeName, setStoreName] = useState(settings.storeName);
  const [tagline, setTagline] = useState(settings.tagline);
  const [currency, setCurrency] = useState(settings.currency);
  const [storeEmail, setStoreEmail] = useState(settings.storeEmail);
  const [storePhone, setStorePhone] = useState(settings.storePhone);
  const [storeAddress, setStoreAddress] = useState(settings.storeAddress);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(settings.freeShippingThreshold);
  const [shippingFee, setShippingFee] = useState(settings.shippingFee);
  const [taxRate, setTaxRate] = useState(settings.taxRate);
  const [minOrderAmount, setMinOrderAmount] = useState(settings.minOrderAmount);
  const [maxOrderQuantity, setMaxOrderQuantity] = useState(settings.maxOrderQuantity);
  const [deliveryEtaMinDays, setDeliveryEtaMinDays] = useState(settings.deliveryEtaMinDays);
  const [deliveryEtaMaxDays, setDeliveryEtaMaxDays] = useState(settings.deliveryEtaMaxDays);
  const [codEnabled, setCodEnabled] = useState(settings.codEnabled);
  const [upiEnabled, setUpiEnabled] = useState(settings.upiEnabled);
  const [cardEnabled, setCardEnabled] = useState(settings.cardEnabled);
  const [maintenanceMode, setMaintenanceMode] = useState(settings.maintenanceMode);
  const [metaTitle, setMetaTitle] = useState(settings.metaTitle);
  const [metaDescription, setMetaDescription] = useState(settings.metaDescription);
  const [storeLogo, setStoreLogo] = useState(settings.storeLogo);
  const [upiId, setUpiId] = useState(settings.upiId);
  const [upiPayeeName, setUpiPayeeName] = useState(settings.upiPayeeName || settings.storeName);
  const [announcementEnabled, setAnnouncementEnabled] = useState(settings.announcementBar.enabled);
  const [announcementMessages, setAnnouncementMsgs] = useState<string[]>(settings.announcementBar.messages);
  const [newAnnouncement, setNewAnnouncement] = useState('');
  const [heroBadges, setHeroBadges] = useState<string[]>(settings.heroBadges || []);
  const [newHeroBadge, setNewHeroBadge] = useState('');

  const [socialLinks, setSocialLinks] = useState(settings.socialLinks);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchPublicSettings();
        if (!active || !data) return;
        updateSettings(data);
        setStoreName(data.storeName);
        setTagline(data.tagline);
        setCurrency(data.currency);
        setStoreEmail(data.storeEmail);
        setStorePhone(data.storePhone);
        setStoreAddress(data.storeAddress);
        setFreeShippingThreshold(data.freeShippingThreshold);
        setShippingFee(data.shippingFee);
        setTaxRate(data.taxRate);
        setMinOrderAmount(data.minOrderAmount);
        setMaxOrderQuantity(data.maxOrderQuantity);
        setDeliveryEtaMinDays(data.deliveryEtaMinDays ?? settings.deliveryEtaMinDays);
        setDeliveryEtaMaxDays(data.deliveryEtaMaxDays ?? settings.deliveryEtaMaxDays);
        setCodEnabled(data.codEnabled);
        setUpiEnabled(data.upiEnabled);
        setCardEnabled(data.cardEnabled);
        setMaintenanceMode(data.maintenanceMode);
        setMetaTitle(data.metaTitle);
        setMetaDescription(data.metaDescription);
        setStoreLogo(data.storeLogo);
        setUpiId(data.upiId || '');
        setUpiPayeeName(data.upiPayeeName || data.storeName || settings.storeName);
        setAnnouncementEnabled(data.announcementBar?.enabled ?? announcementEnabled);
        setAnnouncementMsgs(data.announcementBar?.messages ?? announcementMessages);
        setSocialLinks(data.socialLinks || socialLinks);
        setHeroBadges(data.heroBadges || heroBadges);
      } catch (err: any) {
        toast.error(err?.message || 'Failed to load settings');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      const payload = {
        storeName, tagline, currency, storeEmail, storePhone, storeAddress,
        freeShippingThreshold, shippingFee, taxRate, minOrderAmount, maxOrderQuantity,
        deliveryEtaMinDays, deliveryEtaMaxDays,
        codEnabled, upiEnabled, cardEnabled, maintenanceMode,
        metaTitle, metaDescription, storeLogo, upiId, upiPayeeName,
        announcementBar: { enabled: announcementEnabled, messages: announcementMessages },
        socialLinks,
        notifications: settings.notifications,
        heroBadges,
      };
      const updated = await updatePublicSettings(payload);
      updateSettings(updated);
      updateAnnouncementMessages(updated.announcementBar?.messages || announcementMessages);
      Object.entries(updated.socialLinks || socialLinks).forEach(([k, v]) => updateSocialLinks(k, v as string));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success('Settings updated');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const uploaded = await uploadImage(file);
      setStoreLogo(uploaded.url);
      toast.success('Logo uploaded');
    } catch (err: any) {
      toast.error(err?.message || 'Logo upload failed');
    } finally {
      setLoading(false);
    }
  };

  const addAnnouncement = () => {
    if (newAnnouncement.trim()) {
      setAnnouncementMsgs([...announcementMessages, newAnnouncement.trim()]);
      setNewAnnouncement('');
    }
  };

  const removeAnnouncement = (i: number) => {
    setAnnouncementMsgs(announcementMessages.filter((_, idx) => idx !== i));
  };

  const addHeroBadge = () => {
    if (newHeroBadge.trim()) {
      setHeroBadges([...heroBadges, newHeroBadge.trim()]);
      setNewHeroBadge('');
    }
  };

  const removeHeroBadge = (i: number) => {
    setHeroBadges(heroBadges.filter((_, idx) => idx !== i));
  };

  const tabs = [
    { id: 'store', label: 'Store', icon: Store },
    { id: 'shipping', label: 'Shipping & Orders', icon: Truck },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'announcements', label: 'Announcements', icon: Megaphone },
    { id: 'social', label: 'Social Links', icon: Globe },
    { id: 'seo', label: 'SEO & Branding', icon: Search },
    { id: 'hero', label: 'Hero Badges', icon: Image },
    { id: 'advanced', label: 'Advanced', icon: Settings2 },
    { id: 'admin', label: 'Admin Account', icon: Shield },
  ];

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button onClick={() => onChange(!value)} className={`w-10 h-5 rounded-full transition ${value ? 'bg-amber-500' : 'bg-slate-600'}`}>
      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-white">Settings</h1>
      <p className="text-sm text-slate-400">All changes here reflect instantly across the main application.</p>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${activeTab === t.id ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* Store Settings */}
      {activeTab === 'store' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Store size={18} /> Store Information</h2>
          <p className="text-xs text-slate-400">Store name and tagline appear in navbar, footer, and page titles.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label="Store Name" value={storeName} onChange={setStoreName} />
            <InputField label="Tagline" value={tagline} onChange={setTagline} />
            <InputField label="Store Email" value={storeEmail} onChange={setStoreEmail} type="email" />
            <InputField label="Store Phone" value={storePhone} onChange={setStorePhone} />
          </div>
          <InputField label="Store Address" value={storeAddress} onChange={setStoreAddress} />
          <div>
            <label className="block text-sm text-slate-300 mb-1">Currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none">
              <option value="INR">₹ INR</option>
              <option value="USD">$ USD</option>
            </select>
          </div>
          {/* Logo Upload */}
          <div>
            <label className="block text-sm text-slate-300 mb-1">Store Logo</label>
            <input ref={logoRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
            <div className="flex items-center gap-3">
              {storeLogo ? (
                <img src={storeLogo} alt="Logo" className="w-16 h-16 rounded-xl object-contain border border-slate-700 bg-slate-800 p-1" />
              ) : (
                <div className="w-16 h-16 rounded-xl border border-dashed border-slate-600 flex items-center justify-center"><Image size={20} className="text-slate-500" /></div>
              )}
              <button onClick={() => logoRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white hover:bg-slate-700 transition">
                <Upload size={14} /> Upload Logo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shipping & Orders */}
      {activeTab === 'shipping' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Truck size={18} /> Shipping & Order Settings</h2>
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Free Shipping Above (₹)" value={String(freeShippingThreshold)} onChange={(v) => setFreeShippingThreshold(Number(v))} type="number" />
            <InputField label="Shipping Fee (₹)" value={String(shippingFee)} onChange={(v) => setShippingFee(Number(v))} type="number" />
            <InputField label="Tax Rate (%)" value={String(taxRate)} onChange={(v) => setTaxRate(Number(v))} type="number" />
            <InputField label="Min Order Amount (₹)" value={String(minOrderAmount)} onChange={(v) => setMinOrderAmount(Number(v))} type="number" />
            <InputField label="Max Quantity Per Item" value={String(maxOrderQuantity)} onChange={(v) => setMaxOrderQuantity(Number(v))} type="number" />
            <InputField label="Delivery ETA Min Days" value={String(deliveryEtaMinDays)} onChange={(v) => setDeliveryEtaMinDays(Number(v))} type="number" />
            <InputField label="Delivery ETA Max Days" value={String(deliveryEtaMaxDays)} onChange={(v) => setDeliveryEtaMaxDays(Number(v))} type="number" />
          </div>
        </div>
      )}

      {/* Payments */}
      {activeTab === 'payments' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><CreditCard size={18} /> Payment Methods</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Cash on Delivery</p>
              <p className="text-xs text-slate-400">Enable COD payments for customers</p>
            </div>
            <Toggle value={codEnabled} onChange={setCodEnabled} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">UPI Payments</p>
              <p className="text-xs text-slate-400">Enable UPI payments in checkout</p>
            </div>
            <Toggle value={upiEnabled} onChange={setUpiEnabled} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Card Payments (PayU)</p>
              <p className="text-xs text-slate-400">Enable card payments via PayU gateway</p>
            </div>
            <Toggle value={cardEnabled} onChange={setCardEnabled} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label="UPI ID" value={upiId} onChange={setUpiId} />
            <InputField label="UPI Payee Name" value={upiPayeeName} onChange={setUpiPayeeName} />
          </div>
        </div>
      )}

      {/* Notifications */}
      {activeTab === 'notifications' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Bell size={18} /> Notifications</h2>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(settings.notifications).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between bg-slate-800 rounded-xl p-3">
                <span className="text-sm text-white capitalize">{key}</span>
                <Toggle value={value} onChange={(v) => updateNotifications(key, v)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Announcements */}
      {activeTab === 'announcements' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Megaphone size={18} /> Announcement Bar</h2>
          <p className="text-xs text-slate-400">These messages rotate in the top banner of the main site.</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Enable Announcement Bar</p>
            </div>
            <Toggle value={announcementEnabled} onChange={setAnnouncementEnabled} />
          </div>
          <div className="space-y-2">
            {announcementMessages.map((msg, i) => (
              <div key={`${msg}-${i}`} className="flex items-center justify-between bg-slate-800 rounded-xl px-4 py-2">
                <span className="text-sm text-white">{msg}</span>
                <button onClick={() => removeAnnouncement(i)} className="text-red-300 hover:text-red-200"><X size={14} /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newAnnouncement}
              onChange={(e) => setNewAnnouncement(e.target.value)}
              placeholder="Add new announcement..."
              className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none"
            />
            <button onClick={addAnnouncement} className="px-4 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold">
              Add
            </button>
          </div>
        </div>
      )}

      {/* Social Links */}
      {activeTab === 'social' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Globe size={18} /> Social Links</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label="Instagram" value={socialLinks.instagram} onChange={(v) => setSocialLinks({ ...socialLinks, instagram: v })} />
            <InputField label="Facebook" value={socialLinks.facebook} onChange={(v) => setSocialLinks({ ...socialLinks, facebook: v })} />
            <InputField label="YouTube" value={socialLinks.youtube} onChange={(v) => setSocialLinks({ ...socialLinks, youtube: v })} />
            <InputField label="WhatsApp" value={socialLinks.whatsapp} onChange={(v) => setSocialLinks({ ...socialLinks, whatsapp: v })} />
          </div>
        </div>
      )}

      {/* SEO */}
      {activeTab === 'seo' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Search size={18} /> SEO & Branding</h2>
          <InputField label="Meta Title" value={metaTitle} onChange={setMetaTitle} />
          <InputField label="Meta Description" value={metaDescription} onChange={setMetaDescription} />
          <InputField label="Favicon URL" value={settings.favicon} onChange={() => {}} />
        </div>
      )}

      {/* Hero Badges */}
      {activeTab === 'hero' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Image size={18} /> Hero Badges</h2>
          <p className="text-xs text-slate-400">These appear below the hero section (e.g., Temple Authenticated, 100% Organic).</p>
          <div className="flex gap-2">
            <input
              value={newHeroBadge}
              onChange={(e) => setNewHeroBadge(e.target.value)}
              placeholder="??? Temple Authenticated"
              className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none"
            />
            <button onClick={addHeroBadge} className="px-4 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold">
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {heroBadges.map((b, i) => (
              <div key={`${b}-${i}`} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-sm text-slate-200">
                <span>{b}</span>
                <button onClick={() => removeHeroBadge(i)} className="text-red-300 hover:text-red-200"><X size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Advanced */}
      {activeTab === 'advanced' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Settings2 size={18} /> Advanced</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Maintenance Mode</p>
              <p className="text-xs text-slate-400">Temporarily disable the storefront</p>
            </div>
            <Toggle value={maintenanceMode} onChange={setMaintenanceMode} />
          </div>
        </div>
      )}

      {/* Admin */}
      {activeTab === 'admin' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Shield size={18} /> Admin Account</h2>
          <div className="flex justify-between text-sm"><span className="text-slate-400">Email</span><span className="text-white">{adminEmail}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-400">Role</span><span className="text-amber-400 font-medium">Super Admin</span></div>
        </div>
      )}

      <div className="flex items-center gap-4">
        <button onClick={handleSave} disabled={loading} className="px-5 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold flex items-center gap-2">
          <Save size={16} /> Save Settings
        </button>
        {saved && <span className="text-emerald-400 text-sm">Saved</span>}
      </div>
    </div>
  );
};

const InputField = ({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) => (
  <div>
    <label className="block text-sm text-slate-300 mb-1">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none"
    />
  </div>
);

export default AdminSettings;
