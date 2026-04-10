import { useEffect, useRef, useState } from 'react';
import { useProductStore } from '@/store/productStore';
import { Category } from '@/types/product';
import { Plus, Edit2, Trash2, X, Upload, Image } from 'lucide-react';
import { createCategory, deleteCategory as deleteCategoryApi, updateCategory as updateCategoryApi, uploadImage } from '@/lib/api';
import { toast } from 'sonner';

const AdminCategories = () => {
  const { categories, products, addCategory, updateCategory, deleteCategory, loadFromApi } = useProductStore();
  const [editing, setEditing] = useState<Category | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const getCatCount = (name: string) => products.filter((p) => p.category === name).length;

  useEffect(() => {
    loadFromApi();
  }, [loadFromApi]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this category?')) return;
    try {
      await deleteCategoryApi(id);
      deleteCategory(id);
      toast.success('Category deleted');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete category');
    }
  };

  const handleSave = async (cat: Category) => {
    try {
      if (isCreating) {
        const created: any = await createCategory(cat as any);
        addCategory({ ...created, id: created.id || created._id });
        toast.success('Category created');
      } else {
        const updated: any = await updateCategoryApi(cat.id, cat as any);
        updateCategory(cat.id, updated);
        toast.success('Category updated');
      }
      setEditing(null);
      setIsCreating(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save category');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-white">Categories</h1>
        <button onClick={() => { setIsCreating(true); setEditing({ id: '', name: '', icon: '', color: '#f59e0b', productCount: 0 }); }} className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition w-full sm:w-auto">
          <Plus size={16} /> Add Category
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat) => (
          <div key={cat.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition">
            <div className="flex items-start justify-between mb-3">
              {cat.icon && (cat.icon.startsWith('data:') || cat.icon.startsWith('http') || cat.icon.startsWith('/uploads')) ? (
                <img src={cat.icon} alt={cat.name} className="w-10 h-10 rounded-lg object-cover" />
              ) : (
                <div className="text-3xl">{cat.icon}</div>
              )}
              <div className="flex gap-1.5">
                <button onClick={() => { setIsCreating(false); setEditing(cat); }} className="text-blue-400 hover:text-blue-300 p-1"><Edit2 size={14} /></button>
                <button onClick={() => handleDelete(cat.id)} className="text-red-400 hover:text-red-300 p-1"><Trash2 size={14} /></button>
              </div>
            </div>
            <h3 className="text-white font-semibold text-lg">{cat.name}</h3>
            <p className="text-slate-400 text-sm mt-1">{getCatCount(cat.name)} products</p>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => { setEditing(null); setIsCreating(false); }}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h2 className="text-lg font-semibold text-white">{isCreating ? 'Add Category' : 'Edit Category'}</h2>
              <button onClick={() => { setEditing(null); setIsCreating(false); }} className="text-slate-400 hover:text-white"><X size={20} /></button>
            </div>
            <CategoryForm cat={editing} onSave={handleSave} onClose={() => { setEditing(null); setIsCreating(false); }} isCreating={isCreating} />
          </div>
        </div>
      )}
    </div>
  );
};

const CategoryForm = ({ cat, onSave, onClose, isCreating }: { cat: Category; onSave: (c: Category) => void; onClose: () => void; isCreating: boolean }) => {
  const [form, setForm] = useState(cat);
  const [imageError, setImageError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { url } = await uploadImage(file);
      setImageError('');
      setForm({ ...form, icon: url });
    } catch (err: any) {
      setImageError(err?.message || 'Upload failed');
    }
  };

  return (
    <div className="p-5 space-y-4">
      <div>
        <label className="block text-sm text-slate-300 mb-1">Name</label>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
      </div>
      <div>
        <label className="block text-sm text-slate-300 mb-1">Icon Image</label>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleIconUpload} className="hidden" />
        <div
          onClick={() => fileRef.current?.click()}
          className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800 border border-slate-700 border-dashed rounded-xl cursor-pointer hover:border-amber-500/50 transition"
        >
          {form.icon && (form.icon.startsWith('data:') || form.icon.startsWith('http') || form.icon.startsWith('/uploads')) ? (
            <img src={form.icon} alt="icon" className="w-10 h-10 rounded-lg object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center">
              <Image size={18} className="text-slate-400" />
            </div>
          )}
          <div className="flex-1">
            <p className="text-sm text-slate-300">{form.icon ? 'Change icon image' : 'Upload icon image'}</p>
            <p className="text-xs text-slate-500">PNG, JPG, WebP - any size</p>
          </div>
          <Upload size={16} className="text-slate-400" />
        </div>
        {imageError && <p className="text-xs text-red-400 mt-2">{imageError}</p>}
      </div>
      <div>
        <label className="block text-sm text-slate-300 mb-1">Color</label>
        <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-16 h-10 rounded-lg border border-slate-700 bg-slate-800 cursor-pointer" />
      </div>
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button onClick={onClose} className="flex-1 py-2.5 border border-slate-700 text-slate-300 rounded-xl text-sm hover:bg-slate-800 transition">Cancel</button>
        <button onClick={() => onSave(form)} className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition">{isCreating ? 'Create' : 'Save'}</button>
      </div>
    </div>
  );
};

export default AdminCategories;
