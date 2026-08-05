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
    <section className="bg-brand-soft border-y border-border" aria-label="Why shop with Brajmart">
      <div className="container mx-auto px-3 py-1 sm:px-4 md:py-2.5">
        <div className="grid grid-cols-2 gap-1 sm:gap-1.5 md:flex md:flex-wrap md:justify-between md:gap-3">
          {trustItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="grid min-h-[42px] grid-cols-[16px_1fr] items-center gap-1 rounded bg-white/80 px-1.5 py-1 shadow-[0_1px_2px_rgba(87,52,31,0.06)] sm:min-h-[46px] sm:grid-cols-[18px_1fr] sm:px-2 md:flex md:min-h-0 md:w-auto md:gap-2 md:bg-transparent md:px-1 md:py-2 md:shadow-none"
              >
                <Icon size={16} strokeWidth={2} className="shrink-0 text-brand-accent sm:hidden" aria-hidden="true" />
                <Icon size={18} strokeWidth={2} className="hidden shrink-0 text-brand-accent sm:block md:hidden" aria-hidden="true" />
                <Icon size={34} strokeWidth={1.8} className="shrink-0 text-brand-accent hidden md:block" aria-hidden="true" />
                <div className="min-w-0">
                  <p className={`font-sans text-[9px] font-bold leading-[1.08] text-brand-deep sm:text-[10px] md:text-[13px] ${item.titleClassName || ''}`}>
                    {item.title}
                  </p>
                  <p className="mt-0.5 font-sans text-[8px] leading-[1.1] text-brand-muted sm:text-[9px] md:text-xs md:leading-snug">{item.subtitle}</p>
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
