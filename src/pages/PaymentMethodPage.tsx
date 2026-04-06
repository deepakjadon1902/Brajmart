import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { CreditCard, Smartphone, Building2, Wallet, Banknote, Shield } from 'lucide-react';

const methods = [
  { icon: Smartphone, title: 'UPI', desc: 'Pay instantly using Google Pay, PhonePe, Paytm, BHIM, or any UPI app. Scan QR or enter UPI ID.', tag: 'Most Popular' },
  { icon: CreditCard, title: 'Credit & Debit Cards', desc: 'We accept Visa, Mastercard, RuPay, and American Express. All transactions are 3D Secure protected.', tag: '' },
  { icon: Building2, title: 'Net Banking', desc: 'Pay directly from your bank account. All major Indian banks are supported including SBI, HDFC, ICICI, and more.', tag: '' },
  { icon: Wallet, title: 'Wallets', desc: 'Use Paytm Wallet, Amazon Pay, Mobikwik, Freecharge, and other popular digital wallets.', tag: '' },
  { icon: Banknote, title: 'Cash on Delivery', desc: 'Pay in cash when your order arrives. Available across India on orders up to ₹5,000. ₹29 COD fee applies.', tag: 'COD Available' },
  { icon: CreditCard, title: 'EMI Options', desc: 'No-cost EMI available on select products for orders above ₹3,000. Check eligibility at checkout.', tag: 'Coming Soon' },
];

const PaymentMethodPage = () => (
  <div className="min-h-screen bg-background">
    <Navbar />

    <section className="relative bg-maroon-dark text-primary-foreground py-16 md:py-24">
      <div className="container mx-auto px-4 text-center">
        <ScrollReveal>
          <p className="text-gold font-cinzel tracking-[0.2em] text-sm mb-4">SECURE PAYMENTS</p>
          <h1 className="font-cinzel text-3xl md:text-5xl font-bold mb-4">Payment Methods</h1>
          <p className="text-primary-foreground/70 max-w-xl mx-auto">Multiple secure payment options for a seamless checkout experience.</p>
        </ScrollReveal>
      </div>
    </section>

    <section className="py-16 bg-background">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {methods.map((m, i) => (
            <ScrollReveal key={m.title} delay={i * 0.08}>
              <div className="bg-card rounded-2xl border border-border p-6 hover:border-gold/40 hover:shadow-lg transition-all duration-300 relative">
                {m.tag && (
                  <span className={`absolute top-4 right-4 text-[0.6rem] font-bold px-2 py-0.5 rounded-full ${m.tag === 'Coming Soon' ? 'bg-muted text-muted-foreground' : 'bg-saffron/10 text-saffron'}`}>{m.tag}</span>
                )}
                <div className="w-12 h-12 rounded-xl bg-saffron/10 flex items-center justify-center mb-4">
                  <m.icon size={22} className="text-saffron" />
                </div>
                <h3 className="font-cinzel font-bold text-foreground mb-2">{m.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{m.desc}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal>
          <div className="bg-pearl rounded-2xl border border-border p-8 text-center">
            <Shield size={32} className="text-gold mx-auto mb-4" />
            <h2 className="font-cinzel text-xl font-bold text-foreground mb-3">100% Secure Payments</h2>
            <p className="text-muted-foreground text-sm max-w-lg mx-auto leading-relaxed">
              All payments are processed through PayU — India's most trusted payment gateway. Your financial data is encrypted with 256-bit SSL and we never store your card details on our servers. PCI DSS Level 1 compliant.
            </p>
          </div>
        </ScrollReveal>
      </div>
    </section>

    <Footer />
  </div>
);

export default PaymentMethodPage;

