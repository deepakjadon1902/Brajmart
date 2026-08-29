import { useEffect, useState } from 'react';
import { CheckCircle2, EyeOff, RefreshCw, Search, XCircle } from 'lucide-react';
import { AdminReview, fetchAdminReviews, updateReviewStatus } from '@/lib/api';
import StarRating from '@/components/reviews/StarRating';
import { toast } from 'sonner';

const statuses = ['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'HIDDEN'];

const statusClass: Record<string, string> = {
  PENDING: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  APPROVED: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  REJECTED: 'border-red-500/30 bg-red-500/10 text-red-300',
  HIDDEN: 'border-slate-600 bg-slate-800 text-slate-300',
};

const formatDate = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
};

const AdminReviews = () => {
  const [items, setItems] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('PENDING');
  const [rating, setRating] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = async (nextPage = page) => {
    setRefreshing(true);
    try {
      const data = await fetchAdminReviews({
        page: nextPage,
        limit: 25,
        q: query,
        status: status === 'ALL' ? '' : status,
        rating,
      });
      setItems(data.items);
      setTotalPages(data.totalPages);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load reviews');
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
  }, [query, status, rating]);

  useEffect(() => {
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const moderate = async (review: AdminReview, nextStatus: 'APPROVED' | 'REJECTED' | 'HIDDEN' | 'PENDING') => {
    const reason = nextStatus === 'APPROVED'
      ? 'Approved for public display'
      : window.prompt(`${nextStatus === 'PENDING' ? 'Restore' : nextStatus.toLowerCase()} this review? Add a reason:`)?.trim();
    if (nextStatus !== 'APPROVED' && !reason) return;
    if (nextStatus === 'APPROVED' && !window.confirm('Approve this review? It will become public and contribute to the product rating.')) return;
    try {
      await updateReviewStatus(review.id, { status: nextStatus, reason });
      toast.success(`Review ${nextStatus.toLowerCase()}`);
      await load(page);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update review');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">Review Trust</p>
          <h1 className="mt-1 text-2xl font-bold text-white">Review Moderation</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">Approve real customer feedback. Approved reviews become public and update product ratings; only delivered-order reviews show as verified purchases.</p>
        </div>
        <button type="button" onClick={() => load(page)} disabled={refreshing} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900">
        <div className="grid gap-2 border-b border-slate-800 p-4 md:grid-cols-[minmax(0,1fr)_180px_160px]">
          <label className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search review, product, customer" className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 text-sm text-white outline-none focus:border-amber-400" />
          </label>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-amber-400">
            {statuses.map((item) => <option key={item} value={item}>{item === 'ALL' ? 'All status' : item}</option>)}
          </select>
          <select value={rating} onChange={(event) => setRating(event.target.value)} className="h-10 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-amber-400">
            <option value="">All ratings</option>
            {[5, 4, 3, 2, 1].map((item) => <option key={item} value={item}>{item} stars</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-left text-sm">
            <thead className="bg-slate-950 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Review</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {items.map((review) => (
                <tr key={review.id} className="align-top text-slate-300 hover:bg-slate-800/50">
                  <td className="max-w-[380px] px-4 py-3">
                    <StarRating value={review.rating} readonly size={14} />
                    {review.title && <p className="mt-1 font-semibold text-white">{review.title}</p>}
                    <p className="mt-1 line-clamp-3 text-sm text-slate-400">{review.body}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img src={review.productImage || '/placeholder.svg'} alt="" className="h-12 w-12 rounded-lg border border-slate-700 object-cover" />
                      <div>
                        <p className="font-medium text-white">{review.productName || 'Product'}</p>
                        <p className="text-xs text-slate-500">{review.orderId ? `Order #${review.orderId}` : 'Open product feedback'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-white">{review.customerName}</p>
                    <p className="text-xs text-slate-500">{review.customerEmail}</p>
                    <p className={`mt-1 text-xs font-semibold ${review.isVerifiedPurchase ? 'text-emerald-300' : 'text-amber-300'}`}>
                      {review.isVerifiedPurchase ? 'Verified Purchase' : review.reviewerType === 'GUEST' ? 'Guest Review' : 'Open Review'}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass[review.status] || statusClass.PENDING}`}>{review.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatDate(review.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {review.status !== 'APPROVED' && <button type="button" onClick={() => moderate(review, 'APPROVED')} className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/10"><CheckCircle2 size={13} /> Approve</button>}
                      {review.status !== 'REJECTED' && <button type="button" onClick={() => moderate(review, 'REJECTED')} className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 px-2.5 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/10"><XCircle size={13} /> Reject</button>}
                      {review.status !== 'HIDDEN' && <button type="button" onClick={() => moderate(review, 'HIDDEN')} className="inline-flex items-center gap-1 rounded-lg border border-slate-600 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"><EyeOff size={13} /> Hide</button>}
                      {review.status !== 'PENDING' && <button type="button" onClick={() => moderate(review, 'PENDING')} className="rounded-lg border border-slate-600 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800">Restore</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !items.length && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">No reviews found.</td></tr>
              )}
              {loading && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">Loading reviews...</td></tr>
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
    </div>
  );
};

export default AdminReviews;
