import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { ScrollReveal } from '@/components/ui/ScrollReveal';

const sections = [
  { title: '1. Introduction', content: 'Brajmart is an online platform offering spiritual and devotional products inspired by the sacred land of Braj. These Terms govern your use of our website and any purchases made through it.' },
  { title: '2. Eligibility', content: 'By using our website, you confirm that you are at least 18 years old or are using the website under the supervision of a parent or guardian. You agree to provide accurate and complete information during registration and checkout.' },
  { title: '3. Account Responsibility', content: 'You are responsible for maintaining the confidentiality of your login credentials and for all activities under your account. Notify us immediately of any unauthorized use.' },
  { title: '4. Products & Services', content: 'We strive to ensure product descriptions, images, and prices are accurate. Minor variations may occur in color, size, or appearance. Availability may change without notice, and we reserve the right to modify or discontinue products at any time.' },
  { title: '5. Pricing & Payments', content: 'All prices are listed in INR and are inclusive or exclusive of applicable taxes as specified. Additional charges such as shipping may apply. We reserve the right to correct pricing errors. Payments are processed securely through trusted gateways.' },
  { title: '6. Order Acceptance & Cancellation', content: 'Placing an order does not guarantee acceptance. We may cancel or refuse orders due to product unavailability, pricing errors, or suspected fraud. If an order is canceled after payment, a full refund will be issued.' },
  { title: '7. Shipping & Delivery', content: 'Delivery timelines are estimates and may vary due to external factors. We are not liable for delays caused by logistics partners or unforeseen circumstances. Risk of loss or damage passes to you upon delivery.' },
  { title: '8. Returns & Refunds', content: 'Returns and refunds are governed by our Return & Refund Policy. Returns must be requested within the specified timeframe, items must be unused and in original packaging, and certain items may not be eligible for return.' },
  { title: '9. User Conduct', content: 'You agree not to use the website for unlawful or fraudulent activities, post harmful or misleading content, interfere with site security or functionality, or impersonate others. Violations may result in termination of access.' },
  { title: '10. Intellectual Property', content: 'All content on Brajmart, including logos, images, product descriptions, and website design, is our property and protected by applicable laws. Unauthorized use is prohibited.' },
  { title: '11. Third-Party Links', content: 'Our website may contain links to third-party websites for convenience. We are not responsible for their content, policies, or practices.' },
  { title: '12. Limitation of Liability', content: 'Brajmart is not liable for indirect or consequential damages, losses arising from use or inability to use our website, or delays caused by events beyond our control.' },
  { title: '13. Privacy', content: 'Your use of our website is also governed by our Privacy Policy, which explains how we collect and use your data.' },
  { title: '14. Changes to Terms', content: 'We may update these Terms from time to time. Continued use of the website after changes are posted constitutes acceptance of the updated terms.' },
  { title: '15. Governing Law', content: 'These Terms are governed by the laws of India. Any disputes are subject to the jurisdiction of courts in Uttar Pradesh.' },
  { title: '16. Force Majeure', content: 'We are not responsible for delays or failure to perform obligations due to events beyond our control, such as natural disasters, strikes, or government restrictions.' },
  { title: '17. Contact Us', content: 'Brajmart, ISKCON Vrindavan, Raman Reti, Mathura, Uttar Pradesh. Email: support@brajmart.com. Phone: +91 9634359003.' },
];

const TermsPage = () => (
  <div className="min-h-screen bg-background">
    <Navbar />

    <section className="relative bg-maroon-dark text-primary-foreground py-16 md:py-24">
      <div className="container mx-auto px-4 text-center">
        <ScrollReveal>
          <p className="text-gold font-cinzel tracking-[0.2em] text-sm mb-4">LEGAL</p>
          <h1 className="font-cinzel text-3xl md:text-5xl font-bold mb-4">Terms & Conditions</h1>
          <p className="text-primary-foreground/70 max-w-xl mx-auto">Last updated: April 13, 2026</p>
        </ScrollReveal>
      </div>
    </section>

    <section className="py-16 bg-background">
      <div className="container mx-auto px-4 max-w-3xl">
        <ScrollReveal>
          <p className="text-muted-foreground leading-relaxed mb-10">
            Welcome to Brajmart. By accessing or using our website, you agree to comply with these Terms & Conditions. If you do not agree, please do not use the website.
          </p>
        </ScrollReveal>
        <div className="space-y-8">
          {sections.map((s, i) => (
            <ScrollReveal key={s.title} delay={i * 0.03}>
              <div>
                <h2 className="font-cinzel text-lg font-bold text-foreground mb-3">{s.title}</h2>
                <p className="text-muted-foreground text-sm leading-relaxed">{s.content}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>

    <Footer />
  </div>
);

export default TermsPage;
