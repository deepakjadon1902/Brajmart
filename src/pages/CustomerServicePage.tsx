import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { Headphones, MessageSquare, Phone, Mail, Clock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const channels = [
  { icon: Phone, title: 'Phone Support', desc: 'Speak directly with our support team', detail: '+91 98765 43210', sub: 'Mon–Sat, 9 AM – 7 PM IST', action: 'Call Now' },
  { icon: Mail, title: 'Email Support', desc: 'Get a response within 24 hours', detail: 'support@brajmart.com', sub: 'We reply within 24 hours', action: 'Send Email' },
  { icon: MessageSquare, title: 'WhatsApp', desc: 'Quick chat support on WhatsApp', detail: '+91 87654 32109', sub: 'Available 9 AM – 9 PM IST', action: 'Chat Now' },
];

const commonIssues = [
  { title: 'I haven\'t received my order', desc: 'Track your order status or report a missing delivery.', link: '/track-order' },
  { title: 'I want to return a product', desc: 'Check eligibility and initiate a return request.', link: '/return-policy' },
  { title: 'My payment failed', desc: 'Troubleshoot payment issues and retry.', link: '/payment-method' },
  { title: 'I need to change my address', desc: 'Update delivery address for pending orders.', link: '/profile' },
  { title: 'Product quality concern', desc: 'Report damaged or different product received.', link: '/contact' },
  { title: 'Refund not received', desc: 'Check refund status and timelines.', link: '/return-policy' },
];

const CustomerServicePage = () => (
  <div className="min-h-screen bg-background">
    <Navbar />

    <section className="relative bg-maroon-dark text-primary-foreground py-16 md:py-24">
      <div className="container mx-auto px-4 text-center">
        <ScrollReveal>
          <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-6">
            <Headphones size={28} className="text-gold" />
          </div>
          <h1 className="font-cinzel text-3xl md:text-5xl font-bold mb-4">Customer Service</h1>
          <p className="text-primary-foreground/70 max-w-xl mx-auto">We're here to ensure your divine shopping experience is seamless. Reach out anytime!</p>
        </ScrollReveal>
      </div>
    </section>

    {/* Contact Channels */}
    <section className="py-16 bg-background">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-16">
          {channels.map((c, i) => (
            <ScrollReveal key={c.title} delay={i * 0.1}>
              <div className="bg-card rounded-2xl border border-border p-6 text-center hover:border-gold/40 hover:shadow-lg transition-all duration-300">
                <div className="w-14 h-14 rounded-full bg-saffron/10 flex items-center justify-center mx-auto mb-4">
                  <c.icon size={24} className="text-saffron" />
                </div>
                <h3 className="font-cinzel font-bold text-foreground mb-1">{c.title}</h3>
                <p className="text-muted-foreground text-sm mb-3">{c.desc}</p>
                <p className="text-saffron font-semibold text-sm mb-1">{c.detail}</p>
                <p className="text-muted-foreground text-xs flex items-center justify-center gap-1"><Clock size={11} /> {c.sub}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>

        {/* Common Issues */}
        <ScrollReveal>
          <h2 className="font-cinzel text-2xl font-bold text-foreground text-center mb-8">Common Issues</h2>
        </ScrollReveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {commonIssues.map((issue, i) => (
            <ScrollReveal key={issue.title} delay={i * 0.06}>
              <Link to={issue.link} className="flex items-start gap-3 bg-card rounded-xl border border-border p-5 hover:border-gold/40 hover:shadow-md transition-all duration-300 group">
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground text-sm mb-1 group-hover:text-saffron transition-colors">{issue.title}</h4>
                  <p className="text-muted-foreground text-xs">{issue.desc}</p>
                </div>
                <ArrowRight size={16} className="text-muted-foreground mt-1 group-hover:text-saffron transition-colors shrink-0" />
              </Link>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>

    <Footer />
  </div>
);

export default CustomerServicePage;
