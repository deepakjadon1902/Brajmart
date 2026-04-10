import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { Search, ShoppingCart, Truck, RotateCcw, CreditCard, User, HelpCircle, ChevronRight } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Link } from 'react-router-dom';
import { useState } from 'react';

const topics = [
  { icon: ShoppingCart, title: 'Orders & Purchases', desc: 'Place, modify, or cancel orders', link: '/track-order' },
  { icon: Truck, title: 'Shipping & Delivery', desc: 'Track shipments and delivery info', link: '/shipping-delivery' },
  { icon: RotateCcw, title: 'Returns & Refunds', desc: 'Return policy and refund process', link: '/return-policy' },
  { icon: CreditCard, title: 'Payments', desc: 'Payment methods and billing', link: '/payment-method' },
  { icon: User, title: 'My Account', desc: 'Profile, addresses, and settings', link: '/profile' },
  { icon: HelpCircle, title: 'General Queries', desc: 'FAQs and common questions', link: '/contact' },
];

const faqs = [
  { q: 'How do I track my order?', a: 'You can track your order by visiting the "My Orders" section in your profile or using the Track Order page. Enter your order ID and registered email to get real-time status updates.' },
  { q: 'What payment methods do you accept?', a: 'We accept UPI (Google Pay, PhonePe, Paytm), Credit/Debit Cards (Visa, Mastercard, RuPay), Net Banking, and Wallets across India.' },
  { q: 'How long does delivery take?', a: 'Standard delivery takes 5-7 business days. Express delivery (available in select cities) takes 2-3 business days. Prasadam orders are dispatched within 24 hours for freshness.' },
  { q: 'Can I return a product?', a: 'Yes, most products can be returned within 7 days of delivery. Perishable items like Prasadam are non-returnable. Visit our Return Policy page for complete details.' },
  { q: 'Are your products authentic?', a: 'Absolutely! All our products are sourced directly from Vrindavan temples, certified artisans, and organic farms. Each product comes with an authenticity guarantee.' },
  { q: 'Do you ship internationally?', a: 'Currently we ship across India. International shipping is coming soon. Join our newsletter to be notified when we launch international delivery.' },
  { q: 'How do I apply a coupon code?', a: 'Enter your coupon code in the "Apply Coupon" field on the Cart page before checkout. The discount will be applied automatically to eligible products.' },
  { q: 'What if I receive a damaged product?', a: 'Contact us within 48 hours of delivery with photos of the damaged product. We\'ll arrange a free replacement or full refund — no questions asked.' },
];

const HelpCenterPage = () => {
  const [search, setSearch] = useState('');
  const filtered = faqs.filter(f => f.q.toLowerCase().includes(search.toLowerCase()) || f.a.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="relative bg-maroon-dark text-primary-foreground py-16 md:py-24">
        <div className="container mx-auto px-4 text-center">
          <ScrollReveal>
            <p className="text-gold font-cinzel tracking-[0.2em] text-sm mb-4">WE'RE HERE TO HELP</p>
            <h1 className="font-cinzel text-3xl md:text-5xl font-bold mb-6">Help Center</h1>
            <div className="max-w-lg mx-auto flex rounded-full border border-primary-foreground/20 overflow-hidden bg-primary-foreground/5">
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search for help..." className="flex-1 px-5 py-3 bg-transparent text-sm outline-none placeholder:text-primary-foreground/40" />
              <button className="px-5 text-gold"><Search size={18} /></button>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Topics */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <h2 className="font-cinzel text-2xl font-bold text-foreground text-center mb-10">Browse by Topic</h2>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto mb-16">
            {topics.map((t, i) => (
              <ScrollReveal key={t.title} delay={i * 0.06}>
                <Link to={t.link} className="flex items-center gap-4 bg-card rounded-2xl border border-border p-5 hover:border-gold/40 hover:shadow-lg transition-all duration-300 group">
                  <div className="w-11 h-11 rounded-xl bg-saffron/10 flex items-center justify-center shrink-0 group-hover:bg-saffron/20 transition-colors">
                    <t.icon size={20} className="text-saffron" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground text-sm">{t.title}</h3>
                    <p className="text-muted-foreground text-xs">{t.desc}</p>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground group-hover:text-saffron transition-colors" />
                </Link>
              </ScrollReveal>
            ))}
          </div>

          {/* FAQs */}
          <ScrollReveal>
            <div className="max-w-3xl mx-auto">
              <h2 className="font-cinzel text-2xl font-bold text-foreground text-center mb-8">Frequently Asked Questions</h2>
              <Accordion type="single" collapsible className="space-y-3">
                {filtered.map((f, i) => (
                  <AccordionItem key={i} value={`faq-${i}`} className="bg-card rounded-xl border border-border px-5 data-[state=open]:border-gold/40">
                    <AccordionTrigger className="text-sm font-medium text-foreground hover:no-underline">{f.q}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground text-sm leading-relaxed">{f.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
              {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">No results found. Try a different search term.</p>}
            </div>
          </ScrollReveal>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default HelpCenterPage;
