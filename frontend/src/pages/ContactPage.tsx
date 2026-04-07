import * as React from "react";
import { useState } from 'react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { MapPin, Phone, Mail, Clock, Send, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const contactInfo = [
  { icon: MapPin, title: 'Visit Us', lines: ['BrajMart Headquarters', 'Near ISKCON Temple, Raman Reti', 'Vrindavan, Mathura — 281121', 'Uttar Pradesh, India'] },
  { icon: Phone, title: 'Call Us', lines: ['+91 98765 43210', '+91 87654 32109', 'Mon–Sat, 9 AM – 7 PM IST'] },
  { icon: Mail, title: 'Email Us', lines: ['support@brajmart.com', 'orders@brajmart.com', 'business@brajmart.com'] },
  { icon: Clock, title: 'Working Hours', lines: ['Monday – Saturday', '9:00 AM – 7:00 PM IST', 'Sunday: Closed (Ekadashi seva)'] },
];

const ContactPage = () => {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({ title: 'Message Sent! 🙏', description: 'We\'ll get back to you within 24 hours.' });
    setForm({ name: '', email: '', phone: '', subject: '', message: '' });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="relative bg-maroon-dark text-primary-foreground py-16 md:py-24">
        <div className="container mx-auto px-4 text-center">
          <ScrollReveal>
            <p className="text-gold font-cinzel tracking-[0.2em] text-sm mb-4">GET IN TOUCH</p>
            <h1 className="font-cinzel text-3xl md:text-5xl font-bold mb-4">Contact Us</h1>
            <p className="text-primary-foreground/70 max-w-xl mx-auto">We'd love to hear from you. Reach out for orders, queries, or just to say Hare Krishna!</p>
          </ScrollReveal>
        </div>
      </section>

      {/* Contact Info Cards */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {contactInfo.map((c, i) => (
              <ScrollReveal key={c.title} delay={i * 0.08}>
                <div className="bg-card rounded-2xl border border-border p-6 text-center hover:border-gold/40 hover:shadow-lg transition-all duration-300">
                  <div className="w-12 h-12 rounded-full bg-saffron/10 flex items-center justify-center mx-auto mb-4">
                    <c.icon size={20} className="text-saffron" />
                  </div>
                  <h3 className="font-cinzel font-bold text-foreground mb-3">{c.title}</h3>
                  {c.lines.map(l => <p key={l} className="text-muted-foreground text-sm">{l}</p>)}
                </div>
              </ScrollReveal>
            ))}
          </div>

          {/* Form */}
          <ScrollReveal>
            <div className="max-w-2xl mx-auto bg-card rounded-2xl border border-border p-8">
              <div className="flex items-center gap-3 mb-6">
                <MessageSquare size={24} className="text-saffron" />
                <h2 className="font-cinzel text-xl font-bold text-foreground">Send Us a Message</h2>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required placeholder="Your Name" className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm outline-none focus:border-gold transition-colors" />
                  <input value={form.email} onChange={e => setForm({...form, email: e.target.value})} required type="email" placeholder="Email Address" className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm outline-none focus:border-gold transition-colors" />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="Phone Number" className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm outline-none focus:border-gold transition-colors" />
                  <input value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} required placeholder="Subject" className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm outline-none focus:border-gold transition-colors" />
                </div>
                <textarea value={form.message} onChange={e => setForm({...form, message: e.target.value})} required rows={5} placeholder="Your message..." className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm outline-none focus:border-gold transition-colors resize-none" />
                <button type="submit" className="w-full py-3 rounded-xl bg-gold-gradient text-maroon-dark font-bold text-sm flex items-center justify-center gap-2 shimmer active:scale-[0.97] transition-transform">
                  <Send size={16} /> Send Message
                </button>
              </form>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default ContactPage;
