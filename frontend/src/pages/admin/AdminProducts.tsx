import * as React from "react";
import { useEffect, useRef, useState } from 'react';
import { useProductStore } from '@/store/productStore';
import { Product } from '@/types/product';
import { Search, Plus, Edit2, Trash2, X, Upload, ImageIcon } from 'lucide-react';
import { createProduct, deleteProduct as deleteProductApi, updateProduct as updateProductApi, uploadImage } from '@/lib/api';
import { toast } from 'sonner';

// No image size limit
const slugify = (value: string) =>
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
      const normalized = {
        ...product,
        tags: Array.isArray(product.tags) ? product.tags : (product.badge ? [product.badge] : []),
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
        <button onClick={() => { setIsCreating(true); setEditProduct({ id: '', name: '', slug: '', price: 0, image: '', images: [], description: '', category: categoryNames[0] || '', rating: 4.5, reviewCount: 0, inStock: true, tags: [] }); }} className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition w-full sm:w-auto">
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
                    <button onClick={() => { setIsCreating(false); setEditProduct({ ...p, images: Array.isArray(p.images) ? p.images : (p.image ? [p.image] : []), tags: Array.isArray(p.tags) ? p.tags : (p.badge ? [p.badge] : []) }); }} className="text-blue-400 hover:text-blue-300"><Edit2 size={15} /></button>
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
  const [galleryUrl, setGalleryUrl] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const update = (field: string, value: any) => setForm((prev) => ({ ...prev, [field]: value }));

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
    const uploaded: string[] = [];
    try {
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        const { url } = await uploadImage(file);
        uploaded.push(url);
      }
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

  const addGalleryUrl = () => {
    const url = galleryUrl.trim();
    if (!url) return;
    const current = Array.isArray(form.images) ? form.images : [];
    update('images', [...current, url]);
    setGalleryUrl('');
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
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={galleryUrl}
                onChange={(e) => setGalleryUrl(e.target.value)}
                placeholder="Paste image URL and click Add"
                className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none"
              />
              <button type="button" onClick={addGalleryUrl} className="px-4 py-2.5 rounded-xl border border-slate-700 text-white text-sm">
                Add URL
              </button>
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
