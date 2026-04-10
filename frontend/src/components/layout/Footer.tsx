import { Link } from 'react-router-dom';
import { ScrollReveal } from '../ui/ScrollReveal';
import { useSettingsStore } from '@/store/settingsStore';
import { Instagram, Facebook, Youtube, MessageCircle } from 'lucide-react';

const footerLinks = {
  'Get to Know Us': [
    { label: 'About Us', to: '/about' },
    { label: 'Blog', to: '/blog' },
    { label: 'Contact Us', to: '/contact' },
  ],
  'Customer Service': [
    { label: 'Compare', to: '/compare' },
    { label: 'Help Center', to: '/help-center' },
    { label: 'Customer Service', to: '/customer-service' },
  ],
  'Orders & Returns': [
    { label: 'Track Order', to: '/track-orders' },
    { label: 'Shipping & Delivery', to: '/shipping-delivery' },
    { label: 'Return Policy', to: '/return-policy' },
  ],
  'Quick Links': [
    { label: 'Privacy Policy', to: '/privacy-policy' },
    { label: 'Payment Method', to: '/payment-method' },
    { label: 'Terms & Conditions', to: '/terms' },
  ],
};

const Footer = () => {
  const { settings } = useSettingsStore();

  return (
    <footer className="bg-maroon-dark text-primary-foreground">
      {/* Newsletter */}
      <ScrollReveal>
        <div className="border-b border-primary-foreground/10">
          <div className="container mx-auto px-4 py-10 text-center">
            <h3 className="font-cinzel text-xl font-bold mb-2">Join Our Devotee Community</h3>
            <p className="text-primary-foreground/70 text-sm mb-4">Get exclusive offers, new arrivals & spiritual content</p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-0 max-w-md mx-auto">
              <input
                type="email"
                placeholder="Your email address"
                className="flex-1 px-4 py-2.5 rounded-full sm:rounded-l-full sm:rounded-r-none bg-transparent border border-primary-foreground/20 text-sm outline-none placeholder:text-primary-foreground/40 focus:border-gold"
              />
              <button className="px-6 py-2.5 rounded-full sm:rounded-l-none sm:rounded-r-full bg-gold-gradient text-maroon-dark font-bold text-sm shimmer">
                Subscribe
              </button>
            </div>
          </div>
        </div>
      </ScrollReveal>

      {/* Main grid */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand col */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-3">
              {settings.storeLogo ? (
                <img src={settings.storeLogo} alt={settings.storeName} className="w-8 h-8 rounded object-contain" />
              ) : (
                <span className="text-2xl">🪷</span>
              )}
              <span className="font-cinzel text-lg font-bold text-gold">{settings.storeName}</span>
            </Link>
            <p className="text-primary-foreground/70 text-xs leading-relaxed mb-2">
              {settings.tagline}
            </p>
            <p className="text-primary-foreground/60 text-xs leading-relaxed mb-2">
              {settings.storeAddress}
            </p>
            {settings.storeEmail && <p className="text-primary-foreground/50 text-xs mb-1">📧 {settings.storeEmail}</p>}
            {settings.storePhone && <p className="text-primary-foreground/50 text-xs mb-3">📞 {settings.storePhone}</p>}
            <div className="flex gap-3 text-primary-foreground/60">
              {settings.socialLinks.instagram && (
                <a href={settings.socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-gold transition-colors" aria-label="Instagram">
                  <Instagram size={18} />
                </a>
              )}
              {settings.socialLinks.facebook && (
                <a href={settings.socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-gold transition-colors" aria-label="Facebook">
                  <Facebook size={18} />
                </a>
              )}
              {settings.socialLinks.youtube && (
                <a href={settings.socialLinks.youtube} target="_blank" rel="noopener noreferrer" className="hover:text-gold transition-colors" aria-label="YouTube">
                  <Youtube size={18} />
                </a>
              )}
              {settings.socialLinks.whatsapp && (
                <a href={settings.socialLinks.whatsapp} target="_blank" rel="noopener noreferrer" className="hover:text-gold transition-colors" aria-label="WhatsApp">
                  <MessageCircle size={18} />
                </a>
              )}
              {!settings.socialLinks.instagram && !settings.socialLinks.facebook && !settings.socialLinks.youtube && !settings.socialLinks.whatsapp && (
                <>
                  <span className="text-primary-foreground/40"><Instagram size={18} /></span>
                  <span className="text-primary-foreground/40"><Facebook size={18} /></span>
                  <span className="text-primary-foreground/40"><Youtube size={18} /></span>
                  <span className="text-primary-foreground/40"><MessageCircle size={18} /></span>
                </>
              )}
            </div>
          </div>

          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="font-semibold text-sm text-gold mb-3">{title}</h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link to={link.to} className="text-primary-foreground/60 text-xs hover:text-primary-foreground transition-colors">{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-primary-foreground/10">
        <div className="container mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-primary-foreground/50">
          <span>© 2025 {settings.storeName}. Made with 🙏 in Vrindavan, India</span>
          <span className="font-devanagari text-primary-foreground/40">हरे कृष्ण 🌸 Hare Krishna</span>
          <span>{settings.upiEnabled && 'UPI'} {settings.cardEnabled && '• Visa • Mastercard'}</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
