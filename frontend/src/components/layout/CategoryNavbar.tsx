// import { useEffect, useMemo, useRef, useState } from 'react';
// import { Link as RouterLink } from 'react-router-dom';
// import { ChevronRight, Menu, X } from 'lucide-react';
// import { useProductStore, categoryToSlug } from '@/store/productStore';

// const chunkSubcategories = <T,>(items: T[], size = 4) => {
//   const chunks: T[][] = [];
//   for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
//   return chunks;
// };

// const CategoryNavbar = () => {
//   const categories = useProductStore((s) => s.categories);
//   const [openCatId, setOpenCatId] = useState<string | null>(null);
//   const [allOpen, setAllOpen] = useState(false);
//   const openCat = useMemo(() => categories.find((c) => c.id === openCatId) || null, [categories, openCatId]);
//   const rootRef = useRef<HTMLDivElement | null>(null);
//   const closeTimerRef = useRef<number | null>(null);

//   useEffect(() => {
//     const onDocClick = (e: MouseEvent) => {
//       const el = rootRef.current;
//       if (!el || (e.target && el.contains(e.target as Node))) return;
//       setOpenCatId(null);
//       setAllOpen(false);
//     };
//     document.addEventListener('mousedown', onDocClick);
//     return () => document.removeEventListener('mousedown', onDocClick);
//   }, []);

//   const clearCloseTimer = () => {
//     if (closeTimerRef.current) {
//       window.clearTimeout(closeTimerRef.current);
//       closeTimerRef.current = null;
//     }
//   };

//   const scheduleClose = (delayMs = 120) => {
//     clearCloseTimer();
//     closeTimerRef.current = window.setTimeout(() => setOpenCatId(null), delayMs);
//   };

//   return (
//     <div className="sticky top-16 md:top-[68px] z-[35]">
//       <section className="relative bg-card border-b border-border shadow-sm" ref={rootRef}>
//         <div className="container mx-auto px-3 md:px-4">
//           <div className="flex items-center gap-2 md:gap-0 md:justify-between overflow-x-auto scrollbar-hide h-10 md:h-11">
//             <button
//               type="button"
//               onClick={() => {
//                 setOpenCatId(null);
//                 setAllOpen((open) => !open);
//               }}
//               className="sticky left-0 z-10 inline-flex h-8 shrink-0 items-center gap-2 rounded-md bg-card px-3 text-sm font-bold text-maroon shadow-[8px_0_10px_-10px_rgba(0,0,0,0.4)] hover:text-saffron"
//               aria-expanded={allOpen}
//               aria-haspopup="menu"
//             >
//               {allOpen ? <X size={16} /> : <Menu size={17} />}
//               All
//             </button>
//             {categories.map((cat) => {
//               const subs = Array.isArray(cat.subcategories) ? cat.subcategories : [];
//               const hasSubs = subs.length > 0;

//               return (
//                 <div
//                   key={cat.id}
//                   className="group snap-start shrink-0 md:flex-1 md:flex md:justify-center"
//                   onMouseEnter={() => {
//                     if (!hasSubs) return;
//                     clearCloseTimer();
//                     setOpenCatId(cat.id);
//                   }}
//                   onMouseLeave={() => {
//                     if (!hasSubs) return;
//                     scheduleClose();
//                   }}
//                 >
//                   <RouterLink
//                     to={`/category/${categoryToSlug(cat.name)}`}
//                     className="inline-flex h-9 items-center whitespace-nowrap px-2.5 text-sm font-semibold text-foreground hover:text-saffron transition-colors"
//                     onClick={(e) => {
//                       if (!hasSubs) return;
//                       e.preventDefault();
//                       clearCloseTimer();
//                       setOpenCatId((prev) => (prev === cat.id ? null : cat.id));
//                     }}
//                     onFocus={() => {
//                       if (!hasSubs) return;
//                       clearCloseTimer();
//                       setOpenCatId(cat.id);
//                     }}
//                     onBlur={() => {
//                       if (!hasSubs) return;
//                       scheduleClose(150);
//                     }}
//                     aria-haspopup={hasSubs ? 'menu' : undefined}
//                     aria-expanded={hasSubs ? openCatId === cat.id : undefined}
//                   >
//                     {cat.name}
//                   </RouterLink>
//                 </div>
//               );
//             })}
//             <div className="group snap-start shrink-0 md:flex-1 md:flex md:justify-center">
//               <RouterLink
//                 to="/braj-darshan"
//                 className="inline-flex h-9 items-center whitespace-nowrap px-2.5 text-sm font-semibold text-foreground hover:text-saffron transition-colors"
//               >
//                 Braj Yatra
//               </RouterLink>
//             </div>
//           </div>

