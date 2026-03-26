import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product } from '@/types/product';

export type OrderStatus = 'confirmed' | 'processing' | 'shipped' | 'out_for_delivery' | 'delivered' | 'cancelled';

export interface OrderItem {
  product: Product;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  shippingAddress: {
    fullName: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    mobile: string;
  };
  paymentMethod: string;
  createdAt: string;
  updatedAt: string;
  trackingId?: string;
  estimatedDelivery?: string;
  statusHistory: { status: OrderStatus; date: string; note?: string }[];
}

interface OrderStore {
  orders: Order[];
  addOrder: (order: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'statusHistory'>) => string;
  getOrdersByUser: (userId: string) => Order[];
  getOrderById: (id: string) => Order | undefined;
  updateOrderStatus: (id: string, status: OrderStatus, note?: string) => void;
  getAllOrders: () => Order[];
}

export const useOrderStore = create<OrderStore>()(
  persist(
    (set, get) => ({
      orders: [
        // Mock orders for demo
        {
          id: 'ORD-2026-001',
          userId: 'demo',
          items: [
            { product: { id: 'p1', name: 'Vrindavan Temple Prasadam Box', slug: 'vrindavan-prasadam-box', price: 319, originalPrice: 699, image: 'https://images.unsplash.com/photo-1606567595334-d39972c85dbe?w=400&h=400&fit=crop&auto=format', category: 'Prasadam', rating: 4.8, reviewCount: 234, badge: 'new', inStock: true }, quantity: 2, price: 319 },
            { product: { id: 'b1', name: 'Bhagavad Gita As It Is', slug: 'bhagavad-gita', price: 249, originalPrice: 499, image: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&h=400&fit=crop&auto=format', category: 'Spiritual Books', rating: 4.9, reviewCount: 1823, badge: 'bestseller', inStock: true }, quantity: 1, price: 249 },
          ],
          total: 887,
          status: 'shipped',
          shippingAddress: { fullName: 'Deepak Jadon', address: '123 Krishna Lane', city: 'Vrindavan', state: 'Uttar Pradesh', pincode: '281121', mobile: '9876543210' },
          paymentMethod: 'UPI',
          createdAt: '2026-03-20T10:30:00Z',
          updatedAt: '2026-03-23T14:00:00Z',
          trackingId: 'BM26032001',
          estimatedDelivery: '2026-03-28',
          statusHistory: [
            { status: 'confirmed', date: '2026-03-20T10:30:00Z', note: 'Order placed successfully' },
            { status: 'processing', date: '2026-03-21T09:00:00Z', note: 'Order is being prepared' },
            { status: 'shipped', date: '2026-03-23T14:00:00Z', note: 'Shipped via BlueDart — AWB: BD123456789' },
          ],
        },
        {
          id: 'ORD-2026-002',
          userId: 'demo',
          items: [
            { product: { id: 'i2', name: 'Laddu Gopal Shringar Set', slug: 'laddu-gopal-shringar', price: 749, originalPrice: 1499, image: 'https://images.unsplash.com/photo-1609710228159-0fa9bd7c0827?w=400&h=400&fit=crop&auto=format', category: 'Idols & Shringar', rating: 4.9, reviewCount: 234, badge: 'bestseller', inStock: true, soldCount: 167 }, quantity: 1, price: 749 },
          ],
          total: 749,
          status: 'delivered',
          shippingAddress: { fullName: 'Deepak Jadon', address: '123 Krishna Lane', city: 'Vrindavan', state: 'Uttar Pradesh', pincode: '281121', mobile: '9876543210' },
          paymentMethod: 'COD',
          createdAt: '2026-03-10T08:00:00Z',
          updatedAt: '2026-03-15T16:00:00Z',
          trackingId: 'BM26031001',
          estimatedDelivery: '2026-03-15',
          statusHistory: [
            { status: 'confirmed', date: '2026-03-10T08:00:00Z' },
            { status: 'processing', date: '2026-03-11T10:00:00Z' },
            { status: 'shipped', date: '2026-03-12T14:00:00Z' },
            { status: 'out_for_delivery', date: '2026-03-15T09:00:00Z' },
            { status: 'delivered', date: '2026-03-15T16:00:00Z', note: 'Delivered to customer' },
          ],
        },
        {
          id: 'ORD-2026-003',
          userId: 'demo',
          items: [
            { product: { id: 'a2', name: 'Chandan Tilak Paste — 100g', slug: 'chandan-tilak', price: 129, originalPrice: 249, image: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=400&h=400&fit=crop&auto=format', category: 'Accessories', rating: 4.8, reviewCount: 1567, badge: 'bestseller', inStock: true, soldCount: 1203 }, quantity: 3, price: 129 },
          ],
          total: 387,
          status: 'confirmed',
          shippingAddress: { fullName: 'Deepak Jadon', address: '123 Krishna Lane', city: 'Vrindavan', state: 'Uttar Pradesh', pincode: '281121', mobile: '9876543210' },
          paymentMethod: 'Card',
          createdAt: '2026-03-25T18:00:00Z',
          updatedAt: '2026-03-25T18:00:00Z',
          trackingId: 'BM26032501',
          estimatedDelivery: '2026-03-31',
          statusHistory: [
            { status: 'confirmed', date: '2026-03-25T18:00:00Z', note: 'Order confirmed' },
          ],
        },
      ],
      addOrder: (orderData) => {
        const id = `ORD-${new Date().getFullYear()}-${String(get().orders.length + 1).padStart(3, '0')}`;
        const now = new Date().toISOString();
        const order: Order = {
          ...orderData,
          id,
          createdAt: now,
          updatedAt: now,
          statusHistory: [{ status: orderData.status, date: now, note: 'Order placed' }],
        };
        set((s) => ({ orders: [order, ...s.orders] }));
        return id;
      },
      getOrdersByUser: (userId) => get().orders.filter((o) => o.userId === userId || o.userId === 'demo'),
      getOrderById: (id) => get().orders.find((o) => o.id === id),
      updateOrderStatus: (id, status, note) =>
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === id
              ? {
                  ...o,
                  status,
                  updatedAt: new Date().toISOString(),
                  statusHistory: [...o.statusHistory, { status, date: new Date().toISOString(), note }],
                }
              : o
          ),
        })),
      getAllOrders: () => get().orders,
    }),
    { name: 'brajmart-orders' }
  )
);
