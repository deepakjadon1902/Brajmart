import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { RotateCcw, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';

const ReturnPolicyPage = () => (
  <div className="min-h-screen bg-background">
    <Navbar />

    <section className="relative bg-maroon-dark text-primary-foreground py-16 md:py-24">
      <div className="container mx-auto px-4 text-center">
        <ScrollReveal>
          <p className="text-gold font-cinzel tracking-[0.2em] text-sm mb-4">HASSLE-FREE RETURNS</p>
          <h1 className="font-cinzel text-3xl md:text-5xl font-bold mb-4">Return Policy</h1>
          <p className="text-primary-foreground/70 max-w-xl mx-auto">Your satisfaction is our seva. We make returns simple and fair.</p>
        </ScrollReveal>
      </div>
    </section>

    <section className="py-16 bg-background">
      <div className="container mx-auto px-4 max-w-3xl">
        {/* Key Points */}
        <ScrollReveal>
          <div className="grid sm:grid-cols-3 gap-6 mb-12">
            {[
              { icon: Clock, title: '7-Day Window', desc: 'Return within 7 days of delivery' },
              { icon: RotateCcw, title: 'Easy Process', desc: 'Initiate from your order page' },
              { icon: CheckCircle2, title: 'Quick Refund', desc: 'Refund within 5-7 business days' },
            ].map((p, i) => (
              <div key={p.title} className="bg-card rounded-2xl border border-border p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-saffron/10 flex items-center justify-center mx-auto mb-3">
                  <p.icon size={20} className="text-saffron" />
                </div>
                <h3 className="font-semibold text-foreground text-sm mb-1">{p.title}</h3>
                <p className="text-muted-foreground text-xs">{p.desc}</p>
              </div>
            ))}
          </div>
        </ScrollReveal>

        {/* Eligible / Not Eligible */}
        <ScrollReveal>
          <div className="grid sm:grid-cols-2 gap-6 mb-12">
            <div className="bg-card rounded-2xl border border-border p-6">
              <h3 className="flex items-center gap-2 font-cinzel font-bold text-foreground mb-4"><CheckCircle2 size={18} className="text-tulsi-green" /> Eligible for Return</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {['Books & scriptures (undamaged)', 'Clothing & accessories (unused, with tags)', 'Idols & Shringar (with original packaging)', 'Pooja accessories & home decor', 'Damaged or defective products'].map(l => (
                  <li key={l} className="flex items-start gap-2"><CheckCircle2 size={14} className="text-tulsi-green mt-0.5 shrink-0" /> {l}</li>
                ))}
              </ul>
            </div>
            <div className="bg-card rounded-2xl border border-border p-6">
              <h3 className="flex items-center gap-2 font-cinzel font-bold text-foreground mb-4"><XCircle size={18} className="text-destructive" /> Not Eligible</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {['Prasadam & perishable food items', 'Opened incense & dhoop products', 'Personalized or custom items', 'Products without original packaging', 'Items returned after 7-day window'].map(l => (
                  <li key={l} className="flex items-start gap-2"><XCircle size={14} className="text-destructive mt-0.5 shrink-0" /> {l}</li>
                ))}
              </ul>
            </div>
          </div>
        </ScrollReveal>

        {/* Steps */}
        <ScrollReveal>
          <div className="bg-pearl rounded-2xl border border-border p-8">
            <h2 className="font-cinzel text-xl font-bold text-foreground mb-6">How to Return</h2>
            <div className="space-y-6">
              {[
                { step: '1', title: 'Initiate Return', desc: 'Go to My Orders → select the order → click "Return Item" and choose a reason.' },
                { step: '2', title: 'Schedule Pickup', desc: 'Choose a convenient date. Our courier partner will pick up the item from your address.' },
                { step: '3', title: 'Quality Check', desc: 'Once received, our team inspects the product within 2 business days.' },
                { step: '4', title: 'Refund Processed', desc: 'Approved returns are refunded to your original payment method within 5-7 business days.' },
              ].map(s => (
                <div key={s.step} className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-gold-gradient flex items-center justify-center text-maroon-dark font-bold text-sm shrink-0">{s.step}</div>
                  <div>
                    <h4 className="font-semibold text-foreground text-sm">{s.title}</h4>
                    <p className="text-muted-foreground text-sm">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <div className="mt-8 bg-saffron/5 border border-saffron/20 rounded-xl p-5 flex gap-3">
            <AlertTriangle size={20} className="text-saffron shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">Important Note</p>
              <p className="text-muted-foreground text-sm">For damaged or wrong products, please contact us within 48 hours of delivery with photos. We'll arrange an immediate replacement or full refund — no return shipping needed.</p>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>

    <Footer />
  </div>
);

export default ReturnPolicyPage;
