import { useEffect, useRef, useState } from 'react';
import { useProductStore } from '@/store/productStore';
import { Category, Subcategory } from '@/types/product';
import { Plus, Edit2, Trash2, X, Upload, Image } from 'lucide-react';
import { createCategory, deleteCategory as deleteCategoryApi, updateCategory as updateCategoryApi, uploadImage, createSubcategory, updateSubcategory, deleteSubcategory as deleteSubcategoryApi } from '@/lib/api';
import { toast } from 'sonner';

const PRODUCT_SYNC_KEY = 'brajmart-products-updated-at';

const AdminCategories = () => {
  const { categories, addCategory, updateCategory, deleteCategory, loadFromApi, getProductsByCategory } = useProductStore();
  const [editing, setEditing] = useState<Category | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const getCatCount = (name: string) => getProductsByCategory(name).length;

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

      // Refresh products + categories so storefront reflects category renames immediately.
      await loadFromApi({ force: true });
      try {
        localStorage.setItem(PRODUCT_SYNC_KEY, String(Date.now()));
      } catch {
        // ignore storage permission errors
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
        <button
          onClick={() => {
            const nextOrder = Math.max(0, ...categories.map((c) => c.displayOrder ?? 0)) + 1;
            setIsCreating(true);
            setEditing({ id: '', name: '', icon: '', color: '#f59e0b', productCount: 0, displayOrder: nextOrder });
          }}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition w-full sm:w-auto"
        >
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
            <p className="text-slate-500 text-xs mt-2">Order: {cat.displayOrder ?? 0}</p>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => { setEditing(null); setIsCreating(false); }}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
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
  const [subName, setSubName] = useState('');
  const [subOrder, setSubOrder] = useState<number>(0);
  const [subSaving, setSubSaving] = useState(false);
  const [subEdits, setSubEdits] = useState<Record<string, { name: string; displayOrder: number }>>({});
  const loadFromApi = useProductStore((s) => s.loadFromApi);

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

  useEffect(() => {
    setForm(cat);
    setSubEdits({});
  }, [cat]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
      <div>
        <label className="block text-sm text-slate-300 mb-1">Name</label>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
      </div>
      <div>
        <label className="block text-sm text-slate-300 mb-1">Display Order</label>
        <input
          type="number"
          value={form.displayOrder ?? 0}
          onChange={(e) => setForm({ ...form, displayOrder: Number(e.target.value) })}
          className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          min={0}
        />
        <p className="text-xs text-slate-500 mt-1">Use 1 for first position, 2 for second… (0/unset shows at the end).</p>
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

      <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold text-white">Subcategories</p>
          <p className="text-xs text-slate-500">Create and manage subcategories under this category.</p>
        </div>

        {isCreating ? (
          <div className="text-xs text-slate-400">
            Save this category first to add subcategories.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-end">
              <div className="sm:col-span-3">
                <label className="block text-xs text-slate-400 mb-1">Subcategory name</label>
                <input
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  placeholder="e.g. Kurtis"
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>
              <div className="sm:col-span-1">
                <label className="block text-xs text-slate-400 mb-1">Order</label>
                <input
                  type="number"
                  value={subOrder}
                  onChange={(e) => setSubOrder(Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  min={0}
                />
              </div>
              <button
                type="button"
                disabled={subSaving || !subName.trim()}
                onClick={async () => {
                  try {
                    setSubSaving(true);
                    const created: any = await createSubcategory(form.id, { name: subName.trim(), displayOrder: subOrder || 0 });
                    const mapped: Subcategory = {
                      ...(created || {}),
                      id: created?.id || created?._id,
                      categoryId: String(created?.categoryId ?? created?.category_id ?? form.id),
                      name: String(created?.name ?? subName.trim()),
                      displayOrder: Number(created?.displayOrder ?? created?.display_order ?? subOrder ?? 0),
                    };
                    setForm((prev) => {
                      const current = (prev.subcategories || []) as Subcategory[];
                      const next = [...current, mapped].sort((a, b) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0) || String(a.name).localeCompare(String(b.name)));
                      return { ...prev, subcategories: next };
                    });
                    await loadFromApi({ force: true });
                    try {
                      localStorage.setItem(PRODUCT_SYNC_KEY, String(Date.now()));
                    } catch {
                      // ignore storage permission errors
                    }
                    toast.success('Subcategory created');
                    setSubName('');
                    setSubOrder(0);
                  } catch (err: any) {
                    toast.error(err?.message || 'Failed to create subcategory');
                  } finally {
                    setSubSaving(false);
                  }
                }}
                className="sm:col-span-1 px-4 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition disabled:opacity-60 disabled:hover:bg-amber-500"
              >
                Add
              </button>
            </div>

            <div className="space-y-2">
              {((form.subcategories || []) as Subcategory[]).length === 0 ? (
                <div className="text-xs text-slate-500">No subcategories yet.</div>
              ) : (
                ((form.subcategories || []) as Subcategory[]).map((s) => {
                  const edit = subEdits[s.id] || { name: s.name, displayOrder: Number(s.displayOrder ?? 0) };
                  return (
                    <div key={s.id} className="flex flex-col sm:flex-row gap-2 sm:items-center rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                      <input
                        value={edit.name}
                        onChange={(e) => setSubEdits((prev) => ({ ...prev, [s.id]: { ...edit, name: e.target.value } }))}
                        className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none"
                      />
                      <input
                        type="number"
                        value={edit.displayOrder}
                        onChange={(e) => setSubEdits((prev) => ({ ...prev, [s.id]: { ...edit, displayOrder: Number(e.target.value) } }))}
                        className="w-full sm:w-28 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none"
                        min={0}
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          disabled={subSaving || !edit.name.trim()}
                          onClick={async () => {
                            try {
                              setSubSaving(true);
                              const updated: any = await updateSubcategory(s.id, { name: edit.name.trim(), displayOrder: edit.displayOrder || 0 });
                              setForm((prev) => {
                                const current = (prev.subcategories || []) as Subcategory[];
                                const next = current
                                  .map((x) => (x.id === s.id ? { ...x, ...(updated || {}), id: updated?.id || updated?._id || x.id } : x))
                                  .sort((a, b) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0) || String(a.name).localeCompare(String(b.name)));
                                return { ...prev, subcategories: next };
                              });
                              await loadFromApi({ force: true });
                              try {
                                localStorage.setItem(PRODUCT_SYNC_KEY, String(Date.now()));
                              } catch {
                                // ignore
                              }
                              toast.success('Subcategory updated');
                            } catch (err: any) {
                              toast.error(err?.message || 'Failed to update subcategory');
                            } finally {
                              setSubSaving(false);
                            }
                          }}
                          className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm hover:bg-slate-700 transition disabled:opacity-60"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          disabled={subSaving}
                          onClick={async () => {
                            if (!confirm('Delete this subcategory?')) return;
                            try {
                              setSubSaving(true);
                              await deleteSubcategoryApi(s.id);
                              setForm((prev) => {
                                const current = (prev.subcategories || []) as Subcategory[];
                                return { ...prev, subcategories: current.filter((x) => x.id !== s.id) };
                              });
                              await loadFromApi({ force: true });
                              try {
                                localStorage.setItem(PRODUCT_SYNC_KEY, String(Date.now()));
                              } catch {
                                // ignore
                              }
                              toast.success('Subcategory deleted');
                            } catch (err: any) {
                              toast.error(err?.message || 'Failed to delete subcategory');
                            } finally {
                              setSubSaving(false);
                            }
                          }}
                          className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-sm hover:bg-red-500/20 transition disabled:opacity-60"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
      </div>
      <div className="p-5 pt-3 border-t border-slate-800 bg-slate-900">
        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-700 text-slate-300 rounded-xl text-sm hover:bg-slate-800 transition">Cancel</button>
          <button onClick={() => onSave(form)} className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition">{isCreating ? 'Create' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
};

export default AdminCategories;
