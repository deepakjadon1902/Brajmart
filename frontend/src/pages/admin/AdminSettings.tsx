import { useEffect, useRef, useState } from 'react';
import { useAdminStore } from '@/store/adminStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useProductStore } from '@/store/productStore';
import { Save, Store, Bell, Shield, Truck, CheckCircle, Globe, Megaphone, CreditCard, Image, Search, Settings2, Plus, X, Upload, Tag, Trash2, Pencil } from 'lucide-react';
import { createCoupon, deleteCoupon, fetchCoupons, fetchPublicSettings, sendTestEmail, updateCoupon, updatePublicSettings, uploadImage } from '@/lib/api';
import { toast } from 'sonner';

type CouponFormState = {
  code: string;
  title: string;
  discountType: 'amount' | 'percent';
  discountValue: string;
  maxDiscount: string;
  freeShipping: boolean;
  freePackaging: boolean;
  scopeType: 'all' | 'product' | 'category';
  scopeValue: string;
  minOrderAmount: string;
  usageLimit: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

const emptyCouponForm: CouponFormState = {
  code: '',
  title: '',
  discountType: 'amount',
  discountValue: '',
  maxDiscount: '',
  freeShipping: false,
  freePackaging: false,
  scopeType: 'all',
  scopeValue: '',
  minOrderAmount: '',
  usageLimit: '',
  startsAt: '',
  endsAt: '',
  isActive: true,
};

const AdminSettings = () => {
  const { adminEmail } = useAdminStore();
  const { settings, updateSettings, updateNotifications, updateSocialLinks, updateAnnouncementMessages } = useSettingsStore();
  const { products, categories, loadFromApi } = useProductStore();
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
  const [packagingRate, setPackagingRate] = useState(settings.packagingRate);
  const [minOrderAmount, setMinOrderAmount] = useState(settings.minOrderAmount);
  const [maxOrderQuantity, setMaxOrderQuantity] = useState(settings.maxOrderQuantity);
  const [deliveryEtaMinDays, setDeliveryEtaMinDays] = useState(settings.deliveryEtaMinDays);
  const [deliveryEtaMaxDays, setDeliveryEtaMaxDays] = useState(settings.deliveryEtaMaxDays);
  const [codEnabled, setCodEnabled] = useState(settings.codEnabled);
  const [maintenanceMode, setMaintenanceMode] = useState(settings.maintenanceMode);
  const [metaTitle, setMetaTitle] = useState(settings.metaTitle);
  const [metaDescription, setMetaDescription] = useState(settings.metaDescription);
  const [storeLogo, setStoreLogo] = useState(settings.storeLogo);
  const [announcementEnabled, setAnnouncementEnabled] = useState(settings.announcementBar.enabled);
  const [announcementMessages, setAnnouncementMsgs] = useState<string[]>(settings.announcementBar.messages);
  const [newAnnouncement, setNewAnnouncement] = useState('');
  const [heroBadges, setHeroBadges] = useState<string[]>(settings.heroBadges || []);
  const [newHeroBadge, setNewHeroBadge] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [coupons, setCoupons] = useState<any[]>([]);
  const [couponForm, setCouponForm] = useState<CouponFormState>(emptyCouponForm);
  const [editingCouponId, setEditingCouponId] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);

  const [socialLinks, setSocialLinks] = useState(settings.socialLinks);
  const sanitizeBadges = (badges?: string[]) =>
    (badges || []).filter((b) => !/\bCOD\b/i.test(b) && !/cash on delivery/i.test(b));

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchPublicSettings({ fresh: true });
        if (!active || !data) return;
        updateSettings({ ...data, heroBadges: sanitizeBadges(data.heroBadges) });
        setStoreName(data.storeName);
        setTagline(data.tagline);
        setCurrency(data.currency);
        setStoreEmail(data.storeEmail);
        setStorePhone(data.storePhone);
        setStoreAddress(data.storeAddress);
        setFreeShippingThreshold(data.freeShippingThreshold);
        setShippingFee(data.shippingFee);
        setPackagingRate(data.packagingRate ?? data.taxRate ?? 0);
        setMinOrderAmount(data.minOrderAmount);
        setMaxOrderQuantity(data.maxOrderQuantity);
        setDeliveryEtaMinDays(data.deliveryEtaMinDays ?? settings.deliveryEtaMinDays);
        setDeliveryEtaMaxDays(data.deliveryEtaMaxDays ?? settings.deliveryEtaMaxDays);
        setCodEnabled(Boolean(data.codEnabled));
        setMaintenanceMode(data.maintenanceMode);
        setMetaTitle(data.metaTitle);
        setMetaDescription(data.metaDescription);
        setStoreLogo(data.storeLogo);
        setAnnouncementEnabled(data.announcementBar?.enabled ?? announcementEnabled);
        setAnnouncementMsgs(data.announcementBar?.messages ?? announcementMessages);
        setSocialLinks(data.socialLinks || socialLinks);
        setHeroBadges(sanitizeBadges(data.heroBadges || heroBadges));
      } catch (err: any) {
        toast.error(err?.message || 'Failed to load settings');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, []);

  const loadCoupons = async () => {
    setCouponLoading(true);
    try {
      const data = await fetchCoupons();
      setCoupons(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load coupons');
    } finally {
      setCouponLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'payments') return;
    loadCoupons();
    loadFromApi({ force: true }).catch(() => undefined);
  }, [activeTab, loadFromApi]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const payload = {
        storeName, tagline, currency, storeEmail, storePhone, storeAddress,
        freeShippingThreshold, shippingFee, packagingRate, taxRate: packagingRate, minOrderAmount, maxOrderQuantity,
        deliveryEtaMinDays, deliveryEtaMaxDays,
        codEnabled, maintenanceMode,
        metaTitle, metaDescription, storeLogo,
        announcementBar: { enabled: announcementEnabled, messages: announcementMessages },
        socialLinks,
        notifications: settings.notifications,
        heroBadges,
      };
      const updated = await updatePublicSettings(payload);
      updateSettings(updated);
      setCodEnabled(Boolean(updated.codEnabled));
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

  const handleTestEmail = async () => {
    if (!testEmail.trim()) {
      toast.error('Enter a test email address');
      return;
    }
    setLoading(true);
    try {
      await sendTestEmail(testEmail.trim());
      toast.success('Test email sent');
    } catch (err: any) {
      toast.error(err?.message || 'Test email failed');
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

  const resetCouponForm = () => {
    setCouponForm(emptyCouponForm);
    setEditingCouponId(null);
  };

  const toCouponPayload = () => ({
    code: couponForm.code,
    title: couponForm.title,
    discountType: couponForm.discountType,
    discountValue: Number(couponForm.discountValue || 0),
    maxDiscount: couponForm.maxDiscount ? Number(couponForm.maxDiscount) : null,
    freeShipping: couponForm.freeShipping,
    freePackaging: couponForm.freePackaging,
    scopeType: couponForm.scopeType,
    scopeValue: couponForm.scopeType === 'all' ? null : couponForm.scopeValue,
    minOrderAmount: couponForm.minOrderAmount ? Number(couponForm.minOrderAmount) : 0,
    usageLimit: couponForm.usageLimit ? Number(couponForm.usageLimit) : null,
    startsAt: couponForm.startsAt || null,
    endsAt: couponForm.endsAt || null,
    isActive: couponForm.isActive,
  });

  const handleSaveCoupon = async () => {
    const code = couponForm.code.trim().toUpperCase();
    const hasMoneyDiscount = Number(couponForm.discountValue || 0) > 0;
    if (!code) return toast.error('Enter coupon code');
    if (!hasMoneyDiscount && !couponForm.freeShipping && !couponForm.freePackaging) {
      return toast.error('Add a discount, free shipping, or free packaging');
    }
    if (couponForm.scopeType !== 'all' && !couponForm.scopeValue) {
      return toast.error(`Select a ${couponForm.scopeType} for this coupon`);
    }
    setCouponLoading(true);
    try {
      const payload = toCouponPayload();
      if (editingCouponId) await updateCoupon(editingCouponId, payload);
      else await createCoupon(payload);
      await loadCoupons();
      resetCouponForm();
      toast.success(editingCouponId ? 'Coupon updated' : 'Coupon created');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save coupon');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleEditCoupon = (coupon: any) => {
    setEditingCouponId(String(coupon.id));
    setCouponForm({
      code: String(coupon.code || ''),
      title: String(coupon.title || ''),
      discountType: coupon.discountType === 'percent' ? 'percent' : 'amount',
      discountValue: coupon.discountValue ? String(coupon.discountValue) : '',
      maxDiscount: coupon.maxDiscount ? String(coupon.maxDiscount) : '',
      freeShipping: Boolean(coupon.freeShipping),
      freePackaging: Boolean(coupon.freePackaging),
      scopeType: coupon.scopeType === 'product' || coupon.scopeType === 'category' ? coupon.scopeType : 'all',
      scopeValue: String(coupon.scopeValue || ''),
      minOrderAmount: coupon.minOrderAmount ? String(coupon.minOrderAmount) : '',
      usageLimit: coupon.usageLimit ? String(coupon.usageLimit) : '',
      startsAt: coupon.startsAt ? String(coupon.startsAt).slice(0, 16) : '',
      endsAt: coupon.endsAt ? String(coupon.endsAt).slice(0, 16) : '',
      isActive: Boolean(coupon.isActive),
    });
  };

  const handleDeleteCoupon = async (id: string) => {
    setCouponLoading(true);
    try {
      await deleteCoupon(id);
      setCoupons((list) => list.filter((coupon) => String(coupon.id) !== String(id)));
      if (editingCouponId === id) resetCouponForm();
      toast.success('Coupon deleted');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete coupon');
    } finally {
      setCouponLoading(false);
    }
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
    <div className="admin-settings-page space-y-5">
      <div className="admin-settings-header">
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-sm text-slate-400">All changes here reflect instantly across the main application.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="admin-settings-tabs">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`admin-settings-tab ${activeTab === t.id ? 'is-active bg-amber-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* Store Settings */}
      {activeTab === 'store' && (
        <div className="admin-settings-panel space-y-4">
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
              <option value="INR">INR</option>
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

          <div className="pt-2 border-t border-slate-800">
            <h3 className="text-sm font-semibold text-slate-200 mb-2">SMTP Test Email</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="Enter email to test SMTP"
                className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none"
              />
              <button
                onClick={handleTestEmail}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold"
              >
                Send Test
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shipping & Orders */}
      {activeTab === 'shipping' && (
        <div className="admin-settings-panel space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Truck size={18} /> Shipping & Order Settings</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="Free Shipping Above (INR)" value={String(freeShippingThreshold)} onChange={(v) => setFreeShippingThreshold(Number(v))} type="number" />
            <InputField label="Shipping Fee (INR)" value={String(shippingFee)} onChange={(v) => setShippingFee(Number(v))} type="number" />
            <InputField label="Packaging Cost (%)" value={String(packagingRate)} onChange={(v) => setPackagingRate(Math.max(0, Number(v)))} type="number" />
            <InputField label="Min Order Amount (INR)" value={String(minOrderAmount)} onChange={(v) => setMinOrderAmount(Number(v))} type="number" />
            <InputField label="Max Quantity Per Item" value={String(maxOrderQuantity)} onChange={(v) => setMaxOrderQuantity(Number(v))} type="number" />
            <InputField label="Delivery ETA Min Days" value={String(deliveryEtaMinDays)} onChange={(v) => setDeliveryEtaMinDays(Number(v))} type="number" />
            <InputField label="Delivery ETA Max Days" value={String(deliveryEtaMaxDays)} onChange={(v) => setDeliveryEtaMaxDays(Number(v))} type="number" />
          </div>
        </div>
      )}

      {/* Payments */}
      {activeTab === 'payments' && (
        <div className="admin-settings-panel space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><CreditCard size={18} /> Payment Methods</h2>
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
            <p className="text-sm font-medium text-white">Razorpay Checkout</p>
            <p className="text-xs text-slate-400">Primary checkout. Configure RAZORPAY_PLATFORM_KEY_ID, RAZORPAY_PLATFORM_KEY_SECRET, and RAZORPAY_PLATFORM_WEBHOOK_SECRET on the backend.</p>
          </div>
          <div className={`flex items-center justify-between rounded-xl border p-4 ${codEnabled ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-red-500/30 bg-red-500/10'}`}>
            <div>
              <p className="text-sm font-medium text-white">Cash on Delivery</p>
              <p className="text-xs text-slate-400">
                {codEnabled
                  ? 'COD is enabled on the storefront after DTDC pincode verification. Prasadam products remain blocked.'
                  : 'COD is disabled everywhere on the storefront. Customers will see only online payment methods.'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs font-semibold ${codEnabled ? 'text-emerald-300' : 'text-red-300'}`}>
                {codEnabled ? 'Enabled' : 'Disabled'}
              </span>
              <Toggle value={codEnabled} onChange={setCodEnabled} />
            </div>
          </div>

          <div className="border-t border-slate-800 pt-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2"><Tag size={16} /> Coupons</h3>
                <p className="text-xs text-slate-400">Create checkout coupons for products, categories, or the full store.</p>
              </div>
              <button
                type="button"
                onClick={resetCouponForm}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-amber-500/50 hover:text-amber-300"
              >
                <Plus size={14} /> New Coupon
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <InputField label="Coupon Code" value={couponForm.code} onChange={(v) => setCouponForm((s) => ({ ...s, code: v.toUpperCase().replace(/\s+/g, '') }))} />
              <InputField label="Title" value={couponForm.title} onChange={(v) => setCouponForm((s) => ({ ...s, title: v }))} />
              <div>
                <label className="block text-sm text-slate-300 mb-1">Status</label>
                <div className="flex h-[42px] items-center justify-between rounded-xl border border-slate-700 bg-slate-800 px-4">
                  <span className={couponForm.isActive ? 'text-emerald-300 text-sm font-medium' : 'text-slate-400 text-sm font-medium'}>
                    {couponForm.isActive ? 'Active' : 'Paused'}
                  </span>
                  <Toggle value={couponForm.isActive} onChange={(v) => setCouponForm((s) => ({ ...s, isActive: v }))} />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Discount Type</label>
                <select
                  value={couponForm.discountType}
                  onChange={(e) => setCouponForm((s) => ({ ...s, discountType: e.target.value as CouponFormState['discountType'] }))}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none"
                >
                  <option value="amount">Flat Amount</option>
                  <option value="percent">Percentage</option>
                </select>
              </div>
              <InputField label={couponForm.discountType === 'percent' ? 'Discount (%)' : 'Discount (INR)'} value={couponForm.discountValue} onChange={(v) => setCouponForm((s) => ({ ...s, discountValue: v }))} type="number" />
              <InputField label="Max Discount (optional)" value={couponForm.maxDiscount} onChange={(v) => setCouponForm((s) => ({ ...s, maxDiscount: v }))} type="number" />
              <div>
                <label className="block text-sm text-slate-300 mb-1">Applies To</label>
                <select
                  value={couponForm.scopeType}
                  onChange={(e) => setCouponForm((s) => ({ ...s, scopeType: e.target.value as CouponFormState['scopeType'], scopeValue: '' }))}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none"
                >
                  <option value="all">Whole Store</option>
                  <option value="category">Category</option>
                  <option value="product">Product</option>
                </select>
              </div>
              {couponForm.scopeType === 'category' && (
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Category</label>
                  <select
                    value={couponForm.scopeValue}
                    onChange={(e) => setCouponForm((s) => ({ ...s, scopeValue: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none"
                  >
                    <option value="">Select category</option>
                    {categories.map((category: any) => (
                      <option key={category.id || category.name} value={category.name}>{category.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {couponForm.scopeType === 'product' && (
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Product</label>
                  <select
                    value={couponForm.scopeValue}
                    onChange={(e) => setCouponForm((s) => ({ ...s, scopeValue: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none"
                  >
                    <option value="">Select product</option>
                    {products.map((product: any) => (
                      <option key={product.id} value={product.id}>{product.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <InputField label="Min Order (optional)" value={couponForm.minOrderAmount} onChange={(v) => setCouponForm((s) => ({ ...s, minOrderAmount: v }))} type="number" />
              <InputField label="Usage Limit (optional)" value={couponForm.usageLimit} onChange={(v) => setCouponForm((s) => ({ ...s, usageLimit: v }))} type="number" />
              <InputField label="Starts At" value={couponForm.startsAt} onChange={(v) => setCouponForm((s) => ({ ...s, startsAt: v }))} type="datetime-local" />
              <InputField label="Ends At" value={couponForm.endsAt} onChange={(v) => setCouponForm((s) => ({ ...s, endsAt: v }))} type="datetime-local" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-white">Free Shipping</p>
                  <p className="text-xs text-slate-400">Remove shipping charge when code applies.</p>
                </div>
                <Toggle value={couponForm.freeShipping} onChange={(v) => setCouponForm((s) => ({ ...s, freeShipping: v }))} />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-white">Free Packaging</p>
                  <p className="text-xs text-slate-400">Remove packaging cost when code applies.</p>
                </div>
                <Toggle value={couponForm.freePackaging} onChange={(v) => setCouponForm((s) => ({ ...s, freePackaging: v }))} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSaveCoupon}
                disabled={couponLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                <Save size={15} /> {editingCouponId ? 'Update Coupon' : 'Create Coupon'}
              </button>
              {editingCouponId && (
                <button type="button" onClick={resetCouponForm} className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200">
                  Cancel Edit
                </button>
              )}
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full min-w-[760px] text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/50 text-left text-slate-400">
                    <th className="px-4 py-3 font-medium">Code</th>
                    <th className="px-4 py-3 font-medium">Benefit</th>
                    <th className="px-4 py-3 font-medium">Scope</th>
                    <th className="px-4 py-3 font-medium">Usage</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((coupon) => (
                    <tr key={coupon.id} className="border-b border-slate-800/70 text-slate-200 last:border-b-0">
                      <td className="px-4 py-3">
                        <p className="font-mono font-semibold text-amber-300">{coupon.code}</p>
                        {coupon.title && <p className="mt-0.5 text-slate-500">{coupon.title}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <p>{coupon.discountType === 'percent' ? `${coupon.discountValue}% off` : `INR ${Number(coupon.discountValue || 0).toLocaleString('en-IN')} off`}</p>
                        <p className="mt-0.5 text-slate-500">{[coupon.freeShipping ? 'Free shipping' : '', coupon.freePackaging ? 'Free packaging' : ''].filter(Boolean).join(' + ') || 'Product discount'}</p>
                      </td>
                      <td className="px-4 py-3 capitalize">{coupon.scopeType === 'all' ? 'Whole store' : `${coupon.scopeType}: ${coupon.scopeValue}`}</td>
                      <td className="px-4 py-3">{Number(coupon.usedCount || 0)}{coupon.usageLimit ? ` / ${coupon.usageLimit}` : ''}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${coupon.isActive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-700 text-slate-300'}`}>
                          {coupon.isActive ? 'Active' : 'Paused'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button type="button" onClick={() => handleEditCoupon(coupon)} className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:text-amber-300"><Pencil size={14} /></button>
                          <button type="button" onClick={() => handleDeleteCoupon(String(coupon.id))} className="rounded-lg border border-red-500/30 p-2 text-red-300 hover:bg-red-500/10"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {coupons.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">{couponLoading ? 'Loading coupons...' : 'No coupons created yet.'}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Notifications */}
      {activeTab === 'notifications' && (
        <div className="admin-settings-panel space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Bell size={18} /> Notifications</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        <div className="admin-settings-panel space-y-4">
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
        <div className="admin-settings-panel space-y-4">
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
        <div className="admin-settings-panel space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Search size={18} /> SEO & Branding</h2>
          <InputField label="Meta Title" value={metaTitle} onChange={setMetaTitle} />
          <InputField label="Meta Description" value={metaDescription} onChange={setMetaDescription} />
          <InputField label="Favicon URL" value={settings.favicon} onChange={() => {}} />
        </div>
      )}

      {/* Hero Badges */}
      {activeTab === 'hero' && (
        <div className="admin-settings-panel space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Image size={18} /> Hero Badges</h2>
          <p className="text-xs text-slate-400">These appear below the hero section (e.g., Temple Authenticated, 100% Organic).</p>
          <div className="flex gap-2">
            <input
              value={newHeroBadge}
              onChange={(e) => setNewHeroBadge(e.target.value)}
              placeholder="Temple Authenticated"
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
        <div className="admin-settings-panel space-y-4">
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
        <div className="admin-settings-panel space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Shield size={18} /> Admin Account</h2>
          <div className="flex justify-between text-sm"><span className="text-slate-400">Email</span><span className="text-white">{adminEmail}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-400">Role</span><span className="text-amber-400 font-medium">Super Admin</span></div>
        </div>
      )}

      <div className="admin-settings-actions">
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

