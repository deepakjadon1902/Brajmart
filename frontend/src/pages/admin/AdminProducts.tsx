import * as React from "react";
import { useEffect, useRef, useState } from 'react';
import { useProductStore } from '@/store/productStore';
import { Product } from '@/types/product';
import { Search, Plus, Edit2, Trash2, X, Upload, ImageIcon } from 'lucide-react';
import { createProduct, deleteProduct as deleteProductApi, updateProduct as updateProductApi, uploadImage, uploadImages, fetchProductsSchema } from '@/lib/api';
import { toast } from 'sonner';

const PRODUCT_SYNC_KEY = 'brajmart-products-updated-at';

// No image size limit
const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

const normalizeKey = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

const AdminProducts = () => {
  const { products, categories, addProduct, updateProduct, deleteProduct, loadFromApi } = useProductStore();
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const categoryNames = categories.map((c) => c.name);

  useEffect(() => {
    loadFromApi();
  }, [loadFromApi]);

  useEffect(() => {
    // Soft-check schema to avoid noisy toasts in environments that don't run migrations.
    const run = async () => {
      try {
        const schema: any = await fetchProductsSchema();
        const cols = schema?.columns || {};
        if (
          cols.sizes === 'missing' ||
          cols.size_pricing === 'missing' ||
          cols.piece_pricing === 'missing' ||
          cols.attributes === 'missing' ||
          cols.variant_pricing === 'missing' ||
          cols.color_variants === 'missing'
        ) {
          // Features will still work on servers that allow auto-ALTER in `products` routes.
          // We'll surface a clear error only if a save fails.
        }
      } catch {
        // ignore schema check errors (permissions / offline)
      }
    };
    run();
  }, []);

  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === 'all' || p.category === filterCat;
    return matchSearch && matchCat;
  });

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    try {
      await deleteProductApi(id);
      deleteProduct(id);
      toast.success('Product deleted');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete product');
    }
  };

  const handleSave = async (product: Product) => {
    try {
      if (!product.description || !product.description.trim()) {
        toast.error('Description is required');
        return;
      }

      const normalizedColorVariants = Array.isArray((product as any).colorVariants) ? (product as any).colorVariants : [];
      const normalizedColorNames = normalizedColorVariants
        .map((v: any) => String(v?.color || '').trim())
        .filter(Boolean);

      const normalizedAttributesBase = (Array.isArray(product.attributes) ? product.attributes : [])
        .map((a: any) => ({
          name: String(a?.name || '').trim(),
          slug: normalizeKey(String(a?.slug || a?.name || '')),
          terms: (Array.isArray(a?.terms) ? a.terms : [])
            .map((t: any) => String(t).trim())
            .filter(Boolean),
        }))
        .filter((a: any) => a.slug && a.terms?.length);

      const normalizedAttributes = (() => {
        if (!normalizedColorNames.length) return normalizedAttributesBase;
        const colorSlug = 'color';
        const existing = normalizedAttributesBase.find((a: any) => String(a.slug) === colorSlug);
        const merged = [...(existing?.terms || []), ...normalizedColorNames]
          .map((t) => String(t).trim())
          .filter(Boolean)
          .filter((t, i, arr) => arr.findIndex((x) => x.toLowerCase() === t.toLowerCase()) === i);
        if (existing) {
          return normalizedAttributesBase.map((a: any) => String(a.slug) === colorSlug ? { ...a, name: a.name || 'Color', terms: merged } : a);
        }
        return [...normalizedAttributesBase, { name: 'Color', slug: colorSlug, terms: merged }];
      })();

      const normalizedVariantPricing = (Array.isArray(product.variantPricing) ? product.variantPricing : [])
        .map((v: any) => ({
          selections: (v?.selections && typeof v.selections === 'object') ? v.selections : {},
          price: Number(v?.price),
        }))
        .filter((v: any) => Object.keys(v.selections || {}).length > 0 && Number.isFinite(v.price) && v.price > 0);

      const normalized = {
        ...product,
        tags: Array.isArray(product.tags) ? product.tags : (product.badge ? [product.badge] : []),
        // Always send these keys so backend always persists them (never reverts to NULL).
        attributes: normalizedAttributes,
        variantPricing: normalizedVariantPricing,
        colorVariants: normalizedColorVariants,
        sizes: Array.isArray(product.sizes) ? product.sizes : [],
        sizePricing: Array.isArray(product.sizePricing) ? product.sizePricing : [],
        piecePricing: Array.isArray(product.piecePricing) ? product.piecePricing : [],
      };
      if (isCreating) {
        const created: any = await createProduct(normalized as any);
        addProduct({ ...created, id: created.id || created._id, tags: normalized.tags });
        toast.success('Product created');
      } else {
        const updated: any = await updateProductApi(product.id, normalized as any);
        updateProduct(product.id, { ...updated, tags: normalized.tags });
        toast.success('Product updated');
      }

      // Force re-fetch from DB so Admin + Store always reflect what was actually saved.
      await loadFromApi({ force: true });

      // Notify other open tabs (main store) to refresh immediately.
      try {
        localStorage.setItem(PRODUCT_SYNC_KEY, String(Date.now()));
      } catch {
        // ignore storage permission errors
      }
      setEditProduct(null);
      setIsCreating(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save product');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-white">Products</h1>
        <button onClick={() => { setIsCreating(true); setEditProduct({ id: '', name: '', slug: '', price: 0, image: '', images: [], colorVariants: [], description: '', category: categoryNames[0] || '', rating: 4.5, reviewCount: 0, inStock: true, tags: [], sizes: [], sizePricing: [], piecePricing: [], attributes: [], variantPricing: [] }); }} className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition w-full sm:w-auto">
          <Plus size={16} /> Add Product
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
        </div>
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none">
          <option value="all">All Categories</option>
          {categoryNames.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm min-w-[900px]">
            <thead><tr className="text-slate-400 border-b border-slate-800">
              <th className="text-left px-5 py-3 font-medium">Product</th>
              <th className="text-left px-5 py-3 font-medium hidden sm:table-cell">Category</th>
              <th className="text-left px-5 py-3 font-medium">Price</th>
              <th className="text-left px-5 py-3 font-medium hidden md:table-cell">MRP</th>
              <th className="text-left px-5 py-3 font-medium hidden md:table-cell">Rating</th>
              <th className="text-left px-5 py-3 font-medium">Stock</th>
              <th className="text-left px-5 py-3 font-medium">Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <img src={p.image} alt={p.name} className="w-10 h-10 rounded-lg object-cover bg-slate-800" />
                      <span className="text-white text-sm max-w-[200px] truncate">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-300 hidden sm:table-cell">{p.category}</td>
                  <td className="px-5 py-3 text-white font-medium">INR {p.price}</td>
                  <td className="px-5 py-3 text-slate-400 line-through hidden md:table-cell">INR {p.originalPrice || p.price}</td>
                  <td className="px-5 py-3 text-amber-400 hidden md:table-cell">* {p.rating}</td>
                  <td className="px-5 py-3"><span className={`text-xs font-medium ${p.inStock ? 'text-emerald-400' : 'text-red-400'}`}>{p.inStock ? 'In Stock' : 'Out'}</span></td>
                  <td className="px-5 py-3 flex gap-2">
                    <button onClick={() => { setIsCreating(false); setEditProduct({ ...p, images: Array.isArray(p.images) ? p.images : (p.image ? [p.image] : []), colorVariants: Array.isArray((p as any).colorVariants) ? (p as any).colorVariants : [], tags: Array.isArray(p.tags) ? p.tags : (p.badge ? [p.badge] : []) }); }} className="text-blue-400 hover:text-blue-300"><Edit2 size={15} /></button>
                    <button onClick={() => handleDelete(p.id)} className="text-red-400 hover:text-red-300"><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editProduct && (
        <ProductModal product={editProduct} categories={categoryNames} isCreating={isCreating} onClose={() => { setEditProduct(null); setIsCreating(false); }} onSave={handleSave} />
      )}
    </div>
  );
};

const ProductModal = ({ product, categories, isCreating, onClose, onSave }: { product: Product; categories: string[]; isCreating: boolean; onClose: () => void; onSave: (p: Product) => void }) => {
  const [form, setForm] = useState(product);
  const [imageError, setImageError] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [colorUploadKey, setColorUploadKey] = useState<string>('');
  const [newColorName, setNewColorName] = useState('');
  const [sizeText, setSizeText] = useState('');
  const [sizePriceText, setSizePriceText] = useState('');
  const [piecesText, setPiecesText] = useState('');
  const [piecesPriceText, setPiecesPriceText] = useState('');
  const [attrNameText, setAttrNameText] = useState('');
  const [attrTermsText, setAttrTermsText] = useState('');
  const [variantPriceText, setVariantPriceText] = useState('');
  const [variantSelections, setVariantSelections] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const colorFileInputRef = useRef<HTMLInputElement>(null);
  const update = (field: string, value: any) => setForm((prev) => ({ ...prev, [field]: value }));

  const normalize = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

  const supportsVariants = (() => {
    const cat = normalize(form.category || '');
    return cat.includes('dress') || cat.includes('clothing') || cat.includes('accessor') || cat.includes('idol') || cat.includes('grocer');
  })();

  const sizes = Array.isArray(form.sizes) ? form.sizes.filter(Boolean) : [];
  const sizePricing = Array.isArray(form.sizePricing) ? form.sizePricing : [];
  const piecePricing = Array.isArray(form.piecePricing) ? form.piecePricing : [];
  const attributes = Array.isArray(form.attributes) ? form.attributes : [];
  const variantPricing = Array.isArray(form.variantPricing) ? form.variantPricing : [];
  const colorVariants = Array.isArray((form as any).colorVariants) ? (form as any).colorVariants : [];

  const colorAttr = attributes.find((a: any) => normalize(String(a?.slug || a?.name || '')).includes('color'));
  const colorSlug = colorAttr ? normalize(String(colorAttr.slug || 'color')) : 'color';
  const pricingAttributes = attributes.filter((a: any) => {
    const slug = normalize(String(a?.slug || a?.name || ''));
    if (!slug) return false;
    return slug !== colorSlug;
  });

  const upsertColorVariantImages = (color: string, images: string[]) => {
    const key = String(color || '').trim();
    if (!key) return;
    const next = [...colorVariants];
    const idx = next.findIndex((v: any) => String(v?.color || '').toLowerCase() === key.toLowerCase());
    const payload = { color: key, images: images.filter(Boolean) };
    if (idx >= 0) next[idx] = payload;
    else next.push(payload);
    update('colorVariants', next);
  };

  const removeColorImage = (color: string, idx: number) => {
    const existing = colorVariants.find((v: any) => String(v?.color || '').toLowerCase() === String(color).toLowerCase());
    const current = Array.isArray(existing?.images) ? existing.images : [];
    upsertColorVariantImages(color, current.filter((_: any, i: number) => i !== idx));
  };

  const addColorVariant = () => {
    const name = String(newColorName || '').trim();
    if (!name) return;
    const exists = colorVariants.some((v: any) => String(v?.color || '').toLowerCase() === name.toLowerCase());
    if (exists) return toast.error('Color already exists');
    update('colorVariants', [...colorVariants, { color: name, images: [] }]);
    setNewColorName('');
  };

  const removeColorVariant = (color: string) => {
    update('colorVariants', colorVariants.filter((v: any) => String(v?.color || '').toLowerCase() !== String(color).toLowerCase()));
  };

  const ATTRIBUTE_PRESETS: Array<{ name: string; slug: string; terms: string[] }> = [
    {
      name: 'Color',
      slug: 'color',
      terms: [],
    },
    { name: 'Language', slug: 'language', terms: ['English', 'Hindi'] },
    { name: 'Sleeves', slug: 'sleeves', terms: ['Full Sleeves', 'Half Sleeves'] },
    { name: 'Weight', slug: 'weight', terms: ['250 gm', '500 gm', '1 kg'] },
    { name: 'Size/Height', slug: 'size-height', terms: ['6"', '7.5"', '10"', '12"'] },
    { name: 'Size/No.', slug: 'size-no', terms: ['0', '1', '2', '3', '4', '5', '6', '7', '8'] },
  ];

  const upsertAttribute = (attr: { name: string; slug: string; terms: string[] }) => {
    const slug = normalize(attr.slug || attr.name || '');
    if (!slug) return;
    const cleanedTerms = (Array.isArray(attr.terms) ? attr.terms : [])
      .map((t) => String(t).trim())
      .filter(Boolean);

    const existing = attributes.find((a) => normalize(String(a?.slug || '')) === slug);
    if (!existing) {
      update('attributes', [...attributes, { name: attr.name, slug, terms: cleanedTerms }]);
      return;
    }

    const merged = Array.from(new Set([...(Array.isArray(existing.terms) ? existing.terms : []), ...cleanedTerms]));
    update(
      'attributes',
      attributes.map((a) => (normalize(String(a?.slug || '')) === slug ? { ...a, name: attr.name || a.name, slug, terms: merged } : a))
    );
  };

  const variantPreset = (() => {
    const cat = normalize(form.category || '');
    if (cat.includes('idols-shringar') || (cat.includes('idol') && cat.includes('shringar'))) {
      return { kind: 'idol-numeric' as const, label: 'Idols & Shringar (0-7)', sizes: ['0', '1', '2', '3', '4', '5', '6', '7'] };
    }
    if (cat.includes('idol')) {
      return { kind: 'idol-numeric' as const, label: 'Idols (0-7)', sizes: ['0', '1', '2', '3', '4', '5', '6', '7'] };
    }
    if (cat.includes('grocer')) {
      return { kind: 'grocery-units' as const, label: 'Groceries (ml/gm/kg)', sizes: ['250 ml', '500 ml', '1 l', '2 l', '250 gm', '500 gm', '1 kg', '2 kg'] };
    }
    return null;
  })();

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageError('');

    // No size limit

    if (!file.type.startsWith('image/')) {
      setImageError('Please select a valid image file');
      return;
    }

    try {
      const { url } = await uploadImage(file);
      update('image', url);
    } catch (err: any) {
      setImageError(err?.message || 'Upload failed');
    }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setImageError('');
    try {
      const cleaned = files.filter((f) => f && f.type.startsWith('image/'));
      const { urls: uploaded } = await uploadImages(cleaned);
      if (uploaded.length) {
        const current = Array.isArray(form.images) ? form.images : [];
        update('images', [...current, ...uploaded]);
      }
    } catch (err: any) {
      setImageError(err?.message || 'Upload failed');
    } finally {
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const handleColorUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const key = String(colorUploadKey || '').trim();
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (!key || files.length === 0) return;

    try {
      const cleaned = files.filter((f) => f && f.type.startsWith('image/'));
      const { urls: uploaded } = await uploadImages(cleaned);
      const existing = colorVariants.find((v: any) => String(v?.color || '').toLowerCase() === key.toLowerCase());
      const current = Array.isArray(existing?.images) ? existing.images : [];
      upsertColorVariantImages(key, [...current, ...uploaded]);
      toast.success('Color images uploaded');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload images');
    }
  };

  const removeGalleryImage = (index: number) => {
    const current = Array.isArray(form.images) ? form.images : [];
    update('images', current.filter((_, i) => i !== index));
  };

  const moveGalleryImage = (from: number, to: number) => {
    if (from === to) return;
    const current = Array.isArray(form.images) ? [...form.images] : [];
    if (!current.length) return;
    const [item] = current.splice(from, 1);
    current.splice(to, 0, item);
    update('images', current);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-white">{isCreating ? 'Add Product' : 'Edit Product'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <Field label="Name" value={form.name} onChange={(v) => update('name', v)} />
          <Field label="Slug" value={form.slug} onChange={(v) => update('slug', v)} />
          <Field label="Description" value={form.description || ''} onChange={(v) => update('description', v)} type="textarea" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Price (INR)" value={String(form.price)} onChange={(v) => update('price', Number(v))} type="number" />
            <Field label="MRP (INR)" value={String(form.originalPrice || '')} onChange={(v) => update('originalPrice', Number(v))} type="number" />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Category</label>
            <select value={form.category} onChange={(e) => update('category', e.target.value)} className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none">
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Sizes & Piece Pricing (only for Dresses / Accessories / Idols) */}
          {(supportsVariants || sizes.length > 0 || piecePricing.length > 0) && (
            <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
              <div>
                <p className="text-sm font-semibold text-white">Sizes & Piece Pricing</p>
                <p className="text-xs text-slate-500">Shown only for Dresses / Accessories / Idols / Groceries categories.</p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm text-slate-300">Sizes</label>
                {variantPreset && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-400">Preset:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const current = Array.isArray(form.sizes) ? form.sizes.filter(Boolean) : [];
                        const merged = [...current];
                        for (const s of variantPreset.sizes) {
                          if (!merged.includes(s)) merged.push(s);
                        }
                        update('sizes', merged);
                      }}
                      className="px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-xs text-white hover:bg-slate-700 transition"
                    >
                      Add {variantPreset.label}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        update('sizes', variantPreset.sizes);
                        update('sizePricing', (Array.isArray(form.sizePricing) ? form.sizePricing : []).filter((x) => variantPreset.sizes.includes(String(x?.size || ''))));
                      }}
                      className="px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-xs text-white hover:bg-slate-700 transition"
                    >
                      Replace with preset
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    value={sizeText}
                    onChange={(e) => setSizeText(e.target.value)}
                    placeholder={variantPreset?.kind === 'idol-numeric' ? 'e.g. 0, 1, 2...' : variantPreset?.kind === 'grocery-units' ? 'e.g. 500 ml, 1 kg...' : 'e.g. S, M, L, XL'}
                    className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                  <input
                    value={sizePriceText}
                    onChange={(e) => setSizePriceText(e.target.value)}
                    placeholder="Price (INR) (optional)"
                    type="number"
                    className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next = sizeText.trim();
                      if (!next) return;
                      const current = Array.isArray(form.sizes) ? form.sizes.filter(Boolean) : [];
                      if (current.includes(next)) return;
                      update('sizes', [...current, next]);

                      const price = Number(sizePriceText);
                      if (Number.isFinite(price) && price > 0) {
                        const currentPricing = Array.isArray(form.sizePricing) ? form.sizePricing : [];
                        const withoutDup = currentPricing.filter((x) => String(x?.size || '') !== next);
                        update('sizePricing', [...withoutDup, { size: next, price }].sort((a, b) => String(a.size).localeCompare(String(b.size))));
                      }
                      setSizeText('');
                      setSizePriceText('');
                    }}
                    className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white hover:bg-slate-700 transition"
                  >
                    Add
                  </button>
                </div>
                {sizes.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {sizes.map((s) => (
                      <span key={s} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs text-slate-200">
                        {s}
                        {(() => {
                          const priced = sizePricing.find((x) => String(x?.size || '') === s);
                          if (!priced || !Number.isFinite(Number(priced.price))) return null;
                          return <span className="text-slate-400">₹{Number(priced.price).toLocaleString('en-IN')}</span>;
                        })()}
                        <button
                          type="button"
                          onClick={() => update('sizes', sizes.filter((x) => x !== s))}
                          className="text-slate-400 hover:text-white"
                          aria-label={`Remove size ${s}`}
                        >
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {sizes.length > 0 && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        update('sizePricing', []);
                        setSizePriceText('');
                      }}
                      className="text-xs text-slate-400 hover:text-white underline underline-offset-2"
                    >
                      Clear size pricing
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm text-slate-300">Piece-based Pricing</label>
                <p className="text-xs text-slate-500">Set prices for 2+ pieces (1 piece uses the main Price field).</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    value={piecesText}
                    onChange={(e) => setPiecesText(e.target.value)}
                    placeholder="Pieces (e.g. 2)"
                    type="number"
                    className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                  <input
                    value={piecesPriceText}
                    onChange={(e) => setPiecesPriceText(e.target.value)}
                    placeholder="Price (INR)"
                    type="number"
                    className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const pieces = Number(piecesText);
                      const price = Number(piecesPriceText);
                      if (!Number.isFinite(pieces) || pieces < 2) return;
                      if (!Number.isFinite(price) || price <= 0) return;
                      const current = Array.isArray(form.piecePricing) ? form.piecePricing : [];
                      const withoutDup = current.filter((x) => Number(x?.pieces) !== pieces);
                      const next = [...withoutDup, { pieces, price }].sort((a, b) => a.pieces - b.pieces);
                      update('piecePricing', next);
                      setPiecesText('');
                      setPiecesPriceText('');
                    }}
                    className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white hover:bg-slate-700 transition"
                  >
                    Add Tier
                  </button>
                </div>

                {piecePricing.length > 0 && (
                  <div className="space-y-2 pt-1">
                    {piecePricing
                      .slice()
                      .sort((a, b) => Number(a.pieces) - Number(b.pieces))
                      .map((tier) => (
                        <div key={String(tier.pieces)} className="flex items-center justify-between gap-3 bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2">
                          <div className="text-sm text-slate-200">
                            <span className="font-semibold">{tier.pieces}</span> pcs → <span className="font-semibold">₹{Number(tier.price).toLocaleString('en-IN')}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => update('piecePricing', piecePricing.filter((x) => Number(x?.pieces) !== Number(tier.pieces)))}
                            className="text-slate-400 hover:text-white"
                            aria-label={`Remove tier ${tier.pieces} pieces`}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Custom Attributes */}
          <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
            <div>
              <p className="text-sm font-semibold text-white">Custom Attributes</p>
              <p className="text-xs text-slate-500">Add options like Color, Language, Sleeves, Weight, etc.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400">Presets:</span>
              {ATTRIBUTE_PRESETS.map((preset) => (
                <button
                  key={preset.slug}
                  type="button"
                  onClick={() => upsertAttribute(preset)}
                  className="px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-xs text-white hover:bg-slate-700 transition"
                >
                  Add {preset.name}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                value={attrNameText}
                onChange={(e) => setAttrNameText(e.target.value)}
                placeholder="Attribute name (e.g. Color)"
                className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
              <input
                value={attrTermsText}
                onChange={(e) => setAttrTermsText(e.target.value)}
                placeholder="Terms (comma separated)"
                className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
              <button
                type="button"
                onClick={() => {
                  const name = attrNameText.trim();
                  if (!name) return;
                  const slug = normalize(name);
                  const terms = attrTermsText
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean);
                  upsertAttribute({ name, slug, terms });
                  setAttrNameText('');
                  setAttrTermsText('');
                }}
                className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white hover:bg-slate-700 transition"
              >
                Add Attribute
              </button>
            </div>

            {attributes.length > 0 && (
              <div className="space-y-3 pt-1">
                {attributes.map((attr) => {
                  const slug = normalize(String(attr?.slug || attr?.name || ''));
                  const terms = Array.isArray(attr?.terms) ? attr.terms : [];
                  return (
                    <div key={slug} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm text-slate-200">
                          <span className="font-semibold">{attr.name || slug}</span>
                          <span className="ml-2 text-xs text-slate-500">{slug}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            update('attributes', attributes.filter((a) => normalize(String(a?.slug || '')) !== slug));
                            update('variantPricing', variantPricing.filter((v) => !Object.prototype.hasOwnProperty.call((v as any)?.selections || {}, slug)));
                            setVariantSelections((prev) => {
                              const next = { ...prev };
                              delete next[slug];
                              return next;
                            });
                          }}
                          className="text-slate-400 hover:text-white"
                          aria-label={`Remove attribute ${slug}`}
                        >
                          <X size={16} />
                        </button>
                      </div>
                      <input
                        value={terms.join(', ')}
                        onChange={(e) => {
                          const nextTerms = e.target.value
                            .split(',')
                            .map((t) => t.trim())
                            .filter(Boolean);
                          update(
                            'attributes',
                            attributes.map((a) => (normalize(String(a?.slug || '')) === slug ? { ...a, terms: nextTerms } : a))
                          );
                        }}
                        placeholder="Terms (comma separated)"
                        className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Variant Pricing */}
          {(pricingAttributes.length > 0 || sizes.length > 0) && (
            <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
              <div>
                <p className="text-sm font-semibold text-white">Attribute Pricing</p>
                <p className="text-xs text-slate-500">Set a price for a selected combination of size + custom attributes (color never affects price).</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sizes.length > 0 && (
                  <div className="space-y-1">
                    <label className="block text-xs text-slate-400">Size</label>
                    <select
                      value={variantSelections.size || sizes[0] || ''}
                      onChange={(e) => setVariantSelections((prev) => ({ ...prev, size: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none"
                    >
                      {sizes.map((s: string) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {pricingAttributes
                  .filter((a: any) => Array.isArray(a?.terms) && a.terms.length > 0)
                  .map((attr: any) => {
                    const slug = normalize(String(attr?.slug || attr?.name || ''));
                    const terms = Array.isArray(attr?.terms) ? attr.terms : [];
                    const value = variantSelections[slug] || terms[0] || '';
                    return (
                      <div key={slug} className="space-y-1">
                        <label className="block text-xs text-slate-400">{attr.name || slug}</label>
                        <select
                          value={value}
                          onChange={(e) => setVariantSelections((prev) => ({ ...prev, [slug]: e.target.value }))}
                          className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none"
                        >
                          {terms.map((t: any) => (
                            <option key={String(t)} value={String(t)}>
                              {String(t)}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <input
                    value={variantPriceText}
                    onChange={(e) => setVariantPriceText(e.target.value)}
                    placeholder="Price (INR)"
                    type="number"
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const price = Number(variantPriceText);
                    if (!Number.isFinite(price) || price <= 0) return;

                    const selections: Record<string, string> = {};
                    if (sizes.length > 0) {
                      const s = String(variantSelections.size || sizes[0] || '').trim();
                      if (s) selections.size = s;
                    }
                    for (const attr of pricingAttributes) {
                      const slug = normalize(String((attr as any)?.slug || (attr as any)?.name || ''));
                      const terms = Array.isArray((attr as any)?.terms) ? (attr as any).terms : [];
                      if (!slug || !terms.length) continue;
                      selections[slug] = variantSelections[slug] || terms[0];
                    }
                    if (Object.keys(selections).length === 0) return;

                    const key = JSON.stringify(Object.keys(selections).sort().reduce((acc: any, k) => (acc[k] = selections[k], acc), {}));
                    const current = Array.isArray(form.variantPricing) ? form.variantPricing : [];
                    const withoutDup = current.filter((v) => {
                      const s = (v as any)?.selections || {};
                      const k = JSON.stringify(Object.keys(s).sort().reduce((acc: any, kk) => (acc[kk] = s[kk], acc), {}));
                      return k !== key;
                    });
                    update('variantPricing', [...withoutDup, { selections, price }]);
                    setVariantPriceText('');
                  }}
                  className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white hover:bg-slate-700 transition"
                >
                  Add Price
                </button>
              </div>

              {variantPricing.length > 0 && (
                <div className="space-y-2 pt-1">
                  {variantPricing.map((v, idx) => {
                    const selections = (v as any)?.selections || {};
                    const label = Object.keys(selections)
                      .sort()
                      .map((k) => `${k}: ${selections[k]}`)
                      .join(', ');
                    return (
                      <div key={`${label}-${idx}`} className="flex items-center justify-between gap-3 bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2">
                        <div className="text-sm text-slate-200">
                          <span className="text-slate-300">{label || 'Variant'}</span>
                          <span className="ml-2 font-semibold">₹{Number((v as any)?.price || 0).toLocaleString('en-IN')}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => update('variantPricing', variantPricing.filter((_, i) => i !== idx))}
                          className="text-slate-400 hover:text-white"
                          aria-label="Remove variant price"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Image Upload */}
          <div>
            <label className="block text-sm text-slate-300 mb-1">Product Image</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <div className="flex gap-3 items-start">
              {form.image ? (
                <img src={form.image} alt="Preview" className="w-20 h-20 rounded-xl object-cover border border-slate-700" />
              ) : (
                <div className="w-20 h-20 rounded-xl border border-dashed border-slate-600 flex items-center justify-center">
                  <ImageIcon size={24} className="text-slate-500" />
                </div>
              )}
              <div className="flex-1 space-y-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white hover:bg-slate-700 transition"
                >
                  <Upload size={14} /> Upload from Device
                </button>
                <p className="text-xs text-slate-500">JPG, PNG, WebP - any size</p>
                {imageError && <p className="text-xs text-red-400">{imageError}</p>}
              </div>
            </div>
          </div>

          {/* Gallery Images */}
          <div>
            <label className="block text-sm text-slate-300 mb-2">Gallery Images (2-4 recommended)</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {(Array.isArray(form.images) ? form.images : []).map((img, idx) => (
                <div
                  key={`${img}-${idx}`}
                  className={`relative rounded-lg border ${dragIndex === idx ? 'border-amber-400' : 'border-slate-700'} bg-slate-800`}
                  draggable
                  onDragStart={() => setDragIndex(idx)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragIndex === null) return;
                    moveGalleryImage(dragIndex, idx);
                    setDragIndex(null);
                  }}
                  onDragEnd={() => setDragIndex(null)}
                >
                  <img src={img} alt={`Gallery ${idx + 1}`} className="w-full h-16 rounded-lg object-cover" />
                  <button
                    type="button"
                    onClick={() => removeGalleryImage(idx)}
                    className="absolute -top-2 -right-2 bg-slate-900 border border-slate-600 rounded-full p-1 text-slate-300 hover:text-white"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleGalleryUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white hover:bg-slate-700 transition"
              >
                <Upload size={14} /> Upload Multiple
              </button>
              <span className="text-xs text-slate-500">Drag thumbnails to reorder</span>
            </div>
          </div>

          {/* Color-wise Images */}
          <div>
            <label className="block text-sm text-slate-300 mb-2">Color Variants (Images)</label>
              <input
                ref={colorFileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleColorUpload}
                className="hidden"
              />

              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <input
                  value={newColorName}
                  onChange={(e) => setNewColorName(e.target.value)}
                  placeholder="Add a color (e.g. Blue, Maroon)"
                  className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none"
                />
                <button
                  type="button"
                  onClick={addColorVariant}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition"
                >
                  Add Color
                </button>
              </div>

              <div className="space-y-4">
                {colorVariants.map((entry: any) => {
                  const term = String(entry?.color || '').trim();
                  if (!term) return null;
                  const existing = colorVariants.find((v: any) => String(v?.color || '').toLowerCase() === String(term).toLowerCase());
                  const imgs = Array.isArray(existing?.images) ? existing.images : [];
                  return (
                    <div key={term} className="rounded-2xl border border-slate-700 bg-slate-900/40 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-white font-semibold text-sm">{term}</div>
                          <div className="text-xs text-slate-400 mt-0.5">Set images to switch when user selects this color.</div>
                        </div>
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            onClick={() => removeColorVariant(term)}
                            className="px-3 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs hover:bg-slate-800 transition"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      {imgs.length > 0 && (
                        <div className="mt-3 grid grid-cols-2 sm:grid-cols-6 gap-2">
                          {imgs.map((img: string, idx: number) => (
                            <div key={`${img}-${idx}`} className="relative rounded-lg border border-slate-700 bg-slate-800">
                              <img src={img} alt={`${term} ${idx + 1}`} className="w-full h-16 rounded-lg object-cover" />
                              <button
                                type="button"
                                onClick={() => removeColorImage(term, idx)}
                                className="absolute -top-2 -right-2 bg-slate-900 border border-slate-600 rounded-full p-1 text-slate-300 hover:text-white"
                                aria-label="Remove"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="mt-3 flex flex-col sm:flex-row gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setColorUploadKey(term);
                            colorFileInputRef.current?.click();
                          }}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white hover:bg-slate-700 transition"
                        >
                          <Upload size={14} /> Upload
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            {colorVariants.length === 0 && (
              <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4 text-sm text-slate-400">
                Add your product colors above, then upload images for each color.
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Rating" value={String(form.rating)} onChange={(v) => update('rating', Number(v))} type="number" />
            <Field label="Review Count" value={String(form.reviewCount)} onChange={(v) => update('reviewCount', Number(v))} type="number" />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm text-slate-300">In Stock</label>
            <button onClick={() => update('inStock', !form.inStock)} className={`w-10 h-5 rounded-full transition ${form.inStock ? 'bg-emerald-500' : 'bg-slate-600'}`}>
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${form.inStock ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-2">Placement Tags</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {['latest', 'new', 'bestseller', 'accessories', 'prasadam', 'combo', 'exclusive'].map((tag) => {
                const selected = Array.isArray(form.tags) && form.tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      const current = Array.isArray(form.tags) ? form.tags : [];
                      const next = selected ? current.filter((t) => t !== tag) : [...current, tag];
                      update('tags', next);
                      const priority = ['bestseller', 'new', 'combo', 'exclusive'];
                      const nextBadge = priority.find((t) => next.includes(t));
                      update('badge', nextBadge);
                    }}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition ${selected ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'}`}
                  >
                    {tag === 'latest' && 'Latest Products'}
                    {tag === 'new' && 'New Arrivals'}
                    {tag === 'bestseller' && 'Best Selling'}
                    {tag === 'accessories' && 'Top Accessories'}
                    {tag === 'prasadam' && 'Sacred Prasadam'}
                    {tag === 'combo' && 'Combo'}
                    {tag === 'exclusive' && 'Exclusive'}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-500 mt-2">Select one or more placements. Products will appear in all selected sections.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 border border-slate-700 text-slate-300 rounded-xl text-sm hover:bg-slate-800 transition">Cancel</button>
            <button
              onClick={() => {
                if (!form.description || !form.description.trim()) {
                  toast.error('Description is required');
                  return;
                }
                const baseImages = Array.isArray(form.images) ? form.images.filter(Boolean) : [];
                const withMain = form.image && !baseImages.includes(form.image) ? [form.image, ...baseImages] : baseImages;
                onSave({ ...form, images: withMain, slug: slugify(form.slug || form.name) });
              }}
              className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition"
            >
              {isCreating ? 'Create' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Field = ({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) => (
  <div>
    <label className="block text-sm text-slate-300 mb-1">{label}</label>
    {type === 'textarea' ? (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
      />
    ) : (
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
      />
    )}
  </div>
);

export default AdminProducts;
