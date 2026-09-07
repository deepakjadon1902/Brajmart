import type { Product } from '@/types/product';

const normalizeApiBase = (value: unknown) => String(value || '').trim().replace(/\/$/, '');

const isLocalHostname = (hostname: string) =>
  ['localhost', '127.0.0.1', '::1'].includes(hostname) || hostname.endsWith('.localhost');

const isLocalApiBase = (value: string) => {
  try {
    return isLocalHostname(new URL(value).hostname);
  } catch {
    return false;
  }
};

const resolveApiBase = () => {
  const configured = normalizeApiBase(import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL);
  if (typeof window === 'undefined') return configured || 'http://localhost:5001/api';

  const runtimeOrigin = window.location.origin;
  const runtimeIsLocal = isLocalHostname(window.location.hostname);

  if (configured && (!isLocalApiBase(configured) || runtimeIsLocal)) return configured;
  return `${runtimeOrigin}/api`;
};

const API_BASE = resolveApiBase();
let memoryToken = '';

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  cache?: RequestCache;
};

export const getAuthToken = () => {
  if (typeof window === 'undefined') return '';
  if (memoryToken) return memoryToken;
  const direct = localStorage.getItem('brajmart-token');
  if (direct) return direct;

  const tryParse = (key: string) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return '';
      const parsed = JSON.parse(raw);
      return parsed?.state?.token || '';
    } catch {
      return '';
    }
  };

  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  const preferAdmin = path.startsWith('/admin');
  if (preferAdmin) {
    return tryParse('brajmart-admin') || tryParse('brajmart-auth') || memoryToken || '';
  }
  return tryParse('brajmart-auth') || tryParse('brajmart-admin') || memoryToken || '';
};

const getJson = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const token = getAuthToken();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: options.method || 'GET',
      cache: options.cache,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    throw new Error(
      `Cannot reach BrajMart API at ${API_BASE}. Please check the production API URL/CORS configuration.${message ? ` (${message})` : ''}`
    );
  }

  const resClone = res.clone();
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await resClone.text().catch(() => '');
    const cleaned = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const missingRoute = /cannot\s+(get|post|put|delete)\s+\/api\//i.test(cleaned);
    throw new Error(
      missingRoute
        ? 'Backend API is not updated yet. Please redeploy the backend service and try again.'
        : cleaned || `Expected JSON response (${res.status})`
    );
  }
  const data = await res.json().catch(async () => {
    const text = await resClone.text().catch(() => '');
    return { message: text || '' };
  });
  if (!res.ok) {
    const maybe = data as { message?: unknown } | null | undefined;
    const rawMessage = typeof maybe?.message === 'string' ? maybe.message : '';
    const message = rawMessage.trim() ? rawMessage.trim() : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
};

export const fetchPublicSettings = (opts?: { fresh?: boolean }) =>
  getJson<Record<string, any>>(`/settings${opts?.fresh ? '?fresh=1' : ''}`, { cache: opts?.fresh ? 'no-store' : 'default' });

export const updatePublicSettings = (payload: Record<string, unknown>) =>
  getJson<Record<string, any>>('/settings', { method: 'PUT', body: payload });
export const sendTestEmail = (to: string) =>
  getJson<Record<string, any>>('/settings/test-email', { method: 'POST', body: { to } });

// Auth
export const registerUser = (payload: { name: string; email: string; password: string }) =>
  getJson('/auth/register', { method: 'POST', body: payload });
export const loginUser = (payload: { email: string; password: string }) =>
  getJson('/auth/login', { method: 'POST', body: payload });
export const loginWithGoogleCredential = (credential: string) =>
  getJson('/auth/google/token', { method: 'POST', body: { credential } });
export const adminLogin = (payload: { email: string; password: string }) =>
  getJson('/auth/admin-login', { method: 'POST', body: payload });
export const verifyEmail = (token: string) =>
  getJson(`/auth/verify?token=${encodeURIComponent(token)}`);

export const fetchMe = () => getJson('/auth/me');

export const verifyOtp = (payload: { email: string; otp: string }) =>
  getJson('/auth/verify-otp', { method: 'POST', body: payload });

