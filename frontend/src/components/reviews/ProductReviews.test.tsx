import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProductReviews from './ProductReviews';
import { fetchProductReviews, fetchReviewEligibility } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  fetchProductReviews: vi.fn(), fetchReviewEligibility: vi.fn(), createReview: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const response = {
  summary: { averageRating: 5, reviewCount: 1, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 } },
  page: 1, limit: 20, totalPages: 1,
  reviews: [{ id: '9', productId: '505', rating: 5, title: 'Good quality', body: 'Arrived in excellent condition.', customerName: 'Test C.', isVerifiedPurchase: true, status: 'APPROVED', createdAt: '2026-11-01T10:00:00Z' }],
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchProductReviews).mockResolvedValue(response);
  vi.mocked(fetchReviewEligibility).mockResolvedValue({ canReview: true, isVerifiedPurchase: false });
});
afterEach(cleanup);

describe('product reviews', () => {
  it('loads and displays approved reviews for the selected product', async () => {
    render(<ProductReviews productId="505" />);
    expect(await screen.findByText('Arrived in excellent condition.')).toBeInTheDocument();
    expect(screen.getByText('Verified Purchase')).toBeInTheDocument();
    expect(fetchProductReviews).toHaveBeenCalledWith('505', { page: 1, limit: 20, sort: 'recent' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a retryable failure rather than claiming no reviews exist', async () => {
    vi.mocked(fetchProductReviews).mockRejectedValueOnce(new Error('Failed to load reviews'));
    render(<ProductReviews productId="505" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load reviews');
    expect(screen.queryByText('No approved reviews yet.')).not.toBeInTheDocument();
    expect(screen.queryByText('No reviews yet')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading reviews' }));
    expect(await screen.findByText('Arrived in excellent condition.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(fetchProductReviews).toHaveBeenCalledTimes(2);
  });

  it('keeps sort selection when reloading reviews', async () => {
    render(<ProductReviews productId="505" />);
    await screen.findByText('Arrived in excellent condition.');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'highest' } });
    await waitFor(() => expect(fetchProductReviews).toHaveBeenLastCalledWith('505', { page: 1, limit: 20, sort: 'highest' }));
  });
});
