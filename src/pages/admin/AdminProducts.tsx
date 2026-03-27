import { useState } from 'react';
import { useProductStore } from '@/store/productStore';
import { Product } from '@/types/product';
import { Search, Plus, Edit2, Trash2, X } from 'lucide-react';

const AdminProducts = () => {
  const { products, categories, addProduct, updateProduct, deleteProduct } = useProductStore();
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const categoryNames = categories.map((c) => c.name);

  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === 'all' || p.category === filterCat;
    return matchSearch && matchCat;
  });

  const handleDelete = (id: string) => {
    if (confirm('Delete this product?')) deleteProduct(id);
  };

  const handleSave = (product: Product) => {
    if (isCreating) {
      addProduct({ ...product, id: `prod-${Date.now()}` });
    } else {
      updateProduct(product.id, product);
    }
    setEditProduct(null);
    setIsCreating(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Products</h1>
        <button onClick={() => { setIsCreating(true); setEditProduct({ id: '', name: '', slug: '', price: 0, image: '', category: categoryNames[0] || '', rating: 4.5, reviewCount: 0, inStock: true }); }} className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition">
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
          <table className="w-full text-sm">
            <thead><tr className="text-slate-400 border-b border-slate-800">
              <th className="text-left px-5 py-3 font-medium">Product</th>
              <th className="text-left px-5 py-3 font-medium">Category</th>
              <th className="text-left px-5 py-3 font-medium">Price</th>
              <th className="text-left px-5 py-3 font-medium">MRP</th>
              <th className="text-left px-5 py-3 font-medium">Rating</th>
              <th className="text-left px-5 py-3 font-medium">Stock</th>
              <th className="text-left px-5 py-3 font-medium">Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <img src={p.image} alt={p.name} className="w-10 h-10 rounded-lg object-cover" />
                      <span className="text-white text-sm max-w-[200px] truncate">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-300">{p.category}</td>
                  <td className="px-5 py-3 text-white font-medium">₹{p.price}</td>
                  <td className="px-5 py-3 text-slate-400 line-through">₹{p.originalPrice || p.price}</td>
                  <td className="px-5 py-3 text-amber-400">⭐ {p.rating}</td>
                  <td className="px-5 py-3"><span className={`text-xs font-medium ${p.inStock ? 'text-emerald-400' : 'text-red-400'}`}>{p.inStock ? 'In Stock' : 'Out'}</span></td>
                  <td className="px-5 py-3 flex gap-2">
                    <button onClick={() => { setIsCreating(false); setEditProduct(p); }} className="text-blue-400 hover:text-blue-300"><Edit2 size={15} /></button>
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
  const update = (field: string, value: any) => setForm((prev) => ({ ...prev, [field]: value }));

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
          <div className="grid grid-cols-2 gap-4">
            <Field label="Price (₹)" value={String(form.price)} onChange={(v) => update('price', Number(v))} type="number" />
            <Field label="MRP (₹)" value={String(form.originalPrice || '')} onChange={(v) => update('originalPrice', Number(v))} type="number" />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Category</label>
            <select value={form.category} onChange={(e) => update('category', e.target.value)} className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none">
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <Field label="Image URL" value={form.image} onChange={(v) => update('image', v)} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Rating" value={String(form.rating)} onChange={(v) => update('rating', Number(v))} type="number" />
            <Field label="Review Count" value={String(form.reviewCount)} onChange={(v) => update('reviewCount', Number(v))} type="number" />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-slate-300">In Stock</label>
            <button onClick={() => update('inStock', !form.inStock)} className={`w-10 h-5 rounded-full transition ${form.inStock ? 'bg-emerald-500' : 'bg-slate-600'}`}>
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${form.inStock ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Badge</label>
            <select value={form.badge || ''} onChange={(e) => update('badge', e.target.value || undefined)} className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none">
              <option value="">None</option>
              <option value="new">New</option>
              <option value="bestseller">Bestseller</option>
              <option value="combo">Combo</option>
              <option value="exclusive">Exclusive</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 border border-slate-700 text-slate-300 rounded-xl text-sm hover:bg-slate-800 transition">Cancel</button>
            <button onClick={() => onSave({ ...form, slug: form.slug || form.name.toLowerCase().replace(/\s+/g, '-') })} className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition">
              {isCreating ? 'Create' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) => (
  <div>
    <label className="block text-sm text-slate-300 mb-1">{label}</label>
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
  </div>
);

export default AdminProducts;
