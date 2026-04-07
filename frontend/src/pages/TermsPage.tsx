import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { ScrollReveal } from '@/components/ui/ScrollReveal';

const sections = [
  { title: '1. Acceptance of Terms', content: 'By accessing and using BrajMart (brajmart.com), you agree to be bound by these Terms & Conditions. If you do not agree to any part of these terms, please do not use our platform. These terms apply to all users, including browsers, customers, merchants, and contributors.' },
  { title: '2. Account Registration', content: 'To place an order, you may need to create an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account. You must provide accurate, current, and complete information during registration. BrajMart reserves the right to suspend or terminate accounts that violate these terms.' },
  { title: '3. Products & Pricing', content: 'We strive to display accurate product descriptions, images, and prices. However, we do not warrant that descriptions or pricing are error-free. All prices are in Indian Rupees (₹) and include applicable taxes unless stated otherwise. BrajMart reserves the right to modify prices without prior notice. Promotional prices are valid only during the specified period.' },
  { title: '4. Orders & Payment', content: 'Placing an order constitutes an offer to purchase. We reserve the right to accept or decline any order. Payment must be made through our accepted methods (UPI, Cards, Net Banking, Wallets, or COD). For COD orders, a nominal fee may apply. Orders are confirmed only after successful payment verification.' },
  { title: '5. Shipping & Delivery', content: 'Delivery timelines are estimates and may vary based on location and availability. BrajMart is not liable for delays caused by logistics partners, natural disasters, or circumstances beyond our control. Risk of loss passes to you upon delivery. Please inspect products upon receipt and report damages within 48 hours.' },
  { title: '6. Returns & Refunds', content: 'Returns are accepted within 7 days of delivery for eligible products as per our Return Policy. Perishable items (Prasadam, food products) are non-returnable. Refunds are processed within 5-7 business days to the original payment method. Shipping charges are non-refundable unless the return is due to our error.' },
  { title: '7. Intellectual Property', content: 'All content on BrajMart — including logos, text, images, graphics, and software — is our intellectual property or licensed to us. You may not reproduce, distribute, modify, or create derivative works without our written consent. User-generated content (reviews, ratings) grants BrajMart a non-exclusive license to use and display such content.' },
  { title: '8. Prohibited Activities', content: 'You agree not to: use the platform for unlawful purposes, attempt to hack or disrupt our systems, post false reviews or misleading content, resell products commercially without authorization, use automated tools to scrape data, or impersonate other users or BrajMart staff.' },
  { title: '9. Limitation of Liability', content: 'BrajMart shall not be liable for indirect, incidental, or consequential damages arising from your use of the platform. Our total liability for any claim shall not exceed the amount paid by you for the specific product or service in question. We are not responsible for third-party services linked from our platform.' },
  { title: '10. Governing Law', content: 'These terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts in Mathura, Uttar Pradesh. We encourage users to first contact our customer service to resolve issues amicably before pursuing legal action.' },
  { title: '11. Changes to Terms', content: 'BrajMart reserves the right to modify these terms at any time. Changes become effective upon posting on the website. Continued use of the platform after changes constitutes acceptance. We recommend reviewing these terms periodically.' },
];

const TermsPage = () => (
  <div className="min-h-screen bg-background">
    <Navbar />

    <section className="relative bg-maroon-dark text-primary-foreground py-16 md:py-24">
      <div className="container mx-auto px-4 text-center">
        <ScrollReveal>
          <p className="text-gold font-cinzel tracking-[0.2em] text-sm mb-4">LEGAL</p>
          <h1 className="font-cinzel text-3xl md:text-5xl font-bold mb-4">Terms & Conditions</h1>
          <p className="text-primary-foreground/70 max-w-xl mx-auto">Last updated: March 1, 2025</p>
        </ScrollReveal>
      </div>
    </section>

    <section className="py-16 bg-background">
      <div className="container mx-auto px-4 max-w-3xl">
        <ScrollReveal>
          <p className="text-muted-foreground leading-relaxed mb-10">
            Welcome to BrajMart. These Terms & Conditions govern your use of our platform and services. Please read them carefully before using our website or placing any orders.
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
