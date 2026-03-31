import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Heart, ShoppingCart, Menu, X, User, LogOut, Package, MapPin } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const cartCount = useCartStore(s => s.totalItems());
  const wishlistCount = useWishlistStore(s => s.items.length);
  const { user, isAuthenticated, logout } = useAuthStore();
  const { settings } = useSettingsStore();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
  };

  const handleLogout = () => {
    logout();
    setUserMenuOpen(false);
    navigate('/');
  };

  return (
    <header className={`sticky top-0 z-40 transition-all duration-300 ${scrolled ? 'glass shadow-md border-b border-gold/20' : 'bg-card border-b border-border'}`}>
      <div className="container mx-auto flex items-center gap-4 h-16 md:h-[72px] px-4">
        <button className="md:hidden text-foreground" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        <Link to="/" className="flex items-center gap-2 shrink-0">
          <span className="text-2xl">🪷</span>
          <div className="leading-none">
            <span className="font-cinzel text-xl font-bold text-maroon-gold-gradient">{settings.storeName}</span>
            <span className="block text-[0.55rem] text-muted-foreground tracking-wider">{settings.tagline}</span>
          </div>
        </Link>

        <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-xl mx-auto">
          <div className="flex w-full rounded-full border border-gold/30 overflow-hidden bg-card focus-within:border-gold transition-colors">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search Prasadam, Books, Shringar..."
              className="flex-1 px-4 py-2.5 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            />
            <button type="submit" className="px-4 bg-saffron text-primary-foreground hover:bg-saffron-light transition-colors" aria-label="Search">
              <Search size={18} />
            </button>
          </div>
        </form>

        <div className="flex items-center gap-1 sm:gap-2 ml-auto md:ml-0">
          <Link to="/track-orders" className="relative p-2 rounded-full hover:bg-muted transition-colors" aria-label="Track Orders">
            <MapPin size={20} className="text-foreground" />
          </Link>
          <Link to="/wishlist" className="relative p-2 rounded-full hover:bg-muted transition-colors" aria-label="Wishlist">
            <Heart size={20} className="text-foreground" />
            {wishlistCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-saffron text-primary-foreground text-[0.55rem] font-bold rounded-full flex items-center justify-center">{wishlistCount}</span>
            )}
          </Link>
          <Link to="/cart" className="relative p-2 rounded-full hover:bg-muted transition-colors" aria-label="Cart">
            <ShoppingCart size={20} className="text-foreground" />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-saffron text-primary-foreground text-[0.55rem] font-bold rounded-full flex items-center justify-center">{cartCount}</span>
            )}
          </Link>

          {isAuthenticated && user ? (
            <div className="relative">
              <button onClick={() => setUserMenuOpen(!userMenuOpen)} className="w-9 h-9 rounded-full bg-gold-gradient flex items-center justify-center text-maroon-dark font-bold text-sm border-2 border-gold/30">
                {user.fullName[0]?.toUpperCase()}
              </button>
              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 top-12 z-50 w-48 bg-card rounded-xl border border-border shadow-lg py-2">
                    <div className="px-4 py-2 border-b border-border">
                      <p className="text-sm font-semibold text-foreground">{user.fullName}</p>
                      <p className="text-[0.65rem] text-muted-foreground">{user.email}</p>
                    </div>
                    <Link to="/profile" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-muted transition-colors">
                      <User size={14} /> My Profile
                    </Link>
                    <Link to="/orders" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-muted transition-colors">
                      <Package size={14} /> My Orders
                    </Link>
                    <Link to="/wishlist" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-muted transition-colors">
                      <Heart size={14} /> Wishlist
                    </Link>
                    <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-muted transition-colors w-full text-left">
                      <LogOut size={14} /> Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              <Link to="/login" className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-maroon text-maroon text-sm font-medium hover:bg-maroon hover:text-primary-foreground transition-colors">
                <User size={15} /> Login
              </Link>
              <Link to="/register" className="hidden sm:block px-4 py-1.5 rounded-full bg-gold-gradient text-maroon-dark text-sm font-bold shimmer active:scale-[0.97] transition-transform">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Mobile search */}
      <form onSubmit={handleSearch} className="md:hidden px-4 pb-3">
        <div className="flex w-full rounded-full border border-gold/30 overflow-hidden bg-card">
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search products..." className="flex-1 px-4 py-2 text-sm bg-transparent outline-none" />
          <button type="submit" className="px-3 bg-saffron text-primary-foreground" aria-label="Search"><Search size={16} /></button>
        </div>
      </form>

      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-card px-4 py-4 space-y-3 animate-fade-up">
          <Link to="/" onClick={() => setMobileOpen(false)} className="block py-2 text-sm font-medium text-foreground hover:text-saffron">Home</Link>
          <Link to="/search" onClick={() => setMobileOpen(false)} className="block py-2 text-sm font-medium text-foreground hover:text-saffron">All Products</Link>
          <Link to="/wishlist" onClick={() => setMobileOpen(false)} className="block py-2 text-sm font-medium text-foreground hover:text-saffron">Wishlist</Link>
          <Link to="/cart" onClick={() => setMobileOpen(false)} className="block py-2 text-sm font-medium text-foreground hover:text-saffron">Cart</Link>
          {isAuthenticated ? (
            <>
              <Link to="/profile" onClick={() => setMobileOpen(false)} className="block py-2 text-sm font-medium text-foreground hover:text-saffron">Profile</Link>
              <button onClick={() => { handleLogout(); setMobileOpen(false); }} className="block py-2 text-sm font-medium text-destructive">Logout</button>
            </>
          ) : (
            <div className="flex gap-2 pt-2">
              <Link to="/login" onClick={() => setMobileOpen(false)} className="flex-1 py-2 rounded-full border border-maroon text-maroon text-sm font-medium text-center">Login</Link>
              <Link to="/register" onClick={() => setMobileOpen(false)} className="flex-1 py-2 rounded-full bg-gold-gradient text-maroon-dark text-sm font-bold text-center">Sign Up</Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
};

export default Navbar;
