import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useLocation } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useSettingsStore, type FestivalTheme } from '@/store/settingsStore';
import { FestivalArtwork } from './FestivalArtwork';
import { festivalCopy, useFestivalTheme } from './festivalTheme';
import DiwaliFireworks from './DiwaliFireworks';
import './festival.css';

export default function FestivalWelcome({ delay = 650 }: { delay?: number }) {
  const theme = useFestivalTheme();
  const { pathname } = useLocation();
  const storeName = useSettingsStore(s => s.settings.storeName) || 'BrajMart';
  const shown = useRef(new Set<FestivalTheme>());
  const [openTheme, setOpenTheme] = useState<FestivalTheme | null>(null);

  useEffect(() => {
    setOpenTheme(null);
    if (theme === 'none' || pathname !== '/' || shown.current.has(theme)) return;
    const timer = window.setTimeout(() => {
      shown.current.add(theme);
      setOpenTheme(theme);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [theme, pathname, delay]);

  if (theme === 'none') return null;
  const copy = festivalCopy[theme];
  const open = openTheme === theme && pathname === '/';
  return <Dialog.Root open={open} onOpenChange={value => { if (!value) setOpenTheme(null); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="festival-welcome-overlay" />
      <Dialog.Content className={`festival-welcome festival-${theme}`} onOpenAutoFocus={event => {
        event.preventDefault();
        const continueButton = document.getElementById('festival-welcome-continue');
        // Short landscape screens may need to scroll to the final action. Keep
        // initial keyboard focus on the visible close control in that case.
        const focusTarget = window.innerHeight < 600
          ? continueButton?.closest('[role="dialog"]')?.querySelector<HTMLButtonElement>('.festival-welcome-close')
          : continueButton;
        focusTarget?.focus({ preventScroll: true });
      }}>
        <div className="festival-welcome-halo" aria-hidden="true" />
        {theme === 'diwali' && <DiwaliFireworks variant="greeting" />}
        <Dialog.Close className="festival-welcome-close" aria-label="Close festival wishes"><X size={18} /></Dialog.Close>
        <p className="festival-welcome-kicker">{copy.eyebrow}</p>
        <div className="festival-welcome-art"><FestivalArtwork theme={theme} idPrefix={`welcome-${theme}`} /></div>
        <div className="festival-welcome-copy">
          <span className="festival-welcome-rule" aria-hidden="true">✦</span>
          <Dialog.Title className="festival-welcome-title">{copy.greeting}</Dialog.Title>
          <Dialog.Description className="festival-welcome-message">{copy.message}</Dialog.Description>
          <p className="festival-welcome-signature">With love, <span>{storeName}</span></p>
          <Dialog.Close className="festival-welcome-continue" id="festival-welcome-continue">Continue exploring <span aria-hidden="true">↗</span></Dialog.Close>
        </div>
        <div className="festival-welcome-confetti" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ '--i': i, '--row': i % 4 } as CSSProperties} />)}</div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
