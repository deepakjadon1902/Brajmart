import { usePaymentStore } from '@/store/paymentStore';
import { useOrderStore } from '@/store/orderStore';
import { CreditCard, Wallet, Banknote, DollarSign, AlertCircle } from 'lucide-react';

const AdminPayments = () => {
  const payments = usePaymentStore((s) => s.payments);
  const orders = useOrderStore((s) => s.orders);
  const totalRevenue = payments.reduce((s, p) => s + p.amount, 0);
  const paidRevenue = payments.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const pendingRevenue = payments.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amount, 0);

  const methodStats = payments.reduce<Record<string, { count: number; total: number }>>((acc, p) => {
    if (!acc[p.method]) acc[p.method] = { count: 0, total: 0 };
    acc[p.method].count++;
    acc[p.method].total += p.amount;
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
          <p className="text-sm text-slate-400">Total Revenue</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mb-3"><CreditCard size={20} className="text-white" /></div>
          <p className="text-2xl font-bold text-white">₹{paidRevenue.toLocaleString('en-IN')}</p>
          <p className="text-sm text-slate-400">Collected</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center mb-3"><AlertCircle size={20} className="text-white" /></div>
          <p className="text-2xl font-bold text-white">₹{pendingRevenue.toLocaleString('en-IN')}</p>
          <p className="text-sm text-slate-400">Pending (COD)</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-3"><DollarSign size={20} className="text-white" /></div>
          <p className="text-2xl font-bold text-white">{payments.length}</p>
          <p className="text-sm text-slate-400">Total Transactions</p>
        </div>
      </div>

      {/* Method breakdown */}
      {Object.keys(methodStats).length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Object.entries(methodStats).map(([method, data]) => {
            const Icon = icons[method] || CreditCard;
            return (
              <div key={method} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center"><Icon size={16} className="text-white" /></div>
                  <span className="text-white font-medium">{method}</span>
                </div>
                <p className="text-xl font-bold text-white">₹{data.total.toLocaleString('en-IN')}</p>
                <p className="text-xs text-slate-400">{data.count} transactions</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-800"><h2 className="text-lg font-semibold text-white">Transaction History</h2></div>
        {payments.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <CreditCard size={40} className="mx-auto mb-3 opacity-40" />
            <p>No transactions yet. Payments will appear here when users place orders.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800">
                  <th className="text-left px-5 py-3 font-medium">Transaction ID</th>
                  <th className="text-left px-5 py-3 font-medium">Order ID</th>
                  <th className="text-left px-5 py-3 font-medium">Customer</th>
                  <th className="text-left px-5 py-3 font-medium">Method</th>
                  <th className="text-left px-5 py-3 font-medium">Amount</th>
                  <th className="text-left px-5 py-3 font-medium">Date</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-5 py-3 text-slate-300 font-mono text-xs">{p.transactionId}</td>
                    <td className="px-5 py-3 text-amber-400 font-mono text-xs">{p.orderId}</td>
                    <td className="px-5 py-3 text-white">{p.customerName}</td>
                    <td className="px-5 py-3">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">{p.method}</span>
                    </td>
                    <td className="px-5 py-3 text-white font-medium">₹{p.amount.toLocaleString('en-IN')}</td>
                    <td className="px-5 py-3 text-slate-400 text-xs">{new Date(p.createdAt).toLocaleDateString('en-IN')}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        p.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        p.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                        p.status === 'refunded' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                        'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>{p.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPayments;
