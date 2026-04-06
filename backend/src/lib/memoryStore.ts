type Id = string;

const genId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export type MemoryProduct = {
  _id: Id;
  name: string;
  slug: string;
  price: number;
  originalPrice?: number;
  image: string;
  category: string;
  rating?: number;
  reviewCount?: number;
  badge?: string | null;
  tags?: string[];
  inStock?: boolean;
  soldCount?: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
};

export type MemoryCategory = {
  _id: Id;
  name: string;
  icon: string;
  color?: string;
  productCount?: number;
  createdAt: string;
  updatedAt: string;
};

export type MemoryOrder = {
  _id: Id;
  orderId: number;
  userId?: Id;
  items: any[];
  total: number;
  status: string;
  shippingAddress: any;
  billingAddress: any;
  paymentMethod: string;
  customerName?: string;
  customerEmail?: string;
  trackingId?: string;
  estimatedDelivery?: string;
  statusHistory: Array<{ status: string; date: string; note?: string }>;
  createdAt: string;
  updatedAt: string;
};

export type MemoryPayment = {
  _id: Id;
  orderId: number | string;
  customerName: string;
  customerEmail: string;
  method: string;
  amount: number;
  status: string;
  transactionId: string;
  createdAt: string;
  updatedAt: string;
};

export type PayuDraft = {
  txnid: string;
  createdAt: string;
  amount: number;
  method: 'upi' | 'card';
  customer: { name: string; email: string; phone?: string };
  order: any;
};

export type MemoryPaymentStatus = {
  token: string;
  status: 'paid' | 'pending' | 'failed';
  orderId?: number;
  amount?: number;
  method?: string;
  paymentId?: string;
  createdAt: string;
  updatedAt: string;
};

