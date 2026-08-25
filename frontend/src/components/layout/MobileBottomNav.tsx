import { Home, Heart, Search, ShoppingBag, ShoppingCart } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useCartStore } from '@/store/cartStore';
import { useWishlistStore } from '@/store/wishlistStore';

const navItems = [
  { label: 'Home', to: '/', icon: Home },
  { label: 'Shop', to: '/products', icon: ShoppingBag },
  { label: 'Search', to: '/search', icon: Search },
  { label: 'Wishlist', to: '/wishlist', icon: Heart, count: 'wishlist' },
  { label: 'Cart', to: '/cart', icon: ShoppingCart, count: 'cart' },
] as const;

const MobileBottomNav = () => {
  const { pathname } = useLocation();
  const cartCount = useCartStore((state) => state.totalItems());
  const wishlistCount = useWishlistStore((state) => state.items.length);

  if (pathname.startsWith('/admin') || pathname.startsWith('/checkout')) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[75] border-t border-border bg-card/95 shadow-[0_-10px_30px_rgba(48,30,20,0.12)] backdrop-blur md:hidden"
      aria-label="Primary mobile navigation"
    >
      <div className="grid h-[64px] grid-cols-5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.to || (item.to !== '/' && pathname.startsWith(item.to));
          const count = item.count === 'cart' ? cartCount : item.count === 'wishlist' ? wishlistCount : 0;

          return (
            <Link
              key={item.to}
              to={item.to}
              className={`relative flex min-w-0 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors premium-focus ${
                active ? 'text-saffron' : 'text-muted-foreground'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <span className="relative">
                <Icon size={20} strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
                {count > 0 && (
                  <span className="absolute -right-2.5 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-saffron px-1 text-[9px] font-bold leading-none text-white">
                    {count > 9 ? '9+' : count}
                  </span>
                )}
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
