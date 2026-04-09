import { useEffect, useMemo, useRef, useState } from 'react';
import { createBlog, deleteBlog, fetchAdminBlogs, updateBlog, uploadImage } from '@/lib/api';
import type { BlogPost } from '@/types/blog';
import { toast } from 'sonner';
import { Plus, Save, Trash2, Image as ImageIcon, Link as LinkIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

const emptyBlog: BlogPost = {
  id: '',
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  category: '',
  coverImage: '',
  author: 'BrajMart Team',
  readTime: 5,
  status: 'published',
  publishedAt: null,
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

const estimateReadTime = (content: string) => {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200) || 1);
};

const AdminBlogs = () => {
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [editing, setEditing] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const data = await fetchAdminBlogs();
      setBlogs(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load blogs');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startNew = () => {
    setEditing({ ...emptyBlog });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editing) return;
    setLoading(true);
    try {
      const res = await uploadImage(file);
      setEditing({ ...editing, coverImage: res.url });
      toast.success('Cover image uploaded');
    } catch (err: any) {
      toast.error(err?.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.title?.trim()) {
      toast.error('Title is required');
      return;
    }
    const payload = {
      ...editing,
      slug: editing.slug?.trim() || slugify(editing.title),
      readTime: editing.readTime || estimateReadTime(editing.content || ''),
      status: editing.status || 'published',
    };
    setLoading(true);
    try {
      if (editing.id) {
        const updated = await updateBlog(editing.id, payload);
        setBlogs((prev) => prev.map((b) => (b.id === editing.id ? updated : b)));
        toast.success('Blog updated');
      } else {
        const created = await createBlog(payload);
        setBlogs((prev) => [created, ...prev]);
        toast.success('Blog created');
      }
      setEditing(null);
    } catch (err: any) {
      toast.error(err?.message || 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this blog post?')) return;
    setLoading(true);
    try {
      await deleteBlog(id);
      setBlogs((prev) => prev.filter((b) => b.id !== id));
      toast.success('Blog deleted');
    } catch (err: any) {
      toast.error(err?.message || 'Delete failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (blog: BlogPost) => {
    setLoading(true);
    try {
      const nextStatus = blog.status === 'published' ? 'draft' : 'published';
      const updated = await updateBlog(blog.id, { status: nextStatus });
      setBlogs((prev) => prev.map((b) => (b.id === blog.id ? updated : b)));
      toast.success(`Status set to ${nextStatus}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const sortedBlogs = useMemo(() => {
    return [...blogs].sort((a, b) => {
      const aDate = new Date(a.publishedAt || a.createdAt || 0).getTime();
      const bDate = new Date(b.publishedAt || b.createdAt || 0).getTime();
      return bDate - aDate;
    });
  }, [blogs]);

  const filteredBlogs = useMemo(() => {
    if (filter === 'all') return sortedBlogs;
    return sortedBlogs.filter((b) => b.status === filter);
  }, [filter, sortedBlogs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Blog Posts</h1>
          <p className="text-sm text-slate-400">Create and manage stories published on the Blog page.</p>
        </div>
        <button onClick={startNew} className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-semibold">
          <Plus size={16} /> New Post
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {([
          { key: 'all', label: 'All' },
          { key: 'published', label: 'Published' },
          { key: 'draft', label: 'Unpublished' },
        ] as const).map((item) => (
          <button
            key={item.key}
            onClick={() => setFilter(item.key)}
            className={`px-4 py-2 rounded-full border text-xs font-semibold uppercase tracking-wide transition ${
              filter === item.key
                ? 'bg-amber-500/10 border-amber-400 text-amber-300'
                : 'border-slate-700 text-slate-400 hover:text-amber-300 hover:border-amber-400/60'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {editing && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <Field label="Title" value={editing.title || ''} onChange={(v) => setEditing({ ...editing, title: v })} />
            <Field label="Slug" value={editing.slug || ''} onChange={(v) => setEditing({ ...editing, slug: v })} />
            <Field label="Category" value={editing.category || ''} onChange={(v) => setEditing({ ...editing, category: v })} />
            <Field label="Author" value={editing.author || ''} onChange={(v) => setEditing({ ...editing, author: v })} />
            <Field label="Read Time (min)" type="number" value={String(editing.readTime ?? 5)} onChange={(v) => setEditing({ ...editing, readTime: Number(v) })} />
            <Field label="Status" value={editing.status || 'draft'} onChange={(v) => setEditing({ ...editing, status: v as BlogPost['status'] })} type="select" options={['draft', 'published']} />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Field
              label="Excerpt"
              value={editing.excerpt || ''}
              onChange={(v) => setEditing({ ...editing, excerpt: v })}
              type="textarea"
              rows={4}
            />
            <Field
              label="Content"
              value={editing.content || ''}
              onChange={(v) => setEditing({ ...editing, content: v })}
              type="textarea"
              rows={10}
            />
          </div>

          <Field
            label="Cover Image URL"
            value={editing.coverImage || ''}
            onChange={(v) => setEditing({ ...editing, coverImage: v })}
          />

          <div>
            <label className="block text-sm text-slate-300 mb-1">Cover Image</label>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
            <div className="flex flex-wrap items-center gap-3">
              {editing.coverImage ? (
                <img src={editing.coverImage} alt="Cover" className="w-28 h-20 rounded-lg object-cover border border-slate-700" />
              ) : (
                <div className="w-28 h-20 rounded-lg border border-dashed border-slate-600 flex items-center justify-center">
                  <ImageIcon size={18} className="text-slate-500" />
                </div>
              )}
              <button onClick={() => fileRef.current?.click()} className="px-4 py-2 rounded-xl border border-slate-700 text-white text-sm">
                Upload Image
              </button>
              <button
                onClick={() => setEditing({ ...editing, coverImage: '' })}
                className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-sm"
              >
                Clear
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
              <LinkIcon size={12} />
              <span>Tip: You can paste a direct image URL into the cover image field if needed.</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button onClick={() => setEditing({ ...editing, slug: slugify(editing.title || '') })} className="px-4 py-2 rounded-xl border border-slate-700 text-white text-sm">
              Auto-generate Slug
            </button>
            <button onClick={() => setEditing({ ...editing, readTime: estimateReadTime(editing.content || '') })} className="px-4 py-2 rounded-xl border border-slate-700 text-white text-sm">
              Auto Read Time
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

      <div className="grid lg:grid-cols-2 gap-4">
        {!filteredBlogs.length && (
          <div className="text-slate-400 text-sm">No posts found for this filter.</div>
        )}
        {filteredBlogs.map((blog) => (
          <div key={blog.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="h-40 bg-slate-800">
              {blog.coverImage && <img src={blog.coverImage} alt={blog.title} className="w-full h-full object-cover" />}
            </div>
            <div className="p-4 space-y-1">
              <div className="flex items-center gap-2 text-xs">
                <span className={`px-2 py-0.5 rounded-full ${blog.status === 'published' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-700 text-slate-300'}`}>
                  {blog.status}
                </span>
                <span className="text-amber-400">{blog.category || 'BrajMart'}</span>
              </div>
              <div className="text-white font-semibold">{blog.title}</div>
              <div className="text-xs text-slate-400 line-clamp-2">{blog.excerpt}</div>
              <div className="text-xs text-slate-500">Slug: {blog.slug}</div>
            </div>
            <div className="flex flex-wrap gap-2 p-4 pt-0">
              <button onClick={() => setEditing(blog)} className="px-3 py-1.5 rounded-lg border border-slate-700 text-white text-xs">Edit</button>
              <button onClick={() => toggleStatus(blog)} className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-200 text-xs">
                {blog.status === 'published' ? 'Set Draft' : 'Publish'}
              </button>
              <Link to={`/blog/${blog.slug}`} className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-200 text-xs">View</Link>
              <button onClick={() => remove(blog.id)} className="px-3 py-1.5 rounded-lg border border-red-500 text-red-300 text-xs inline-flex items-center gap-1">
                <Trash2 size={12} /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Field = ({
  label,
  value,
  onChange,
  type = 'text',
  rows = 3,
  options = [],
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: 'text' | 'number' | 'textarea' | 'select';
  rows?: number;
  options?: string[];
}) => (
  <div>
    <label className="block text-sm text-slate-300 mb-1">{label}</label>
    {type === 'textarea' ? (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none"
      />
    ) : type === 'select' ? (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    ) : (
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none"
      />
    )}
  </div>
);

export default AdminBlogs;