export type MemoryUser = {
  _id: Id;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'blocked';
  passwordHash?: string;
  googleId?: string | null;
  avatar?: string;
  isVerified?: boolean;
  verificationToken?: string | null;
  verificationTokenExpires?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MemorySettings = Record<string, any>;
export type MemoryCart = {
  _id: Id;
  userId: Id;
  items: any[];
};

const now = () => new Date().toISOString();

const defaultCategories: MemoryCategory[] = [
  { _id: 'cat_prasadam', name: 'Prasadam', icon: '🍮', color: 'saffron', productCount: 6, createdAt: now(), updatedAt: now() },
  { _id: 'cat_books', name: 'Spiritual Books', icon: '📚', color: 'maroon', productCount: 6, createdAt: now(), updatedAt: now() },
  { _id: 'cat_idols', name: 'Idols & Shringar', icon: '🪔', color: 'gold', productCount: 5, createdAt: now(), updatedAt: now() },
  { _id: 'cat_incense', name: 'Incense & Pooja', icon: '🕯️', color: 'divine-purple', productCount: 5, createdAt: now(), updatedAt: now() },
  { _id: 'cat_accessories', name: 'Accessories', icon: '📿', color: 'tulsi', productCount: 5, createdAt: now(), updatedAt: now() },
  { _id: 'cat_clothing', name: 'Clothing', icon: '👘', color: 'lotus', productCount: 4, createdAt: now(), updatedAt: now() },
  { _id: 'cat_groceries', name: 'Groceries', icon: '🌿', color: 'tulsi', productCount: 5, createdAt: now(), updatedAt: now() },
  { _id: 'cat_yatra', name: 'Braj Yatra', icon: '🛕', color: 'maroon', productCount: 0, createdAt: now(), updatedAt: now() },
];

const img = (seed: string) => `https://images.unsplash.com/photo-${seed}?w=600&h=600&fit=crop&auto=format`;

const defaultProducts: MemoryProduct[] = [
  { _id: 'prod_p1', name: 'Vrindavan Temple Prasadam Box', slug: 'vrindavan-prasadam-box', price: 319, originalPrice: 699, image: img('1606567595334-d39972c85dbe'), category: 'Prasadam', rating: 4.8, reviewCount: 234, badge: 'new', tags: ['latest', 'new', 'prasadam'], inStock: true, createdAt: now(), updatedAt: now() },
  { _id: 'prod_b1', name: 'Bhagavad Gita As It Is', slug: 'bhagavad-gita', price: 249, originalPrice: 499, image: img('1544947950-fa07a98d237f'), category: 'Spiritual Books', rating: 4.9, reviewCount: 1823, badge: 'bestseller', tags: ['bestseller'], inStock: true, createdAt: now(), updatedAt: now() },
  { _id: 'prod_i1', name: 'Radha Krishna Brass Idol', slug: 'radha-krishna-idol', price: 1849, originalPrice: 3499, image: img('1609710228159-0fa9bd7c0827'), category: 'Idols & Shringar', rating: 4.9, reviewCount: 89, tags: ['latest'], inStock: true, createdAt: now(), updatedAt: now() },
  { _id: 'prod_in1', name: 'Nag Champa Incense Bundle', slug: 'nag-champa-incense', price: 149, originalPrice: 299, image: img('1600298882525-1ac67b1a28dc'), category: 'Incense & Pooja', rating: 4.6, reviewCount: 567, badge: 'new', tags: ['new'], inStock: true, createdAt: now(), updatedAt: now() },
  { _id: 'prod_a1', name: 'Tulsi Kanti Mala — Premium', slug: 'tulsi-kanti-mala', price: 189, originalPrice: 399, image: img('1611591437281-460bfbe1220a'), category: 'Accessories', rating: 4.7, reviewCount: 412, badge: 'new', tags: ['accessories', 'latest'], inStock: true, createdAt: now(), updatedAt: now() },
  { _id: 'prod_cl1', name: 'Silk Dhoti — Temple Grade', slug: 'silk-dhoti', price: 599, originalPrice: 1199, image: img('1610030469983-3be1740117f0'), category: 'Clothing', rating: 4.5, reviewCount: 76, badge: 'new', tags: ['new'], inStock: true, createdAt: now(), updatedAt: now() },
  { _id: 'prod_g1', name: 'Pure Vrindavan Cow Ghee 500ml', slug: 'cow-ghee', price: 449, originalPrice: 799, image: img('1631209046498-fa72d4d4a5c3'), category: 'Groceries', rating: 4.8, reviewCount: 328, inStock: true, createdAt: now(), updatedAt: now() },
  { _id: 'prod_y1', name: 'Braj Yatra Guide (Coming Soon)', slug: 'braj-yatra-guide', price: 0, originalPrice: 0, image: img('1519681393784-d120267933ba'), category: 'Braj Yatra', rating: 0, reviewCount: 0, badge: 'new', tags: ['exclusive'], inStock: false, createdAt: now(), updatedAt: now() },
];

const store = {
  products: [...defaultProducts] as MemoryProduct[],
  categories: [...defaultCategories] as MemoryCategory[],
  orders: [] as MemoryOrder[],
  payments: [] as MemoryPayment[],
  payuDrafts: {} as Record<string, PayuDraft>,
  paymentStatus: {} as Record<string, MemoryPaymentStatus>,
  users: [] as MemoryUser[],
  carts: [] as MemoryCart[],
  settings: {
    storeName: 'BrajMart',
    tagline: 'From Braj, With Love',
    currency: 'INR',
    freeShippingThreshold: 499,
    shippingFee: 49,
    storeEmail: 'support@brajmart.com',
    storePhone: '+91 9876543210',
    storeAddress: 'Vrindavan, Mathura, UP 281121, India',
    taxRate: 0,
    minOrderAmount: 0,
    maxOrderQuantity: 10,
    deliveryEtaMinDays: 3,
    deliveryEtaMaxDays: 7,
    codEnabled: true,
    upiEnabled: true,
    cardEnabled: true,
    maintenanceMode: false,
    metaTitle: 'BrajMart - Authentic Vrindavan Products',
    metaDescription: '',
    storeLogo: '',
    favicon: '',
    upiId: '',
    upiPayeeName: 'BrajMart',
    socialLinks: { instagram: '', facebook: '', youtube: '', whatsapp: '' },
    announcementBar: { enabled: true, messages: [] },
    notifications: { orders: true, users: true, payments: true, stock: false },
  } as MemorySettings,
  orderSeq: 10000,
};

export const memory = {
  listProducts: () => store.products,
  createProduct: (data: Partial<MemoryProduct>) => {
    const p: MemoryProduct = { _id: genId('prod'), createdAt: now(), updatedAt: now(), rating: 0, reviewCount: 0, inStock: true, ...data } as any;
    store.products.unshift(p);
    return p;
  },
  updateProduct: (id: Id, data: Partial<MemoryProduct>) => {
    const idx = store.products.findIndex((p) => p._id === id);
    if (idx === -1) return null;
    store.products[idx] = { ...store.products[idx], ...data, updatedAt: now() };
    return store.products[idx];
  },
  deleteProduct: (id: Id) => {
    store.products = store.products.filter((p) => p._id !== id);
  },

  listCategories: () => store.categories,
  createCategory: (data: Partial<MemoryCategory>) => {
    const c: MemoryCategory = { _id: genId('cat'), createdAt: now(), updatedAt: now(), ...data } as any;
    store.categories.push(c);
    return c;
  },
  updateCategory: (id: Id, data: Partial<MemoryCategory>) => {
    const idx = store.categories.findIndex((c) => c._id === id);
    if (idx === -1) return null;
    store.categories[idx] = { ...store.categories[idx], ...data, updatedAt: now() };
    return store.categories[idx];
  },
  deleteCategory: (id: Id) => {
    store.categories = store.categories.filter((c) => c._id !== id);
  },

  listOrders: () => store.orders,
  createOrder: (data: Partial<MemoryOrder>) => {
    const orderId = store.orderSeq++;
    const o: MemoryOrder = {
      _id: genId('ord'),
      orderId,
      createdAt: now(),
      updatedAt: now(),
      status: 'confirmed',
      statusHistory: [{ status: 'confirmed', date: now(), note: 'Order placed successfully' }],
      trackingId: `BM${orderId}`,
      estimatedDelivery: new Date(Date.now() + 5 * 86400000).toISOString(),
      ...data,
    } as any;
    store.orders.unshift(o);
    return o;
  },
  updateOrderStatus: (id: Id, status: string, note?: string) => {
    const idx = store.orders.findIndex((o) => o._id === id);
    if (idx === -1) return null;
    const o = store.orders[idx];
    o.status = status;
    o.statusHistory.push({ status, date: now(), note });
    o.updatedAt = now();
    return o;
  },
  findOrderById: (id: Id) => store.orders.find((o) => o._id === id),
  findOrderByOrderId: (orderId: number) => store.orders.find((o) => o.orderId === orderId),

  listPayments: () => store.payments,
  createPayment: (data: Partial<MemoryPayment>) => {
    const p: MemoryPayment = { _id: genId('pay'), createdAt: now(), updatedAt: now(), ...data } as any;
    store.payments.unshift(p);
    return p;
  },
  updatePayment: (id: Id, status: string) => {
    const idx = store.payments.findIndex((p) => p._id === id);
    if (idx === -1) return null;
    store.payments[idx] = { ...store.payments[idx], status, updatedAt: now() };
    return store.payments[idx];
  },

  listUsers: () => store.users,
  findUserByEmail: (email: string) => store.users.find((u) => u.email === email),
  findUserByVerificationToken: (token: string) => store.users.find((u) => u.verificationToken === token),
  createUser: (data: Partial<MemoryUser>) => {
    const u: MemoryUser = { _id: genId('usr'), createdAt: now(), updatedAt: now(), role: 'user', status: 'active', isVerified: false, ...data } as any;
    store.users.unshift(u);
    return u;
  },
  updateUser: (id: Id, data: Partial<MemoryUser>) => {
    const idx = store.users.findIndex((u) => u._id === id);
    if (idx === -1) return null;
    store.users[idx] = { ...store.users[idx], ...data, updatedAt: now() };
    return store.users[idx];
  },
  updateUserStatus: (id: Id, status: 'active' | 'blocked') => {
    const idx = store.users.findIndex((u) => u._id === id);
    if (idx === -1) return null;
    store.users[idx] = { ...store.users[idx], status, updatedAt: now() };
    return store.users[idx];
  },

  getCartByUser: (userId: Id) => store.carts.find((c) => c.userId === userId),
  upsertCart: (userId: Id, items: any[]) => {
    const existing = store.carts.find((c) => c.userId === userId);
    if (existing) {
      existing.items = items;
      return existing;
    }
    const c: MemoryCart = { _id: genId('cart'), userId, items };
    store.carts.push(c);
    return c;
  },
  clearCart: (userId: Id) => {
    const existing = store.carts.find((c) => c.userId === userId);
    if (existing) existing.items = [];
    return existing;
  },

  createPayuDraft: (draft: PayuDraft) => {
    store.payuDrafts[draft.txnid] = draft;
    return draft;
  },
  getPayuDraft: (txnid: string) => store.payuDrafts[txnid],
  removePayuDraft: (txnid: string) => {
    const existing = store.payuDrafts[txnid];
    delete store.payuDrafts[txnid];
    return existing;
  },

  upsertPaymentStatus: (token: string, data: Partial<MemoryPaymentStatus>) => {
    const existing = store.paymentStatus[token];
    const updated: MemoryPaymentStatus = {
      token,
      status: (data.status as any) || existing?.status || 'pending',
      orderId: data.orderId ?? existing?.orderId,
      amount: data.amount ?? existing?.amount,
      method: data.method ?? existing?.method,
      paymentId: data.paymentId ?? existing?.paymentId,
      createdAt: existing?.createdAt || now(),
      updatedAt: now(),
    };
    store.paymentStatus[token] = updated;
    return updated;
  },
  getPaymentStatus: (token: string) => store.paymentStatus[token],

  getSettings: () => store.settings,
  updateSettings: (data: MemorySettings) => {
    store.settings = { ...store.settings, ...data };
    return store.settings;
  },
};
