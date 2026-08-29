import { useEffect, useMemo, useState } from 'react';
import { Boxes, CheckCircle2, Plus, Save, Search, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  CommerceBundle,
  createAdminBundle,
  fetchAdminBundles,
  updateAdminBundle,
  updateAdminBundleStatus,
} from '@/lib/api';
import { useProductStore } from '@/store/productStore';
import { formatPrice } from '@/utils/formatPrice';
import { isProductPurchasable } from '@/utils/productPresentation';

const emptyForm = {
  id: '',
  name: '',
  slug: '',
  description: '',
  displayLocation: 'home',
  sortOrder: 0,
  isActive: false,
  productIds: [] as string[],
};

const AdminBundles = () => {
  const products = useProductStore((state) => state.products);
  const loadProducts = useProductStore((state) => state.loadFromApi);
  const [bundles, setBundles] = useState<CommerceBundle[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const validProducts = useMemo(
    () => products.filter((product) => isProductPurchasable(product) && Number(product.price) > 0),
    [products]
  );
  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return validProducts.slice(0, 80);
    return validProducts
      .filter((product) => [product.name, product.sku, product.category].filter(Boolean).join(' ').toLowerCase().includes(q))
      .slice(0, 80);
  }, [query, validProducts]);
  const selectedProducts = useMemo(() => form.productIds.map((id) => validProducts.find((product) => product.id === id)).filter(Boolean), [form.productIds, validProducts]);
  const bundleTotal = selectedProducts.reduce((sum, product) => sum + Number(product?.price || 0), 0);

  const loadBundles = async () => {
    setLoading(true);
    try {
      const data = await fetchAdminBundles();
      setBundles(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load bundles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts({ force: true }).catch(() => undefined);
    loadBundles();
  }, [loadProducts]);

  const toggleProduct = (id: string) => {
    setForm((current) => {
      const exists = current.productIds.includes(id);
      const productIds = exists ? current.productIds.filter((item) => item !== id) : [...current.productIds, id].slice(0, 12);
      return { ...current, productIds };
    });
  };

  const editBundle = (bundle: CommerceBundle) => {
    setForm({
      id: bundle.id,
      name: bundle.name,
      slug: bundle.slug,
      description: bundle.description || '',
      displayLocation: bundle.displayLocation || 'home',
      sortOrder: bundle.sortOrder || 0,
      isActive: Boolean(bundle.isActive),
      productIds: (bundle.products || []).map((product: any) => String(product.id)),
    });
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Bundle name is required');
      return;
    }
    if (form.productIds.length < 2) {
      toast.error('Choose at least 2 valid products');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        slug: form.slug,
        description: form.description,
        displayLocation: form.displayLocation,
        sortOrder: form.sortOrder,
        isActive: form.isActive,
        productIds: form.productIds,
      };
      if (form.id) await updateAdminBundle(form.id, payload);
      else await createAdminBundle(payload);
      toast.success(form.id ? 'Bundle updated' : 'Bundle created');
      setForm(emptyForm);
      await loadBundles();
    } catch (err: any) {
      toast.error(err?.message || 'Bundle save failed');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (bundle: CommerceBundle, isActive: boolean) => {
    try {
      await updateAdminBundleStatus(bundle.id, isActive);
      toast.success(isActive ? 'Bundle activated' : 'Bundle deactivated');
      await loadBundles();
    } catch (err: any) {
      toast.error(err?.message || 'Status update failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-400">Commerce Intelligence</p>
          <h1 className="mt-1 text-2xl font-bold text-white">Bundles</h1>
          <p className="mt-1 text-sm text-slate-400">Create curated sets from valid, available products. Prices stay backend-authoritative.</p>
        </div>
        <button onClick={() => setForm(emptyForm)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 text-sm font-bold text-slate-950">
          <Plus size={16} /> New Bundle
        </button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="text-lg font-bold text-white">{form.id ? 'Edit bundle' : 'Create bundle'}</h2>
          <div className="mt-4 space-y-3">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Bundle name" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
            <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="Slug, optional" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short admin-curated description" rows={3} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
            <div className="grid grid-cols-2 gap-3">
              <select value={form.displayLocation} onChange={(e) => setForm({ ...form, displayLocation: e.target.value })} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">
                <option value="home">Home</option>
                <option value="product_detail">Product detail</option>
                <option value="cart">Cart</option>
              </select>
              <input type="number" min={0} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Active
            </label>
          </div>

          <div className="mt-5 border-t border-slate-800 pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-white">Selected products</p>
              <p className="text-sm font-bold text-amber-400">{formatPrice(bundleTotal)}</p>
            </div>
            <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
              {selectedProducts.map((product: any) => (
                <div key={product.id} className="grid grid-cols-[40px_1fr_auto] items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 p-2">
                  <img src={product.image} alt="" className="h-10 w-10 rounded bg-white object-contain p-1" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{product.name}</p>
                    <p className="text-xs text-slate-500">{product.category}</p>
                  </div>
                  <button type="button" onClick={() => toggleProduct(product.id)} className="text-xs font-bold text-red-300">Remove</button>
                </div>
              ))}
              {!selectedProducts.length && <p className="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-500">Choose products below.</p>}
            </div>
            <button onClick={save} disabled={saving} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-amber-500 text-sm font-bold text-slate-950 disabled:opacity-60">
              <Save size={16} /> {saving ? 'Saving...' : 'Save Bundle'}
            </button>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-400">
              <Search size={16} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search valid products" className="w-full bg-transparent text-sm text-white outline-none" />
            </label>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {filteredProducts.map((product) => {
                const selected = form.productIds.includes(product.id);
                return (
                  <button key={product.id} type="button" onClick={() => toggleProduct(product.id)} className={`grid grid-cols-[44px_1fr] gap-2 rounded-lg border p-2 text-left transition ${selected ? 'border-amber-400 bg-amber-500/10' : 'border-slate-800 bg-slate-950 hover:border-slate-600'}`}>
                    <img src={product.image} alt="" className="h-11 w-11 rounded bg-white object-contain p-1" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-white">{product.name}</span>
                      <span className="flex items-center gap-2 text-xs text-slate-500">
                        {formatPrice(product.price)}
                        {selected && <CheckCircle2 size={13} className="text-amber-400" />}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900">
            <div className="border-b border-slate-800 p-4">
              <h2 className="text-lg font-bold text-white">Existing bundles</h2>
            </div>
            <div className="divide-y divide-slate-800">
              {loading && <p className="p-4 text-sm text-slate-400">Loading bundles...</p>}
              {!loading && bundles.map((bundle) => (
                <div key={bundle.id} className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
                  <button type="button" onClick={() => editBundle(bundle)} className="flex min-w-0 items-center gap-3 text-left">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400"><Boxes size={18} /></span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-white">{bundle.name}</span>
                      <span className="text-xs text-slate-500">{bundle.productCount} products · {bundle.displayLocation} · {formatPrice(bundle.bundlePrice)}</span>
                    </span>
                  </button>
                  <button type="button" onClick={() => setStatus(bundle, !bundle.isActive)} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold ${bundle.isActive ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-800 text-slate-300'}`}>
                    {bundle.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                    {bundle.isActive ? 'Active' : 'Inactive'}
                  </button>
                </div>
              ))}
              {!loading && !bundles.length && <p className="p-4 text-sm text-slate-400">No bundles created yet.</p>}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminBundles;
