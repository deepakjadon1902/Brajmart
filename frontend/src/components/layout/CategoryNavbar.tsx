import { ScrollReveal } from '../ui/ScrollReveal';
import { Link as RouterLink } from 'react-router-dom';
import { useProductStore, categoryToSlug } from '@/store/productStore';
import { useEffect, useMemo, useRef, useState } from 'react';

const CategoryNavbar = () => {
  const categories = useProductStore((s) => s.categories);
  const loadFromApi = useProductStore((s) => s.loadFromApi);
  const [openCatId, setOpenCatId] = useState<string | null>(null);
  const openCat = useMemo(() => categories.find((c) => c.id === openCatId) || null, [categories, openCatId]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    // Ensure dropdown subcategories exist even if the persisted store is stale (common on deployed).
    loadFromApi({ force: true }).catch(() => undefined);
  }, [loadFromApi]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (e.target && el.contains(e.target as Node)) return;
      setOpenCatId(null);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = (delayMs = 120) => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => setOpenCatId(null), delayMs);
  };

  return (
  <ScrollReveal>
    <section className="py-3 bg-card border-b border-border" ref={rootRef}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-2">
  <span className="text-base font-semibold text-maroon">Categories</span>
  <RouterLink to="/categories" className="text-xs font-semibold text-saffron hover:underline">View All →</RouterLink>
</div>
        <div className="flex gap-3 sm:gap-4 md:gap-6 overflow-x-auto scrollbar-hide pb-2 justify-start md:justify-center snap-x snap-mandatory">
          {categories.map((cat) => {
            const subs = Array.isArray(cat.subcategories) ? cat.subcategories : [];
            const hasSubs = subs.length > 0;
            return (
              <div
                key={cat.id}
                className="group snap-start"
                onMouseEnter={() => {
                  if (!hasSubs) return;
                  clearCloseTimer();
                  setOpenCatId(cat.id);
                }}
                onMouseLeave={() => {
                  if (!hasSubs) return;
                  scheduleClose();
                }}
              >
                <RouterLink
                  to={`/category/${categoryToSlug(cat.name)}`}
                  className="flex flex-col items-center gap-2 min-w-[84px] sm:min-w-[96px] md:min-w-[108px]"
                  onClick={() => setOpenCatId(null)}
                  onPointerDown={(e) => {
                    // On some deployed/mobile environments hover doesn't fire reliably.
                    // If the category has subcategories, treat pointer-down as a toggle for the dropdown.
                    if (!hasSubs) return;
                    e.preventDefault();
                    clearCloseTimer();
                    setOpenCatId((prev) => (prev === cat.id ? null : cat.id));
                  }}
                  onFocus={() => {
                    if (!hasSubs) return;
                    clearCloseTimer();
                    setOpenCatId(cat.id);
                  }}
                  onBlur={() => {
                    if (!hasSubs) return;
                    scheduleClose(0);
                  }}
                  aria-haspopup={hasSubs ? 'menu' : undefined}
                  aria-expanded={hasSubs ? (openCatId === cat.id) : undefined}
                >
                  <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-[72px] md:h-[72px] rounded-full border-2 border-gold/30 bg-pearl flex items-center justify-center text-2xl sm:text-[1.65rem] transition-all duration-300 group-hover:border-gold group-hover:shadow-[0_0_16px_rgba(212,175,55,0.25)] group-hover:scale-110 overflow-hidden">
                    {cat.icon && (cat.icon.startsWith('data:') || cat.icon.startsWith('http') || cat.icon.startsWith('/uploads')) ? (
                      <img src={cat.icon} alt={cat.name} className="w-full h-full object-cover" />
                    ) : (
                      cat.icon
                    )}
                  </div>
                  <span className="text-[0.65rem] sm:text-xs font-semibold font-cinzel text-foreground group-hover:text-saffron transition-colors text-center leading-tight whitespace-normal break-words w-[92px] sm:w-[108px]">
                    {cat.name}
                  </span>
                </RouterLink>
              </div>
            );
          })}
        </div>

        {openCat && (
          <div className="relative mt-3">
            <div
              className="rounded-2xl border border-border bg-background shadow-lg overflow-hidden"
              onMouseEnter={() => clearCloseTimer()}
              onMouseLeave={() => scheduleClose()}
              role="menu"
              aria-label={`${openCat.name} subcategories`}
            >
              <div className="flex items-center justify-between px-4 py-3 bg-pearl border-b border-border">
                <div className="text-sm font-semibold text-foreground">{openCat.name}</div>
                <RouterLink
                  to={`/category/${categoryToSlug(openCat.name)}`}
                  className="text-xs font-semibold text-saffron hover:underline"
                  onClick={() => setOpenCatId(null)}
                >
                  View all
                </RouterLink>
              </div>
              <ul className="p-4 space-y-2 list-disc pl-6">
                {(openCat.subcategories || []).map((s) => (
                  <li key={s.id} className="text-sm text-foreground">
                    <RouterLink
                      to={`/category/${categoryToSlug(openCat.name)}/${categoryToSlug(s.name)}`}
                      className="hover:text-saffron hover:underline transition-colors"
                      onClick={() => setOpenCatId(null)}
                      role="menuitem"
                    >
                      {s.name}
                    </RouterLink>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </section>
  </ScrollReveal>
  );
};

export default CategoryNavbar;
