import { useState } from 'react';
import { Search, MoreVertical, Ban, CheckCircle } from 'lucide-react';

interface MockUser {
  id: string;
  name: string;
  email: string;
  joined: string;
  orders: number;
  spent: number;
  status: 'active' | 'blocked';
}

const mockUsers: MockUser[] = [
  { id: 'u1', name: 'Deepak Jadon', email: 'deepakjadon1907@gmail.com', joined: '2026-01-15', orders: 12, spent: 8450, status: 'active' },
  { id: 'u2', name: 'Radha Sharma', email: 'radha.sharma@gmail.com', joined: '2026-02-20', orders: 5, spent: 3200, status: 'active' },
  { id: 'u3', name: 'Krishna Das', email: 'krishna.das@gmail.com', joined: '2026-03-01', orders: 3, spent: 1890, status: 'active' },
  { id: 'u4', name: 'Meera Patel', email: 'meera.patel@gmail.com', joined: '2026-02-10', orders: 8, spent: 5670, status: 'active' },
  { id: 'u5', name: 'Govind Singh', email: 'govind.singh@gmail.com', joined: '2026-01-28', orders: 2, spent: 980, status: 'blocked' },
  { id: 'u6', name: 'Yamuna Devi', email: 'yamuna.devi@gmail.com', joined: '2026-03-12', orders: 1, spent: 449, status: 'active' },
  { id: 'u7', name: 'Balram Yadav', email: 'balram.yadav@gmail.com', joined: '2026-02-05', orders: 7, spent: 4320, status: 'active' },
];

const AdminUsers = () => {
  const [users, setUsers] = useState(mockUsers);
  const [search, setSearch] = useState('');

  const filtered = users.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

  const toggleStatus = (id: string) => {
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, status: u.status === 'active' ? 'blocked' : 'active' } as MockUser : u));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Users</h1>

      <div className="flex gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex-1">
          <p className="text-2xl font-bold text-white">{users.length}</p>
          <p className="text-sm text-slate-400">Total Users</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex-1">
          <p className="text-2xl font-bold text-emerald-400">{users.filter(u => u.status === 'active').length}</p>
          <p className="text-sm text-slate-400">Active</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex-1">
          <p className="text-2xl font-bold text-red-400">{users.filter(u => u.status === 'blocked').length}</p>
          <p className="text-sm text-slate-400">Blocked</p>
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..." className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-slate-400 border-b border-slate-800">
              <th className="text-left px-5 py-3 font-medium">User</th>
              <th className="text-left px-5 py-3 font-medium">Joined</th>
              <th className="text-left px-5 py-3 font-medium">Orders</th>
              <th className="text-left px-5 py-3 font-medium">Spent</th>
              <th className="text-left px-5 py-3 font-medium">Status</th>
              <th className="text-left px-5 py-3 font-medium">Action</th>
            </tr></thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-5 py-3">
                    <div>
                      <p className="text-white font-medium">{u.name}</p>
                      <p className="text-slate-400 text-xs">{u.email}</p>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-300">{new Date(u.joined).toLocaleDateString('en-IN')}</td>
                  <td className="px-5 py-3 text-white">{u.orders}</td>
                  <td className="px-5 py-3 text-white">₹{u.spent.toLocaleString('en-IN')}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${u.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <button onClick={() => toggleStatus(u.id)} className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition ${u.status === 'active' ? 'border-red-500/30 text-red-400 hover:bg-red-500/10' : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'}`}>
                      {u.status === 'active' ? <><Ban size={12} /> Block</> : <><CheckCircle size={12} /> Activate</>}
                    </button>
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

export default AdminUsers;
