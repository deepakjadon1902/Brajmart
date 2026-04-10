import { Outlet, useNavigate, Link, useLocation, Navigate } from 'react-router-dom';
import { useAdminStore } from '@/store/adminStore';
import {
  LayoutDashboard, Users, ShoppingBag, Package, Truck, CreditCard,
  Tags, BarChart3, LogOut, Settings, ChevronRight, Menu, X, PenLine,
} from 'lucide-react';
import { useEffect, useState } from 'react';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
  { label: 'Analytics', icon: BarChart3, path: '/admin/analytics' },
  { label: 'Users', icon: Users, path: '/admin/users' },
  { label: 'Orders', icon: ShoppingBag, path: '/admin/orders' },
  { label: 'Products', icon: Package, path: '/admin/products' },
  { label: 'Categories', icon: Tags, path: '/admin/categories' },
  { label: 'Blogs', icon: PenLine, path: '/admin/blogs' },
  { label: 'Shipments', icon: Truck, path: '/admin/shipments' },
  { label: 'Payments', icon: CreditCard, path: '/admin/payments' },
  { label: 'Hero Slides', icon: LayoutDashboard, path: '/admin/hero' },
  { label: 'Settings', icon: Settings, path: '/admin/settings' },
];

const AdminLayout = () => {
  const { isAdminAuthenticated, adminLogout, adminEmail } = useAdminStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isAdminAuthenticated) navigate('/admin/login');
  }, [isAdminAuthenticated, navigate]);

  if (!isAdminAuthenticated) return <Navigate to="/admin/login" replace />;

  const handleLogout = () => {
    adminLogout();
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex overflow-x-hidden">
      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed lg:sticky top-0 left-0 z-50 h-screen bg-slate-900 border-r border-slate-800 transition-all duration-300 flex flex-col ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} ${sidebarOpen ? 'w-72 lg:w-64' : 'w-20'} max-w-[85vw]`}>
        <div className="flex items-center gap-3 px-4 h-16 border-b border-slate-800 shrink-0">
          <span className="text-2xl">BM</span>
          {sidebarOpen && <span className="text-lg font-bold text-white">BrajMart Admin</span>}
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${active ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
              >
                <item.icon size={20} />
                {sidebarOpen && <span>{item.label}</span>}
                {sidebarOpen && active && <ChevronRight size={14} className="ml-auto" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800">
          {sidebarOpen && (
            <div className="px-3 py-2 mb-2">
              <p className="text-xs text-slate-500 truncate">{adminEmail}</p>
            </div>
          )}
          <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 w-full transition">
            <LogOut size={20} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        <header className="sticky top-0 z-30 h-16 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 flex items-center px-4 gap-4">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden text-slate-400 hover:text-white">
            <Menu size={22} />
          </button>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="hidden lg:block text-slate-400 hover:text-white">
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="ml-auto flex items-center gap-3">
            <Link to="/" className="text-xs text-slate-400 hover:text-amber-400 border border-slate-700 px-3 py-1.5 rounded-lg transition">
              View Store
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
