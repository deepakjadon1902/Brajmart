import { BadgeCheck, RefreshCcw, ShieldCheck, Truck } from 'lucide-react';

const trustItems = [
  {
    icon: ShieldCheck,
    title: 'Vrindavan Authentic',
    subtitle: 'Temple-sourced products',
  },
  {
    icon: Truck,
    title: 'Free Shipping Rs. 299+',
    subtitle: 'Fast delivery across India',
    titleClassName: 'text-tulsi',
  },
  {
    icon: BadgeCheck,
    title: '100% Genuine',
    subtitle: 'No duplicate items',
  },
  {
    icon: RefreshCcw,
    title: 'Easy Returns',
    subtitle: 'Hassle-free policy',
  },
];

const TrustBar = () => {
  return (
    <section className="hidden bg-brand-soft border-y border-border md:block" aria-label="Why shop with Brajmart">
      <div className="container mx-auto px-1.5 py-1 sm:px-4 md:py-2.5">
        <div className="grid grid-cols-2 gap-0.5 sm:gap-1.5 md:flex md:flex-wrap md:justify-between md:gap-3">
          {trustItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="grid min-h-[32px] grid-cols-[12px_1fr] items-center gap-0.5 rounded bg-white/80 px-1 py-0.5 shadow-[0_1px_2px_rgba(87,52,31,0.06)] sm:min-h-[46px] sm:grid-cols-[18px_1fr] sm:gap-1 sm:px-2 sm:py-1 md:flex md:min-h-0 md:w-auto md:gap-2 md:bg-transparent md:px-1 md:py-2 md:shadow-none"
              >
                <Icon size={12} strokeWidth={1.9} className="shrink-0 text-brand-accent sm:hidden" aria-hidden="true" />
                <Icon size={18} strokeWidth={2} className="hidden shrink-0 text-brand-accent sm:block md:hidden" aria-hidden="true" />
                <Icon size={34} strokeWidth={1.8} className="shrink-0 text-brand-accent hidden md:block" aria-hidden="true" />
                <div className="min-w-0">
                  <span className={`trust-title block font-sans !text-[7px] font-medium leading-[1.05] text-brand-deep sm:!text-[10px] sm:font-bold md:!text-[13px] ${item.titleClassName || ''}`}>
                    {item.title}
                  </span>
                  <span className="trust-subtitle mt-0.5 block font-sans !text-[6.4px] font-light leading-[1.08] text-brand-muted sm:!text-[9px] sm:font-normal md:!text-xs md:leading-snug">{item.subtitle}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default TrustBar;
