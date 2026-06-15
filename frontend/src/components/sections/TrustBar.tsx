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
      <div className="container mx-auto px-4 py-1.5 md:py-2.5">
        <div className="flex flex-wrap justify-around md:justify-between gap-y-1.5 md:gap-3">
          {trustItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="flex items-center gap-1.5 md:gap-2 rounded-md bg-brand-raised/75 px-1.5 py-1.5 md:bg-transparent md:px-1 md:py-2 w-[47%] md:w-auto">
                <Icon size={24} strokeWidth={1.8} className="shrink-0 text-brand-accent md:hidden" aria-hidden="true" />
                <Icon size={34} strokeWidth={1.8} className="shrink-0 text-brand-accent hidden md:block" aria-hidden="true" />
                <div className="min-w-0">
                  <p className={`font-sans text-[11px] md:text-[13px] font-bold leading-tight text-brand-deep ${item.titleClassName || ''}`}>
                    {item.title}
                  </p>
                  <p className="mt-0.5 font-sans text-[10px] md:text-xs leading-snug text-brand-muted">{item.subtitle}</p>
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