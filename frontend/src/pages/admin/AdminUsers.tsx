import { useEffect, useState } from 'react';
import { Search, Ban, CheckCircle, Mail, Phone, MapPin, CalendarDays, ShoppingBag, IndianRupee, UserRound } from 'lucide-react';
import { fetchUsers, updateUserStatus } from '@/lib/api';
import { toast } from 'sonner';
import AdminPagination, { ADMIN_PAGE_SIZE } from '@/components/admin/AdminPagination';

type UserAddress = {
  fullName?: string;
  mobile?: string;
  street?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  isDefault?: boolean;
};

interface MockUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  addresses: UserAddress[];
  joined: string;
  orders: number;
  spent: number;
  status: 'active' | 'blocked';
  customerType?: 'registered' | 'guest';
}

interface AdminUserResponse {
  _id?: string;
  id?: string;
  name?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  addresses?: UserAddress[];
  createdAt?: string;
  orders?: number | string;
  spent?: number | string;
  status?: 'active' | 'blocked';
  customerType?: 'registered' | 'guest';
}

const AdminUsers = () => {
  const [users, setUsers] = useState<MockUser[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchUsers({ search: debouncedSearch });
        const mapped = (Array.isArray(data) ? data : []).map((u: AdminUserResponse) => ({
          id: u._id || u.id,
          name: u.name || u.fullName || 'User',
          email: u.email || '',
          phone: u.phone || '',
          addresses: Array.isArray(u.addresses) ? u.addresses : [],
          joined: u.createdAt || new Date().toISOString(),
          orders: Number(u.orders || 0),
          spent: Number(u.spent || 0),
          status: u.status || 'active',
          customerType: u.customerType || 'registered',
        }));
        setUsers(mapped);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to load users');
      }
    };
    load();
  }, [debouncedSearch]);

  const getPrimaryAddress = (user: MockUser) => user.addresses.find((a) => a.isDefault) || user.addresses[0] || {};

  const formatAddress = (address: UserAddress) => {
    const street = address.street || address.address || '';
    return [street, address.city, address.state, address.pincode].filter(Boolean).join(', ');
  };

  const filtered = users.filter((u) => {
    const query = search.trim().toLowerCase();
    const address = formatAddress(getPrimaryAddress(u)).toLowerCase();
    return !query
      || u.name.toLowerCase().includes(query)
      || u.email.toLowerCase().includes(query)
      || u.phone.toLowerCase().includes(query)
      || address.includes(query);
  });
  const paginatedUsers = filtered.slice((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filtered.length / ADMIN_PAGE_SIZE));
    if (page > totalPages) setPage(totalPages);
  }, [filtered.length, page]);

  const toggleStatus = async (id: string) => {
    const current = users.find((u) => u.id === id);
    if (!current) return;
    const nextStatus = current.status === 'active' ? 'blocked' : 'active';
    try {
      await updateUserStatus(id, nextStatus);
      setUsers((prev) => prev.map((u) => u.id === id ? { ...u, status: nextStatus } : u));
      toast.success('User updated');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update user');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <p className="mt-1 text-sm text-slate-400">Customer contact, address, order value and account status in one place.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <p className="text-2xl font-bold text-white">{users.length}</p>
          <p className="text-sm text-slate-400">Total Users</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <p className="text-2xl font-bold text-emerald-400">{users.filter(u => u.status === 'active').length}</p>
          <p className="text-sm text-slate-400">Active</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <p className="text-2xl font-bold text-red-400">{users.filter(u => u.status === 'blocked').length}</p>
          <p className="text-sm text-slate-400">Blocked</p>
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, phone, or address..." className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
      </div>

      <div className="grid gap-4 lg:hidden">
        {paginatedUsers.map((u) => {
          const address = getPrimaryAddress(u);
          const addressLine = formatAddress(address);
          return (
            <div key={u.id} className="admin-contact-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="admin-meta-line text-base font-bold"><UserRound size={16} /> <span className="truncate">{u.name}</span></p>
                  <p className="mt-1 text-xs font-semibold">{u.customerType === 'guest' ? 'Guest checkout' : 'Registered user'}</p>
                </div>
                <span className={`admin-status-badge admin-status-${u.status} inline-flex rounded-full border px-2.5 py-1 text-xs font-medium`}>
                  {u.status}
                </span>
              </div>
              <div className="mt-4 grid gap-2 text-sm">
                <p className="admin-meta-line"><Mail size={15} /> <span className="break-all">{u.email || '-'}</span></p>
                <p className="admin-meta-line"><Phone size={15} /> <span>{u.phone || address.mobile || '-'}</span></p>
                <p className="admin-meta-line"><MapPin size={15} /> <span>{addressLine || '-'}</span></p>
                <p className="admin-meta-line"><CalendarDays size={15} /> <span>{new Date(u.joined).toLocaleDateString('en-IN')}</span></p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-700 bg-slate-800 p-3">
                  <p className="admin-meta-line text-sm font-semibold"><ShoppingBag size={15} /> <span>{u.orders} orders</span></p>
                </div>
                <div className="rounded-lg border border-slate-700 bg-slate-800 p-3">
                  <p className="admin-meta-line text-sm font-semibold"><IndianRupee size={15} /> <span>{u.spent.toLocaleString('en-IN')}</span></p>
                </div>
              </div>
              <div className="mt-4">
                {u.customerType === 'guest' ? (
                  <span className="text-xs font-semibold text-slate-500">Order only</span>
                ) : (
                  <button onClick={() => toggleStatus(u.id)} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition ${u.status === 'active' ? 'border-red-500/30 text-red-400 hover:bg-red-500/10' : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'}`}>
                    {u.status === 'active' ? <><Ban size={12} /> Block</> : <><CheckCircle size={12} /> Activate</>}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden lg:block">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm min-w-[1120px]">
            <thead><tr className="text-slate-400 border-b border-slate-800">
              <th className="text-left px-5 py-3 font-medium">User Details</th>
              <th className="text-left px-5 py-3 font-medium">Contact</th>
              <th className="text-left px-5 py-3 font-medium">Address</th>
              <th className="text-left px-5 py-3 font-medium">Joined</th>
              <th className="text-left px-5 py-3 font-medium">Orders</th>
              <th className="text-left px-5 py-3 font-medium">Spent</th>
              <th className="text-left px-5 py-3 font-medium">Status</th>
              <th className="text-left px-5 py-3 font-medium">Action</th>
            </tr></thead>
            <tbody>
              {paginatedUsers.map((u) => {
                const address = getPrimaryAddress(u);
                const addressLine = formatAddress(address);
                return (
                  <tr key={u.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 align-top">
                    <td className="px-5 py-4">
                      <div>
                        <p className="admin-meta-line text-white font-semibold"><UserRound size={15} /> <span>{u.name}</span></p>
                        <p className="mt-1 text-xs font-medium text-amber-300">{u.customerType === 'guest' ? 'Guest checkout' : 'Registered user'}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="space-y-2">
                        <p className="admin-meta-line text-xs"><Mail size={14} /> <span className="break-all">{u.email || '-'}</span></p>
                        <p className="admin-meta-line text-xs"><Phone size={14} /> <span>{u.phone || address.mobile || '-'}</span></p>
                      </div>
                    </td>
                    <td className="px-5 py-4 max-w-[320px]">
                      <p className="admin-meta-line text-xs leading-5"><MapPin size={14} /> <span>{addressLine || '-'}</span></p>
                    </td>
                    <td className="px-5 py-4 text-slate-300">{new Date(u.joined).toLocaleDateString('en-IN')}</td>
                    <td className="px-5 py-4 text-white">{u.orders}</td>
                    <td className="px-5 py-4 text-white">INR {u.spent.toLocaleString('en-IN')}</td>
                    <td className="px-5 py-4">
                      <span className={`admin-status-badge admin-status-${u.status} inline-flex rounded-full border px-2.5 py-1 text-xs font-medium`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {u.customerType === 'guest' ? (
                        <span className="text-xs text-slate-500">Order only</span>
                      ) : (
                        <button onClick={() => toggleStatus(u.id)} className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition ${u.status === 'active' ? 'border-red-500/30 text-red-400 hover:bg-red-500/10' : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'}`}>
                          {u.status === 'active' ? <><Ban size={12} /> Block</> : <><CheckCircle size={12} /> Activate</>}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <AdminPagination page={page} totalItems={filtered.length} onPageChange={setPage} itemLabel="users" />
    </div>
  );
};

export default AdminUsers;
