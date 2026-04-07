import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product } from '@/types/product';
import { fetchMyOrders } from '@/lib/api';

export type OrderStatus = 'confirmed' | 'processing' | 'shipped' | 'out_for_delivery' | 'delivered' | 'cancelled';

export interface OrderItem {
  product: Product;
  quantity: number;
  price: number;
}

export interface Address {
  fullName: string;
  mobile: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
}

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  shippingAddress: Address;
  billingAddress: Address;
  paymentMethod: string;
  createdAt: string;
  updatedAt: string;
  trackingId?: string;
  estimatedDelivery?: string;
  statusHistory: { status: OrderStatus; date: string; note?: string }[];
}

// Generate sequential order ID starting from 10000
const getNextOrderId = (orders: Order[]): string => {
  if (orders.length === 0) return '10000';
  const maxId = Math.max(...orders.map((o) => parseInt(o.id, 10) || 0), 9999);
  return String(maxId + 1);
};

interface OrderStore {
  orders: Order[];
  setOrders: (orders: Order[]) => void;
  loadMyOrders: () => Promise<void>;
  addOrder: (order: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'statusHistory'>) => string;
  getOrdersByUser: (userId: string) => Order[];
  getOrderById: (id: string) => Order | undefined;
  updateOrderStatus: (id: string, status: OrderStatus, note?: string) => void;
  getAllOrders: () => Order[];
}

export const useOrderStore = create<OrderStore>()(
  persist(
    (set, get) => ({
      orders: [],
      setOrders: (orders) => set({ orders }),
      loadMyOrders: async () => {
        try {
          const data: any = await fetchMyOrders();
          const mapped = (Array.isArray(data) ? data : []).map((o: any) => ({
            id: o.orderId ? String(o.orderId) : o._id,
            userId: o.userId || 'user',
            items: (o.items || []).map((i: any) => ({
              product: {
                id: i.productId || i.product?.id || i.product?._id || '',
                name: i.name || i.product?.name || 'Item',
                slug: i.product?.slug || '',
                price: i.price || i.product?.price || 0,
                originalPrice: i.product?.originalPrice,
                image: i.image || i.product?.image || '',
                category: i.product?.category || '',
                rating: i.product?.rating || 0,
                reviewCount: i.product?.reviewCount || 0,
                badge: i.product?.badge,
                inStock: i.product?.inStock ?? true,
              },
              quantity: i.quantity || 1,
              price: i.price || 0,
            })),
            total: o.total || 0,
            status: o.status,
            shippingAddress: o.shippingAddress,
            billingAddress: o.billingAddress,
            paymentMethod: o.paymentMethod,
            createdAt: o.createdAt,
            updatedAt: o.updatedAt,
            trackingId: o.trackingId,
            estimatedDelivery: o.estimatedDelivery,
            statusHistory: o.statusHistory || [],
          }));
          set({ orders: mapped });
        } catch {
          // ignore
        }
      },
      addOrder: (orderData) => {
        const id = getNextOrderId(get().orders);
        
        const now = new Date().toISOString();
        const estimatedDelivery = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0];
        const order: Order = {
          ...orderData,
          id,
          createdAt: now,
          updatedAt: now,
          trackingId: `BM${id}`,
          estimatedDelivery,
          statusHistory: [{ status: orderData.status, date: now, note: 'Order placed successfully' }],
        };
        set((s) => ({ orders: [order, ...s.orders] }));
        return id;
      },
      getOrdersByUser: (userId) => get().orders.filter((o) => o.userId === userId),
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
