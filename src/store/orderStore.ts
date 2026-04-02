import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Product } from '@/types/product';

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
      addOrder: (orderData) => {
        const id = getNextOrderId(get().orders);
        const id = generate6DigitId(existingIds);
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
