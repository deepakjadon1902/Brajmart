import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { brajDestinations } from '@/data/brajDestinations';
import { ScrollReveal } from '../ui/ScrollReveal';

const BrajYatra = () => (
  <section className="bg-white py-6 md:py-8">
    <div className="container mx-auto px-4">
      <ScrollReveal>
        <div className="mb-6 text-center">
          <h2 className="mb-2 font-cinzel text-2xl font-bold text-brand-deep md:text-3xl">Braj Darshan</h2>
          <p className="mx-auto max-w-xl text-sm text-brand-deep/70">
            Short, clean guides to Vrindavan, Mathura, Govardhan, Barsana, Nandgaon and Gokul.
          </p>
        </div>
      </ScrollReveal>

      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
        {brajDestinations.map((destination, index) => (
          <ScrollReveal key={destination.id} delay={index * 0.08}>
            <Link
              to={`/braj-darshan/${destination.slug}`}
              className="group block overflow-hidden rounded-lg border border-brand-deep/15 bg-brand-deep/5 transition-all hover:border-gold/40 hover:bg-brand-deep/10"
            >
              <div className="aspect-[4/3] overflow-hidden">
                <img
                  src={destination.image}
                  alt={destination.name}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              </div>
              <div className="p-4 text-center">
                <h3 className="font-cinzel text-sm font-semibold text-brand-deep">{destination.name}</h3>
                <div className="mt-1 flex items-center justify-center gap-1">
                  <MapPin size={10} className="text-gold" />
                  <span className="text-xs text-black">{destination.distance}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-black">{destination.shortDesc}</p>
                <span className="mt-2 block text-xs text-gold opacity-0 transition-opacity group-hover:opacity-100">
                  Explore
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
