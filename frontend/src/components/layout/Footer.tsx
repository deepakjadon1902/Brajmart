import { Link } from 'react-router-dom';
import { Mail, Phone } from 'lucide-react';
import { FaFacebookF, FaInstagram, FaWhatsapp, FaYoutube } from 'react-icons/fa';
import { useSettingsStore } from '@/store/settingsStore';
import { toResponsiveImageUrl } from '@/utils/responsiveImage';

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
  const hasSocialLinks = Boolean(
    settings.socialLinks.instagram ||
      settings.socialLinks.facebook ||
      settings.socialLinks.youtube ||
      settings.socialLinks.whatsapp
  );

  const socialItems = [
    {
      label: 'Instagram',
      href: settings.socialLinks.instagram,
      icon: FaInstagram,
      className: 'bg-gradient-to-br from-[#feda75] via-[#d62976] to-[#4f5bd5] text-white',
    },
    {
      label: 'Facebook',
      href: settings.socialLinks.facebook,
      icon: FaFacebookF,
      className: 'bg-[#1877F2] text-white',
    },
    {
      label: 'YouTube',
      href: settings.socialLinks.youtube,
      icon: FaYoutube,
      className: 'bg-[#FF0000] text-white',
    },
    {
      label: 'WhatsApp',
      href: settings.socialLinks.whatsapp,
      icon: FaWhatsapp,
      className: 'bg-[#25D366] text-white',
    },
  ];

  return (
    <>
    {hasSocialLinks && (
      <div
        className="group fixed right-0 top-1/2 z-50 -translate-y-1/2 translate-x-[calc(100%-0.75rem)] overflow-hidden rounded-l-lg shadow-xl transition-transform duration-300 ease-out hover:translate-x-0 focus-within:translate-x-0"
        aria-label="Social media links"
      >
        <div className="absolute inset-y-0 left-0 w-3 bg-gold" aria-hidden="true" />
        <div className="pl-3">
          {socialItems.filter((item) => item.href).map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={item.label}
                className={`flex h-10 w-10 items-center justify-center transition-transform hover:-translate-x-1 md:h-11 md:w-11 ${item.className}`}
              >
                <Icon size={17} />
              </a>
            );
          })}
          {settings.storeEmail && (
            <a
              href={`mailto:${settings.storeEmail}`}
              aria-label="Email BrajMart"
              className="flex h-10 w-10 items-center justify-center bg-[#ff9f1c] text-white transition-transform hover:-translate-x-1 md:h-11 md:w-11"
            >
              <Mail size={17} />
            </a>
          )}
        </div>
      </div>
    )}

    <footer className="bg-maroon-dark text-primary-foreground">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_2.6fr] gap-10 lg:gap-12 items-start">
          <div>
            <Link to="/" className="flex items-center gap-2 mb-3">
              {settings.storeLogo ? (
                <img
                  src={toResponsiveImageUrl(settings.storeLogo, { width: 96, height: 96, fit: 'contain', quality: 72 })}
                  alt={settings.storeName}
                  className="w-9 h-9 rounded object-contain"
                />
              ) : (
                <span className="sr-only">{settings.storeName}</span>
              )}
              <span className="font-cinzel text-lg font-bold text-gold">{settings.storeName}</span>
            </Link>
            <p className="text-primary-foreground/70 text-xs leading-relaxed mb-2">{settings.tagline}</p>
            <p className="text-primary-foreground/60 text-xs leading-relaxed mb-3">{settings.storeAddress}</p>
            <div className="space-y-1.5">
              {settings.storeEmail && (
                <p className="flex items-center gap-2 text-primary-foreground/55 text-xs">
                  <Mail size={13} />
                  {settings.storeEmail}
                </p>
              )}
              {settings.storePhone && (
                <p className="flex items-center gap-2 text-primary-foreground/55 text-xs">
                  <Phone size={13} />
                  {settings.storePhone}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-7">
            {Object.entries(footerLinks).map(([title, links]) => (
              <div key={title}>
                <h4 className="font-semibold text-sm text-gold mb-3">{title}</h4>
                <ul className="space-y-2">
                  {links.map((link) => (
                    <li key={link.label}>
                      <Link to={link.to} className="text-primary-foreground/60 text-xs hover:text-primary-foreground transition-colors">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-primary-foreground/10">
        <div className="container mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-primary-foreground/50">
          <span>Copyright 2025 {settings.storeName}. Made in Vrindavan, India</span>
          <span className="font-devanagari text-primary-foreground/40">Hare Krishna</span>
          <span>{settings.upiEnabled && 'UPI'} {settings.cardEnabled && 'Visa Mastercard'}</span>
        </div>
      </div>
    </footer>
    </>
  );
};

export default Footer;
