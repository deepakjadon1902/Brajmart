import { useEffect, useState } from 'react';
import { StatusBadge } from './AdminDashboard';
import { CheckCircle2, MapPin, RefreshCw, Truck } from 'lucide-react';
import { adminCheckDtdcPincode, adminTrackDtdcOrder, fetchOrders } from '@/lib/api';
import { toast } from 'sonner';

const AdminShipments = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [busyOrder, setBusyOrder] = useState('');
  const [dtdcPreview, setDtdcPreview] = useState<any | null>(null);
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
  const dtdcShipments = shipments.filter((o) => String(o.shippingService || '').toLowerCase().includes('dtdc'));

  const fetchDtdcStatus = async (order: any) => {
    const lookup = String(order.trackingId || '').trim();
    if (!lookup) {
      toast.error('Add the DTDC AWB/tracking ID first');
      return;
    }
    setBusyOrder(order.id);
    try {
      const data: any = await adminTrackDtdcOrder(lookup);
      setDtdcPreview({ order, tracking: data?.tracking || null, pincode: null });
      toast.success('DTDC status refreshed');
    } catch (err: any) {
      toast.error(err?.message || 'Unable to fetch DTDC status');
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
      const data: any = await adminCheckDtdcPincode({ desPincode: pincode });
      setDtdcPreview({ order, tracking: null, pincode: data });
      toast.success('DTDC pincode checked');
    } catch (err: any) {
      toast.error(err?.message || 'Unable to check DTDC pincode');
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
          { label: 'DTDC Active', count: dtdcShipments.length, color: 'text-emerald-400' },
        ].map((s) => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
            <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
            <p className="text-sm text-slate-400">{s.label}</p>
          </div>
        ))}
      </div>

      {dtdcPreview && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">DTDC Service Desk</p>
              <h2 className="text-white font-semibold mt-1">Order {dtdcPreview.order.id}</h2>
            </div>
            <button onClick={() => setDtdcPreview(null)} className="text-xs text-slate-400 hover:text-white">Close</button>
          </div>
          {dtdcPreview.tracking && (
            <div className="mt-4 rounded-xl bg-slate-800/50 border border-slate-700 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Truck size={16} className="text-amber-400" />
                {dtdcPreview.tracking.currentStatus}
              </div>
              {dtdcPreview.tracking.lastLocation && <p className="mt-1 text-xs text-slate-400">Last location: {dtdcPreview.tracking.lastLocation}</p>}
              {dtdcPreview.tracking.trackingPortalUrl && (
                <a
                  href={dtdcPreview.tracking.trackingPortalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex text-xs font-medium text-amber-300 hover:text-amber-200"
                >
                  Open DTDC tracking page
                </a>
              )}
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {(dtdcPreview.tracking.events || []).slice(0, 4).map((event: any, index: number) => (
                  <div key={`${event.status}-${index}`} className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                    <p className="text-xs font-medium text-white">{event.status}</p>
                    <p className="mt-1 text-xs text-slate-500">{[event.date, event.time, event.location].filter(Boolean).join(' - ') || 'DTDC update'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {dtdcPreview.pincode && (
            <div className="mt-4 rounded-xl bg-slate-800/50 border border-slate-700 p-4">
              <div className={`flex items-center gap-2 text-sm font-semibold ${dtdcPreview.pincode.serviceable ? 'text-emerald-400' : 'text-red-400'}`}>
                <CheckCircle2 size={16} />
                {dtdcPreview.pincode.orgPincode} to {dtdcPreview.pincode.desPincode}: {dtdcPreview.pincode.serviceable ? 'Serviceable' : 'Needs review'}
              </div>
              {dtdcPreview.pincode.message && <p className="mt-1 text-xs text-slate-400">{dtdcPreview.pincode.message}</p>}
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
              <th className="text-left px-5 py-3 font-medium">DTDC Tools</th>
            </tr></thead>
            <tbody>
              {shipments.map((o) => (
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
                        onClick={() => fetchDtdcStatus(o)}
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
      </div>
    </div>
  );
};

export default AdminShipments;
