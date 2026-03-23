import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { Heart, Leaf, Shield, Truck, Users, MapPin } from 'lucide-react';

const values = [
  { icon: Heart, title: 'Devotion First', desc: 'Every product is selected with devotion and reverence for Braj culture.' },
  { icon: Leaf, title: '100% Authentic', desc: 'Sourced directly from Vrindavan temples, artisans, and trusted farms.' },
  { icon: Shield, title: 'Quality Assured', desc: 'Rigorous quality checks ensure only the best reaches your doorstep.' },
  { icon: Truck, title: 'Pan-India Delivery', desc: 'We deliver divine products across India with care and speed.' },
  { icon: Users, title: 'Community Driven', desc: 'Built by devotees, for devotees — with love from Braj Bhumi.' },
  { icon: MapPin, title: 'Rooted in Vrindavan', desc: 'Our heart and headquarters lie in the sacred land of Vrindavan.' },
];

const team = [
  { name: 'Radhika Sharma', role: 'Founder & CEO', initials: 'RS' },
  { name: 'Govind Patel', role: 'Head of Operations', initials: 'GP' },
  { name: 'Meera Devi', role: 'Product Curator', initials: 'MD' },
  { name: 'Arjun Mishra', role: 'Technology Lead', initials: 'AM' },
];

const AboutPage = () => (
  <div className="min-h-screen bg-background">
    <Navbar />

    {/* Hero */}
    <section className="relative bg-maroon-dark text-primary-foreground py-20 md:py-28 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,hsl(var(--gold)/0.08),transparent_60%)]" />
      <div className="container mx-auto px-4 text-center relative z-10">
        <ScrollReveal>
          <p className="text-gold font-cinzel tracking-[0.2em] text-sm mb-4">OUR STORY</p>
          <h1 className="font-cinzel text-3xl md:text-5xl font-bold mb-6 leading-tight">About BrajMart</h1>
          <p className="max-w-2xl mx-auto text-primary-foreground/70 text-lg leading-relaxed">
            Connecting millions of devotees worldwide to the divine culture, authentic products, and sacred traditions of Vrindavan — the land of Lord Krishna.
          </p>
        </ScrollReveal>
      </div>
    </section>

    {/* Mission */}
    <section className="py-16 md:py-24 bg-background">
      <div className="container mx-auto px-4">
        <ScrollReveal>
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-gold font-cinzel tracking-widest text-xs mb-3">OUR MISSION</p>
              <h2 className="font-cinzel text-2xl md:text-3xl font-bold text-foreground mb-6">Bringing Vrindavan to Your Doorstep</h2>
              <div className="space-y-4 text-muted-foreground leading-relaxed">
                <p>BrajMart was born from a simple yet profound idea — to make the sacred treasures of Braj Bhumi accessible to devotees everywhere. From temple-blessed Prasadam to handcrafted deity Shringar, every product carries the essence of Vrindavan's divine culture.</p>
                <p>We work directly with Vrindavan's temples, local artisans, and organic farmers to ensure authenticity, fair pricing, and the highest quality. Our commitment goes beyond commerce — we aim to preserve and promote the rich spiritual heritage of Braj.</p>
                <p>Whether you're seeking Srila Prabhupada's timeless books, authentic Tulsi malas, or satvik groceries for your Bhoga preparation, BrajMart is your trusted companion on the path of devotion.</p>
              </div>
            </div>
            <div className="bg-pearl rounded-2xl p-8 border border-border">
              <div className="grid grid-cols-2 gap-6 text-center">
                {[
                  { num: '10,000+', label: 'Happy Devotees' },
                  { num: '500+', label: 'Products' },
                  { num: '50,000+', label: 'Orders Delivered' },
                  { num: '100+', label: 'Temple Partners' },
                ].map(s => (
                  <div key={s.label}>
                    <p className="font-cinzel text-2xl font-bold text-saffron">{s.num}</p>
                    <p className="text-muted-foreground text-sm mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>

    {/* Values */}
    <section className="py-16 md:py-24 bg-pearl">
      <div className="container mx-auto px-4">
        <ScrollReveal>
          <div className="text-center mb-12">
            <p className="text-gold font-cinzel tracking-widest text-xs mb-3">WHAT WE STAND FOR</p>
            <h2 className="font-cinzel text-2xl md:text-3xl font-bold text-foreground">Our Core Values</h2>
          </div>
        </ScrollReveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {values.map((v, i) => (
            <ScrollReveal key={v.title} delay={i * 0.08}>
              <div className="bg-card rounded-2xl p-6 border border-border hover:border-gold/40 hover:shadow-lg transition-all duration-300 group">
                <div className="w-12 h-12 rounded-xl bg-saffron/10 flex items-center justify-center mb-4 group-hover:bg-saffron/20 transition-colors">
                  <v.icon size={22} className="text-saffron" />
                </div>
                <h3 className="font-cinzel font-bold text-foreground mb-2">{v.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{v.desc}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>

    {/* Team */}
    <section className="py-16 md:py-24 bg-background">
      <div className="container mx-auto px-4">
        <ScrollReveal>
          <div className="text-center mb-12">
            <p className="text-gold font-cinzel tracking-widest text-xs mb-3">THE PEOPLE BEHIND BRAJMART</p>
            <h2 className="font-cinzel text-2xl md:text-3xl font-bold text-foreground">Our Team</h2>
          </div>
        </ScrollReveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
          {team.map((t, i) => (
            <ScrollReveal key={t.name} delay={i * 0.1}>
              <div className="text-center group">
                <div className="w-20 h-20 rounded-full bg-gold-gradient mx-auto mb-4 flex items-center justify-center text-maroon-dark font-cinzel font-bold text-xl border-2 border-gold/30 group-hover:scale-105 transition-transform">
                  {t.initials}
                </div>
                <h4 className="font-semibold text-foreground">{t.name}</h4>
                <p className="text-muted-foreground text-sm">{t.role}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>

    <Footer />
  </div>
);

export default AboutPage;
