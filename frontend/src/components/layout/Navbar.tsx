import * as React from "react";
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Heart, ShoppingCart, Menu, X, User, LogOut, Package, MapPin, Newspaper } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { toResponsiveImageUrl } from '@/utils/responsiveImage';

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
    <header className={`sticky top-0 z-[80] transition-all duration-300 ${scrolled ? 'glass shadow-md border-b border-gold/20' : 'bg-card border-b border-border'}`}>
      <div className="container mx-auto flex items-center gap-4 h-16 md:h-[68px] px-3 md:px-4">
        <button className="md:hidden text-foreground" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        <Link to="/" className="flex items-center shrink-0" aria-label={settings.storeName || 'Brajmart home'}>
          {settings.storeLogo ? (
            <img
              src={toResponsiveImageUrl(settings.storeLogo, { width: 220, height: 220, fit: 'contain', quality: 76 })}
              alt={settings.storeName}
              className="h-16 w-24 md:h-24 md:w-32 rounded object-contain"
            />
          ) : (
            <span className="sr-only">{settings.storeName}</span>
          )}
        </Link>

        <form onSubmit={handleSearch} className="hidden md:flex flex-1 min-w-[360px] max-w-[760px] mx-auto">
          <div className="flex w-full rounded-md border border-gold/40 overflow-hidden bg-card focus-within:border-saffron transition-colors shadow-sm">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search Prasadam, Books, Shringar..."
              className="flex-1 px-4 py-3 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            />
            <button type="submit" className="px-5 bg-saffron text-primary-foreground hover:bg-saffron-light transition-colors" aria-label="Search">
              <Search size={21} />
            </button>
          </div>
        </form>

        <div className="flex items-center gap-3 sm:gap-5 ml-auto md:ml-0">
          <Link to="/blog" className="hidden lg:flex flex-col items-center gap-0.5 p-1.5 sm:p-2 rounded-full hover:bg-muted transition-colors" aria-label="Blog">
  <svg
    width={20}
    height={20}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-foreground"
  >
    <path d="M4 4h11a2 2 0 0 1 2 2v13a1 1 0 0 1-1.5.87L13 18.5l-2.5 1.37A1 1 0 0 1 9 19V6a2 2 0 0 0-2-2H4Z" />
    <path d="M4 4a2 2 0 0 0-2 2v13a1 1 0 0 0 1.5.87L6 18.5" />
    <line x1="11" y1="8" x2="14" y2="8" />
    <line x1="11" y1="11" x2="14" y2="11" />
  </svg>
  <span className="hidden sm:block text-[0.65rem] font-medium text-foreground">Blog</span>
</Link>
          <Link to="/track-orders" className="relative flex flex-col items-center gap-0.5 p-1.5 sm:p-2 rounded-full hover:bg-muted transition-colors" aria-label="Track Orders">
            <MapPin size={20} className="text-foreground" />
            <span className="hidden sm:block text-[0.65rem] font-medium text-foreground">Track Order</span>
          </Link>
          <Link to="/wishlist" className="relative flex flex-col items-center gap-0.5 p-1.5 sm:p-2 rounded-full hover:bg-muted transition-colors" aria-label="Wishlist">
            <Heart size={20} className="text-foreground" />
            {wishlistCount > 0 && (
              <span className="absolute -top-0.5 right-1 sm:right-2 w-4 h-4 bg-saffron text-primary-foreground text-[0.55rem] font-bold rounded-full flex items-center justify-center">{wishlistCount}</span>
            )}
            <span className="hidden sm:block text-[0.65rem] font-medium text-foreground">Wishlist</span>
          </Link>
          <Link to="/cart" className="relative flex flex-col items-center gap-0.5 p-1.5 sm:p-2 rounded-full hover:bg-muted transition-colors" aria-label="Cart">
            <ShoppingCart size={20} className="text-foreground" />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 right-1 sm:right-2 w-4 h-4 bg-saffron text-primary-foreground text-[0.55rem] font-bold rounded-full flex items-center justify-center">{cartCount}</span>
            )}
            <span className="hidden sm:block text-[0.65rem] font-medium text-foreground">Cart</span>
          </Link>

          {isAuthenticated && user ? (
            <div className="relative">
              <button onClick={() => setUserMenuOpen(!userMenuOpen)} className="flex flex-col items-center gap-0.5">
                <span className="w-9 h-9 rounded-full bg-gold-gradient flex items-center justify-center text-maroon-dark font-bold text-sm border-2 border-gold/30">
                  {user.fullName[0]?.toUpperCase()}
                </span>
                <span className="hidden sm:block text-[0.65rem] font-medium text-foreground">Profile</span>
              </button>
              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-[90]" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 top-14 z-[100] w-48 bg-card rounded-xl border border-border shadow-lg py-2">
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
        <div className="md:hidden border-t border-border bg-card px-4 py-4 space-y-3">
          <Link to="/" onClick={() => setMobileOpen(false)} className="block py-2 text-sm font-medium text-foreground hover:text-saffron">Home</Link>
          <Link to="/search" onClick={() => setMobileOpen(false)} className="block py-2 text-sm font-medium text-foreground hover:text-saffron">All Products</Link>
          <Link to="/blog" onClick={() => setMobileOpen(false)} className="block py-2 text-sm font-medium text-foreground hover:text-saffron">Blog</Link>
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