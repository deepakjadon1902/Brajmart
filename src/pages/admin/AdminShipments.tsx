import { useOrderStore } from '@/store/orderStore';
import { StatusBadge } from './AdminDashboard';
import { Truck, MapPin } from 'lucide-react';

const AdminShipments = () => {
  const orders = useOrderStore((s) => s.orders);
  const shipments = orders.filter((o) => o.status !== 'cancelled');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Shipments</h1>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: 'To Ship', count: orders.filter(o => o.status === 'confirmed' || o.status === 'processing').length, color: 'text-amber-400' },
          { label: 'In Transit', count: orders.filter(o => o.status === 'shipped').length, color: 'text-blue-400' },
          { label: 'Out for Delivery', count: orders.filter(o => o.status === 'out_for_delivery').length, color: 'text-purple-400' },
          { label: 'Delivered', count: orders.filter(o => o.status === 'delivered').length, color: 'text-emerald-400' },
        ].map((s) => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
            <p className="text-sm text-slate-400">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-slate-400 border-b border-slate-800">
              <th className="text-left px-5 py-3 font-medium">Order ID</th>
              <th className="text-left px-5 py-3 font-medium">Tracking ID</th>
              <th className="text-left px-5 py-3 font-medium">Customer</th>
              <th className="text-left px-5 py-3 font-medium">Destination</th>
              <th className="text-left px-5 py-3 font-medium">Status</th>
              <th className="text-left px-5 py-3 font-medium">Est. Delivery</th>
            </tr></thead>
            <tbody>
              {shipments.map((o) => (
                <tr key={o.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-5 py-3 text-amber-400 font-mono text-xs">{o.id}</td>
                  <td className="px-5 py-3 text-white font-mono text-xs">{o.trackingId || '—'}</td>
                  <td className="px-5 py-3 text-white">{o.shippingAddress.fullName}</td>
                  <td className="px-5 py-3 text-slate-300 text-xs"><MapPin size={12} className="inline mr-1" />{o.shippingAddress.city}, {o.shippingAddress.state}</td>
                  <td className="px-5 py-3"><StatusBadge status={o.status} /></td>
                  <td className="px-5 py-3 text-slate-300">{o.estimatedDelivery ? new Date(o.estimatedDelivery).toLocaleDateString('en-IN') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminShipments;
