import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { Truck, Clock, MapPin, Package, IndianRupee, Shield } from 'lucide-react';

const policies = [
  { icon: Truck, title: 'Standard Delivery', desc: '5-7 business days across India. Free on orders above ₹499.' },
  { icon: Clock, title: 'Express Delivery', desc: '2-3 business days in select metro cities. ₹99 flat fee.' },
  { icon: Package, title: 'Prasadam Priority', desc: 'All Prasadam orders are dispatched within 24 hours for freshness.' },
  { icon: MapPin, title: 'Pan-India Coverage', desc: 'We deliver to 25,000+ pin codes across all Indian states and UTs.' },
  { icon: IndianRupee, title: 'Shipping Charges', desc: 'Free above ₹499. ₹49 flat rate for orders below ₹499.' },
  { icon: Shield, title: 'Safe Packaging', desc: 'All items are packed with care — fragile products get extra cushioning.' },
];

const ShippingDeliveryPage = () => (
  <div className="min-h-screen bg-background">
    <Navbar />

    <section className="relative bg-maroon-dark text-primary-foreground py-16 md:py-24">
      <div className="container mx-auto px-4 text-center">
        <ScrollReveal>
          <p className="text-gold font-cinzel tracking-[0.2em] text-sm mb-4">DELIVERY INFORMATION</p>
          <h1 className="font-cinzel text-3xl md:text-5xl font-bold mb-4">Shipping & Delivery</h1>
          <p className="text-primary-foreground/70 max-w-xl mx-auto">We bring the blessings of Vrindavan to your doorstep — with speed, care, and devotion.</p>
        </ScrollReveal>
      </div>
    </section>

    <section className="py-16 bg-background">
      <div className="container mx-auto px-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto mb-16">
          {policies.map((p, i) => (
            <ScrollReveal key={p.title} delay={i * 0.08}>
              <div className="bg-card rounded-2xl border border-border p-6 hover:border-gold/40 hover:shadow-lg transition-all duration-300">
                <div className="w-12 h-12 rounded-xl bg-saffron/10 flex items-center justify-center mb-4">
                  <p.icon size={22} className="text-saffron" />
                </div>
                <h3 className="font-cinzel font-bold text-foreground mb-2">{p.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{p.desc}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal>
          <div className="max-w-3xl mx-auto bg-pearl rounded-2xl p-8 border border-border">
            <h2 className="font-cinzel text-xl font-bold text-foreground mb-6">Delivery Timeline</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 text-muted-foreground font-medium">Region</th>
                    <th className="text-left py-3 text-muted-foreground font-medium">Standard</th>
                    <th className="text-left py-3 text-muted-foreground font-medium">Express</th>
                  </tr>
                </thead>
                <tbody className="text-foreground">
                  {[
                    ['Delhi NCR, UP, Haryana', '3-4 days', '1-2 days'],
                    ['Metro Cities (Mumbai, Bangalore, etc.)', '4-5 days', '2-3 days'],
                    ['Tier 2 Cities', '5-7 days', '3-4 days'],
                    ['Remote / Rural Areas', '7-10 days', 'Not available'],
                    ['North-East India', '7-12 days', 'Not available'],
                  ].map(([region, std, exp]) => (
                    <tr key={region} className="border-b border-border/50">
                      <td className="py-3 font-medium">{region}</td>
                      <td className="py-3">{std}</td>
                      <td className="py-3">{exp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>

    <Footer />
  </div>
);

export default ShippingDeliveryPage;
