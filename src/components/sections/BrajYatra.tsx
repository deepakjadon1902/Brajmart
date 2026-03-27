import { Link } from 'react-router-dom';
import { ScrollReveal } from '../ui/ScrollReveal';
import { brajDestinations } from '@/data/brajDestinations';
import { MapPin } from 'lucide-react';

const BrajYatra = () => (
  <section className="py-14 md:py-20 bg-[#1a1a3e] relative overflow-hidden">
    <div className="container mx-auto px-4">
      <ScrollReveal>
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="h-px w-12 bg-gold/40" />
            <span className="text-gold text-2xl">✾</span>
            <span className="h-px w-12 bg-gold/40" />
          </div>
          <h2 className="font-cinzel text-2xl md:text-3xl font-bold text-primary-foreground mb-2">
            Braj Darshan — Enter the Realm of the Divine
          </h2>
          <p className="text-primary-foreground/60 text-sm max-w-xl mx-auto">
            Explore the sacred Yatra circuits of Braj Bhumi — from the birthplace of Lord Krishna to the land of Radha Rani
          </p>
        </div>
      </ScrollReveal>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
        {brajDestinations.map((d, i) => (
          <ScrollReveal key={d.id} delay={i * 0.08}>
            <Link
              to={`/braj-darshan/${d.slug}`}
              className="block rounded-2xl bg-primary-foreground/5 border border-primary-foreground/10 backdrop-blur overflow-hidden group hover:border-gold/40 hover:bg-primary-foreground/10 transition-all"
            >
              <div className="aspect-[4/3] overflow-hidden">
                <img
                  src={d.image}
                  alt={d.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  loading="lazy"
                />
              </div>
              <div className="p-4 text-center">
                <span className="text-2xl block mb-1">{d.emoji}</span>
                <h3 className="font-cinzel text-primary-foreground font-semibold text-sm">{d.name}</h3>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <MapPin size={10} className="text-gold/60" />
                  <span className="text-primary-foreground/40 text-xs">{d.distance}</span>
                </div>
                <p className="text-primary-foreground/50 text-xs mt-2 line-clamp-2">{d.shortDesc}</p>
                <span className="text-gold text-xs mt-2 block opacity-0 group-hover:opacity-100 transition-opacity">
                  Explore →
                </span>
              </div>
            </Link>
          </ScrollReveal>
        ))}
      </div>
    </div>
  </section>
);

export default BrajYatra;
