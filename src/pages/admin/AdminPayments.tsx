import { useOrderStore } from '@/store/orderStore';
import { CreditCard, Wallet, Banknote, DollarSign } from 'lucide-react';

const AdminPayments = () => {
  const orders = useOrderStore((s) => s.orders);
  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);

  const methodStats = orders.reduce<Record<string, { count: number; total: number }>>((acc, o) => {
    if (!acc[o.paymentMethod]) acc[o.paymentMethod] = { count: 0, total: 0 };
    acc[o.paymentMethod].count++;
    acc[o.paymentMethod].total += o.total;
    return acc;
  }, {});

  const icons: Record<string, any> = { UPI: Wallet, COD: Banknote, Card: CreditCard };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Payments</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-3"><DollarSign size={20} className="text-white" /></div>
          <p className="text-2xl font-bold text-white">₹{totalRevenue.toLocaleString('en-IN')}</p>
          <p className="text-sm text-slate-400">Total Collected</p>
        </div>
        {Object.entries(methodStats).map(([method, data]) => {
          const Icon = icons[method] || CreditCard;
          return (
            <div key={method} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mb-3"><Icon size={20} className="text-white" /></div>
              <p className="text-2xl font-bold text-white">₹{data.total.toLocaleString('en-IN')}</p>
              <p className="text-sm text-slate-400">{method} — {data.count} txns</p>
            </div>
          );
        })}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-800"><h2 className="text-lg font-semibold text-white">Transaction History</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-slate-400 border-b border-slate-800">
              <th className="text-left px-5 py-3 font-medium">Transaction ID</th>
              <th className="text-left px-5 py-3 font-medium">Order</th>
              <th className="text-left px-5 py-3 font-medium">Customer</th>
              <th className="text-left px-5 py-3 font-medium">Method</th>
              <th className="text-left px-5 py-3 font-medium">Amount</th>
              <th className="text-left px-5 py-3 font-medium">Date</th>
              <th className="text-left px-5 py-3 font-medium">Status</th>
            </tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-5 py-3 text-slate-300 font-mono text-xs">TXN-{o.id.split('-').pop()}</td>
                  <td className="px-5 py-3 text-amber-400 font-mono text-xs">{o.id}</td>
                  <td className="px-5 py-3 text-white">{o.shippingAddress.fullName}</td>
                  <td className="px-5 py-3"><span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">{o.paymentMethod}</span></td>
                  <td className="px-5 py-3 text-white font-medium">₹{o.total.toLocaleString('en-IN')}</td>
                  <td className="px-5 py-3 text-slate-400 text-xs">{new Date(o.createdAt).toLocaleDateString('en-IN')}</td>
                  <td className="px-5 py-3"><span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{o.status === 'cancelled' ? 'Refunded' : 'Paid'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminPayments;
