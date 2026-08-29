import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, MessageSquare, RefreshCw } from 'lucide-react';
import { createReview, fetchProductReviews, fetchReviewEligibility, PublicReview, ReviewSummary } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import StarRating from './StarRating';

const emptySummary: ReviewSummary = {
  averageRating: 0,
  reviewCount: 0,
  distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
};

const formatDate = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

type ProductReviewsProps = {
  productId: string;
};

const ProductReviews = ({ productId }: ProductReviewsProps) => {
  const { isAuthenticated } = useAuthStore();
  const [summary, setSummary] = useState<ReviewSummary>(emptySummary);
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [eligibility, setEligibility] = useState<{ canReview: boolean; orderId?: string; reason?: string } | null>(null);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async (nextPage = page) => {
    setLoading(true);
    try {
      const data = await fetchProductReviews(productId, { page: nextPage, limit: 5, sort });
      setSummary(data.summary);
      setReviews(data.reviews);
      setTotalPages(data.totalPages);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, sort]);

  useEffect(() => {
    if (!isAuthenticated) {
      setEligibility(null);
      return;
    }
    fetchReviewEligibility(productId)
      .then(setEligibility)
      .catch(() => setEligibility({ canReview: false, reason: 'Review eligibility could not be checked.' }));
  }, [isAuthenticated, productId]);

  const distributionRows = useMemo(() => [5, 4, 3, 2, 1].map((star) => {
    const count = Number(summary.distribution[star as 1 | 2 | 3 | 4 | 5] || 0);
    const percent = summary.reviewCount > 0 ? Math.round((count / summary.reviewCount) * 100) : 0;
    return { star, count, percent };
  }), [summary]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!eligibility?.canReview) return;
    setSubmitting(true);
    try {
      const result = await createReview({ productId, orderId: eligibility.orderId, rating, title, body });
      toast.success(result.message || 'Your review is awaiting moderation.');
      setTitle('');
      setBody('');
      setEligibility({ canReview: false, reason: 'Your review is awaiting moderation.' });
      await load(1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="reviews" className="mt-12 border-t border-border pt-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Verified Reviews</p>
          <h2 className="font-playfair text-2xl font-bold text-foreground">Reviews</h2>
        </div>
        <select value={sort} onChange={(event) => setSort(event.target.value)} className="h-10 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-saffron">
          <option value="recent">Most recent</option>
          <option value="highest">Highest rating</option>
          <option value="lowest">Lowest rating</option>
        </select>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="rounded-lg border border-border bg-card p-4">
          {summary.reviewCount > 0 ? (
            <>
              <div className="flex items-end gap-2">
                <span className="font-sans text-4xl font-bold text-foreground">{summary.averageRating.toFixed(1)}</span>
                <span className="pb-1 text-sm text-muted-foreground">/ 5</span>
              </div>
              <div className="mt-2"><StarRating value={summary.averageRating} readonly /></div>
              <p className="mt-1 text-sm text-muted-foreground">{summary.reviewCount.toLocaleString('en-IN')} approved reviews</p>
              <div className="mt-4 space-y-2">
                {distributionRows.map((row) => (
                  <div key={row.star} className="grid grid-cols-[42px_minmax(0,1fr)_34px] items-center gap-2 text-xs text-muted-foreground">
                    <span>{row.star} star</span>
                    <span className="h-2 overflow-hidden rounded-full bg-muted">
                      <span className="block h-full rounded-full bg-gold" style={{ width: `${row.percent}%` }} />
                    </span>
                    <span className="text-right">{row.count}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="py-4 text-center">
              <MessageSquare size={28} className="mx-auto text-gold" />
              <h3 className="mt-3 font-semibold text-foreground">No reviews yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">Be the first eligible customer to review this product.</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {isAuthenticated && eligibility?.canReview && (
            <form onSubmit={submit} className="rounded-lg border border-border bg-card p-4">
              <h3 className="font-semibold text-foreground">Write a review</h3>
              <p className="mt-1 text-xs text-muted-foreground">Your review will be checked before it appears publicly.</p>
              <div className="mt-3"><StarRating value={rating} onChange={setRating} label="Choose review rating" /></div>
              <input value={title} onChange={(event) => setTitle(event.target.value.slice(0, 120))} placeholder="Short title optional" className="mt-3 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-saffron" />
              <textarea value={body} onChange={(event) => setBody(event.target.value.slice(0, 2000))} required minLength={10} placeholder="Share your experience with this product" className="mt-3 min-h-28 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-saffron" />
              <button type="submit" disabled={submitting} className="mt-3 inline-flex min-h-11 items-center justify-center rounded-lg bg-maroon px-5 text-sm font-bold text-white hover:bg-saffron disabled:opacity-60">
                {submitting ? 'Submitting...' : 'Submit Review'}
              </button>
            </form>
          )}
          {isAuthenticated && eligibility && !eligibility.canReview && (
            <p className="rounded-lg border border-border bg-brand-soft p-3 text-sm text-muted-foreground">{eligibility.reason}</p>
          )}
          {!isAuthenticated && (
            <p className="rounded-lg border border-border bg-brand-soft p-3 text-sm text-muted-foreground">Sign in after a delivered purchase to write a verified review.</p>
          )}

          {loading ? (
            <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
              <RefreshCw size={16} className="mr-2 inline animate-spin" /> Loading reviews...
            </div>
          ) : reviews.length > 0 ? reviews.map((review) => (
            <article key={review.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <StarRating value={review.rating} readonly size={15} />
                {review.isVerifiedPurchase && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-tulsi/10 px-2 py-0.5 text-xs font-semibold text-tulsi">
                    <CheckCircle2 size={12} /> Verified Purchase
                  </span>
                )}
              </div>
              {review.title && <h3 className="mt-2 font-semibold text-foreground">{review.title}</h3>}
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{review.body}</p>
              <p className="mt-3 text-xs text-muted-foreground">{review.customerName} {formatDate(review.createdAt) ? `- ${formatDate(review.createdAt)}` : ''}</p>
            </article>
          )) : (
            <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">No approved reviews yet.</div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button type="button" disabled={page <= 1} onClick={() => { const next = Math.max(1, page - 1); setPage(next); load(next); }} className="rounded-lg border border-border px-3 py-2 disabled:opacity-50">Previous</button>
                <button type="button" disabled={page >= totalPages} onClick={() => { const next = Math.min(totalPages, page + 1); setPage(next); load(next); }} className="rounded-lg border border-border px-3 py-2 disabled:opacity-50">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default ProductReviews;
