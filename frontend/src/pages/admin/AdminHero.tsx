import { useEffect, useRef, useState } from 'react';
import { createHeroSlide, deleteHeroSlide, fetchHeroSlides, updateHeroSlide, uploadImage } from '@/lib/api';
import { toast } from 'sonner';
import { Plus, Trash2, Image as ImageIcon, Save } from 'lucide-react';

const defaultOverlay = 'from-indigo-950/80 via-indigo-900/50 to-transparent';

const AdminHero = () => {
  const [slides, setSlides] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const data = await fetchHeroSlides();
      setSlides(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load hero slides');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startNew = () => {
    setEditing({ tag: '', title: '', subtitle: '', cta: '', image: '', overlay: defaultOverlay, sortOrder: 0, isActive: true });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const res = await uploadImage(file);
      setEditing((s: any) => ({ ...s, image: res.url }));
      toast.success('Image uploaded');
    } catch (err: any) {
      toast.error(err?.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!editing?.title || !editing?.image) {
      toast.error('Title and image are required');
      return;
    }
    setLoading(true);
    try {
      if (editing.id) {
        const updated = await updateHeroSlide(editing.id, editing);
        setSlides((s) => s.map((x) => (x.id === editing.id ? updated : x)));
        toast.success('Slide updated');
      } else {
        const created = await createHeroSlide(editing);
        setSlides((s) => [...s, created]);
        toast.success('Slide created');
      }
      setEditing(null);
    } catch (err: any) {
      toast.error(err?.message || 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id: string) => {
    setLoading(true);
    try {
      await deleteHeroSlide(id);
      setSlides((s) => s.filter((x) => x.id !== id));
      toast.success('Slide deleted');
    } catch (err: any) {
      toast.error(err?.message || 'Delete failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Hero Slides</h1>
        <button onClick={startNew} className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-semibold">
          <Plus size={16} /> Add Slide
        </button>
      </div>

      {editing && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Tag" value={editing.tag} onChange={(v) => setEditing((s: any) => ({ ...s, tag: v }))} />
            <Field label="Title" value={editing.title} onChange={(v) => setEditing((s: any) => ({ ...s, title: v }))} />
            <Field label="Subtitle" value={editing.subtitle} onChange={(v) => setEditing((s: any) => ({ ...s, subtitle: v }))} />
            <Field label="CTA" value={editing.cta} onChange={(v) => setEditing((s: any) => ({ ...s, cta: v }))} />
            <Field label="Overlay" value={editing.overlay} onChange={(v) => setEditing((s: any) => ({ ...s, overlay: v }))} />
            <Field label="Sort Order" value={String(editing.sortOrder ?? 0)} onChange={(v) => setEditing((s: any) => ({ ...s, sortOrder: Number(v) }))} type="number" />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">Background Image (4K recommended)</label>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
            <div className="flex items-center gap-3">
              {editing.image ? (
                <img src={editing.image} alt="Hero" className="w-24 h-16 rounded-lg object-cover border border-slate-700" />
              ) : (
                <div className="w-24 h-16 rounded-lg border border-dashed border-slate-600 flex items-center justify-center">
                  <ImageIcon size={18} className="text-slate-500" />
                </div>
              )}
              <button onClick={() => fileRef.current?.click()} className="px-4 py-2 rounded-xl border border-slate-700 text-white text-sm">
                Upload Image
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="text-sm text-slate-300">Active</label>
            <button onClick={() => setEditing((s: any) => ({ ...s, isActive: !s.isActive }))} className={`w-10 h-5 rounded-full transition ${editing.isActive ? 'bg-amber-500' : 'bg-slate-600'}`}>
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${editing.isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          <div className="flex gap-3">
            <button onClick={save} disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold">
              <Save size={16} /> Save
            </button>
            <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-xl border border-slate-700 text-white text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {slides.map((s) => (
          <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="h-40 bg-slate-800">
              {s.image && <img src={s.image} alt={s.title} className="w-full h-full object-cover" />}
            </div>
            <div className="p-4 space-y-1">
              <div className="text-xs text-amber-400">{s.tag}</div>
              <div className="text-white font-semibold">{s.title}</div>
              <div className="text-xs text-slate-400">{s.subtitle}</div>
              <div className="text-xs text-slate-500">CTA: {s.cta || '—'} | Order: {s.sortOrder}</div>
            </div>
            <div className="flex gap-2 p-4 pt-0">
              <button onClick={() => setEditing(s)} className="px-3 py-1.5 rounded-lg border border-slate-700 text-white text-xs">Edit</button>
              <button onClick={() => remove(s.id)} className="px-3 py-1.5 rounded-lg border border-red-500 text-red-300 text-xs inline-flex items-center gap-1">
                <Trash2 size={12} /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Field = ({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) => (
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

export default AdminHero;
