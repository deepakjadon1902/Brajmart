import { Link } from 'react-router-dom';
import { ScrollReveal } from '../ui/ScrollReveal';
import { brajDestinations } from '@/data/brajDestinations';
import { MapPin } from 'lucide-react';

const BrajYatra = () => (
  <section className="py-12 md:py-18 bg-white relative overflow-hidden">
    <div className="container mx-auto px-4">
      <ScrollReveal>
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="h-px w-12 bg-gold/40" />
            <span className="text-gold text-2xl">✾</span>
            <span className="h-px w-12 bg-gold/40" />
          </div>
          <h2 className="font-cinzel text-2xl md:text-3xl font-bold text-brand-deep mb-2">
            Braj Darshan — Enter the Realm of the Divine
          </h2>
          <p className="text-brand-deep/70 text-sm max-w-xl mx-auto">
            Explore the sacred Yatra circuits of Braj Bhumi — from the birthplace of Lord Krishna to the land of Radha Rani
          </p>
        </div>
      </ScrollReveal>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 max-w-5xl mx-auto">
        {brajDestinations.map((d, i) => (
          <ScrollReveal key={d.id} delay={i * 0.08}>
            <Link
              to={`/braj-darshan/${d.slug}`}
              className="block rounded-2xl bg-brand-deep/8 border border-brand-deep/15 backdrop-blur overflow-hidden group hover:border-gold/40 hover:bg-brand-deep/12 transition-all"
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
                <div className="flex items-center justify-center gap-2">
                  <img
                    src={d.templeIcon}
                    alt={`${d.name} temple icon`}
                    className="w-6 h-6 rounded-full object-cover border border-gold/40"
                    loading="lazy"
                  />
                  <h3 className="font-cinzel text-brand-deep font-semibold text-sm">{d.name}</h3>
                </div>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <MapPin size={10} className="text-gold" />
                  <span className="text-black text-xs">{d.distance}</span>
                </div>
                <p className="text-black text-xs mt-2 line-clamp-2">{d.shortDesc}</p>
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