//           {allOpen && (
//             <div className="absolute left-0 top-full z-[60] w-full md:w-[360px]">
//               <div className="max-h-[76vh] overflow-y-auto border border-border bg-brand-raised shadow-2xl md:ml-4">
//                 <div className="border-b border-border bg-brand-soft px-4 py-3">
//                   <p className="text-sm font-bold text-maroon">All Categories</p>
//                 </div>
//                 <div className="divide-y divide-border">
//                   {categories.map((cat) => (
//                     <div key={cat.id} className="px-4 py-3">
//                       <RouterLink
//                         to={`/category/${categoryToSlug(cat.name)}`}
//                         className="flex items-center justify-between text-sm font-bold text-foreground hover:text-saffron"
//                         onClick={() => setAllOpen(false)}
//                       >
//                         {cat.name}
//                         <ChevronRight size={14} />
//                       </RouterLink>
//                       {Array.isArray(cat.subcategories) && cat.subcategories.length > 0 && (
//                         <div className="mt-2 grid gap-1 pl-2">
//                           {cat.subcategories.map((sub) => (
//                             <RouterLink
//                               key={sub.id}
//                               to={`/category/${categoryToSlug(cat.name)}/${categoryToSlug(sub.name)}`}
//                               className="py-1 text-xs font-medium text-brand-muted hover:text-saffron"
//                               onClick={() => setAllOpen(false)}
//                             >
//                               {sub.name}
//                             </RouterLink>
//                           ))}
//                         </div>
//                       )}
//                     </div>
//                   ))}
//                   <div className="px-4 py-3">
//                     <RouterLink
//                       to="/braj-darshan"
//                       className="flex items-center justify-between text-sm font-bold text-foreground hover:text-saffron"
//                       onClick={() => setAllOpen(false)}
//                     >
//                       Braj Yatra
//                       <ChevronRight size={14} />
//                     </RouterLink>
//                   </div>
//                 </div>
//               </div>
//             </div>
//           )}

//           {openCat && (
//             <div className="absolute left-0 right-0 top-full z-[60] block">
//               <div
//                 className="mx-2 max-h-[70vh] overflow-y-auto border border-border bg-brand-raised shadow-2xl md:mx-auto md:max-w-[1180px]"
//                 onMouseEnter={() => clearCloseTimer()}
//                 onMouseLeave={() => scheduleClose()}
//                 role="menu"
//                 aria-label={`${openCat.name} subcategories`}
//               >
//                 <div className="grid grid-cols-1 md:grid-cols-[220px_1fr]">
//                   <div className="bg-brand-soft px-5 py-6 border-b md:border-b-0 md:border-r border-border">
//                     <p className="text-xs font-bold uppercase tracking-[0.14em] text-saffron mb-2">{openCat.name}</p>
//                     <RouterLink
//                       to={`/category/${categoryToSlug(openCat.name)}`}
//                       className="inline-flex items-center gap-1 text-sm font-semibold text-foreground hover:text-saffron transition-colors"
//                       onClick={() => setOpenCatId(null)}
//                     >
//                       Shop all products
//                       <ChevronRight size={14} />
//                     </RouterLink>
//                   </div>

