import { useState } from 'react';
import { X } from 'lucide-react';
import { useSettingsStore } from '@/store/settingsStore';

const AnnouncementBar = () => {
  const { settings } = useSettingsStore();
  const [visible, setVisible] = useState(true);

  const messages = settings.announcementBar.messages;

  if (!visible || !settings.announcementBar.enabled || messages.length === 0) return null;

  return (
    <div className="relative bg-saffron h-9 sm:h-10 flex items-center justify-center overflow-hidden z-50">
      <span className="text-primary-foreground text-sm sm:text-base font-semibold tracking-wide px-8 text-center">
        {messages[0]}
      </span>
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
