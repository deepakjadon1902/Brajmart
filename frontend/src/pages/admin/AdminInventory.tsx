import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  ClipboardList,
  History,
  PackageCheck,
  PackageX,
  Pencil,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import {
  adjustInventoryStock,
  fetchInventoryAudit,
  fetchInventoryDashboard,
  fetchInventoryHistory,
  fetchInventoryProducts,
  InventoryAuditIssue,
  InventoryAuditItem,
  InventoryProduct,
  InventoryTransaction,
  saveInventoryProductCorrection,
} from '@/lib/api';
import { useProductStore } from '@/store/productStore';
import { toast } from 'sonner';

const PRODUCT_SYNC_KEY = 'brajmart-products-updated-at';
const PRODUCT_SYNC_EVENT = 'brajmart-products-updated';

const statusLabel: Record<InventoryProduct['status'], string> = {
  HEALTHY: 'Healthy',
  LOW_STOCK: 'Low stock',
  OUT_OF_STOCK: 'Out of stock',
  UNMANAGED: 'Unmanaged',
  INVALID: 'Invalid',
};

const statusClass: Record<InventoryProduct['status'], string> = {
  HEALTHY: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  LOW_STOCK: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  OUT_OF_STOCK: 'bg-red-500/10 text-red-300 border-red-500/30',
  UNMANAGED: 'bg-slate-500/10 text-slate-300 border-slate-600',
  INVALID: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
};

const adjustmentReasons = [
  'Purchase received',
  'Supplier adjustment',
  'Damaged stock',
  'Lost stock',
  'Manual correction',
  'Return received',
  'Warehouse correction',
];

const formatDate = (value?: string) => {
  if (!value) return 'Not updated';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not updated';
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
};

const currency = (value: number | null | undefined) =>
  value === null || value === undefined ? '-' : `₹${Number(value).toLocaleString('en-IN')}`;

