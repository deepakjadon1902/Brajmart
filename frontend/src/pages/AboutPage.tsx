import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { Heart, Leaf, Shield, Truck, Users, MapPin, ShoppingBag, Package, Star, ShieldCheck } from 'lucide-react';

const values = [
  { icon: Heart, title: 'Devotion First', desc: 'We treat every order as seva, honoring the spirit behind each product.' },
  { icon: Leaf, title: 'Authenticity You Can Trust', desc: 'Handpicked from temples, artisans, and trusted sources in Braj.' },
  { icon: Shield, title: 'Quality With Reverence', desc: 'Carefully curated for purity, craftsmanship, and cultural value.' },
  { icon: Truck, title: 'Reliable Delivery', desc: 'Secure packaging and dependable shipping across India.' },
  { icon: Users, title: 'Community Centered', desc: 'Built for devotees, families, and seekers of spiritual living.' },
  { icon: MapPin, title: 'Rooted in Vrindavan', desc: 'Inspired daily by the sacred land of Braj and its living traditions.' },
];

const offerings = [
  { icon: Package, label: 'Divine idols of Gods and Goddesses' },
  { icon: ShoppingBag, label: 'Puja samagri and ritual essentials' },
  { icon: Star, label: 'Spiritual books and devotional accessories' },
  { icon: Leaf, label: 'Prasadam and sacred offerings' },
  { icon: MapPin, label: 'Products inspired by the culture of Braj' },
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
            Brajmart is a bridge between devotion and daily life, bringing the sacred culture of Vrindavan to homes everywhere through authentic, meaningful spiritual essentials.
          </p>
        </ScrollReveal>
      </div>
    </section>

    {/* Story */}
    <section className="py-16 md:py-24 bg-background">
      <div className="container mx-auto px-4">
        <ScrollReveal>
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-gold font-cinzel tracking-widest text-xs mb-3">OUR STORY</p>
              <h2 className="font-cinzel text-2xl md:text-3xl font-bold text-foreground mb-6">A Journey Rooted in Faith</h2>
              <div className="space-y-4 text-muted-foreground leading-relaxed">
                <p>At Brajmart, we believe spirituality is not merely a practice - it is a way of life. Born in the sacred land of Vrindavan and nurtured in Mathura, our journey began with a simple vision: to bring devotion, culture, and tradition closer to every home.</p>
                <p>What started as a small, heartfelt initiative has grown into a trusted eCommerce destination for spiritual essentials. We curate each offering with care, ensuring authenticity, quality, and a meaningful connection to faith.</p>
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

    {/* What We Offer */}
    <section className="py-16 md:py-24 bg-pearl">
      <div className="container mx-auto px-4">
        <ScrollReveal>
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-gold font-cinzel tracking-widest text-xs mb-3">WHAT WE OFFER</p>
              <h2 className="font-cinzel text-2xl md:text-3xl font-bold text-foreground mb-6">Spiritual Essentials, Curated with Care</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Our collection is designed to carry the soul of Braj into your everyday rituals - from daily pooja to special ceremonies. Each product is selected for its spiritual significance and cultural authenticity.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {offerings.map((item) => (
                  <div key={item.label} className="flex items-start gap-3 rounded-xl border border-border bg-card/60 px-4 py-3">
                    <div className="w-9 h-9 rounded-lg bg-saffron/10 flex items-center justify-center shrink-0">
                      <item.icon size={18} className="text-saffron" />
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-card rounded-2xl p-8 border border-border">
              <p className="text-gold font-cinzel tracking-widest text-xs mb-3">OUR MISSION</p>
              <h3 className="font-cinzel text-xl md:text-2xl font-bold text-foreground mb-4">Tradition Meets Modern Living</h3>
              <p className="text-muted-foreground leading-relaxed">
                We bridge the gap between heritage and convenience by making authentic spiritual products easily accessible. Our goal is to keep you connected to your roots while enjoying a seamless online experience.
              </p>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>

    {/* Values */}
    <section className="py-16 md:py-24 bg-background">
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

    {/* Why Choose */}
    <section className="py-10 md:py-12 bg-maroon-dark text-primary-foreground">
      <div className="container mx-auto px-4">
        <ScrollReveal>
          <div className="grid md:grid-cols-4 gap-4">
            {[
              { icon: ShieldCheck, title: 'Authenticity You Can Trust', desc: 'Verified sources and sacred provenance.' },
              { icon: Truck, title: 'Reliable Delivery', desc: 'Secure packaging and timely dispatch.' },
              { icon: Heart, title: 'Seva With Care', desc: 'Every order treated with devotion.' },
              { icon: Users, title: 'Customer First', desc: 'Warm support and a personal touch.' },
            ].map((item) => (
              <div key={item.title} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-3">
                  <item.icon size={18} className="text-gold" />
                </div>
                <h3 className="font-cinzel text-base font-bold">{item.title}</h3>
                <p className="text-primary-foreground/70 text-sm mt-1">{item.desc}</p>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>

    {/* Vision & Commitment */}
    <section className="py-16 md:py-24 bg-pearl">
      <div className="container mx-auto px-4">
        <ScrollReveal>
          <div className="grid md:grid-cols-2 gap-12">
            <div className="bg-card rounded-2xl p-8 border border-border">
              <p className="text-gold font-cinzel tracking-widest text-xs mb-3">OUR VISION</p>
              <h3 className="font-cinzel text-2xl font-bold text-foreground mb-4">A Spiritual Ecosystem</h3>
              <p className="text-muted-foreground leading-relaxed">
                We envision Brajmart as more than an online store - a trusted space where devotion meets convenience. Whether it is a daily diya or a special ritual, we strive to be your one-stop destination for spiritual needs.
              </p>
            </div>
            <div className="bg-card rounded-2xl p-8 border border-border">
              <p className="text-gold font-cinzel tracking-widest text-xs mb-3">OUR COMMITMENT</p>
              <h3 className="font-cinzel text-2xl font-bold text-foreground mb-4">Heritage, Preserved</h3>
              <p className="text-muted-foreground leading-relaxed">
                We are committed to preserving cultural heritage while making it accessible in today's digital world. We do not just deliver products - we deliver a piece of faith, tradition, and devotion to your doorstep.
              </p>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>

    {/* Founder Story */}
    <section className="py-16 md:py-24 bg-background">
      <div className="container mx-auto px-4">
        <ScrollReveal>
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-gold font-cinzel tracking-widest text-xs mb-3">FOUNDER'S NOTE</p>
              <h2 className="font-cinzel text-2xl md:text-3xl font-bold text-foreground mb-6">A Personal Promise</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Brajmart began as a simple seva - sourcing authentic spiritual essentials for friends and family who wished to stay connected to Vrindavan. Over time, that seva grew into a platform built on trust, devotion, and cultural pride.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                My promise is to keep Brajmart rooted in faith, transparent in quality, and warm in service. Every order is a sacred responsibility and a chance to bring a piece of Braj into your home.
              </p>
              <div className="mt-5">
                <p className="font-semibold text-foreground">Kumar Anish</p>
                <p className="text-muted-foreground text-sm">Founder, Brajmart</p>
              </div>
            </div>
            <div className="bg-pearl border border-border rounded-2xl p-8">
              <div className="text-saffron font-cinzel text-4xl mb-4">"</div>
              <p className="text-foreground text-lg leading-relaxed">
                Brajmart is not just a store - it is a bridge between faith and everyday life, designed to keep the spirit of Vrindavan close to your heart.
              </p>
              <div className="mt-6 h-px bg-border" />
              <div className="mt-4 text-sm text-muted-foreground">
                From Mathura, with devotion and gratitude.
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>

    <Footer />
  </div>
);

export default AboutPage;
