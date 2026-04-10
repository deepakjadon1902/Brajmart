import { useEffect, useState } from 'react';
import { StatusBadge } from './AdminDashboard';
import { MapPin } from 'lucide-react';
import { fetchOrders } from '@/lib/api';
import { toast } from 'sonner';

const AdminShipments = () => {
  const [orders, setOrders] = useState<any[]>([]);
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
        toast.error(err?.message || 'Failed to load shipments');
      }
    };
    load();
  }, []);
  const shipments = orders.filter((o) => o.status !== 'cancelled');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Shipments</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'To Ship', count: orders.filter(o => o.status === 'confirmed' || o.status === 'processing').length, color: 'text-amber-400' },
          { label: 'In Transit', count: orders.filter(o => o.status === 'shipped').length, color: 'text-blue-400' },
          { label: 'Out for Delivery', count: orders.filter(o => o.status === 'out_for_delivery').length, color: 'text-purple-400' },
          { label: 'Delivered', count: orders.filter(o => o.status === 'delivered').length, color: 'text-emerald-400' },
        ].map((s) => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
            <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
            <p className="text-sm text-slate-400">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm min-w-[860px]">
            <thead><tr className="text-slate-400 border-b border-slate-800">
              <th className="text-left px-5 py-3 font-medium">Order ID</th>
              <th className="text-left px-5 py-3 font-medium hidden sm:table-cell">Tracking ID</th>
              <th className="text-left px-5 py-3 font-medium">Customer</th>
              <th className="text-left px-5 py-3 font-medium">Destination</th>
              <th className="text-left px-5 py-3 font-medium">Status</th>
              <th className="text-left px-5 py-3 font-medium hidden md:table-cell">Est. Delivery</th>
            </tr></thead>
            <tbody>
              {shipments.map((o) => (
                <tr key={o.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-5 py-3 text-amber-400 font-mono text-xs">{o.id}</td>
                  <td className="px-5 py-3 text-white font-mono text-xs hidden sm:table-cell">{o.trackingId || '-'}</td>
                  <td className="px-5 py-3 text-white">{o.shippingAddress.fullName}</td>
                  <td className="px-5 py-3 text-slate-300 text-xs"><MapPin size={12} className="inline mr-1" />{o.shippingAddress.city}, {o.shippingAddress.state}</td>
                  <td className="px-5 py-3"><StatusBadge status={o.status} /></td>
                  <td className="px-5 py-3 text-slate-300 hidden md:table-cell">{o.estimatedDelivery ? new Date(o.estimatedDelivery).toLocaleDateString('en-IN') : '-'}</td>
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