const AdminInventory = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboard, setDashboard] = useState<Awaited<ReturnType<typeof fetchInventoryDashboard>> | null>(null);
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [audit, setAudit] = useState<Awaited<ReturnType<typeof fetchInventoryAudit>> | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [adjusting, setAdjusting] = useState<InventoryProduct | null>(null);
  const [historyProduct, setHistoryProduct] = useState<InventoryProduct | null>(null);
  const [history, setHistory] = useState<InventoryTransaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [correctionItem, setCorrectionItem] = useState<InventoryAuditItem | null>(null);
  const refreshProducts = useProductStore((state) => state.loadFromApi);

  const auditByProductId = useMemo(() => {
    const map = new Map<string, InventoryAuditItem>();
    for (const item of audit?.items || []) map.set(String(item.id), item);
    return map;
  }, [audit]);

  const load = async (nextPage = page) => {
    setRefreshing(true);
    try {
      const [dash, list, auditReport] = await Promise.all([
        fetchInventoryDashboard(),
        fetchInventoryProducts({ page: nextPage, limit: 20, q: query, status }),
        fetchInventoryAudit(),
      ]);
      setDashboard(dash);
      setProducts(list.items);
      setTotalPages(list.totalPages);
      setAudit(auditReport);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load inventory');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(1);
      load(1);
    }, 250);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, status]);

  useEffect(() => {
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const metrics = useMemo(() => {
    const totals = dashboard?.totals;
    return [
      { label: 'Total Products', value: totals?.totalProducts ?? 0, icon: Boxes, tone: 'text-blue-300' },
      { label: 'In Stock', value: totals?.inStock ?? 0, icon: PackageCheck, tone: 'text-emerald-300' },
      { label: 'Low Stock', value: totals?.lowStock ?? 0, icon: AlertTriangle, tone: 'text-amber-300' },
      { label: 'Out Of Stock', value: totals?.outOfStock ?? 0, icon: PackageX, tone: 'text-red-300' },
      { label: 'Reserved Stock', value: totals?.reservedStock ?? 0, icon: ClipboardList, tone: 'text-purple-300' },
    ];
  }, [dashboard]);

  const openHistory = async (product: InventoryProduct) => {
    setHistoryProduct(product);
    setHistoryLoading(true);
    try {
      const data = await fetchInventoryHistory(product.id);
      setHistory(data.transactions);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const onAdjusted = async () => {
    setAdjusting(null);
    await load(page);
  };

  const onCorrectionSaved = async () => {
    setCorrectionItem(null);
    await Promise.all([load(page), refreshProducts({ force: true })]);
    try {
      localStorage.setItem(PRODUCT_SYNC_KEY, String(Date.now()));
      window.dispatchEvent(new Event(PRODUCT_SYNC_EVENT));
    } catch {
      // ignore storage/event issues in restricted browser modes
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">Inventory Control</p>
          <h1 className="mt-1 text-2xl font-bold text-white">Inventory & Product Data</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Track physical stock, reservations, product-data risks, and every stock movement without touching payment logic.
          </p>
        </div>
        <button
          type="button"
          onClick={() => load(page)}
          disabled={refreshing}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500">{metric.label}</p>
                  <p className="mt-1 text-2xl font-bold text-white">{loading ? '-' : metric.value}</p>
                </div>
                <div className={`rounded-lg border border-slate-800 bg-slate-950 p-2 ${metric.tone}`}>
                  <Icon size={19} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 rounded-xl border border-slate-800 bg-slate-900">
          <div className="flex flex-col gap-3 border-b border-slate-800 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Stock Table</h2>
              <p className="text-xs text-slate-500">Available stock is calculated by the backend.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search product, SKU, category"
                  className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 text-sm text-white outline-none focus:border-amber-400 sm:w-72"
                />
              </label>
              <label className="relative">
                <SlidersHorizontal size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="h-10 rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-8 text-sm text-white outline-none focus:border-amber-400"
                >
                  <option value="ALL">All status</option>
                  <option value="HEALTHY">Healthy</option>
                  <option value="LOW_STOCK">Low stock</option>
                  <option value="OUT_OF_STOCK">Out of stock</option>
                  <option value="INVALID">Invalid</option>
                  <option value="UNMANAGED">Unmanaged</option>
                </select>
              </label>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-left text-sm">
              <thead className="bg-slate-950/60 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Reserved</th>
                  <th className="px-4 py-3">Available</th>
                  <th className="px-4 py-3">Threshold</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last Updated</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                      {loading ? 'Loading inventory...' : 'No inventory products match this view.'}
                    </td>
                  </tr>
                ) : (
                  products.map((product) => {
                    const auditItem = auditByProductId.get(String(product.id));
                    const correctionTarget = auditItem || ({
                      id: product.id,
                      name: product.name,
                      slug: product.slug,
                      category: product.category,
                      price: null,
                      originalPrice: null,
                      rating: null,
                      reviewCount: null,
                      inStock: product.inStock,
                      stockQuantity: product.stockQuantity,
                      reservedQuantity: product.reservedQuantity,
                      lowStockThreshold: product.lowStockThreshold,
                      sku: product.sku,
                      issueCount: 0,
                      issues: [],
                    } satisfies InventoryAuditItem);

                    return (
                    <tr key={product.id} className="align-middle">
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <img src={product.image || '/placeholder.svg'} alt="" className="h-11 w-11 rounded-lg object-cover" />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-white">{product.name}</p>
                            <p className="truncate text-xs text-slate-500">#{product.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-300">{product.sku || 'Missing'}</td>
                      <td className="px-4 py-3 text-slate-300">{product.category || '-'}</td>
                      <td className="px-4 py-3 text-white">{product.stockQuantity ?? 'Unmanaged'}</td>
                      <td className="px-4 py-3 text-slate-300">{product.reservedQuantity}</td>
                      <td className="px-4 py-3 text-white">{product.availableQuantity ?? 'Unmanaged'}</td>
                      <td className="px-4 py-3 text-slate-300">{product.lowStockThreshold}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass[product.status]}`}>
                          {statusLabel[product.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{formatDate(product.updatedAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setAdjusting(product)}
                            className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/20"
                          >
                            Adjust
                          </button>
                          <button
                            type="button"
                            onClick={() => openHistory(product)}
                            className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                          >
                            History
                          </button>
                          <button
                            type="button"
                            onClick={() => setCorrectionItem(correctionTarget)}
                            className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-800 p-4">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-sm text-slate-400">Page {page} of {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </section>

        <aside className="space-y-5">
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Inventory Alerts</h2>
                <p className="text-xs text-slate-500">Needs admin attention.</p>
              </div>
              <AlertTriangle size={18} className="text-amber-300" />
            </div>
            <div className="mt-4 space-y-3">
              {dashboard?.alerts.length ? dashboard.alerts.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setAdjusting(item)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-left hover:border-amber-500/40"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-white">{item.name}</span>
                    <span className="text-xs text-slate-500">Available: {item.availableQuantity ?? 'Unmanaged'}</span>
                  </span>
                  <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold ${statusClass[item.status]}`}>
                    {statusLabel[item.status]}
                  </span>
                </button>
              )) : (
                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-400">
                  No urgent stock alerts.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Product Data Audit</h2>
                <p className="text-xs text-slate-500">{audit?.productsWithIssues ?? 0} products need review.</p>
              </div>
              <ClipboardList size={18} className="text-blue-300" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                <p className="text-xs text-red-200">Errors</p>
                <p className="text-xl font-bold text-white">{audit?.errorCount ?? 0}</p>
              </div>
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
                <p className="text-xs text-amber-200">Warnings</p>
                <p className="text-xl font-bold text-white">{audit?.warningCount ?? 0}</p>
              </div>
            </div>
            <div className="mt-4 max-h-[480px] space-y-3 overflow-y-auto pr-1">
              {audit?.items.slice(0, 12).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCorrectionItem(item)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-left hover:border-amber-500/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-white">{item.name || `Product #${item.id}`}</p>
                    <span className="shrink-0 text-xs text-slate-500">{item.issueCount} issues</span>
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-400">{item.issues[0]?.message}</p>
                </button>
              ))}
              {!audit?.items.length && (
                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-400">
                  Product data audit is clean.
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>

      {adjusting && <AdjustStockModal product={adjusting} onClose={() => setAdjusting(null)} onSaved={onAdjusted} />}
      {historyProduct && (
        <HistoryModal
          product={historyProduct}
          transactions={history}
          loading={historyLoading}
          onClose={() => {
            setHistoryProduct(null);
            setHistory([]);
          }}
        />
      )}
      {correctionItem && <CorrectionModal item={correctionItem} onClose={() => setCorrectionItem(null)} onSaved={onCorrectionSaved} />}
    </div>
  );
};

const AdjustStockModal = ({ product, onClose, onSaved }: { product: InventoryProduct; onClose: () => void; onSaved: () => void }) => {
  const [type, setType] = useState<'INCREASE' | 'DECREASE' | 'SET'>('INCREASE');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState(adjustmentReasons[0]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const nextStock = useMemo(() => {
    const qty = Number(quantity);
    const current = product.stockQuantity ?? 0;
    if (!Number.isFinite(qty)) return current;
    if (type === 'INCREASE') return current + qty;
    if (type === 'DECREASE') return current - qty;
    return qty;
  }, [product.stockQuantity, quantity, type]);

  const blocked = nextStock < product.reservedQuantity;

  const submit = async () => {
    try {
      setSaving(true);
      await adjustInventoryStock(product.id, { type, quantity: Number(quantity), reason, note });
      toast.success('Stock adjustment recorded');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to adjust stock');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900" onClick={(event) => event.stopPropagation()}>
        <div className="border-b border-slate-800 p-5">
          <h3 className="text-lg font-semibold text-white">Adjust Stock</h3>
          <p className="mt-1 text-sm text-slate-400">{product.name}</p>
        </div>
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-3 gap-2">
            {(['INCREASE', 'DECREASE', 'SET'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setType(option)}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold ${type === option ? 'border-amber-400 bg-amber-500/15 text-amber-100' : 'border-slate-700 text-slate-300'}`}
              >
                {option === 'SET' ? 'Set' : option[0] + option.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Quantity" value={quantity} onChange={setQuantity} type="number" />
            <label>
              <span className="mb-1 block text-sm text-slate-300">Reason</span>
              <select value={reason} onChange={(event) => setReason(event.target.value)} className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-amber-400">
                {adjustmentReasons.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
          </div>
          <Field label="Reference / note" value={note} onChange={setNote} />
          <div className={`rounded-xl border p-3 text-sm ${blocked ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-slate-800 bg-slate-950/50 text-slate-300'}`}>
            Current stock: {product.stockQuantity ?? 0} · Reserved: {product.reservedQuantity} · New stock: {Number.isFinite(nextStock) ? nextStock : '-'}
            {blocked && <p className="mt-1 text-xs">Blocked: new stock cannot be below currently reserved stock.</p>}
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-800 p-5">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200">Cancel</button>
          <button
            type="button"
            disabled={saving || blocked || !quantity || !reason}
            onClick={submit}
            className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
          >
            Save Adjustment
          </button>
        </div>
      </div>
    </div>
  );
};

const HistoryModal = ({ product, transactions, loading, onClose }: { product: InventoryProduct; transactions: InventoryTransaction[]; loading: boolean; onClose: () => void }) => (
  <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
    <div className="w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-900" onClick={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between gap-3 border-b border-slate-800 p-5">
        <div>
          <h3 className="text-lg font-semibold text-white">Inventory History</h3>
          <p className="mt-1 text-sm text-slate-400">{product.name}</p>
        </div>
        <History size={20} className="text-slate-500" />
      </div>
      <div className="max-h-[65vh] overflow-y-auto p-5">
        {loading ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-6 text-center text-slate-400">Loading history...</div>
        ) : transactions.length ? (
          <div className="space-y-3">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-semibold text-white">{transaction.type} · {transaction.quantity}</p>
                  <p className="text-xs text-slate-500">{formatDate(transaction.createdAt)}</p>
                </div>
                <p className="mt-2 text-sm text-slate-300">{transaction.reason || 'No reason recorded'}</p>
                <p className="mt-2 text-xs text-slate-500">
                  Stock {transaction.previousQuantity ?? '-'} → {transaction.newQuantity ?? '-'} · Reserved {transaction.previousReserved ?? '-'} → {transaction.newReserved ?? '-'}
                  {transaction.orderId ? ` · Order #${transaction.orderId}` : ''} {transaction.createdBy ? ` · ${transaction.createdBy}` : ''}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-6 text-center text-slate-400">No inventory history yet.</div>
        )}
      </div>
      <div className="flex justify-end border-t border-slate-800 p-5">
        <button type="button" onClick={onClose} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200">Close</button>
      </div>
    </div>
  </div>
);

const correctionFieldLabels: Record<string, string> = {
  name: 'Product Name',
  slug: 'URL Slug',
  sku: 'SKU',
  price: 'Sale Price',
  originalPrice: 'MRP',
  image: 'Primary Image URL',
  category: 'Category',
  rating: 'Rating',
  reviewCount: 'Review Count',
  lowStockThreshold: 'Low Stock Threshold',
  stockQuantity: 'Stock Quantity',
  reservedQuantity: 'Reserved Quantity',
  inStock: 'In Stock',
  description: 'Description',
  metaTitle: 'SEO Title',
  metaDescription: 'SEO Description',
};

const numericCorrectionFields = new Set(['price', 'originalPrice', 'rating', 'reviewCount', 'lowStockThreshold', 'stockQuantity', 'reservedQuantity']);
const editableCorrectionFields = new Set(Object.keys(correctionFieldLabels));

const fieldValue = (item: InventoryAuditItem, field: string) => {
  const value = item[field as keyof InventoryAuditItem];
  if (value === null || value === undefined) return '';
  return typeof value === 'boolean' ? value : String(value);
};

const CorrectionModal = ({ item, onClose, onSaved }: { item: InventoryAuditItem; onClose: () => void; onSaved: () => void }) => {
  const issueFields = Array.from(new Set(item.issues.map((issue) => issue.field).filter((field) => editableCorrectionFields.has(field))));
  const fallbackFields = ['name', 'slug', 'sku', 'category', 'price', 'originalPrice', 'rating', 'reviewCount', 'lowStockThreshold', 'inStock'];
  const fields = issueFields.length ? issueFields : fallbackFields;
  const [form, setForm] = useState<Record<string, string | boolean>>(() =>
    Object.fromEntries(fields.map((field) => [field, fieldValue(item, field)]))
  );
  const [saving, setSaving] = useState(false);
  const blockedIssues = item.issues.filter((issue) => !editableCorrectionFields.has(issue.field));
  const issuesByField = useMemo(() => {
    return item.issues.reduce<Record<string, InventoryAuditIssue[]>>((acc, issue) => {
      acc[issue.field] = [...(acc[issue.field] || []), issue];
      return acc;
    }, {});
  }, [item.issues]);

  const updateField = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const submit = async () => {
    try {
      setSaving(true);
      const payload = fields.reduce<Record<string, unknown>>((acc, field) => {
        const value = form[field];
        if (numericCorrectionFields.has(field)) {
          acc[field] = value === '' ? null : Number(value);
        } else {
          acc[field] = value;
        }
        return acc;
      }, {});
      await saveInventoryProductCorrection(item.id, payload);
      toast.success('Product correction saved');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save correction');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-900" onClick={(event) => event.stopPropagation()}>
        <div className="border-b border-slate-800 p-5">
          <h3 className="text-lg font-semibold text-white">Edit Product Data</h3>
          <p className="mt-1 text-sm text-slate-400">{item.name || `Product #${item.id}`}</p>
        </div>
        <div className="max-h-[68vh] space-y-4 overflow-y-auto p-5">
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
            <p className="text-sm font-semibold text-white">{item.issueCount || item.issues.length || 'No'} issues found</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {item.issues.length ? item.issues.map((issue) => (
                <span
                  key={`${issue.code}-${issue.field}`}
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${issue.severity === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-amber-500/30 bg-amber-500/10 text-amber-200'}`}
                >
                  {issue.code}
                </span>
              )) : (
                <span className="text-xs text-slate-400">You can edit the core inventory product fields here.</span>
              )}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => {
              const fieldIssues = issuesByField[field] || [];
              const value = form[field];
              if (field === 'inStock') {
                return (
                  <label key={field} className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                    <span className="mb-2 block text-sm font-semibold text-slate-200">{correctionFieldLabels[field]}</span>
                    <select
                      value={value ? 'true' : 'false'}
                      onChange={(event) => updateField(field, event.target.value === 'true')}
                      className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-amber-400"
                    >
                      <option value="true">In stock</option>
                      <option value="false">Out of stock</option>
                    </select>
                    {fieldIssues.map((issue) => (
                      <p key={issue.code} className="mt-2 text-xs text-slate-400">{issue.message} {issue.recommendedCorrection || ''}</p>
                    ))}
                  </label>
                );
              }
              return (
                <div key={field} className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
                  <Field
                    label={correctionFieldLabels[field] || field}
                    value={String(value ?? '')}
                    onChange={(next) => updateField(field, next)}
                    type={field === 'description' || field === 'metaDescription' ? 'textarea' : numericCorrectionFields.has(field) ? 'number' : 'text'}
                  />
                  {fieldIssues.map((issue) => (
                    <p key={issue.code} className="mt-2 text-xs text-slate-400">{issue.message} {issue.recommendedCorrection || ''}</p>
                  ))}
                </div>
              );
            })}
          </div>
          {blockedIssues.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
              {blockedIssues.map((issue) => (
                <p key={`${issue.code}-${issue.field}`}>{issue.message} {issue.recommendedCorrection || ''}</p>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-800 p-5">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200">Cancel</button>
          <button type="button" disabled={saving} onClick={submit} className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50">
            <Pencil size={15} />
            Save Product Data
          </button>
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) => (
  <label>
    <span className="mb-1 block text-sm text-slate-300">{label}</span>
    {type === 'textarea' ? (
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-400"
      />
    ) : (
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-amber-400"
      />
    )}
  </label>
);

export default AdminInventory;
