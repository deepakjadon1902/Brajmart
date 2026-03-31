import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PaymentStatus = 'paid' | 'pending' | 'failed' | 'refunded';

export interface Payment {
  id: string;
  orderId: string;
  customerName: string;
  customerEmail: string;
  method: string;
  amount: number;
  status: PaymentStatus;
  transactionId: string;
  createdAt: string;
}

interface PaymentStore {
  payments: Payment[];
  addPayment: (payment: Omit<Payment, 'id' | 'createdAt'>) => string;
  getPaymentByOrderId: (orderId: string) => Payment | undefined;
  getAllPayments: () => Payment[];
  updatePaymentStatus: (id: string, status: PaymentStatus) => void;
}

export const usePaymentStore = create<PaymentStore>()(
  persist(
    (set, get) => ({
      payments: [],
      addPayment: (data) => {
        const id = `PAY-${Date.now().toString(36).toUpperCase()}`;
        const payment: Payment = { ...data, id, createdAt: new Date().toISOString() };
        set((s) => ({ payments: [payment, ...s.payments] }));
        return id;
      },
      getPaymentByOrderId: (orderId) => get().payments.find((p) => p.orderId === orderId),
      getAllPayments: () => get().payments,
      updatePaymentStatus: (id, status) =>
        set((s) => ({
          payments: s.payments.map((p) => (p.id === id ? { ...p, status } : p)),
        })),
    }),
    { name: 'brajmart-payments' }
  )
);
