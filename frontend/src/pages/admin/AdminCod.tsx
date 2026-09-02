import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { CheckSquare, Search, Square, Trash2, Truck } from 'lucide-react';
import { deleteAdminCodPincode, fetchAdminCodConfig, saveAdminCodPincodes, updateAdminCodConfig, type AdminCodConfig } from '@/lib/api';
import { toast } from 'sonner';

const AdminCod = () => {
  const [config, setConfig] = useState<AdminCodConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [pincodes, setPincodes] = useState('');
  const [partnerName, setPartnerName] = useState('Delivery Service Partner');
  const [pinCodEnabled, setPinCodEnabled] = useState(true);
  const [pinDeliveryEnabled, setPinDeliveryEnabled] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setConfig(await fetchAdminCodConfig());
    } catch (err: any) {
      toast.error(err?.message || 'Unable to load COD settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (config?.products || []).filter((p) => !q || `${p.name} ${p.category}`.toLowerCase().includes(q));
  }, [config?.products, search]);

  const toggle = (id: string, list: string[], setList: (next: string[]) => void) => {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const applyEligibility = async (enabled: boolean, inherit = false) => {
    if (!selectedProducts.length && !selectedCategories.length) return toast.error('Select products or categories first');
    setSaving(true);
    try {
      const updated = await updateAdminCodConfig({
        productIds: selectedProducts,
        categoryIds: selectedCategories,
        enabled,
        inherit,
      });
      setConfig(updated);
      if (!inherit) setSelectedCategories([]);
      setSelectedProducts([]);
      toast.success(inherit ? 'Products now inherit category COD' : enabled ? 'COD enabled' : 'COD disabled');
    } catch (err: any) {
      toast.error(err?.message || 'Unable to save COD rules');
    } finally {
      setSaving(false);
    }
  };

  const savePincodes = async () => {
    setSaving(true);
    try {
      const updated = await saveAdminCodPincodes({
        pincodes,
        partnerName,
        deliveryEnabled: pinDeliveryEnabled,
        codEnabled: pinCodEnabled,
      });
      setConfig(updated);
      setPincodes('');
      toast.success('Pincode rules saved');
    } catch (err: any) {
      toast.error(err?.message || 'Unable to save pincode rules');
    } finally {
      setSaving(false);
    }
  };

  const removePincode = async (id: string) => {
    setSaving(true);
    try {
      setConfig(await deleteAdminCodPincode(id));
      toast.success('Pincode rule removed');
    } catch (err: any) {
      toast.error(err?.message || 'Unable to remove pincode rule');
    } finally {
      setSaving(false);
    }
  };

  const selectedCount = selectedProducts.length + selectedCategories.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">COD Delivery Rules</h1>
          <p className="mt-1 text-sm text-slate-400">Enable COD for selected products, categories, and delivery partner pincodes.</p>
        </div>
        <button onClick={load} disabled={loading} className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800 disabled:opacity-60">
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">Categories</h2>
                <p className="mt-1 text-xs text-slate-500">Products inherit from category unless a product override is set.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button disabled={saving || selectedCount === 0} onClick={() => applyEligibility(true)} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Enable COD</button>
                <button disabled={saving || selectedCount === 0} onClick={() => applyEligibility(false)} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Disable COD</button>
                <button disabled={saving || selectedProducts.length === 0} onClick={() => applyEligibility(true, true)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 disabled:opacity-50">Product Inherit</button>
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {(config?.categories || []).map((category) => {
                const selected = selectedCategories.includes(category.id);
                return (
                  <button key={category.id} onClick={() => toggle(category.id, selectedCategories, setSelectedCategories)} className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition ${selected ? 'border-amber-500/50 bg-amber-500/10' : 'border-slate-800 bg-slate-950/30 hover:border-slate-700'}`}>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-white">{category.name}</span>
                      <span className={`mt-1 block text-xs ${category.codEnabled ? 'text-emerald-400' : 'text-slate-500'}`}>{category.codEnabled ? 'COD enabled' : 'COD disabled'}</span>
                    </span>
                    {selected ? <CheckSquare size={18} className="text-amber-300" /> : <Square size={18} className="text-slate-500" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">Products</h2>
                <p className="mt-1 text-xs text-slate-500">Select one or many products to override COD availability.</p>
              </div>
              <div className="relative sm:w-72">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products" className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-white outline-none" />
              </div>
            </div>
            <div className="max-h-[560px] overflow-auto rounded-xl border border-slate-800">
              {filteredProducts.map((product) => {
                const selected = selectedProducts.includes(product.id);
                const inheritedCategory = config?.categories.find((c) => String(c.id) === String(product.categoryId));
                const effective = product.codEnabled === null ? Boolean(inheritedCategory?.codEnabled) : Boolean(product.codEnabled);
                return (
                  <button key={product.id} onClick={() => toggle(product.id, selectedProducts, setSelectedProducts)} className={`flex w-full items-center gap-3 border-b border-slate-800 p-3 text-left transition last:border-b-0 ${selected ? 'bg-amber-500/10' : 'hover:bg-slate-800/40'}`}>
                    <img src={product.image} alt={product.name} className="h-10 w-10 rounded-lg object-cover bg-slate-800" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">{product.name}</span>
                      <span className="block truncate text-xs text-slate-500">{product.category}</span>
                    </span>
                    <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${effective ? 'border-emerald-500/30 text-emerald-300' : 'border-slate-700 text-slate-400'}`}>
                      {product.codEnabled === null ? (effective ? 'Category' : 'No COD') : product.codEnabled ? 'Product COD' : 'Blocked'}
                    </span>
                    {selected ? <CheckSquare size={18} className="text-amber-300" /> : <Square size={18} className="text-slate-500" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300">
                <Truck size={17} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Pincode Rules</h2>
                <p className="mt-1 text-xs text-slate-500">When no pincode rules exist, delivery partner COD is allowed after product/category checks.</p>
              </div>
            </div>
            <div className="space-y-3">
              <input value={partnerName} onChange={(e) => setPartnerName(e.target.value)} placeholder="Partner name" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
              <textarea value={pincodes} onChange={(e) => setPincodes(e.target.value)} rows={4} placeholder="Add pincodes separated by comma or new line" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none" />
              <label className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/30 p-3 text-sm text-slate-200">
                Delivery serviceable
                <input type="checkbox" checked={pinDeliveryEnabled} onChange={(e) => setPinDeliveryEnabled(e.target.checked)} className="h-4 w-4 accent-amber-500" />
              </label>
              <label className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/30 p-3 text-sm text-slate-200">
                COD available
                <input type="checkbox" checked={pinCodEnabled} onChange={(e) => setPinCodEnabled(e.target.checked)} className="h-4 w-4 accent-amber-500" />
              </label>
              <button disabled={saving} onClick={savePincodes} className="w-full rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60">Save Pincodes</button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="mb-3 text-sm font-semibold text-white">Saved Pincodes</h2>
            <div className="max-h-80 space-y-2 overflow-auto">
              {(config?.pincodes || []).length === 0 && <p className="text-sm text-slate-500">No pincode rules added yet.</p>}
              {(config?.pincodes || []).map((rule) => (
                <div key={rule.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                  <div>
                    <p className="font-mono text-sm font-semibold text-white">{rule.pincode}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{rule.partnerName}</p>
                    <p className={`mt-1 text-xs ${rule.deliveryEnabled && rule.codEnabled ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {rule.deliveryEnabled ? 'Delivery' : 'No delivery'} / {rule.codEnabled ? 'COD' : 'No COD'}
                    </p>
                  </div>
                  <button onClick={() => removePincode(rule.id)} disabled={saving} className="rounded-lg p-2 text-red-400 hover:bg-red-500/10 disabled:opacity-50" aria-label="Remove pincode rule">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminCod;
