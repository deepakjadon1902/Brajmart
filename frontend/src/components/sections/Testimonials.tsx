import { ScrollReveal } from '../ui/ScrollReveal';
import { Star } from 'lucide-react';
import { testimonials } from '@/data/mockData';

const stats = [
  { label: 'Happy Devotees', value: '10,000+' },
  { label: 'Average Rating', value: '4.8★' },
  { label: 'Orders Delivered', value: '50,000+' },
  { label: 'Products', value: '100+' },
];

const Testimonials = () => {
  if (!testimonials || testimonials.length === 0) return null;
  return (
  <section className="py-14 md:py-20 bg-card">
    <div className="container mx-auto px-4">
      <ScrollReveal>
        <div className="flex items-center justify-center gap-3 mb-4">
          <span className="h-px w-12 bg-gold/40" />
          <span className="text-gold text-2xl">✾</span>
          <span className="h-px w-12 bg-gold/40" />
        </div>
        <h2 className="font-cinzel text-2xl md:text-3xl font-bold text-maroon text-center mb-2">
          What Our Customers Say
        </h2>
        <p className="text-center text-muted-foreground text-sm mb-8">
          Here's why thousands of devotees choose BrajMart
        </p>
      </ScrollReveal>

      {/* Stats */}
      <ScrollReveal>
        <div className="flex flex-wrap justify-center gap-6 md:gap-10 mb-12">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <span className="block text-xl font-bold text-saffron">{s.value}</span>
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
          ))}
        </div>
      </ScrollReveal>

      {/* Reviews grid */}
      <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
        {testimonials.slice(0, 3).map((t, i) => (
          <ScrollReveal key={t.id} delay={i * 0.1}>
            <div className="p-5 rounded-2xl bg-pearl border border-border border-l-4 border-l-gold shadow-sm">
              <div className="flex gap-0.5 mb-2">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} size={13} className="fill-gold text-gold" />
                ))}
              </div>
              <p className="text-sm italic text-foreground leading-relaxed mb-3">"{t.text}"</p>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gold-gradient flex items-center justify-center text-maroon-dark text-xs font-bold">
                  {t.name[0]}
                </div>
                <div>
                  <span className="block text-xs font-semibold text-foreground">{t.name}</span>
                  <span className="text-[0.65rem] text-muted-foreground">{t.city}</span>
                </div>
              </div>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </div>
  </section>
  );
};

export default Testimonials;
