const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
let memoryToken = '';

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
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

  return tryParse('brajmart-admin') || tryParse('brajmart-auth') || memoryToken || '';
};

const getJson = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = typeof data?.message === 'string' ? data.message : 'Request failed';
    throw new Error(message);
  }
  return data as T;
};

export const fetchPublicSettings = () =>
  getJson<Record<string, any>>('/settings');

export const updatePublicSettings = (payload: Record<string, unknown>) =>
  getJson<Record<string, any>>('/settings', { method: 'PUT', body: payload });
export const sendTestEmail = (to: string) =>
  getJson<Record<string, any>>('/settings/test-email', { method: 'POST', body: { to } });

// Auth
export const registerUser = (payload: { name: string; email: string; password: string }) =>
  getJson('/auth/register', { method: 'POST', body: payload });
export const loginUser = (payload: { email: string; password: string }) =>
  getJson('/auth/login', { method: 'POST', body: payload });
export const adminLogin = (payload: { email: string; password: string }) =>
  getJson('/auth/admin-login', { method: 'POST', body: payload });
export const googleLogin = (payload: { email: string; name: string; googleId: string; avatar?: string }) =>
  getJson('/auth/google', { method: 'POST', body: payload });
export const verifyEmail = (token: string) =>
  getJson(`/auth/verify?token=${encodeURIComponent(token)}`);

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
export const fetchProducts = () => getJson('/products');
export const fetchProductBySlug = (slug: string) => getJson(`/products/${slug}`);
export const createProduct = (payload: Record<string, unknown>) =>
  getJson('/products', { method: 'POST', body: payload });
export const updateProduct = (id: string, payload: Record<string, unknown>) =>
  getJson(`/products/${id}`, { method: 'PUT', body: payload });
export const deleteProduct = (id: string) =>
  getJson(`/products/${id}`, { method: 'DELETE' });

// Categories
export const fetchCategories = () => getJson('/categories');
export const createCategory = (payload: Record<string, unknown>) =>
  getJson('/categories', { method: 'POST', body: payload });
export const updateCategory = (id: string, payload: Record<string, unknown>) =>
  getJson(`/categories/${id}`, { method: 'PUT', body: payload });
export const deleteCategory = (id: string) =>
  getJson(`/categories/${id}`, { method: 'DELETE' });

// Orders
export const fetchOrders = () => getJson<any[]>('/orders');
export const fetchMyOrders = () => getJson<any[]>('/orders/my');
export const updateOrderStatus = (id: string, payload: { status: string; note?: string }) =>
  getJson<Record<string, any>>(`/orders/${id}/status`, { method: 'PUT', body: payload });
export const createOrder = (payload: Record<string, unknown>) =>
  getJson('/orders', { method: 'POST', body: payload });
export const trackOrder = (orderId: string | number) =>
  getJson(`/orders/track/${orderId}`);

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

// Hero slides
export const fetchHeroSlides = () => getJson('/hero-slides');
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
