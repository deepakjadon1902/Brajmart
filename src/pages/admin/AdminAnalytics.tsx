import { useEffect, useState } from 'react';
import { useProductStore } from '@/store/productStore';
import { TrendingUp, BarChart3, PieChart, Activity } from 'lucide-react';
import { fetchOrders } from '@/lib/api';
import { toast } from 'sonner';

const AdminAnalytics = () => {
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
        setOrders(Array.isArray(data) ? data : []);
      } catch (err: any) {
        toast.error(err?.message || 'Failed to load orders');
      }
    };
    load();
  }, []);
  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);

  const catBreakdown = products.reduce<Record<string, number>>((acc, p) => {
    acc[p.category] = (acc[p.category] || 0) + 1;
    return acc;
  }, {});

  const paymentBreakdown = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.paymentMethod] = (acc[o.paymentMethod] || 0) + 1;
    return acc;
  }, {});

  const statusBreakdown = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  const monthlyData = [
    { month: 'Jan', revenue: 24500, orders: 18 },
    { month: 'Feb', revenue: 32100, orders: 24 },
    { month: 'Mar', revenue: 28700, orders: 21 },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Analytics</h1>

      {/* Revenue Chart Mock */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={18} className="text-amber-400" />
          <h2 className="text-lg font-semibold text-white">Revenue Overview</h2>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-6">
          {monthlyData.map((m) => (
            <div key={m.month} className="bg-slate-800/50 rounded-xl p-4">
              <p className="text-slate-400 text-sm">{m.month} 2026</p>
              <p className="text-xl font-bold text-white mt-1">₹{m.revenue.toLocaleString('en-IN')}</p>
              <p className="text-xs text-slate-500">{m.orders} orders</p>
            </div>
          ))}
        </div>
        <div className="flex items-end gap-2 h-40">
          {monthlyData.map((m) => (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full bg-gradient-to-t from-amber-500/30 to-amber-500/80 rounded-t-lg" style={{ height: `${(m.revenue / 35000) * 100}%` }} />
              <span className="text-xs text-slate-400">{m.month}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Category Distribution */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4"><PieChart size={18} className="text-blue-400" /><h2 className="text-lg font-semibold text-white">Products by Category</h2></div>
          <div className="space-y-3">
            {Object.entries(catBreakdown).map(([cat, count]) => (
              <div key={cat}>
                <div className="flex justify-between text-sm mb-1"><span className="text-slate-300">{cat}</span><span className="text-white font-medium">{count}</span></div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full" style={{ width: `${(count / products.length) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Order Status */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4"><BarChart3 size={18} className="text-emerald-400" /><h2 className="text-lg font-semibold text-white">Order Status</h2></div>
          <div className="space-y-3">
            {Object.entries(statusBreakdown).map(([status, count]) => {
              const colors: Record<string, string> = { confirmed: 'from-blue-500 to-blue-600', processing: 'from-amber-500 to-amber-600', shipped: 'from-indigo-500 to-indigo-600', delivered: 'from-emerald-500 to-emerald-600', cancelled: 'from-red-500 to-red-600', out_for_delivery: 'from-purple-500 to-purple-600' };
              return (
                <div key={status}>
                  <div className="flex justify-between text-sm mb-1"><span className="text-slate-300">{status.replace(/_/g, ' ')}</span><span className="text-white font-medium">{count}</span></div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full bg-gradient-to-r ${colors[status] || 'from-slate-500 to-slate-600'} rounded-full`} style={{ width: `${(count / orders.length) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4"><Activity size={18} className="text-purple-400" /><h2 className="text-lg font-semibold text-white">Payment Methods</h2></div>
          <div className="space-y-4">
            {Object.entries(paymentBreakdown).map(([method, count]) => (
              <div key={method} className="flex items-center justify-between bg-slate-800/50 rounded-xl p-3">
                <span className="text-white font-medium">{method}</span>
                <span className="text-amber-400 font-bold">{count} orders</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Key Metrics</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center"><span className="text-slate-400">Total Revenue</span><span className="text-white font-bold text-lg">₹{totalRevenue.toLocaleString('en-IN')}</span></div>
            <div className="flex justify-between items-center"><span className="text-slate-400">Avg Order Value</span><span className="text-white font-bold text-lg">₹{orders.length ? Math.round(totalRevenue / orders.length).toLocaleString('en-IN') : 0}</span></div>
            <div className="flex justify-between items-center"><span className="text-slate-400">Conversion Rate</span><span className="text-emerald-400 font-bold text-lg">3.2%</span></div>
            <div className="flex justify-between items-center"><span className="text-slate-400">Return Rate</span><span className="text-red-400 font-bold text-lg">1.8%</span></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalytics;
