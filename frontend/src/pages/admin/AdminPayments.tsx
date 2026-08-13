import { useEffect, useState } from 'react';
import { CreditCard, Wallet, DollarSign, AlertCircle, type LucideIcon } from 'lucide-react';
import { fetchOrders, fetchPayments, reconcilePayments } from '@/lib/api';
import { toast } from 'sonner';
import AdminPagination, { ADMIN_PAGE_SIZE } from '@/components/admin/AdminPagination';

type AdminPayment = {
  id: string;
  orderId?: number | string;
  customerName?: string;
  method: string;
  amount: number;
  status: string;
  transactionId?: string;
  createdAt?: string;
  _id?: string;
};

type AdminOrder = {
  paymentMethod?: string;
  total?: number;
};

const errorMessage = (err: unknown, fallback: string) => err instanceof Error ? err.message : fallback;
const isCodOrder = (order: AdminOrder) => /^cod$|cash\s*on\s*delivery/i.test(String(order.paymentMethod || ''));
const normalizePayments = (data: unknown): AdminPayment[] =>
  Array.isArray(data)
    ? data.map((raw) => {
      const p = raw as Partial<AdminPayment>;
      return {
        ...p,
        id: String(p.id || p._id || ''),
        method: String(p.method || 'Unknown'),
        amount: Number(p.amount || 0),
        status: String(p.status || ''),
      };
    })
    : [];

const AdminPayments = () => {
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [page, setPage] = useState(1);
  useEffect(() => {
    const load = async () => {
      try {
        const data: unknown = await fetchPayments();
        setPayments(normalizePayments(data));
        const orderData: unknown = await fetchOrders();
        setOrders(Array.isArray(orderData) ? orderData : []);
      } catch (err: unknown) {
        toast.error(errorMessage(err, 'Failed to load payments'));
      }
    };
    load();
    const t = setInterval(() => load(), 5_000);
    return () => clearInterval(t);
  }, []);
  const paidPayments = payments.filter((p) => p.status === 'paid');
  const codOrders = orders.filter(isCodOrder);
  const paidRevenue = paidPayments.reduce((s, p) => s + p.amount, 0);
  const codRevenue = codOrders.reduce((s, o) => s + Number(o.total || 0), 0);
  const collectedRevenue = paidRevenue + codRevenue;
  const pendingRevenue = payments.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amount, 0);
  const paginatedPayments = payments.slice((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(payments.length / ADMIN_PAGE_SIZE));
    if (page > totalPages) setPage(totalPages);
  }, [payments.length, page]);

  const methodStats = paidPayments.reduce<Record<string, { count: number; total: number }>>((acc, p) => {
    if (!acc[p.method]) acc[p.method] = { count: 0, total: 0 };
    acc[p.method].count++;
    acc[p.method].total += p.amount;
    return acc;
  }, {});
  if (codOrders.length) {
    methodStats.COD = { count: codOrders.length, total: codRevenue };
  }

  const icons: Record<string, LucideIcon> = {
    UPI: Wallet,
    Card: CreditCard,
    Razorpay: CreditCard,
    COD: Wallet,
  };

  const metricCards = [
    { label: 'Collected Revenue', value: `INR ${collectedRevenue.toLocaleString('en-IN')}`, icon: DollarSign },
    { label: 'Online Collected', value: `INR ${paidRevenue.toLocaleString('en-IN')}`, icon: CreditCard },
    { label: 'Pending Amount', value: `INR ${pendingRevenue.toLocaleString('en-IN')}`, icon: AlertCircle },
    { label: 'Valid Transactions', value: String(paidPayments.length + codOrders.length), icon: CreditCard },
  ];

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-white">Payments</h1>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="admin-kpi-card">
              <div className="admin-kpi-icon"><Icon size={16} /></div>
              <div className="min-w-0">
                <p className="admin-kpi-value truncate">{card.value}</p>
                <p className="admin-kpi-label">{card.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Method breakdown */}
      {Object.keys(methodStats).length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Object.entries(methodStats).map(([method, data]) => {
            const Icon = icons[method] || CreditCard;
            return (
              <div key={method} className="admin-kpi-card admin-kpi-card-secondary">
                <div className="admin-kpi-icon"><Icon size={16} /></div>
                <div className="min-w-0">
                  <p className="admin-kpi-label">{method}</p>
                  <p className="admin-kpi-value truncate">INR {data.total.toLocaleString('en-IN')}</p>
                  <p className="admin-kpi-sub">{data.count} transactions</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Transaction History</h2>
          <button
            onClick={async () => {
              try {
                await reconcilePayments();
                const data: unknown = await fetchPayments();
                setPayments(normalizePayments(data));
                const orderData: unknown = await fetchOrders();
                setOrders(Array.isArray(orderData) ? orderData : []);
                toast.success('Payment status refreshed');
              } catch (err: unknown) {
                toast.error(errorMessage(err, 'Failed to refresh payments'));
              }
            }}
            className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white hover:bg-slate-700 transition"
          >
            Refresh
          </button>
        </div>
        {payments.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <CreditCard size={40} className="mx-auto mb-3 opacity-40" />
            <p>No transactions yet. Payments will appear here when users place orders.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm min-w-[920px]">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800">
                    <th className="text-left px-5 py-3 font-medium">Transaction ID</th>
                    <th className="text-left px-5 py-3 font-medium hidden sm:table-cell">Order ID</th>
                    <th className="text-left px-5 py-3 font-medium hidden md:table-cell">Customer</th>
                    <th className="text-left px-5 py-3 font-medium">Method</th>
                    <th className="text-left px-5 py-3 font-medium">Amount</th>
                    <th className="text-left px-5 py-3 font-medium hidden md:table-cell">Date</th>
                    <th className="text-left px-5 py-3 font-medium">Status</th>
                    <th className="text-left px-5 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPayments.map((p) => (
                    <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="px-5 py-3 text-slate-300 font-mono text-xs">{p.transactionId}</td>
                      <td className="px-5 py-3 text-amber-400 font-mono text-xs hidden sm:table-cell">{p.orderId}</td>
                      <td className="px-5 py-3 text-white hidden md:table-cell">{p.customerName}</td>
                      <td className="px-5 py-3">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">{p.method}</span>
                      </td>
                      <td className="px-5 py-3 text-white font-medium">INR {p.amount.toLocaleString('en-IN')}</td>
                      <td className="px-5 py-3 text-slate-400 text-xs hidden md:table-cell">{new Date(p.createdAt).toLocaleDateString('en-IN')}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          p.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          p.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                          p.status === 'refunded' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>{p.status}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs text-slate-500">{p.status === 'pending' ? 'Auto verifying...' : '-'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <AdminPagination page={page} totalItems={payments.length} onPageChange={setPage} itemLabel="transactions" />
          </>
        )}
      </div>
    </div>
  );
};

export default AdminPayments;
