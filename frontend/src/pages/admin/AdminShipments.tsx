import { useEffect, useState } from 'react';
import { StatusBadge } from './AdminDashboard';
import { CheckCircle2, MapPin, RefreshCw, Truck } from 'lucide-react';
import { adminCheckDeliveryServicePincode, adminTrackDeliveryServiceOrder, fetchOrders } from '@/lib/api';
import { toast } from 'sonner';
import AdminPagination, { ADMIN_PAGE_SIZE } from '@/components/admin/AdminPagination';

const AdminShipments = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [busyOrder, setBusyOrder] = useState('');
  const [deliveryPreview, setDeliveryPreview] = useState<any | null>(null);
  const [page, setPage] = useState(1);
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
  const delhiveryShipments = shipments.filter((o) => String(o.shippingService || '').toLowerCase().includes('delhivery'));
  const paginatedShipments = shipments.slice((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(shipments.length / ADMIN_PAGE_SIZE));
    if (page > totalPages) setPage(totalPages);
  }, [shipments.length, page]);

  const fetchDeliveryStatus = async (order: any) => {
    const lookup = String(order.trackingId || '').trim();
    if (!lookup) {
      toast.error('Add the Delhivery AWB/tracking ID first');
      return;
    }
    setBusyOrder(order.id);
    try {
      const data: any = await adminTrackDeliveryServiceOrder(lookup);
      setDeliveryPreview({ order, tracking: data?.tracking || null, pincode: null });
      toast.success('Delhivery status refreshed');
    } catch (err: any) {
      toast.error(err?.message || 'Unable to fetch Delhivery status');
    } finally {
      setBusyOrder('');
    }
  };

  const checkPincode = async (order: any) => {
    const pincode = String(order.shippingAddress?.pincode || '').trim();
    if (!pincode) {
      toast.error('Destination pincode is missing');
      return;
    }
    setBusyOrder(order.id);
    try {
      const data: any = await adminCheckDeliveryServicePincode({ desPincode: pincode });
      setDeliveryPreview({ order, tracking: null, pincode: data });
      toast.success('Delivery pincode checked');
    } catch (err: any) {
      toast.error(err?.message || 'Unable to check delivery pincode');
    } finally {
      setBusyOrder('');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Shipments</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'To Ship', count: orders.filter(o => o.status === 'confirmed' || o.status === 'processing').length, color: 'text-amber-400' },
          { label: 'In Transit', count: orders.filter(o => o.status === 'shipped').length, color: 'text-blue-400' },
          { label: 'Out for Delivery', count: orders.filter(o => o.status === 'out_for_delivery').length, color: 'text-purple-400' },
          { label: 'Delhivery Active', count: delhiveryShipments.length, color: 'text-emerald-400' },
        ].map((s) => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
            <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
            <p className="text-sm text-slate-400">{s.label}</p>
          </div>
        ))}
      </div>

      {deliveryPreview && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Delivery Service Desk</p>
              <h2 className="text-white font-semibold mt-1">Order {deliveryPreview.order.id}</h2>
            </div>
            <button onClick={() => setDeliveryPreview(null)} className="text-xs text-slate-400 hover:text-white">Close</button>
          </div>
          {deliveryPreview.tracking && (
            <div className="mt-4 rounded-xl bg-slate-800/50 border border-slate-700 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Truck size={16} className="text-amber-400" />
                {deliveryPreview.tracking.currentStatus}
              </div>
              {deliveryPreview.tracking.lastLocation && <p className="mt-1 text-xs text-slate-400">Last location: {deliveryPreview.tracking.lastLocation}</p>}
              {deliveryPreview.tracking.trackingPortalUrl && (
                <a
                  href={deliveryPreview.tracking.trackingPortalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex text-xs font-medium text-amber-300 hover:text-amber-200"
                >
                  Open Delhivery tracking page
                </a>
              )}
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {(deliveryPreview.tracking.events || []).slice(0, 4).map((event: any, index: number) => (
                  <div key={`${event.status}-${index}`} className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                    <p className="text-xs font-medium text-white">{event.status}</p>
                    <p className="mt-1 text-xs text-slate-500">{[event.date, event.time, event.location].filter(Boolean).join(' - ') || 'Delhivery update'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {deliveryPreview.pincode && (
            <div className="mt-4 rounded-xl bg-slate-800/50 border border-slate-700 p-4">
              <div className={`flex items-center gap-2 text-sm font-semibold ${deliveryPreview.pincode.serviceable ? 'text-emerald-400' : 'text-red-400'}`}>
                <CheckCircle2 size={16} />
                {deliveryPreview.pincode.desPincode || deliveryPreview.pincode.pincode}: {deliveryPreview.pincode.serviceable ? 'Serviceable' : 'Needs review'}
              </div>
              {deliveryPreview.pincode.message && <p className="mt-1 text-xs text-slate-400">{deliveryPreview.pincode.message}</p>}
            </div>
          )}
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm min-w-[980px]">
            <thead><tr className="text-slate-400 border-b border-slate-800">
              <th className="text-left px-5 py-3 font-medium">Order ID</th>
              <th className="text-left px-5 py-3 font-medium hidden sm:table-cell">Tracking ID</th>
              <th className="text-left px-5 py-3 font-medium">Customer</th>
              <th className="text-left px-5 py-3 font-medium">Courier</th>
              <th className="text-left px-5 py-3 font-medium">Destination</th>
              <th className="text-left px-5 py-3 font-medium">Status</th>
              <th className="text-left px-5 py-3 font-medium">Delivery Tools</th>
            </tr></thead>
            <tbody>
              {paginatedShipments.map((o) => (
                <tr key={o.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-5 py-3 text-amber-400 font-mono text-xs">{o.id}</td>
                  <td className="px-5 py-3 text-white font-mono text-xs hidden sm:table-cell">{o.trackingId || '-'}</td>
                  <td className="px-5 py-3 text-white">{o.shippingAddress?.fullName || o.customerName || '-'}</td>
                  <td className="px-5 py-3 text-slate-300 text-xs">{o.shippingService || '-'}</td>
                  <td className="px-5 py-3 text-slate-300 text-xs"><MapPin size={12} className="inline mr-1" />{[o.shippingAddress?.city, o.shippingAddress?.state, o.shippingAddress?.pincode].filter(Boolean).join(', ') || '-'}</td>
                  <td className="px-5 py-3"><StatusBadge status={o.status} /></td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => checkPincode(o)}
                        disabled={busyOrder === o.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 hover:border-amber-500/50 hover:text-amber-300 disabled:opacity-60"
                      >
                        <MapPin size={13} />
                        Pin
                      </button>
                      <button
                        onClick={() => fetchDeliveryStatus(o)}
                        disabled={busyOrder === o.id || !o.trackingId}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-300 hover:bg-amber-500/20 disabled:opacity-60"
                      >
                        <RefreshCw size={13} className={busyOrder === o.id ? 'animate-spin' : ''} />
                        Track
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <AdminPagination page={page} totalItems={shipments.length} onPageChange={setPage} itemLabel="shipments" />
      </div>
    </div>
  );
};

export default AdminShipments;
