import { ScrollReveal } from '../ui/ScrollReveal';

const destinations = [
  { name: 'Vrindavan', emoji: '🛕' },
  { name: 'Mathura', emoji: '🏛️' },
  { name: 'Govardhan', emoji: '⛰️' },
  { name: 'Nandgaon', emoji: '🌄' },
  { name: 'Barsana', emoji: '🌸' },
  { name: 'Gokul', emoji: '🏘️' },
];

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
          <p className="text-primary-foreground/60 text-sm">
            Explore the sacred Yatra circuits of Braj Bhumi
          </p>
        </div>
      </ScrollReveal>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
        {destinations.map((d, i) => (
          <ScrollReveal key={d.name} delay={i * 0.08}>
            <a href="#" className="block p-6 rounded-2xl bg-primary-foreground/5 border border-primary-foreground/10 backdrop-blur text-center group hover:border-gold/40 hover:bg-primary-foreground/10 transition-all">
              <span className="text-4xl block mb-3">{d.emoji}</span>
              <h3 className="font-cinzel text-primary-foreground font-semibold text-sm">{d.name}</h3>
              <span className="text-gold text-xs mt-1 block opacity-0 group-hover:opacity-100 transition-opacity">Explore →</span>
            </a>
          </ScrollReveal>
        ))}
      </div>
    </div>
  </section>
);

export default BrajYatra;
