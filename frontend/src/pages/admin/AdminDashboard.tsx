import { useEffect, useState } from 'react';
import { useProductStore } from '@/store/productStore';
import { DollarSign, ShoppingBag, Users, Package, TrendingUp, ArrowUpRight } from 'lucide-react';
import { fetchOrders, fetchPayments, fetchUsers } from '@/lib/api';
import { toast } from 'sonner';

type AdminOrder = {
  id: string;
  orderId?: number | string;
  _id?: string;
  total: number;
  status: string;
  paymentMethod?: string;
  createdAt?: string;
  shippingAddress: { fullName?: string };
};

type AdminPayment = {
  amount?: number;
  status?: string;
};

type AdminUser = {
  status?: string;
};

const errorMessage = (err: unknown, fallback: string) => err instanceof Error ? err.message : fallback;
const isCodOrder = (order: Pick<AdminOrder, 'paymentMethod'>) => /^cod$|cash\s*on\s*delivery/i.test(String(order.paymentMethod || ''));

const AdminDashboard = () => {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const products = useProductStore((s) => s.products);
  const loadProducts = useProductStore((s) => s.loadFromApi);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    const load = async () => {
      try {
        const data: unknown = await fetchOrders();
        const mapped = (Array.isArray(data) ? data : []).map((raw) => {
          const o = raw as Partial<AdminOrder>;
          return {
          ...o,
          id: String(o.orderId || o._id || ''),
          total: Number(o.total || 0),
          status: String(o.status || ''),
          shippingAddress: o.shippingAddress || {},
          };
        });
        setOrders(mapped);
        const paymentsData: unknown = await fetchPayments();
        setPayments(Array.isArray(paymentsData) ? paymentsData : []);
        const usersData: unknown = await fetchUsers();
        setUsers(Array.isArray(usersData) ? usersData : []);
      } catch (err: unknown) {
        toast.error(errorMessage(err, 'Failed to load dashboard'));
      }
    };
    load();
  }, []);

  const paidOnlineRevenue = payments
    .filter((p) => p.status === 'paid')
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const codRevenue = orders
    .filter(isCodOrder)
    .reduce((s, o) => s + Number(o.total || 0), 0);
  const totalRevenue = paidOnlineRevenue + codRevenue;
  const totalOrders = orders.length;
  const deliveredOrders = orders.filter((o) => o.status === 'delivered').length;
  const pendingOrders = orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled').length;
  const activeUsers = users.filter((u) => String(u.status || '').toLowerCase() === 'active').length;

  const stats = [
    { label: 'Total Revenue', value: `INR ${totalRevenue.toLocaleString('en-IN')}`, icon: DollarSign, change: '+12.5%' },
    { label: 'Total Orders', value: totalOrders, icon: ShoppingBag, change: '+8.2%' },
    { label: 'Total Products', value: products.length, icon: Package, change: '+3' },
    { label: 'Active Users', value: activeUsers.toLocaleString('en-IN'), icon: Users, change: '+15.3%' },
  ];

  return (
    <div className="admin-dashboard-page space-y-5">
      <div className="admin-dashboard-header">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm">Welcome back, Admin. Here's what's happening.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="admin-kpi-card">
            <div className="admin-kpi-icon"><s.icon size={16} /></div>
            <div className="min-w-0 flex-1">
              <p className="admin-kpi-value truncate">{s.value}</p>
              <p className="admin-kpi-label">{s.label}</p>
            </div>
            <span className="admin-dashboard-change"><TrendingUp size={12} /> {s.change}</span>
          </div>
        ))}
      </div>

      {/* Recent Orders */}
      <div className="admin-dashboard-panel">
        <div className="admin-dashboard-panel-header">
          <h2 className="text-lg font-semibold text-white">Recent Orders</h2>
          <a href="/admin/orders" className="text-xs text-amber-400 flex items-center gap-1 hover:underline">View All <ArrowUpRight size={12} /></a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm min-w-[720px]">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800">
                <th className="text-left px-5 py-3 font-medium">Order ID</th>
                <th className="text-left px-5 py-3 font-medium">Customer</th>
                <th className="text-left px-5 py-3 font-medium">Amount</th>
                <th className="text-left px-5 py-3 font-medium">Status</th>
                <th className="text-left px-5 py-3 font-medium hidden md:table-cell">Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 5).map((o) => (
                <tr key={o.id} className="admin-dashboard-table-row border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-5 py-3 text-amber-400 font-mono text-xs">{o.id}</td>
                  <td className="px-5 py-3 text-white">{o.shippingAddress.fullName || 'Customer'}</td>
                  <td className="px-5 py-3 text-white">INR {o.total.toLocaleString('en-IN')}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="px-5 py-3 text-slate-400 hidden md:table-cell">{new Date(o.createdAt).toLocaleDateString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="admin-dashboard-summary-card">
          <h3 className="text-sm font-medium text-slate-400 mb-3">Order Status</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-slate-300">Pending</span><span className="text-amber-400 font-medium">{pendingOrders}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-300">Delivered</span><span className="text-emerald-400 font-medium">{deliveredOrders}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-300">Cancelled</span><span className="text-red-400 font-medium">{orders.filter(o => o.status === 'cancelled').length}</span></div>
          </div>
        </div>
        <div className="admin-dashboard-summary-card">
          <h3 className="text-sm font-medium text-slate-400 mb-3">Top Categories</h3>
          <div className="space-y-2">
            {['Prasadam', 'Spiritual Books', 'Idols & Shringar'].map((cat) => (
              <div key={cat} className="flex justify-between text-sm">
                <span className="text-slate-300">{cat}</span>
                <span className="text-white font-medium">{products.filter(p => p.category === cat).length} products</span>
              </div>
            ))}
          </div>
        </div>
        <div className="admin-dashboard-summary-card">
          <h3 className="text-sm font-medium text-slate-400 mb-3">Payment Methods</h3>
          <div className="space-y-2">
            {['Razorpay', 'COD'].map((m) => (
              <div key={m} className="flex justify-between text-sm">
                <span className="text-slate-300">{m}</span>
                <span className="text-white font-medium">{orders.filter(o => o.paymentMethod === m).length} orders</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const StatusBadge = ({ status }: { status: string }) => {
  const statusKey = String(status || '').trim().toLowerCase();
  return (
    <span className={`admin-status-badge admin-status-${statusKey || 'unknown'} inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border`}>
      {status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
    </span>
  );
};

export default AdminDashboard;
