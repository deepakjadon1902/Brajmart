import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, Menu, X } from 'lucide-react';
import { useProductStore, categoryToSlug } from '@/store/productStore';
import { brajDestinations } from '@/data/brajDestinations';

const CategoryNavbar = () => {
  const categories = useProductStore((s) => s.categories);
  const [allOpen, setAllOpen] = useState(false);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const [brajYatraOpen, setBrajYatraOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const onDocPointerDown = (event: MouseEvent | TouchEvent) => {
      const root = rootRef.current;
      if (!root || root.contains(event.target as Node)) return;
      setAllOpen(false);
      setExpandedCategoryId(null);
      setBrajYatraOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setAllOpen(false);
      setExpandedCategoryId(null);
      setBrajYatraOpen(false);
    };

    document.addEventListener('mousedown', onDocPointerDown);
    document.addEventListener('touchstart', onDocPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocPointerDown);
      document.removeEventListener('touchstart', onDocPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useEffect(() => {
    setAllOpen(false);
    setExpandedCategoryId(null);
    setBrajYatraOpen(false);
  }, [location.pathname, location.search]);

  const closeMenus = () => {
    setAllOpen(false);
    setExpandedCategoryId(null);
    setBrajYatraOpen(false);
  };

  return (
    <div className="sticky top-16 z-[35] md:top-[68px]" ref={rootRef}>
      <section className="relative border-b border-border bg-card shadow-sm">
        <div className="container mx-auto px-3 md:px-4">
          <div className="flex h-10 items-center gap-2 overflow-x-auto scrollbar-hide md:h-11 md:justify-between md:gap-0">
            <button
              type="button"
              onClick={() => {
                setAllOpen((open) => !open);
                setExpandedCategoryId(null);
                setBrajYatraOpen(false);
              }}
              className="sticky left-0 z-10 inline-flex h-10 w-[84px] shrink-0 items-center justify-center gap-2 border-r border-border bg-card text-sm font-bold text-maroon shadow-[8px_0_10px_-10px_rgba(0,0,0,0.4)] transition-colors hover:text-saffron md:h-11"
              aria-expanded={allOpen}
              aria-haspopup="menu"
            >
              {allOpen ? <X size={16} /> : <Menu size={17} />}
              All
            </button>

            {categories.map((cat) => (
              <div key={cat.id} className="shrink-0 snap-start md:flex md:flex-1 md:justify-center">
                <RouterLink
                  to={`/category/${categoryToSlug(cat.name)}`}
                  className="inline-flex h-9 items-center whitespace-nowrap px-2.5 text-sm font-semibold text-foreground transition-colors hover:text-saffron"
                  onClick={closeMenus}
                >
                  {cat.name}
                </RouterLink>
              </div>
            ))}

            <div className="shrink-0 snap-start md:flex md:flex-1 md:justify-center">
              <button
                type="button"
                className="inline-flex h-9 items-center whitespace-nowrap px-2.5 text-sm font-semibold text-foreground transition-colors hover:text-saffron"
                onClick={() => {
                  setBrajYatraOpen((open) => !open);
                  setAllOpen(false);
                  setExpandedCategoryId(null);
                }}
                aria-expanded={brajYatraOpen}
                aria-haspopup="menu"
              >
                Braj Yatra
              </button>
            </div>
          </div>

          {allOpen && (
            <div className="absolute left-0 top-full z-[60] w-[min(345px,calc(100vw-1rem))]">
              <div className="max-h-[76vh] overflow-y-auto border border-border bg-brand-raised shadow-2xl md:ml-4">
                <div className="border-b border-border bg-brand-soft px-4 py-3">
                  <p className="text-sm font-bold text-maroon">All Categories</p>
                </div>

                <div className="divide-y divide-border">
                  {categories.map((cat) => {
                    const subs = Array.isArray(cat.subcategories) ? cat.subcategories : [];
                    const expanded = expandedCategoryId === cat.id;
                    const categoryPath = `/category/${categoryToSlug(cat.name)}`;

                    return (
                      <div key={cat.id}>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-bold text-foreground transition-colors hover:bg-brand-soft hover:text-saffron"
                          onClick={() => {
                            if (!subs.length) {
                              closeMenus();
                              navigate(categoryPath);
                              return;
                            }
                            setExpandedCategoryId((current) => (current === cat.id ? null : cat.id));
                          }}
                          aria-expanded={subs.length ? expanded : undefined}
                        >
                          <span>{cat.name}</span>
                          {subs.length ? (
                            <ChevronRight size={15} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
                          ) : (
                            <ChevronRight size={14} />
                          )}
                        </button>

                        {expanded && (
                          <div className="grid gap-1 bg-brand-soft/60 px-4 pb-3">
                            <RouterLink
                              to={categoryPath}
                              className="rounded px-2 py-1.5 text-xs font-bold text-maroon transition-colors hover:bg-brand-raised hover:text-saffron"
                              onClick={closeMenus}
                            >
                              View all {cat.name}
                            </RouterLink>
                            {subs.map((sub) => (
                              <RouterLink
                                key={sub.id}
                                to={`${categoryPath}/${categoryToSlug(sub.name)}`}
                                className="rounded px-2 py-1.5 text-xs font-medium text-brand-muted transition-colors hover:bg-brand-raised hover:text-saffron"
                                onClick={closeMenus}
                              >
                                {sub.name}
                              </RouterLink>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {brajYatraOpen && (
            <div className="absolute right-0 top-full z-[60] w-full md:w-[420px]">
              <div className="max-h-[76vh] overflow-y-auto border border-border bg-brand-raised shadow-2xl md:mr-4">
                <div className="border-b border-border bg-brand-soft px-4 py-3">
                  <p className="text-sm font-bold text-maroon">Braj Yatra</p>
                </div>
                <div className="grid grid-cols-2 gap-2 p-3">
                  {brajDestinations.map((destination) => (
                    <RouterLink
                      key={destination.id}
                      to={`/braj-darshan/${destination.slug}`}
                      className="flex items-center gap-2 rounded border border-border bg-card p-2 text-sm font-semibold text-foreground transition-colors hover:border-saffron hover:text-saffron"
                      onClick={closeMenus}
                    >
                      <img
                        src={destination.templeIcon}
                        alt={`${destination.name} temple icon`}
                        className="h-9 w-9 shrink-0 rounded-full object-cover"
                      />
                      <span>{destination.name}</span>
                    </RouterLink>
                  ))}
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
