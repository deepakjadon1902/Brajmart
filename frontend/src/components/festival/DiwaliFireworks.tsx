import { useEffect, useState, type CSSProperties } from 'react';
import './festival.css';

// Stable geometry keeps prerender/hydration identical. CSS handles the launch,
// radial expansion and falling embers; no animation loop or canvas is needed.
const sparks = Array.from({ length: 24 }, (_, index) => {
  const angle = index * Math.PI * 2 / 24;
  const reach = .74 + (index % 4) * .085;
  return {
    '--spark-x': (Math.cos(angle) * reach).toFixed(4),
    '--spark-y': (Math.sin(angle) * reach).toFixed(4),
    '--spark-angle': `${index * 15 + 90}deg`,
  } as CSSProperties;
});
const embers = Array.from({ length: 8 }, (_, index) => {
  const angle = (index + .5) * Math.PI / 4;
  return {
    '--spark-x': (Math.cos(angle) * .58).toFixed(4),
    '--spark-y': (Math.sin(angle) * .58).toFixed(4),
    '--spark-angle': `${index * 45 + 112.5}deg`,
  } as CSSProperties;
});

export default function DiwaliFireworks({ variant = 'page' }: { variant?: 'page' | 'greeting' }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const updateVisibility = () => setPaused(document.visibilityState === 'hidden');
    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  return <div className={`diwali-fireworks diwali-fireworks-${variant}`} data-testid="diwali-fireworks" data-paused={paused} aria-hidden="true">
    {Array.from({ length: variant === 'page' ? 6 : 2 }, (_, index) => <div key={index} className={`diwali-firework diwali-firework-${index}`}>
      <span className="diwali-firework-launch" />
      <span className="diwali-firework-rocket">
        <svg viewBox="0 0 24 60" fill="none" focusable="false">
          <path d="M12 36V57" stroke="#a86d34" strokeWidth="1.8" />
          <path d="M7 35Q5 45 12 51Q19 45 17 35Z" fill="#ffb52e" /><path d="M10 36Q8 43 12 47Q16 43 14 36Z" fill="#fff5b8" />
          <path d="M5 14H19V36H5Z" fill="#bd3c36" stroke="#8c342c" strokeWidth=".8" />
          <path d="M7 16V34" stroke="#ffb68b" strokeWidth="1.5" /><path d="M5 21H19M5 30H19" stroke="#f5cf76" strokeWidth="2.5" />
          <path d="M2 14 12 2 22 14Z" fill="#dfa43f" stroke="#b57628" /><path d="M6 13 12 5 12 13Z" fill="#ffe6a4" />
        </svg>
      </span>
      <span className="diwali-firework-bloom" />
      <span className="diwali-firework-ring" />
      <div className="diwali-firework-sparks">{sparks.map((style, spark) => <i key={spark} className="diwali-firework-spark" style={style} />)}</div>
      <div className="diwali-firework-embers">{embers.map((style, ember) => <i key={ember} className="diwali-firework-ember" style={style} />)}</div>
    </div>)}
  </div>;
}
