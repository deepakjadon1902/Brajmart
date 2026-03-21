import { useState, useEffect } from 'react';
import { Search, Heart, ShoppingCart, Menu, X, User } from 'lucide-react';

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`sticky top-0 z-40 transition-all duration-300 ${scrolled ? 'glass shadow-md border-b border-gold/20' : 'bg-card border-b border-border'}`}>
      <div className="container mx-auto flex items-center gap-4 h-16 md:h-[72px] px-4">
        {/* Mobile menu */}
        <button className="md:hidden text-foreground" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        {/* Logo */}
        <a href="/" className="flex items-center gap-2 shrink-0">
          <span className="text-2xl">🪷</span>
          <div className="leading-none">
            <span className="font-cinzel text-xl font-bold text-maroon-gold-gradient">BrajMart</span>
            <span className="block text-[0.55rem] text-muted-foreground tracking-wider">From Braj, With Love 🙏</span>
          </div>
        </a>

        {/* Search */}
        <div className="hidden md:flex flex-1 max-w-xl mx-auto">
          <div className="flex w-full rounded-full border border-gold/30 overflow-hidden bg-card focus-within:border-gold transition-colors">
            <input
              type="text"
              placeholder="Search Prasadam, Books, Shringar..."
              className="flex-1 px-4 py-2.5 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            />
            <button className="px-4 bg-saffron text-primary-foreground hover:bg-saffron-light transition-colors" aria-label="Search">
              <Search size={18} />
            </button>
          </div>
        </div>

        {/* Right icons */}
        <div className="flex items-center gap-1 sm:gap-2 ml-auto md:ml-0">
          <button className="relative p-2 rounded-full hover:bg-muted transition-colors" aria-label="Wishlist">
            <Heart size={20} className="text-foreground" />
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-saffron text-primary-foreground text-[0.55rem] font-bold rounded-full flex items-center justify-center">0</span>
          </button>
          <button className="relative p-2 rounded-full hover:bg-muted transition-colors" aria-label="Cart">
            <ShoppingCart size={20} className="text-foreground" />
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-saffron text-primary-foreground text-[0.55rem] font-bold rounded-full flex items-center justify-center">0</span>
          </button>
          <button className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-maroon text-maroon text-sm font-medium hover:bg-maroon hover:text-primary-foreground transition-colors">
            <User size={15} />
            Login
          </button>
          <button className="hidden sm:block px-4 py-1.5 rounded-full bg-gold-gradient text-maroon-dark text-sm font-bold shimmer active:scale-[0.97] transition-transform">
            Sign Up
          </button>
        </div>
      </div>

      {/* Mobile search */}
      <div className="md:hidden px-4 pb-3">
        <div className="flex w-full rounded-full border border-gold/30 overflow-hidden bg-card">
          <input
            type="text"
            placeholder="Search products..."
            className="flex-1 px-4 py-2 text-sm bg-transparent outline-none"
          />
          <button className="px-3 bg-saffron text-primary-foreground" aria-label="Search">
            <Search size={16} />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-card px-4 py-4 space-y-3 animate-fade-up">
          <a href="#" className="block py-2 text-sm font-medium text-foreground hover:text-saffron">Home</a>
          <a href="#" className="block py-2 text-sm font-medium text-foreground hover:text-saffron">Categories</a>
          <a href="#" className="block py-2 text-sm font-medium text-foreground hover:text-saffron">Offers</a>
          <a href="#" className="block py-2 text-sm font-medium text-foreground hover:text-saffron">Track Order</a>
          <div className="flex gap-2 pt-2">
            <button className="flex-1 py-2 rounded-full border border-maroon text-maroon text-sm font-medium">Login</button>
            <button className="flex-1 py-2 rounded-full bg-gold-gradient text-maroon-dark text-sm font-bold">Sign Up</button>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
