import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettingsStore } from '@/store/settingsStore';

const AnnouncementBar = () => {
  const { settings } = useSettingsStore();
  const [visible, setVisible] = useState(true);
  const [currentMsg, setCurrentMsg] = useState(0);

  const messages = settings.announcementBar.messages;

  useEffect(() => {
    if (messages.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentMsg((prev) => (prev + 1) % messages.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [messages.length]);

  if (!visible || !settings.announcementBar.enabled || messages.length === 0) return null;

  return (
    <div className="relative bg-saffron h-9 flex items-center justify-center overflow-hidden z-50">
      <AnimatePresence mode="wait">
        <motion.span
          key={currentMsg}
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -14, opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="text-primary-foreground text-xs sm:text-sm font-medium tracking-wide"
        >
          {messages[currentMsg]}
        </motion.span>
      </AnimatePresence>
      <button
        onClick={() => setVisible(false)}
        className="absolute right-3 text-primary-foreground/70 hover:text-primary-foreground transition-colors"
        aria-label="Close announcement"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default AnnouncementBar;