export const resendOtp = (payload: { email: string }) =>
  getJson('/auth/resend-otp', { method: 'POST', body: payload });

export const requestPasswordResetOtp = (payload: { email: string }) =>
  getJson('/auth/forgot-password/request', { method: 'POST', body: payload });

export const verifyPasswordResetOtp = (payload: { email: string; otp: string }) =>
  getJson('/auth/forgot-password/verify', { method: 'POST', body: payload });

export const createRazorpayOrder = (payload: {
  amount: number;
  idempotencyKey?: string;
  order: Record<string, unknown>;
  customer: { name: string; email: string; phone?: string };
}) =>
  getJson<{
    keyId: string;
    orderId: string;
    statusToken: string;
    amount: number;
    currency: string;
    name: string;
    description: string;
    prefill: { name: string; email: string; contact?: string };
  }>('/razorpay/create-order', { method: 'POST', body: payload });

export const verifyRazorpayPayment = (payload: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}) =>
  getJson<{ ok: boolean; orderId: number; paymentId: string; status: string }>('/razorpay/verify', {
    method: 'POST',
    body: payload,
  });

export const reportRazorpayPaymentFailed = (payload: {
  razorpay_order_id: string;
  razorpay_payment_id?: string;
  customer_email: string;
  reason?: string;
}) =>
  getJson<{ ok: boolean; orderId: number; paymentId: string; status: string }>('/razorpay/failed', {
    method: 'POST',
    body: payload,
  });

export const fetchPaymentStatus = (token: string) =>
  getJson(`/payments/status/${token}`);

export const reconcilePayments = () =>
  getJson('/payments/reconcile', { method: 'POST' });

export const getApiBase = () => API_BASE;
export const setAuthToken = (token: string) => {
  if (typeof window === 'undefined') return;
  memoryToken = token || '';
  try {
    if (token) localStorage.setItem('brajmart-token', token);
    else localStorage.removeItem('brajmart-token');
  } catch {
    // ignore storage quota errors; memory token still works for this session
  }
};

// Products
export const fetchProducts = (opts?: { fresh?: boolean }) => getJson(`/products${opts?.fresh ? '?fresh=1' : ''}`, { cache: opts?.fresh ? 'no-store' : 'default' });
export const fetchProductBySlug = (slug: string) => getJson(`/products/${slug}`);
export const fetchProductsSchema = () => getJson('/products/schema');
export type ProductAuditReport = {
  generatedAt: string;
  totalProducts: number;
  productsWithIssues: number;
  errorCount: number;
  warningCount: number;
  issuesByCode: Record<string, number>;
  items: Array<{
    id: string;
    name: string;
    slug: string;
    category: string;
    price: number | null;
    originalPrice: number | null;
    rating: number | null;
    reviewCount: number | null;
    inStock: boolean;
    stockQuantity: number | null;
    reservedQuantity: number | null;
    lowStockThreshold: number | null;
    sku: string;
    description?: string;
    metaTitle?: string;
    metaDescription?: string;
    issueCount: number;
    issues: Array<{ code: string; field: string; severity: 'error' | 'warning'; message: string; currentValue?: unknown; recommendedCorrection?: string }>;
  }>;
};
export const fetchProductAudit = () =>
  getJson<ProductAuditReport>(`/products/audit?fresh=${Date.now()}`, { cache: 'no-store' });
export const createProduct = (payload: Record<string, unknown>) =>
  getJson('/products', { method: 'POST', body: payload });
export const updateProduct = (id: string, payload: Record<string, unknown>) =>
  getJson(`/products/${id}`, { method: 'PUT', body: payload });
export const deleteProduct = (id: string) =>
  getJson(`/products/${id}`, { method: 'DELETE' });

export type PublicCollection = {
  id: string;
  slug: string;
  name: string;
  description: string;
  purposeKey?: string;
  sortOrder?: number;
  isActive?: boolean;
};

export const fetchCollections = () => getJson<PublicCollection[]>('/collections');
export const fetchCollectionProducts = (slug: string) =>
  getJson<{ collection: PublicCollection; products: any[] }>(`/collections/${encodeURIComponent(slug)}/products`);

