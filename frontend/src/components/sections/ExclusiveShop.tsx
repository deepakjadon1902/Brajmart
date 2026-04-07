import { ScrollReveal } from '../ui/ScrollReveal';

const ExclusiveShop = () => (
  <section className="relative py-20 md:py-28 overflow-hidden">
    <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1609710228159-0fa9bd7c0827?w=1600&h=600&fit=crop')] bg-cover bg-center" />
    <div className="absolute inset-0 bg-gradient-to-r from-maroon-dark/90 via-maroon/80 to-maroon-dark/70" />

    <div className="relative container mx-auto px-4 text-center">
      <ScrollReveal>
        <span className="inline-block px-4 py-1.5 rounded-full bg-gold-gradient text-maroon-dark text-xs font-bold mb-4">
          EXCLUSIVE
        </span>
        <h2 className="font-cinzel text-3xl md:text-5xl font-bold text-primary-foreground leading-tight mb-3">
          BrajMart Exclusive Shop
        </h2>
        <h3 className="font-playfair italic text-gold-light text-lg mb-6">
          Your Gateway to Divine Bhakti
        </h3>
        <p className="text-primary-foreground/70 text-sm max-w-lg mx-auto mb-8">
          Handpicked, temple-authenticated, premium spiritual products curated exclusively for true devotees.
        </p>
        <button className="px-8 py-3.5 rounded-full bg-gold-gradient text-maroon-dark font-bold shimmer active:scale-[0.97] transition-transform shadow-xl text-sm">
          Enter Exclusive Shop →
        </button>
      </ScrollReveal>
    </div>
  </section>
);

export default ExclusiveShop;
