import { useEffect, useRef, useState } from 'react';
import { MessageCircle, ShieldCheck, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import SectionHeader from '@/components/ui/SectionHeader';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import BundleShelf from '@/components/recommendations/BundleShelf';
import { CommerceBundle, fetchBundles } from '@/lib/api';

const storyLinks = [
  { name: 'Vrindavan', slug: 'vrindavan', copy: 'Temple lanes, kirtan, seva and the devotional pulse of Braj.' },
  { name: 'Mathura', slug: 'mathura', copy: 'The birthplace of Krishna and the historic heart of sacred commerce.' },
  { name: 'Govardhan', slug: 'govardhan', copy: 'A place of remembrance, pilgrimage and humble offerings.' },
  { name: 'Barsana', slug: 'barsana', copy: "Radha Rani's land, known for devotion, color and celebration." },
];

export const WhyBrajMart = () => (
  <section className="bg-pearl py-8 md:py-10">
    <div className="storefront-shell">
      <SectionHeader
        tag="WHY BRAJMART"
        title="Devotional shopping, made reassuring"
        subtitle="Clear pricing, secure payment, careful packing and support for your order journey."
      />
      <div className="grid gap-3 md:grid-cols-3">
        {[
          { icon: ShieldCheck, title: 'Authentic Selection', text: "Products are curated around BrajMart's devotional catalog and real product data." },
          { icon: Truck, title: 'Delivery Clarity', text: 'Shipping fees, free-shipping threshold and delivery checks use configured settings.' },
          { icon: MessageCircle, title: 'Human Support', text: 'WhatsApp, email, order tracking and customer-service routes stay close at hand.' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <ScrollReveal key={item.title}>
              <div className="h-full rounded-lg border border-border bg-card p-5 shadow-sm">
                <Icon size={22} className="text-saffron" aria-hidden="true" />
                <h3 className="mt-4 text-lg font-bold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
              </div>
            </ScrollReveal>
          );
        })}
      </div>
    </div>
  </section>
);

export const BrajStory = () => (
  <section className="bg-background py-5 sm:py-6 md:py-8">
    <div className="storefront-shell grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
      <ScrollReveal>
        <span className="text-xs font-bold uppercase tracking-[0.18em] text-gold">BRAJ DARSHAN</span>
        <h2 className="mt-3 font-playfair text-3xl font-bold leading-tight text-foreground md:text-4xl">
          From the land of Krishna to your doorstep.
        </h2>
        <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground md:text-base">
          BrajMart's difference is not just a catalog. It is the emotional geography of Vrindavan, Mathura,
          Govardhan and Barsana expressed through useful devotional products for daily life.
        </p>
        <Link
          to="/braj-darshan/vrindavan"
          className="mt-6 inline-flex rounded-lg bg-maroon px-5 py-3 text-sm font-bold text-white transition hover:bg-saffron premium-focus"
        >
          Explore Braj Darshan
        </Link>
      </ScrollReveal>
      <div className="grid gap-3 sm:grid-cols-2">
        {storyLinks.map((item) => (
          <ScrollReveal key={item.slug}>
            <Link
              to={`/braj-darshan/${item.slug}`}
              className="block rounded-lg border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-gold/50 premium-focus"
            >
              <span className="font-playfair text-xl font-bold text-foreground">{item.name}</span>
              <span className="mt-2 block text-sm leading-relaxed text-muted-foreground">{item.copy}</span>
            </Link>
          </ScrollReveal>
        ))}
      </div>
    </div>
  </section>
);

export const NewsletterEngagement = () => (
  <section className="storefront-band bg-maroon text-white">
    <div className="storefront-shell flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
      <div>
        <span className="text-xs font-bold uppercase tracking-[0.18em] text-gold-light">STAY CONNECTED</span>
        <h2 className="mt-2 font-playfair text-3xl font-bold text-white">Bring a little Braj home, again and again.</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/78">
          Get product updates, devotional reading picks and order support through BrajMart's existing contact channels.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link to="/contact" className="rounded-lg bg-white px-5 py-3 text-sm font-bold text-maroon transition hover:bg-gold-light premium-focus">
          Contact Us
        </Link>
        <Link to="/blog" className="rounded-lg border border-white/30 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10 premium-focus">
          Read Stories
        </Link>
      </div>
    </div>
  </section>
);

export const BundledFavorites = () => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [bundles, setBundles] = useState<CommerceBundle[]>([]);

  useEffect(() => {
    let active = true;
    let observer: IntersectionObserver | null = null;
    let timeoutId: number | undefined;

    const load = () => {
      fetchBundles({ location: 'home', limit: 3 })
        .then((data) => {
          if (active) setBundles(Array.isArray(data) ? data : []);
        })
        .catch(() => {
          if (active) setBundles([]);
        });
    };

    if (typeof IntersectionObserver === 'undefined' || !rootRef.current) {
      timeoutId = window.setTimeout(load, 5000);
    } else {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry?.isIntersecting) return;
          observer?.disconnect();
          load();
        },
        { rootMargin: '640px 0px' }
      );
      observer.observe(rootRef.current);
    }

    return () => {
      active = false;
      if (timeoutId) window.clearTimeout(timeoutId);
      observer?.disconnect();
    };
  }, []);

  return (
    <div ref={rootRef}>
      <BundleShelf
        bundles={bundles}
        title="Curated Devotional Sets"
        subtitle="Ready-to-shop combinations selected by the BrajMart team from currently available products."
      />
    </div>
  );
};