// Categories
export const fetchCategories = (opts?: { fresh?: boolean }) => getJson(`/categories${opts?.fresh ? '?fresh=1' : ''}`, { cache: opts?.fresh ? 'no-store' : 'default' });
export const createCategory = (payload: Record<string, unknown>) =>
  getJson('/categories', { method: 'POST', body: payload });
export const updateCategory = (id: string, payload: Record<string, unknown>) =>
  getJson(`/categories/${id}`, { method: 'PUT', body: payload });
export const deleteCategory = (id: string) =>
  getJson(`/categories/${id}`, { method: 'DELETE' });

// Subcategories
export const createSubcategory = (categoryId: string, payload: Record<string, unknown>) =>
  getJson(`/categories/${categoryId}/subcategories`, { method: 'POST', body: payload });
export const updateSubcategory = (subId: string, payload: Record<string, unknown>) =>
  getJson(`/categories/subcategories/${subId}`, { method: 'PUT', body: payload });
export const deleteSubcategory = (subId: string) =>
  getJson(`/categories/subcategories/${subId}`, { method: 'DELETE' });

export type InventoryProduct = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  category: string;
  image: string;
  inStock: boolean;
  stockQuantity: number | null;
  reservedQuantity: number;
  availableQuantity: number | null;
  lowStockThreshold: number;
  status: 'HEALTHY' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'UNMANAGED' | 'INVALID';
  updatedAt?: string;
};

export type InventoryTransaction = {
  id: string;
  type: string;
  quantity: number;
  previousQuantity: number | null;
  newQuantity: number | null;
  previousReserved: number | null;
  newReserved: number | null;
  reason: string;
  createdBy: string;
  orderId: string | null;
  orderStatus: string | null;
  createdAt?: string;
};

export type InventoryAuditIssue = {
  code: string;
  field: string;
  severity: 'error' | 'warning';
  message: string;
  currentValue?: unknown;
  recommendedCorrection?: string;
};

export type InventoryAuditItem = {
  id: string;
  name: string;
  slug: string;
  category: string;
  price: number | null;
  originalPrice: number | null;
  rating: number | null;
  reviewCount: number | null;
  inStock: boolean;
  stockQuantity: number | null;
  reservedQuantity: number | null;
  lowStockThreshold: number | null;
  sku: string;
  description?: string;
  metaTitle?: string;
  metaDescription?: string;
  issueCount: number;
  issues: InventoryAuditIssue[];
};

export const fetchInventoryDashboard = () =>
  getJson<{
    generatedAt: string;
    totals: { totalProducts: number; inStock: number; lowStock: number; outOfStock: number; invalid: number; reservedStock: number };
    recentlyUpdated: InventoryProduct[];
    alerts: InventoryProduct[];
  }>('/inventory/dashboard', { cache: 'no-store' });

export const fetchInventoryProducts = (params?: Record<string, string | number | boolean | undefined | null>) =>
  getJson<{ page: number; limit: number; total: number; totalPages: number; items: InventoryProduct[] }>(
    `/inventory/products${queryString(params)}`,
    { cache: 'no-store' }
  );

export const fetchInventoryHistory = (productId: string) =>
  getJson<{ product: InventoryProduct; transactions: InventoryTransaction[] }>(
    `/inventory/products/${encodeURIComponent(productId)}/history`,
    { cache: 'no-store' }
  );

export const adjustInventoryStock = (
  productId: string,
  payload: { type: 'INCREASE' | 'DECREASE' | 'SET'; quantity: number; reason: string; note?: string }
) => getJson<{ ok: boolean; product: InventoryProduct }>(
  `/inventory/products/${encodeURIComponent(productId)}/adjust`,
  { method: 'POST', body: payload }
);

export const fetchInventoryAudit = () =>
  getJson<{
    generatedAt: string;
    totalProducts: number;
    productsWithIssues: number;
    errorCount: number;
    warningCount: number;
    issuesByCode: Record<string, number>;
    items: InventoryAuditItem[];
  }>('/inventory/audit', { cache: 'no-store' });