//                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
//                     {chunkSubcategories(openCat.subcategories || [], 4).map((group, groupIndex) => (
//                       <div key={groupIndex} className={`px-5 py-5 ${groupIndex % 2 === 1 ? 'bg-brand-soft' : 'bg-brand-raised'}`}>
//                         <p className="mb-3 text-sm font-bold text-saffron">
//                           {groupIndex === 0 ? 'Subcategories' : 'More'}
//                         </p>
//                         <ul className="space-y-3">
//                           {group.map((s) => (
//                             <li key={s.id}>
//                               <RouterLink
//                                 to={`/category/${categoryToSlug(openCat.name)}/${categoryToSlug(s.name)}`}
//                                 className="block text-sm font-medium text-brand-muted transition-colors hover:text-saffron"
//                                 onClick={() => setOpenCatId(null)}
//                                 role="menuitem"
//                               >
//                                 {s.name}
//                               </RouterLink>
//                             </li>
//                           ))}
//                         </ul>
//                       </div>
//                     ))}
//                     {(openCat.subcategories || []).length === 0 && (
//                       <div className="p-5 text-sm text-muted-foreground">
//                         No subcategories available yet.
//                       </div>
//                     )}
//                   </div>
//                 </div>
//               </div>
//             </div>
//           )}
//         </div>
//       </section>
//     </div>
//   );
// };

// export default CategoryNavbar;


import { useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { ChevronRight, Menu, X } from 'lucide-react';
import { useProductStore, categoryToSlug } from '@/store/productStore';
import { brajDestinations } from '@/data/brajDestinations';

const chunkSubcategories = <T,>(items: T[], size = 4) => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

const CategoryNavbar = () => {
  const categories = useProductStore((s) => s.categories);
  const [openCatId, setOpenCatId] = useState<string | null>(null);
  const [allOpen, setAllOpen] = useState(false);
  const [brajYatraOpen, setBrajYatraOpen] = useState(false);
  const openCat = useMemo(() => categories.find((c) => c.id === openCatId) || null, [categories, openCatId]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const brajYatraCloseTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const el = rootRef.current;
      if (!el || (e.target && el.contains(e.target as Node))) return;
      setOpenCatId(null);
      setAllOpen(false);
      setBrajYatraOpen(false);
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

  const clearBrajYatraCloseTimer = () => {
    if (brajYatraCloseTimerRef.current) {
      window.clearTimeout(brajYatraCloseTimerRef.current);
      brajYatraCloseTimerRef.current = null;
    }
  };

  const scheduleBrajYatraClose = (delayMs = 120) => {
    clearBrajYatraCloseTimer();
    brajYatraCloseTimerRef.current = window.setTimeout(() => setBrajYatraOpen(false), delayMs);
  };

  return (
    <div className="sticky top-16 md:top-[68px] z-[35]">
      <section className="relative bg-card border-b border-border shadow-sm" ref={rootRef}>
        <div className="container mx-auto px-3 md:px-4">
          <div className="flex items-center gap-2 md:gap-0 md:justify-between overflow-x-auto scrollbar-hide h-10 md:h-11">
            <button
              type="button"
              onClick={() => {
                setOpenCatId(null);
                setAllOpen((open) => !open);
              }}
              className="sticky left-0 z-10 inline-flex h-8 shrink-0 items-center gap-2 rounded-md bg-card px-3 text-sm font-bold text-maroon shadow-[8px_0_10px_-10px_rgba(0,0,0,0.4)] hover:text-saffron"
              aria-expanded={allOpen}
              aria-haspopup="menu"
            >
              {allOpen ? <X size={16} /> : <Menu size={17} />}
              All
            </button>
            {categories.map((cat) => {
              const subs = Array.isArray(cat.subcategories) ? cat.subcategories : [];
              const hasSubs = subs.length > 0;

              return (
                <div
                  key={cat.id}
                  className="group snap-start shrink-0 md:flex-1 md:flex md:justify-center"
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
                    className="inline-flex h-9 items-center whitespace-nowrap px-2.5 text-sm font-semibold text-foreground hover:text-saffron transition-colors"
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
                    {cat.name}
                  </RouterLink>
                </div>
              );
            })}
            <div
              className="group snap-start shrink-0 md:flex-1 md:flex md:justify-center"
              onMouseEnter={() => {
                clearBrajYatraCloseTimer();
                setOpenCatId(null);
                setBrajYatraOpen(true);
              }}
              onMouseLeave={() => {
                scheduleBrajYatraClose();
              }}
            >
              <RouterLink
                to=""
                className="inline-flex h-9 items-center whitespace-nowrap px-2.5 text-sm font-semibold text-foreground hover:text-saffron transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  clearBrajYatraCloseTimer();
                  setOpenCatId(null);
                  setBrajYatraOpen((prev) => !prev);
                }}
                onFocus={() => {
                  clearBrajYatraCloseTimer();
                  setOpenCatId(null);
                  setBrajYatraOpen(true);
                }}
                onBlur={() => {
                  scheduleBrajYatraClose(150);
                }}
                aria-haspopup="menu"
                aria-expanded={brajYatraOpen}
              >
                Braj Yatra
              </RouterLink>
            </div>
          </div>

          {allOpen && (
            <div className="absolute left-0 top-full z-[60] w-full md:w-[360px]">
              <div className="max-h-[76vh] overflow-y-auto border border-border bg-brand-raised shadow-2xl md:ml-4">
                <div className="border-b border-border bg-brand-soft px-4 py-3">
                  <p className="text-sm font-bold text-maroon">All Categories</p>
                </div>
                <div className="divide-y divide-border">
                  {categories.map((cat) => (
                    <div key={cat.id} className="px-4 py-3">
                      <RouterLink
                        to={`/category/${categoryToSlug(cat.name)}`}
                        className="flex items-center justify-between text-sm font-bold text-foreground hover:text-saffron"
                        onClick={() => setAllOpen(false)}
                      >
                        {cat.name}
                        <ChevronRight size={14} />
                      </RouterLink>
                      {Array.isArray(cat.subcategories) && cat.subcategories.length > 0 && (
                        <div className="mt-2 grid gap-1 pl-2">
                          {cat.subcategories.map((sub) => (
                            <RouterLink
                              key={sub.id}
                              to={`/category/${categoryToSlug(cat.name)}/${categoryToSlug(sub.name)}`}
                              className="py-1 text-xs font-medium text-brand-muted hover:text-saffron"
                              onClick={() => setAllOpen(false)}
                            >
                              {sub.name}
                            </RouterLink>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="px-4 py-3">
                    <RouterLink
                      to=""
                      className="flex items-center justify-between text-sm font-bold text-foreground hover:text-saffron"
                      onClick={() => setAllOpen(false)}
                    >
                      Braj Yatra
                      <ChevronRight size={14} />
                    </RouterLink>
                  </div>
                </div>
              </div>
            </div>
          )}

          {brajYatraOpen && (
            <div className="absolute left-0 right-0 top-full z-[60] block">
              <div
                className="mx-2 max-h-[70vh] overflow-y-auto border border-border bg-brand-raised shadow-2xl md:mx-auto md:max-w-[1180px]"
                onMouseEnter={() => clearBrajYatraCloseTimer()}
                onMouseLeave={() => scheduleBrajYatraClose()}
                role="menu"
                aria-label="Braj Yatra destinations"
              >
                <div className="grid grid-cols-1 md:grid-cols-[220px_1fr]">
                  <div className="bg-brand-soft px-5 py-6 border-b md:border-b-0 md:border-r border-border">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-saffron mb-2">Braj Yatra</p>
                    <RouterLink
                      to="/braj-darshan"
                      className="inline-flex items-center gap-1 text-sm font-semibold text-foreground hover:text-saffron transition-colors"
                      onClick={() => setBrajYatraOpen(false)}
                    >
                      Explore all destinations
                      <ChevronRight size={14} />
                    </RouterLink>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-5">
                    {brajDestinations.map((d) => (
                      <RouterLink
                        key={d.id}
                        to={`/braj-darshan/${d.slug}`}
                        className="flex flex-col items-center text-center gap-2 group/dest"
                        onClick={() => setBrajYatraOpen(false)}
                        role="menuitem"
                      >
                        <img
                          src={d.templeIcon}
                          alt={`${d.name} temple icon`}
                          className="w-12 h-12 rounded-full object-cover border border-border group-hover/dest:border-saffron transition-colors"
                        />
                        <span className="text-sm font-medium text-brand-muted group-hover/dest:text-saffron transition-colors">
                          {d.name}
                        </span>
                      </RouterLink>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {openCat && (
            <div className="absolute left-0 right-0 top-full z-[60] block">
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