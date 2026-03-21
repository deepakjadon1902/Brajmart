import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const messages = [
  '🎉 Grand Opening Sale — Up to 60% Off!',
  '🚚 Free Shipping on orders above ₹499',
  '🙏 Authentic Products Direct from Vrindavan Temples',
  '✨ New Arrivals Every Week',
  '📦 COD Available Across India',
];

const AnnouncementBar = () => {
  const [visible, setVisible] = useState(true);
  const [currentMsg, setCurrentMsg] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMsg((prev) => (prev + 1) % messages.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  if (!visible) return null;

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