export const saveInventoryProductCorrection = (productId: string, payload: Record<string, unknown>) =>
  getJson<{ ok: boolean; product: InventoryProduct }>(
    `/inventory/products/${encodeURIComponent(productId)}/correction`,
    { method: 'PUT', body: payload }
  );

export type AdminAuditLog = {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  reason: string;
  metadata: unknown;
  createdAt?: string;
};

export const fetchAdminAuditLogs = (params?: Record<string, string | number | boolean | undefined | null>) =>
  getJson<{ page: number; limit: number; total: number; totalPages: number; items: AdminAuditLog[] }>(
    `/admin/audit-logs${queryString(params)}`,
    { cache: 'no-store' }
  );

export type ReviewSummary = {
  averageRating: number;
  reviewCount: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
};

export type PublicReview = {
  id: string;
  productId: string;
  rating: number;
  title: string;
  body: string;
  status: string;
  isVerifiedPurchase: boolean;
  reviewerType?: 'USER' | 'GUEST';
  customerName: string;
  createdAt?: string;
};

export type AdminReview = PublicReview & {
  userId: string;
  orderId: string;
  productName: string;
  productSlug: string;
  productImage: string;
  customerEmail: string;
  helpfulCount: number;
  reportCount: number;
  approvedAt?: string;
  rejectedAt?: string;
  hiddenAt?: string;
  rejectionReason: string;
  updatedAt?: string;
};

export const fetchProductReviews = (productId: string, params?: Record<string, string | number | boolean | undefined | null>) =>
  getJson<{ summary: ReviewSummary; page: number; limit: number; totalPages: number; reviews: PublicReview[] }>(
    `/reviews/products/${encodeURIComponent(productId)}${queryString(params)}`,
    { cache: 'no-store' }
  );

export const fetchReviewEligibility = (productId: string, params?: { orderId?: string }) =>
  getJson<{ canReview: boolean; orderId?: string; isVerifiedPurchase?: boolean; reason?: string; existingReviewId?: string; status?: string }>(
    `/reviews/eligibility/${encodeURIComponent(productId)}${queryString(params)}`,
    { cache: 'no-store' }
  );

export const createReview = (payload: { productId: string; orderId?: string; rating: number; title?: string; body: string; guestName?: string; guestEmail?: string }) =>
  getJson<{ message: string; review: PublicReview }>('/reviews', { method: 'POST', body: payload });

export const fetchAdminReviews = (params?: Record<string, string | number | boolean | undefined | null>) =>
  getJson<{ page: number; limit: number; total: number; totalPages: number; items: AdminReview[] }>(
    `/reviews/admin${queryString(params)}`,
    { cache: 'no-store' }
  );

