import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { ScrollReveal } from '@/components/ui/ScrollReveal';

const sections = [
  { title: '1. Information We Collect', content: `We collect information you provide directly: name, email, phone number, shipping address, and payment details when you place an order. We also automatically collect device information, IP address, browser type, and browsing behavior through cookies and analytics tools to improve your experience.` },
  { title: '2. How We Use Your Information', content: `Your information is used to: process and deliver your orders, send order updates and tracking info, provide customer support, personalize your shopping experience, send promotional offers (with your consent), prevent fraud, and improve our platform. We never sell your personal data to third parties.` },
  { title: '3. Data Security', content: `We implement industry-standard security measures including SSL encryption, secure payment gateways (PayU), and regular security audits. Your payment information is never stored on our servers — it's processed directly by our PCI-DSS compliant payment partners.` },
  { title: '4. Cookies & Tracking', content: `We use essential cookies for cart functionality and session management, analytics cookies (Google Analytics) to understand site usage, and marketing cookies for relevant promotions. You can manage cookie preferences through your browser settings at any time.` },
  { title: '5. Third-Party Services', content: `We share limited data with trusted partners: shipping carriers (for delivery), payment processors (PayU), analytics providers (Google Analytics), and email services (for order updates). Each partner is bound by strict data protection agreements.` },
  { title: '6. Your Rights', content: `You have the right to: access your personal data, correct inaccurate information, request data deletion, opt out of marketing communications, and export your data. Contact us at privacy@brajmart.com to exercise any of these rights.` },
  { title: '7. Data Retention', content: `We retain your account data as long as your account is active. Order records are kept for 5 years for legal and tax compliance. You can request account deletion at any time, and we'll remove your data within 30 days (except legally required records).` },
  { title: '8. Children\'s Privacy', content: `BrajMart is not intended for children under 13. We do not knowingly collect information from children. If you believe a child has provided us with personal data, please contact us immediately.` },
  { title: '9. Updates to This Policy', content: `We may update this policy periodically. Significant changes will be communicated via email or a prominent notice on our website. Continued use of BrajMart after changes constitutes acceptance of the updated policy.` },
];

const PrivacyPolicyPage = () => (
  <div className="min-h-screen bg-background">
    <Navbar />

    <section className="relative bg-maroon-dark text-primary-foreground py-16 md:py-24">
      <div className="container mx-auto px-4 text-center">
        <ScrollReveal>
          <p className="text-gold font-cinzel tracking-[0.2em] text-sm mb-4">YOUR PRIVACY MATTERS</p>
          <h1 className="font-cinzel text-3xl md:text-5xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-primary-foreground/70 max-w-xl mx-auto">Last updated: March 1, 2025</p>
        </ScrollReveal>
      </div>
    </section>

    <section className="py-16 bg-background">
      <div className="container mx-auto px-4 max-w-3xl">
        <ScrollReveal>
          <p className="text-muted-foreground leading-relaxed mb-10">
            At BrajMart, we respect your privacy and are committed to protecting your personal information. This policy explains how we collect, use, and safeguard your data when you use our platform.
          </p>
        </ScrollReveal>
        <div className="space-y-8">
          {sections.map((s, i) => (
            <ScrollReveal key={s.title} delay={i * 0.04}>
              <div>
                <h2 className="font-cinzel text-lg font-bold text-foreground mb-3">{s.title}</h2>
                <p className="text-muted-foreground text-sm leading-relaxed">{s.content}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
        <ScrollReveal>
          <div className="mt-12 bg-pearl rounded-2xl border border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">Questions about our privacy practices?</p>
            <p className="text-saffron font-semibold mt-1">privacy@brajmart.com</p>
          </div>
        </ScrollReveal>
      </div>
    </section>

    <Footer />
  </div>
);

export default PrivacyPolicyPage;

