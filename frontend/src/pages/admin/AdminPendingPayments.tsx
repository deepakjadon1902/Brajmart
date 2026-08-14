import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, CreditCard, Mail, MapPin, Phone, RefreshCw, Search, UserRound } from 'lucide-react';
import { confirmPendingPayment, fetchPendingPaymentOrders } from '@/lib/api';
import { toast } from 'sonner';
import AdminPagination, { ADMIN_PAGE_SIZE } from '@/components/admin/AdminPagination';

type PendingPaymentItem = {
  productId?: string;
  name?: string;
  image?: string;
  price?: number;
  quantity?: number;
  selectedSize?: string;
  selectedPieces?: string;
};

type PendingPaymentOrder = {
  _id?: string;
  orderId?: number;
  items?: PendingPaymentItem[];
  total?: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: {
    fullName?: string;
    mobile?: string;
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  paymentMethod?: string;
  paymentStatus?: string;
  paymentToken?: string;
  paymentCreatedAt?: string;
  paymentUpdatedAt?: string;
  createdAt?: string;
};

const formatDate = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('en-IN');
};

const addressText = (address?: PendingPaymentOrder['customerAddress']) =>
  [address?.street, address?.city, address?.state, address?.pincode].filter(Boolean).join(', ');

const AdminPendingPayments = () => {
  const [orders, setOrders] = useState<PendingPaymentOrder[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | number | null>(null);
  const [page, setPage] = useState(1);

  const load = async (query = debouncedSearch) => {
    setLoading(true);
    try {
      const data = await fetchPendingPaymentOrders({ search: query });
      setOrders(Array.isArray(data) ? data as PendingPaymentOrder[] : []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load pending payment users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    load(debouncedSearch);
    const interval = window.setInterval(() => load(debouncedSearch), 10_000);
    return () => window.clearInterval(interval);
  }, [debouncedSearch]);

  const summary = useMemo(() => {
    const products = orders.reduce((sum, order) => sum + (order.items?.length || 0), 0);
    const value = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    return { products, value };
  }, [orders]);

  const filtered = orders.filter((order) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    const address = addressText(order.customerAddress).toLowerCase();
    return String(order.orderId || order._id || '').toLowerCase().includes(query)
      || String(order.customerName || '').toLowerCase().includes(query)
      || String(order.customerEmail || '').toLowerCase().includes(query)
      || String(order.customerPhone || '').toLowerCase().includes(query)
      || address.includes(query)
      || (order.items || []).some((item) => String(item.name || '').toLowerCase().includes(query));
  });
  const paginatedOrders = filtered.slice((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filtered.length / ADMIN_PAGE_SIZE));
    if (page > totalPages) setPage(totalPages);
  }, [filtered.length, page]);

  const handleConfirmPayment = async (order: PendingPaymentOrder) => {
    const orderId = order.orderId || order._id;
    if (!orderId) {
      toast.error('Order ID is missing');
      return;
    }
    const ok = window.confirm(`Confirm payment for order #${orderId}?\n\nOnly use this after you have received the QR/manual payment.`);
    if (!ok) return;

    setConfirmingOrderId(orderId);
    try {
      await confirmPendingPayment(orderId, {
        note: 'Payment manually confirmed by admin after QR payment',
      });
      setOrders((current) => current.filter((item) => String(item.orderId || item._id) !== String(orderId)));
      toast.success(`Payment confirmed for order #${orderId}`);
      load(debouncedSearch);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to confirm payment');
    } finally {
      setConfirmingOrderId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Pending Payment Users</h1>
          <p className="mt-1 text-sm text-slate-400">Customers who reached online checkout but have not completed payment yet.</p>
        </div>
        <button
          onClick={() => load()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-amber-500/50 hover:text-amber-300 disabled:opacity-60"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-2xl font-bold text-white">{orders.length}</p>
          <p className="text-sm text-slate-400">Pending checkouts</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-2xl font-bold text-amber-300">INR {summary.value.toLocaleString('en-IN')}</p>
          <p className="text-sm text-slate-400">Recoverable value</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-2xl font-bold text-sky-300">{summary.products}</p>
          <p className="text-sm text-slate-400">Products waiting</p>
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search order, customer, phone, address, or product..."
          className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="px-5 py-3 text-left font-medium">Checkout</th>
                <th className="px-5 py-3 text-left font-medium">Customer</th>
                <th className="px-5 py-3 text-left font-medium">Address</th>
                <th className="px-5 py-3 text-left font-medium">Products</th>
                <th className="px-5 py-3 text-left font-medium">Payment</th>
              </tr>
            </thead>
            <tbody>
              {paginatedOrders.map((order) => (
                <tr key={order._id || order.orderId} className="border-b border-slate-800/50 align-top hover:bg-slate-800/30">
                  <td className="px-5 py-4">
                    <p className="font-mono text-xs font-semibold text-amber-300">#{order.orderId || order._id}</p>
                    <p className="mt-2 flex items-center gap-2 text-xs text-slate-400"><Clock3 size={13} />{formatDate(order.createdAt)}</p>
                    <p className="mt-2 font-semibold text-white">INR {Number(order.total || 0).toLocaleString('en-IN')}</p>
                  </td>
                  <td className="px-5 py-4">
                    <div className="space-y-2">
                      <p className="flex items-center gap-2 font-medium text-white"><UserRound size={15} />{order.customerName || order.customerAddress?.fullName || 'Customer'}</p>
                      <p className="flex items-center gap-2 text-xs text-slate-400"><Mail size={13} />{order.customerEmail || '-'}</p>
                      <p className="flex items-center gap-2 text-xs text-slate-400"><Phone size={13} />{order.customerPhone || order.customerAddress?.mobile || '-'}</p>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <p className="flex items-start gap-2 text-xs leading-5 text-slate-300">
                      <MapPin size={14} className="mt-0.5 shrink-0 text-slate-500" />
                      <span>{addressText(order.customerAddress) || '-'}</span>
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <div className="space-y-3">
                      {(order.items || []).map((item, index) => (
                        <div key={`${order._id}-${item.productId || index}`} className="flex items-center gap-3">
                          <img src={item.image || '/logo.png'} alt={item.name || 'Product'} className="h-12 w-12 rounded-lg object-cover" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-white">{item.name || 'Product'}</p>
                            <p className="mt-1 text-xs text-slate-400">
                              Qty {Number(item.quantity || 1)} x INR {Number(item.price || 0).toLocaleString('en-IN')}
                              {item.selectedSize ? ` | Size ${item.selectedSize}` : ''}
                              {item.selectedPieces ? ` | ${item.selectedPieces}` : ''}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300">
                      <AlertCircle size={12} />
                      {order.paymentStatus || 'pending'}
                    </span>
                    <p className="mt-2 flex items-center gap-2 text-xs text-slate-400"><CreditCard size={13} />{order.paymentMethod || 'Online'}</p>
                    <p className="mt-2 text-xs text-slate-500">Updated {formatDate(order.paymentUpdatedAt)}</p>
                    <button
                      onClick={() => handleConfirmPayment(order)}
                      disabled={confirmingOrderId === (order.orderId || order._id)}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <CheckCircle2 size={14} />
                      {confirmingOrderId === (order.orderId || order._id) ? 'Confirming...' : 'Confirm Payment'}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">
                    No pending online payment checkouts found.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">
                    Loading pending payment users...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <AdminPagination page={page} totalItems={filtered.length} onPageChange={setPage} itemLabel="checkouts" />
      </div>
    </div>
  );
};

export default AdminPendingPayments;
