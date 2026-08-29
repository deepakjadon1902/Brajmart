import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { AdminAuditLog, fetchAdminAuditLogs } from '@/lib/api';
import { toast } from 'sonner';

const actions = [
  'ALL',
  'PRODUCT_ARCHIVE',
  'PRODUCT_RESTORE',
  'PRODUCT_UPDATE',
  'INVENTORY_ADJUSTMENT',
  'ORDER_STATUS_UPDATE',
  'USER_BLOCK',
  'SETTINGS_UPDATE',
  'BLOG_ARCHIVE',
  'COUPON_ARCHIVE',
];

const entityTypes = ['ALL', 'product', 'order', 'user', 'settings', 'category', 'subcategory', 'blog', 'coupon', 'collection', 'hero_slide'];

const formatDate = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
};

const shortJson = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '-';
  try {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    return text.length > 180 ? `${text.slice(0, 180)}...` : text;
  } catch {
    return '-';
  }
};

const actionTone = (action: string) => {
  if (action.includes('ARCHIVE') || action.includes('DISABLE') || action.includes('BLOCK')) return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  if (action.includes('RESTORE')) return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  if (action.includes('DELETE')) return 'border-red-500/30 bg-red-500/10 text-red-300';
  return 'border-slate-700 bg-slate-950 text-slate-300';
};

const AdminAuditLogs = () => {
  const [items, setItems] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [action, setAction] = useState('ALL');
  const [entityType, setEntityType] = useState('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState<AdminAuditLog | null>(null);

  const load = async (nextPage = page) => {
    setRefreshing(true);
    try {
      const data = await fetchAdminAuditLogs({
        page: nextPage,
        limit: 25,
        q: query,
        action: action === 'ALL' ? '' : action,
        entityType: entityType === 'ALL' ? '' : entityType,
      });
      setItems(data.items);
      setTotalPages(data.totalPages);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load audit logs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(1);
      load(1);
    }, 250);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, action, entityType]);

  useEffect(() => {
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const visibleItems = useMemo(() => (loading ? [] : items), [items, loading]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">Admin Safety</p>
          <h1 className="mt-1 text-2xl font-bold text-white">Audit Logs</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Review sensitive admin changes without exposing passwords, tokens, payment secrets, or private checkout data.
          </p>
        </div>
        <button
          type="button"
          onClick={() => load(page)}
          disabled={refreshing}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-800 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="rounded-lg border border-slate-800 bg-slate-950 p-2 text-amber-300">
              <ShieldCheck size={18} />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-white">Change history</h2>
              <p className="text-xs text-slate-500">Latest protected admin actions first.</p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:w-[720px]">
            <label className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search actor, reason, entity"
                className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 text-sm text-white outline-none focus:border-amber-400"
              />
            </label>
            <select value={action} onChange={(event) => setAction(event.target.value)} className="h-10 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-amber-400">
              {actions.map((item) => <option key={item} value={item}>{item === 'ALL' ? 'All actions' : item}</option>)}
            </select>
            <select value={entityType} onChange={(event) => setEntityType(event.target.value)} className="h-10 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-amber-400">
              {entityTypes.map((item) => <option key={item} value={item}>{item === 'ALL' ? 'All entities' : item}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-left text-sm">
            <thead className="bg-slate-950 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Admin</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {visibleItems.map((item) => (
                <tr key={item.id} className="text-slate-300 hover:bg-slate-800/50">
                  <td className="px-4 py-3 text-xs text-slate-400">{formatDate(item.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${actionTone(item.action)}`}>{item.action}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">{item.entityType}</p>
                    <p className="text-xs text-slate-500">#{item.entityId || '-'}</p>
                  </td>
                  <td className="px-4 py-3">{item.adminEmail || item.adminId || 'Admin'}</td>
                  <td className="max-w-[260px] px-4 py-3 text-slate-400">{item.reason || '-'}</td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => setSelected(item)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-white hover:border-amber-400">
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && !visibleItems.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">No audit logs found.</td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">Loading audit logs...</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-800 p-4 text-sm text-slate-400">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border border-slate-700 px-3 py-1.5 disabled:opacity-40">Previous</button>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded-lg border border-slate-700 px-3 py-1.5 disabled:opacity-40">Next</button>
          </div>
        </div>
      </section>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[86vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">{selected.action}</p>
                <h3 className="mt-1 text-xl font-bold text-white">{selected.entityType} #{selected.entityId || '-'}</h3>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-white hover:bg-slate-800">Close</button>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Before</p>
                <pre className="max-h-72 overflow-auto rounded-lg border border-slate-800 bg-slate-900 p-3 text-xs text-slate-300 whitespace-pre-wrap">{shortJson(selected.before)}</pre>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-slate-500">After</p>
                <pre className="max-h-72 overflow-auto rounded-lg border border-slate-800 bg-slate-900 p-3 text-xs text-slate-300 whitespace-pre-wrap">{shortJson(selected.after)}</pre>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm text-slate-400">
              <span className="font-semibold text-slate-200">Reason:</span> {selected.reason || '-'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAuditLogs;