export const updateReviewStatus = (id: string, payload: { status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'HIDDEN'; reason?: string }) =>
  getJson<{ ok: boolean; review: AdminReview }>(`/reviews/admin/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: payload,
  });

const queryString = (params?: Record<string, string | number | boolean | undefined | null>) => {
  const searchParams = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      searchParams.set(key, String(value).trim());
    }
  });
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
};

// Orders
export const fetchOrders = (opts?: { search?: string }) => getJson<any[]>(`/orders${queryString({ search: opts?.search })}`);
export const fetchPendingPaymentOrders = (opts?: { search?: string }) => getJson<Record<string, unknown>[]>(`/orders/admin/pending-payments${queryString({ search: opts?.search })}`);
export const fetchMyOrders = () => getJson<any[]>('/orders/my');
export const updateOrderStatus = (id: string, payload: { status: string; note?: string; shippingService?: string; trackingId?: string | null }) =>
  getJson<Record<string, any>>(`/orders/${id}/status`, { method: 'PUT', body: payload });
export const createOrder = (payload: Record<string, unknown>) =>
  getJson('/orders', { method: 'POST', body: payload });
export const trackOrder = (orderId: string | number) =>
  getJson(`/orders/track/${orderId}`);
export const trackOrderById = (trackingId: string) =>
  getJson(`/orders/track-by-id/${trackingId}`);
export const trackDeliveryServiceOrder = (lookup: string | number) =>
  getJson(`/orders/delivery-service/track/${encodeURIComponent(String(lookup))}`);
export const adminTrackDeliveryServiceOrder = (lookup: string | number) =>
  getJson(`/orders/admin/delivery-service/track/${encodeURIComponent(String(lookup))}`);
export const checkDeliveryServicePincode = (payload: { desPincode: string }) =>
  getJson('/orders/delivery-service/pincode', { method: 'POST', body: payload });
export const adminCheckDeliveryServicePincode = (payload: { desPincode: string }) =>
  getJson('/orders/admin/delivery-service/pincode', { method: 'POST', body: payload });

export type AdminCodConfig = {
  products: Array<{ id: string; name: string; slug: string; image: string; category: string; categoryId?: number; codEnabled: boolean | null }>;
  categories: Array<{ id: string; name: string; icon: string; color: string; codEnabled: boolean }>;
  pincodes: Array<{ id: string; pincode: string; deliveryEnabled: boolean; codEnabled: boolean; partnerName: string; note: string }>;
};
export const fetchAdminCodConfig = () =>
  getJson<AdminCodConfig>('/orders/admin/cod-config', { cache: 'no-store' });
export const updateAdminCodConfig = (payload: { productIds?: string[]; categoryIds?: string[]; enabled?: boolean; inherit?: boolean }) =>
  getJson<AdminCodConfig>('/orders/admin/cod-config', { method: 'PUT', body: payload });
export const saveAdminCodPincodes = (payload: { pincodes: string; deliveryEnabled: boolean; codEnabled: boolean; partnerName?: string; note?: string }) =>
  getJson<AdminCodConfig>('/orders/admin/cod-config/pincodes', { method: 'POST', body: payload });
export const deleteAdminCodPincode = (id: string) =>
  getJson<AdminCodConfig>(`/orders/admin/cod-config/pincodes/${encodeURIComponent(id)}`, { method: 'DELETE' });

// Payments
export const fetchPayments = () => getJson('/payments');
export const confirmPendingPayment = (orderId: string | number, payload?: { transactionId?: string; note?: string }) =>
  getJson(`/payments/admin/confirm-pending/${encodeURIComponent(String(orderId))}`, { method: 'POST', body: payload || {} });
export const markCodOrderPaid = (orderId: string | number, payload?: { transactionId?: string; note?: string }) =>
  getJson(`/payments/admin/cod-paid/${encodeURIComponent(String(orderId))}`, { method: 'POST', body: payload || {} });
export const updatePaymentStatus = (id: string, status: string) =>
  getJson(`/payments/${id}`, { method: 'PUT', body: { status } });
export const createPayment = (payload: Record<string, unknown>) =>
  getJson('/payments', { method: 'POST', body: payload });

export type AnalyticsPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export type AnalyticsReport = {
  period: AnalyticsPeriod;
  generatedAt: string;
  range: {
    label: string;
    start: string;
    end: string;
  };
  totals: {
    periodRevenue: number;
    previousRevenue: number;
    revenueChange: number;
    periodOrders: number;
    deliveredOrders: number;
    cancelledOrders: number;
    averageOrderValue: number;
    totalRevenue: number;
    paidSalesCount: number;
    onlineRevenue: number;
    codRevenue: number;
    completionRate: number;
  };
  buckets: Array<{
    key: string;
    label: string;
    rangeLabel: string;
    start: string;
    end: string;
    revenue: number;
    orders: number;
  }>;
  breakdowns: {
    categories: Array<{ category: string; count: number }>;
    statuses: Record<string, number>;
    payments: Record<string, number>;
  };
};

export const fetchAnalyticsReport = (period: AnalyticsPeriod) =>
  getJson<AnalyticsReport>(`/analytics?period=${encodeURIComponent(period)}&fresh=${Date.now()}`, { cache: 'no-store' });

// Coupons
export const fetchCoupons = () => getJson('/coupons');
export const createCoupon = (payload: Record<string, unknown>) =>
  getJson('/coupons', { method: 'POST', body: payload });
export const updateCoupon = (id: string, payload: Record<string, unknown>) =>
  getJson(`/coupons/${id}`, { method: 'PUT', body: payload });
export const deleteCoupon = (id: string) =>
  getJson(`/coupons/${id}`, { method: 'DELETE' });
export const validateCoupon = (payload: { code: string; items: unknown[] }) =>
  getJson('/coupons/validate', { method: 'POST', body: payload });

// Users
export const fetchUsers = (opts?: { search?: string }) => getJson(`/users${queryString({ search: opts?.search })}`);
export const fetchUsersCartFavorites = (opts?: { search?: string }) => getJson(`/users/admin/cart-favorites${queryString({ search: opts?.search })}`);
export const updateUserRole = (id: string, role: string) =>
  getJson(`/users/${id}/role`, { method: 'PUT', body: { role } });
export const updateUserStatus = (id: string, status: string) =>
  getJson(`/users/${id}/status`, { method: 'PUT', body: { status } });
export const deleteUser = (id: string) =>
  getJson(`/users/${id}`, { method: 'DELETE' });

export const updateMyProfile = (payload: {
  fullName: string;
  email: string;
  mobile?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
}) => getJson('/users/me', { method: 'PUT', body: payload });

export const updateMyPassword = (payload: { currentPassword?: string; newPassword: string }) =>
  getJson('/users/me/password', { method: 'PUT', body: payload });

// Cart
export const fetchCart = () => getJson('/cart');
export type PersistedProductInterestItem = {
  productId?: string;
  id?: string;
  _id?: string;
  name?: string;
  image?: string;
  price?: number;
  slug?: string;
  category?: string;
  quantity?: number;
  selectedSize?: string;
  selectedPieces?: string;
  selectedAttributes?: Record<string, string>;
  product?: Record<string, unknown>;
};

export const updateCart = (items: PersistedProductInterestItem[]) =>
  getJson('/cart', { method: 'PUT', body: { items } });
export const clearCartApi = () => getJson('/cart', { method: 'DELETE' });
export type CartValidationResponse = {
  items: Array<PersistedProductInterestItem & {
    productId: string;
    requestedQuantity?: number;
    availableQuantity?: number | null;
    originalPrice?: number | null;
    inStock?: boolean;
    codEnabled?: boolean | null;
    categoryCodEnabled?: boolean;
  }>;
  subtotal: number;
  discount: number;
  shipping: number;
  packaging: number;
  codFee: number;
  grandTotal: number;
  currency: string;
  changes: Array<{
    productId: string;
    type: 'price' | 'quantity' | 'stock' | 'unavailable';
    message: string;
    previousPrice?: number;
    currentPrice?: number;
    requestedQuantity?: number;
    currentQuantity?: number;
  }>;
  unavailableItems: Array<{ productId: string; name?: string; reason: string; message: string }>;
  pricingVersion: string;
  validatedAt: string;
};
export const validateCart = (items: PersistedProductInterestItem[]) =>
  getJson<CartValidationResponse>('/cart/validate', { method: 'POST', body: { items } });

// Wishlist
export const fetchWishlist = () => getJson('/wishlist');
export const updateWishlist = (items: PersistedProductInterestItem[]) =>
  getJson('/wishlist', { method: 'PUT', body: { items } });
export const clearWishlistApi = () => getJson('/wishlist', { method: 'DELETE' });

export type RecommendationItem = {
  product: Product;
  type: 'frequently_bought_together' | 'curated_bundle' | 'related_products' | 'popular_fallback';
  sourceType?: 'CO_PURCHASE' | 'SAME_CATEGORY' | 'SIMILAR_PRODUCT' | 'CURATED' | 'RECENTLY_VIEWED' | 'POPULAR' | 'FALLBACK';
  label: string;
  reason?: string;
  confidence?: number;
};

export type RecommendationSection = {
  type: string;
  sourceType?: RecommendationItem['sourceType'];
  title: string;
  items: RecommendationItem[];
};

export type ProductRecommendationsResponse = {
  productId: string;
  sections: RecommendationSection[];
  recommendations: RecommendationItem[];
};

export type CommerceBundle = {
  id: string;
  name: string;
  slug: string;
  sku?: string;
  description: string;
  imageUrl?: string;
  displayLocation: string;
  sortOrder: number;
  isActive: boolean;
  products: Product[];
  productCount: number;
  bundlePrice: number;
  savings: number;
  startsAt?: string;
  endsAt?: string;
  archivedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export const fetchProductRecommendations = (productId: string, limit = 8) =>
  getJson<ProductRecommendationsResponse>(`/recommendations/product/${encodeURIComponent(productId)}?limit=${encodeURIComponent(String(limit))}`);

export const fetchCartRecommendations = (productIds: string[], limit = 8) =>
  getJson<{ productIds: string[]; recommendations: RecommendationItem[] }>('/recommendations/cart', {
    method: 'POST',
    body: { productIds, limit },
  });

export const fetchBundles = (opts?: { location?: string; limit?: number }) =>
  getJson<CommerceBundle[]>(`/bundles${queryString({ location: opts?.location, limit: opts?.limit })}`);

export const fetchAdminBundles = () => getJson<CommerceBundle[]>('/bundles/admin');
export const createAdminBundle = (payload: Record<string, unknown>) =>
  getJson<{ bundle: CommerceBundle | null }>('/bundles/admin', { method: 'POST', body: payload });
export const updateAdminBundle = (id: string, payload: Record<string, unknown>) =>
  getJson<{ bundle: CommerceBundle | null }>(`/bundles/admin/${id}`, { method: 'PUT', body: payload });
export const updateAdminBundleStatus = (id: string, isActive: boolean) =>
  getJson<{ bundle: CommerceBundle | null }>(`/bundles/admin/${id}/status`, { method: 'PATCH', body: { isActive } });
export const deleteAdminBundle = (id: string) =>
  getJson<{ ok: boolean }>(`/bundles/admin/${id}`, { method: 'DELETE' });

export const uploadImage = async (file: File) => {
  const token = getAuthToken();
  const form = new FormData();
  form.append('image', file);
  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = typeof data?.message === 'string' ? data.message : 'Upload failed';
    throw new Error(message);
  }
  return data as { url: string };
};

export const uploadImages = async (files: File[]) => {
  const token = getAuthToken();
  const list = Array.isArray(files) ? files.filter(Boolean) : [];
  if (list.length === 0) return { urls: [] as string[] };

  // Prefer single-request multi upload for speed.
  const form = new FormData();
  for (const f of list) form.append('images', f);

  try {
    const res = await fetch(`${API_BASE}/upload/multiple`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = typeof data?.message === 'string' ? data.message : 'Upload failed';
      throw new Error(message);
    }
    const urls = Array.isArray(data?.urls) ? data.urls.map((u: any) => String(u || '').trim()).filter(Boolean) : [];
    return { urls };
  } catch {
    // Fallback: sequential upload (older backend).
    const urls: string[] = [];
    for (const f of list) {
      const { url } = await uploadImage(f);
      urls.push(url);
    }
    return { urls };
  }
};

// Hero slides
export const fetchHeroSlides = (opts?: { fresh?: boolean }) => getJson(`/hero-slides${opts?.fresh ? '?fresh=1' : ''}`, { cache: opts?.fresh ? 'no-store' : 'default' });
export const createHeroSlide = (payload: Record<string, unknown>) =>
  getJson('/hero-slides', { method: 'POST', body: payload });
export const updateHeroSlide = (id: string, payload: Record<string, unknown>) =>
  getJson(`/hero-slides/${id}`, { method: 'PUT', body: payload });
export const deleteHeroSlide = (id: string) =>
  getJson(`/hero-slides/${id}`, { method: 'DELETE' });

// Blogs
export const fetchBlogs = () => getJson('/blogs');
export const fetchBlogBySlug = (slug: string) => getJson(`/blogs/${slug}`);
export const fetchAdminBlogs = () => getJson('/blogs/admin');
export const fetchAdminBlogBySlug = (slug: string) => getJson(`/blogs/admin/${slug}`);
export const createBlog = (payload: Record<string, unknown>) =>
  getJson('/blogs', { method: 'POST', body: payload });
export const updateBlog = (id: string, payload: Record<string, unknown>) =>
  getJson(`/blogs/${id}`, { method: 'PUT', body: payload });
export const deleteBlog = (id: string) =>
  getJson(`/blogs/${id}`, { method: 'DELETE' });
