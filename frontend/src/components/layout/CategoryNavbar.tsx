import { useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { ChevronRight, Grid2X2 } from 'lucide-react';
import { useProductStore, categoryToSlug } from '@/store/productStore';
import { toResponsiveImageUrl } from '@/utils/responsiveImage';

const isImageIcon = (icon?: string) =>
  Boolean(icon && (icon.startsWith('data:') || icon.startsWith('http') || icon.startsWith('/uploads')));

const chunkSubcategories = <T,>(items: T[], size = 4) => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

const CategoryNavbar = () => {
  const categories = useProductStore((s) => s.categories);
  const [openCatId, setOpenCatId] = useState<string | null>(null);
  const openCat = useMemo(() => categories.find((c) => c.id === openCatId) || null, [categories, openCatId]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const el = rootRef.current;
      if (!el || (e.target && el.contains(e.target as Node))) return;
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
    <div className="relative z-[45]">
      <section className="relative z-[45] py-1.5 bg-card border-b border-border" ref={rootRef}>
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-base font-semibold text-maroon">Categories</span>
            <RouterLink to="/categories" className="text-xs font-semibold text-saffron hover:underline">
              View All
            </RouterLink>
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
                    onClick={(e) => {
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
                      scheduleClose(150);
                    }}
                    aria-haspopup={hasSubs ? 'menu' : undefined}
                    aria-expanded={hasSubs ? openCatId === cat.id : undefined}
                  >
                    <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-[72px] md:h-[72px] rounded-full border-2 border-gold/30 bg-pearl flex items-center justify-center text-2xl sm:text-[1.65rem] transition-all duration-300 group-hover:border-gold group-hover:shadow-[0_0_16px_rgba(212,175,55,0.25)] group-hover:scale-110 overflow-hidden">
                      {isImageIcon(cat.icon) ? (
                        <img
                          src={toResponsiveImageUrl(cat.icon, { width: 128, height: 128, fit: 'cover', quality: 70 })}
                          alt={cat.name}
                          loading="lazy"
                          decoding="async"
                          fetchPriority="low"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        cat.icon || <Grid2X2 size={24} className="text-saffron" />
                      )}
                    </div>
                    <span className="text-xs sm:text-sm font-semibold font-cinzel text-foreground group-hover:text-saffron transition-colors text-center leading-tight whitespace-normal break-words w-[92px] sm:w-[108px]">
                      {cat.name}
                    </span>
                  </RouterLink>
                </div>
              );
            })}
          </div>

          {openCat && (
            <div className="absolute left-0 right-0 top-full z-[70] block">
              <div
                className="mx-2 max-h-[70vh] overflow-y-auto border border-border bg-brand-raised shadow-2xl md:mx-auto md:max-w-[1180px]"
                onMouseEnter={() => clearCloseTimer()}
                onMouseLeave={() => scheduleClose()}
                role="menu"
                aria-label={`${openCat.name} subcategories`}
              >
                <div className="grid grid-cols-1 md:grid-cols-[220px_1fr]">
                  <div className="bg-brand-soft px-5 py-6 border-b md:border-b-0 md:border-r border-border">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-saffron mb-2">{openCat.name}</p>
                    <RouterLink
                      to={`/category/${categoryToSlug(openCat.name)}`}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-foreground hover:text-saffron transition-colors"
                      onClick={() => setOpenCatId(null)}
                    >
                      Shop all products
                      <ChevronRight size={14} />
                    </RouterLink>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                    {chunkSubcategories(openCat.subcategories || [], 4).map((group, groupIndex) => (
                      <div key={groupIndex} className={`px-5 py-5 ${groupIndex % 2 === 1 ? 'bg-brand-soft' : 'bg-brand-raised'}`}>
                        <p className="mb-3 text-sm font-bold text-saffron">
                          {groupIndex === 0 ? 'Subcategories' : 'More'}
                        </p>
                        <ul className="space-y-3">
                          {group.map((s) => (
                            <li key={s.id}>
                              <RouterLink
                                to={`/category/${categoryToSlug(openCat.name)}/${categoryToSlug(s.name)}`}
                                className="block text-sm font-medium text-brand-muted transition-colors hover:text-saffron"
                                onClick={() => setOpenCatId(null)}
                                role="menuitem"
                              >
                                {s.name}
                              </RouterLink>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    {(openCat.subcategories || []).length === 0 && (
                      <div className="p-5 text-sm text-muted-foreground">
                        No subcategories available yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default CategoryNavbar;