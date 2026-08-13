import { useEffect, useMemo, useState } from 'react';
import { Heart, Mail, Phone, RefreshCw, Search, ShoppingCart, UserRound } from 'lucide-react';
import { fetchUsersCartFavorites } from '@/lib/api';
import { toast } from 'sonner';
import AdminPagination, { ADMIN_PAGE_SIZE } from '@/components/admin/AdminPagination';

type InterestStatus = 'cart' | 'favorite';

type InterestProduct = {
  productId: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
  selectedSize?: string;
  selectedPieces?: string;
  status: InterestStatus;
  updatedAt?: string;
};

type CustomerInterest = {
  userId: string;
  name: string;
  email: string;
  phone: string;
  statuses: InterestStatus[];
  products: InterestProduct[];
  updatedAt?: string;
};

const statusLabels: Record<InterestStatus, string> = {
  cart: 'Add to cart',
  favorite: 'Favorite',
};

const StatusPill = ({ status }: { status: InterestStatus }) => {
  const Icon = status === 'cart' ? ShoppingCart : Heart;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
      status === 'cart'
        ? 'border-sky-500/30 bg-sky-500/10 text-sky-300'
        : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
    }`}>
      <Icon size={12} />
      {statusLabels[status]}
    </span>
  );
};

const AdminCartFavorites = () => {
  const [rows, setRows] = useState<CustomerInterest[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'cart' | 'favorite' | 'both'>('all');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const load = async (query = debouncedSearch) => {
    setLoading(true);
    try {
      const data = await fetchUsersCartFavorites({ search: query });
      setRows(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load cart and favorite users');
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
    const interval = window.setInterval(() => load(debouncedSearch), 15_000);
    return () => window.clearInterval(interval);
  }, [debouncedSearch]);

  const summary = useMemo(() => {
    const cartUsers = rows.filter((row) => row.statuses.includes('cart')).length;
    const favoriteUsers = rows.filter((row) => row.statuses.includes('favorite')).length;
    const productCount = rows.reduce((sum, row) => sum + row.products.length, 0);
    return { cartUsers, favoriteUsers, productCount };
  }, [rows]);

  const filtered = rows.filter((row) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query
      || row.name.toLowerCase().includes(query)
      || row.email.toLowerCase().includes(query)
      || row.phone.toLowerCase().includes(query)
      || row.products.some((product) => product.name.toLowerCase().includes(query));

    const matchesFilter = filter === 'all'
      || (filter === 'both' ? row.statuses.includes('cart') && row.statuses.includes('favorite') : row.statuses.includes(filter));

    return matchesSearch && matchesFilter;
  });
  const paginatedRows = filtered.slice((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, filter]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filtered.length / ADMIN_PAGE_SIZE));
    if (page > totalPages) setPage(totalPages);
  }, [filtered.length, page]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Users Add to Cart or Favorite</h1>
          <p className="mt-1 text-sm text-slate-400">Outstanding customer interest, hidden automatically after the same product is ordered.</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-amber-500/50 hover:text-amber-300 disabled:opacity-60"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-2xl font-bold text-white">{rows.length}</p>
          <p className="text-sm text-slate-400">Users to follow up</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-2xl font-bold text-sky-300">{summary.cartUsers}</p>
          <p className="text-sm text-slate-400">With cart items</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-2xl font-bold text-rose-300">{summary.favoriteUsers}</p>
          <p className="text-sm text-slate-400">{summary.productCount} total products</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone, or product..."
            className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />
        </div>
        <div className="grid grid-cols-4 gap-2 rounded-xl border border-slate-800 bg-slate-900 p-1 text-xs">
          {(['all', 'cart', 'favorite', 'both'] as const).map((value) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`rounded-lg px-3 py-2 font-medium capitalize transition ${
                filter === value ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="px-5 py-3 text-left font-medium">User Details</th>
                <th className="px-5 py-3 text-left font-medium">Status</th>
                <th className="px-5 py-3 text-left font-medium">Products</th>
                <th className="px-5 py-3 text-left font-medium">Last Activity</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row) => (
                <tr key={row.userId} className="border-b border-slate-800/50 align-top hover:bg-slate-800/30">
                  <td className="px-5 py-4">
                    <div className="space-y-2">
                      <p className="flex items-center gap-2 font-medium text-white"><UserRound size={15} />{row.name || 'Customer'}</p>
                      <p className="flex items-center gap-2 text-xs text-slate-400"><Mail size={13} />{row.email || '-'}</p>
                      <p className="flex items-center gap-2 text-xs text-slate-400"><Phone size={13} />{row.phone || '-'}</p>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      {row.statuses.map((status) => <StatusPill key={`${row.userId}-${status}`} status={status} />)}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="space-y-3">
                      {row.products.map((product) => (
                        <div key={`${row.userId}-${product.status}-${product.productId}-${product.selectedSize || ''}-${product.selectedPieces || ''}`} className="flex items-center gap-3">
                          <img src={product.image || '/logo.png'} alt={product.name} className="h-12 w-12 rounded-lg object-cover" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-white">{product.name}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                              <StatusPill status={product.status} />
                              <span>Qty {product.quantity}</span>
                              <span>INR {Number(product.price || 0).toLocaleString('en-IN')}</span>
                              {product.selectedSize && <span>Size {product.selectedSize}</span>}
                              {product.selectedPieces && <span>{product.selectedPieces}</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-400">
                    {row.updatedAt ? new Date(row.updatedAt).toLocaleString('en-IN') : '-'}
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-sm text-slate-500">
                    No outstanding cart or favorite products found.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-sm text-slate-500">
                    Loading customer interest...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <AdminPagination page={page} totalItems={filtered.length} onPageChange={setPage} itemLabel="users" />
      </div>
    </div>
  );
};

export default AdminCartFavorites;
