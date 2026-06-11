import { MessageCircle } from 'lucide-react';
import { useSettingsStore } from '@/store/settingsStore';

const digitsOnly = (value: string) => value.replace(/\D/g, '');

const toWhatsAppHref = (whatsapp: string, phone: string) => {
  const explicitLink = whatsapp.trim();
  if (/^https?:\/\//i.test(explicitLink)) return explicitLink;

  const explicitNumber = digitsOnly(explicitLink);
  const fallbackNumber = digitsOnly(phone);
  const number = explicitNumber || fallbackNumber;
  if (!number) return '';

  const international = number.length === 10 ? `91${number}` : number;
  return `https://wa.me/${international}?text=${encodeURIComponent('Hare Krishna, I need help with a Brajmart order.')}`;
};

const WhatsAppButton = () => {
  const settings = useSettingsStore((s) => s.settings);
  const href = toWhatsAppHref(settings.socialLinks.whatsapp || '', settings.storePhone || '');

  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-4 right-4 z-50 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#25D366] px-4 py-3 font-sans text-sm font-semibold text-white shadow-[0_8px_24px_rgba(37,211,102,0.35)] transition hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:ring-offset-2 sm:bottom-5 sm:right-5"
      aria-label="Chat with Brajmart on WhatsApp"
    >
      <MessageCircle size={18} aria-hidden="true" />
      <span>Chat with us</span>
    </a>
  );
};

export default WhatsAppButton;
