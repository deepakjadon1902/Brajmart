import { useEffect, useState } from 'react';
import { OrderStatus } from '@/store/orderStore';
import { StatusBadge } from './AdminDashboard';
import { Search, Eye, X, ChevronDown } from 'lucide-react';
import { fetchOrders, updateOrderStatus as updateOrderStatusApi } from '@/lib/api';
import { toast } from 'sonner';

const statusOptions: OrderStatus[] = ['confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];

const AdminOrders = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchOrders();
        const mapped = (Array.isArray(data) ? data : []).map((o: any) => ({
          ...o,
          id: o.orderId ? String(o.orderId) : o._id,
          _id: o._id,
          items: (o.items || []).map((i: any) => ({
            ...i,
            product: {
              name: i.name || i.product?.name || 'Item',
              image: i.image || i.product?.image || '',
            },
          })),
        }));
        setOrders(mapped);
      } catch (err: any) {
        toast.error(err?.message || 'Failed to load orders');
      }
    };
    load();
  }, []);

  const filtered = orders.filter((o) => {
    const matchSearch = o.id.toLowerCase().includes(search.toLowerCase()) || o.shippingAddress.fullName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || o.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const detail = selectedOrder ? orders.find((o) => o.id === selectedOrder) : null;
  const handleStatusUpdate = async (orderId: string, status: OrderStatus) => {
    try {
      const updated = await updateOrderStatusApi(orderId, { status, note: `Status updated to ${status}` });
      setOrders((s) => s.map((o) => (o._id === orderId ? { ...o, ...updated } : o)));
      toast.success('Order updated');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update order');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Orders Management</h1>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by Order ID or Customer..." className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none">
          <option value="all">All Status</option>
          {statusOptions.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-slate-400 border-b border-slate-800">
              <th className="text-left px-5 py-3 font-medium">Order ID</th>
              <th className="text-left px-5 py-3 font-medium">Customer</th>
              <th className="text-left px-5 py-3 font-medium">Items</th>
              <th className="text-left px-5 py-3 font-medium">Amount</th>
              <th className="text-left px-5 py-3 font-medium">Payment</th>
              <th className="text-left px-5 py-3 font-medium">Status</th>
              <th className="text-left px-5 py-3 font-medium">Date</th>
              <th className="text-left px-5 py-3 font-medium">Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-5 py-3 text-amber-400 font-mono text-xs">{o.id}</td>
                  <td className="px-5 py-3 text-white">{o.shippingAddress.fullName}</td>
                  <td className="px-5 py-3 text-slate-300">{o.items.length} items</td>
                  <td className="px-5 py-3 text-white font-medium">₹{o.total.toLocaleString('en-IN')}</td>
                  <td className="px-5 py-3 text-slate-300">{o.paymentMethod}</td>
                  <td className="px-5 py-3"><StatusBadge status={o.status} /></td>
                  <td className="px-5 py-3 text-slate-400 text-xs">{new Date(o.createdAt).toLocaleDateString('en-IN')}</td>
                  <td className="px-5 py-3">
                    <button onClick={() => setSelectedOrder(o.id)} className="text-amber-400 hover:text-amber-300"><Eye size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail Modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSelectedOrder(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h2 className="text-lg font-semibold text-white">Order {detail.id}</h2>
              <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-5">
              {/* Items */}
              <div>
                <h3 className="text-sm font-medium text-slate-400 mb-2">Items</h3>
                {detail.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 py-2">
                    <img src={item.product.image} alt={item.product.name} className="w-12 h-12 rounded-lg object-cover" />
                    <div className="flex-1"><p className="text-white text-sm">{item.product.name}</p><p className="text-slate-400 text-xs">Qty: {item.quantity} × ₹{item.price}</p></div>
                    <p className="text-white font-medium text-sm">₹{(item.price * item.quantity).toLocaleString('en-IN')}</p>
                  </div>
                ))}
              </div>

              {/* Shipping */}
              <div>
                <h3 className="text-sm font-medium text-slate-400 mb-2">Shipping Address</h3>
                <div className="bg-slate-800/50 rounded-xl p-3 text-sm text-slate-300">
                  <p className="font-medium text-white">{detail.shippingAddress.fullName}</p>
                  <p>{detail.shippingAddress.street}, {detail.shippingAddress.city}</p>
                  <p>{detail.shippingAddress.state} — {detail.shippingAddress.pincode}</p>
                  <p>📞 {detail.shippingAddress.mobile}</p>
                </div>
              </div>

              {/* Status Update */}
              <div>
                <h3 className="text-sm font-medium text-slate-400 mb-2">Update Status</h3>
                <div className="flex flex-wrap gap-2">
                  {statusOptions.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatusUpdate(detail._id, s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${detail.status === s ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'}`}
                    >
                      {s.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Timeline */}
              <div>
                <h3 className="text-sm font-medium text-slate-400 mb-2">Status History</h3>
                <div className="space-y-3">
                  {detail.statusHistory.map((h, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                      <div>
                        <p className="text-sm text-white font-medium">{h.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</p>
                        {h.note && <p className="text-xs text-slate-400">{h.note}</p>}
                        <p className="text-xs text-slate-500">{new Date(h.date).toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOrders;
