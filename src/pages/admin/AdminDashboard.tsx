import { useEffect, useState } from 'react';
import { useProductStore } from '@/store/productStore';
import { DollarSign, ShoppingBag, Users, Package, TrendingUp, ArrowUpRight } from 'lucide-react';
import { fetchOrders } from '@/lib/api';
import { toast } from 'sonner';

const AdminDashboard = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const products = useProductStore((s) => s.products);
  const loadProducts = useProductStore((s) => s.loadFromApi);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchOrders();
        const mapped = (Array.isArray(data) ? data : []).map((o: any) => ({
          ...o,
          id: o.orderId ? String(o.orderId) : o._id,
          shippingAddress: o.shippingAddress || {},
        }));
        setOrders(mapped);
      } catch (err: any) {
        toast.error(err?.message || 'Failed to load orders');
      }
    };
    load();
  }, []);

  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
  const totalOrders = orders.length;
  const deliveredOrders = orders.filter((o) => o.status === 'delivered').length;
  const pendingOrders = orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled').length;

  const stats = [
    { label: 'Total Revenue', value: `₹${totalRevenue.toLocaleString('en-IN')}`, icon: DollarSign, color: 'from-emerald-500 to-teal-600', change: '+12.5%' },
    { label: 'Total Orders', value: totalOrders, icon: ShoppingBag, color: 'from-blue-500 to-indigo-600', change: '+8.2%' },
    { label: 'Total Products', value: products.length, icon: Package, color: 'from-amber-500 to-orange-600', change: '+3' },
    { label: 'Active Users', value: '1,284', icon: Users, color: 'from-purple-500 to-pink-600', change: '+15.3%' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm">Welcome back, Admin. Here's what's happening.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center`}>
                <s.icon size={20} className="text-white" />
              </div>
              <span className="text-xs text-emerald-400 flex items-center gap-0.5"><TrendingUp size={12} /> {s.change}</span>
            </div>
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className="text-sm text-slate-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Recent Orders */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-white">Recent Orders</h2>
          <a href="/admin/orders" className="text-xs text-amber-400 flex items-center gap-1 hover:underline">View All <ArrowUpRight size={12} /></a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800">
                <th className="text-left px-5 py-3 font-medium">Order ID</th>
                <th className="text-left px-5 py-3 font-medium">Customer</th>
                <th className="text-left px-5 py-3 font-medium">Amount</th>
                <th className="text-left px-5 py-3 font-medium">Status</th>
                <th className="text-left px-5 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 5).map((o) => (
                <tr key={o.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-5 py-3 text-amber-400 font-mono text-xs">{o.id}</td>
                  <td className="px-5 py-3 text-white">{o.shippingAddress.fullName}</td>
                  <td className="px-5 py-3 text-white">₹{o.total.toLocaleString('en-IN')}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="px-5 py-3 text-slate-400">{new Date(o.createdAt).toLocaleDateString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-sm font-medium text-slate-400 mb-3">Order Status</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-slate-300">Pending</span><span className="text-amber-400 font-medium">{pendingOrders}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-300">Delivered</span><span className="text-emerald-400 font-medium">{deliveredOrders}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-300">Cancelled</span><span className="text-red-400 font-medium">{orders.filter(o => o.status === 'cancelled').length}</span></div>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
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
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-sm font-medium text-slate-400 mb-3">Payment Methods</h3>
          <div className="space-y-2">
            {['UPI', 'COD', 'Card'].map((m) => (
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
  const colors: Record<string, string> = {
    confirmed: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    processing: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    shipped: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    out_for_delivery: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    delivered: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors[status] || 'bg-slate-500/10 text-slate-400'}`}>
      {status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
    </span>
  );
};

export default AdminDashboard;
