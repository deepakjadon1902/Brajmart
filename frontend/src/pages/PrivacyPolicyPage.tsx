import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { ScrollReveal } from '@/components/ui/ScrollReveal';

const sections = [
  { title: '1. Who We Are', content: 'Brajmart is an eCommerce platform dedicated to spiritual and devotional products inspired by the sacred culture of Vrindavan. When we refer to  "we" , "our", or "us", we mean Brajmart.' },
  { title: '2. Information We Collect', content: 'We collect information you provide, such as full name, email address, phone number, shipping and billing address, and payment details (processed securely via trusted providers). We also collect data automatically like IP address, device and browser type, pages visited, time spent, and purchase or browsing behavior to improve our services.' },
  { title: '3. How We Use Your Information', content: 'We use your information to process and deliver orders, manage your account, provide customer support, send order updates and important notifications, improve site functionality and user experience, personalize recommendations, share offers if you opt in, prevent fraud, and comply with legal obligations.' },
  { title: '4. Sharing Your Information', content: 'We do not sell your personal data. We may share information with trusted service providers (payment gateways, delivery partners), technology and analytics partners, and legal authorities when required by law. All partners must handle your data securely and only for the intended purpose.' },
  { title: '5. Cookies & Tracking Technologies', content: 'We use cookies to remember preferences, keep items in your cart, analyze performance, and show relevant products and offers. You can disable cookies in your browser settings, but some features may not work properly.' },
  { title: '6. Data Security', content: 'We use secure servers, encryption (SSL), restricted access to sensitive data, and regular monitoring. While we take strong precautions, no method of transmission over the internet is 100% secure.' },
  { title: '7. Data Retention', content: 'We retain information only as long as necessary to fulfill orders and services, comply with legal requirements, resolve disputes, and enforce agreements.' },
  { title: '8. Your Rights & Choices', content: 'You can access or update your data, request deletion, opt out of promotional emails, and manage cookie preferences. Contact us to exercise these rights.' },
  { title: '9. Third-Party Links', content: 'Our website may contain links to third-party sites. Once you leave our platform, we are not responsible for how those websites handle your data.' },
  { title: '10. Childrens Privacy', content: 'Brajmart does not knowingly collect personal information from individuals under 18 years of age without parental consent.' },
  { title: '11. Updates to This Policy', content: 'We may update this Privacy Policy from time to time to reflect changes in practices or legal requirements. Please review this page periodically.' },
  { title: '12. Contact Us', content: 'Brajmart, ISKCON Vrindavan, Raman Reti, Mathura, Uttar Pradesh. Email: support@brajmart.com. Phone: +91 9634359003.' },
];

const PrivacyPolicyPage = () => (
  <div className="min-h-screen bg-background">
    <Navbar />

    <section className="relative bg-maroon-dark text-primary-foreground py-16 md:py-24">
      <div className="container mx-auto px-4 text-center">
        <ScrollReveal>
          <p className="text-gold font-cinzel tracking-[0.2em] text-sm mb-4">YOUR PRIVACY MATTERS</p>
          <h1 className="font-cinzel text-3xl md:text-5xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-primary-foreground/70 max-w-xl mx-auto">Last updated: April 13, 2026</p>
        </ScrollReveal>
      </div>
    </section>

    <section className="py-16 bg-background">
      <div className="container mx-auto px-4 max-w-3xl">
        <ScrollReveal>
          <p className="text-muted-foreground leading-relaxed mb-10">
            At Brajmart, your privacy is extremely important to us. This policy explains how we collect, use, and safeguard your information when you visit or make a purchase from our website.
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
            <p className="text-saffron font-semibold mt-1">support@brajmart.com</p>
            <p className="text-muted-foreground text-sm mt-1">+91 75050 09970</p>
          </div>
        </ScrollReveal>
      </div>
    </section>

    <Footer />
  </div>
);

export default PrivacyPolicyPage;
