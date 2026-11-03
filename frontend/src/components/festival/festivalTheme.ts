import { useLocation } from 'react-router-dom';
import { useSettingsStore, type FestivalTheme } from '@/store/settingsStore';

export const festivalCopy = {
  diwali: {
    name: 'Diwali', greeting: 'Shubh Deepavali', eyebrow: 'A little light, a lot of love',
    message: 'May the glow of every diya fill your home with happiness, your heart with peace, and your days with beautiful new beginnings.',
    detail: 'Diyas, candles & sparkling celebrations',
  },
  holi: {
    name: 'Holi', greeting: 'Happy Holi', eyebrow: 'From the heart of Braj',
    message: 'A little gulal, a little laughter, and a whole lot of love. May the colours of Braj fill your life with joy and togetherness.',
    detail: 'Gulal, balloons & playful pichkaris',
  },
};

export type FestivalSurface = 'storefront' | 'admin-dashboard';

export function useFestivalTheme(surface: FestivalSurface = 'storefront'): FestivalTheme {
  const theme = useSettingsStore(s => s.settings.festivalTheme);
  const { pathname } = useLocation();
  if (surface === 'admin-dashboard') {
    if (!/^\/admin\/dashboard\/?$/.test(pathname)) return 'none';
  } else if (/^\/(admin|email)(\/|-|$)/.test(pathname)) return 'none';
  return theme === 'diwali' || theme === 'holi' ? theme : 'none';
}
