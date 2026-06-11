const API_BASE =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== 'undefined' ? `${window.location.origin}/api` : 'http://localhost:5000/api');
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
  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method || 'GET',
    cache: options.cache,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const resClone = res.clone();
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await resClone.text().catch(() => '');
    throw new Error(text.trim() || `Expected JSON response (${res.status})`);
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

export const createPayuOrder = (payload: {
  amount: number;
  method: 'upi' | 'card';
  order: Record<string, unknown>;
  customer: { name: string; email: string; phone?: string };
}) =>
  getJson<{
    actionUrl: string;
    fields: Record<string, string>;
  }>('/payu/create-order', { method: 'POST', body: payload });

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
export const createProduct = (payload: Record<string, unknown>) =>
  getJson('/products', { method: 'POST', body: payload });
export const updateProduct = (id: string, payload: Record<string, unknown>) =>
  getJson(`/products/${id}`, { method: 'PUT', body: payload });
export const deleteProduct = (id: string) =>
  getJson(`/products/${id}`, { method: 'DELETE' });

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

// Orders
export const fetchOrders = () => getJson<any[]>('/orders');
export const fetchMyOrders = () => getJson<any[]>('/orders/my');
export const updateOrderStatus = (id: string, payload: { status: string; note?: string; shippingService?: string; trackingId?: string | null }) =>
  getJson<Record<string, any>>(`/orders/${id}/status`, { method: 'PUT', body: payload });
export const createOrder = (payload: Record<string, unknown>) =>
  getJson('/orders', { method: 'POST', body: payload });
export const trackOrder = (orderId: string | number) =>
  getJson(`/orders/track/${orderId}`);
export const trackOrderById = (trackingId: string) =>
  getJson(`/orders/track-by-id/${trackingId}`);

// Payments
export const fetchPayments = () => getJson('/payments');
export const updatePaymentStatus = (id: string, status: string) =>
  getJson(`/payments/${id}`, { method: 'PUT', body: { status } });
export const createPayment = (payload: Record<string, unknown>) =>
  getJson('/payments', { method: 'POST', body: payload });

// Users
export const fetchUsers = () => getJson('/users');
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
export const updateCart = (items: any[]) =>
  getJson('/cart', { method: 'PUT', body: { items } });
export const clearCartApi = () => getJson('/cart', { method: 'DELETE' });

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
