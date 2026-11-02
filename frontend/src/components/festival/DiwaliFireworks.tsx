import { useEffect, useState, type CSSProperties } from 'react';
import './festival.css';

// Stable geometry keeps prerender/hydration identical. CSS handles the launch,
// radial expansion and falling embers; no animation loop or canvas is needed.
const sparks = Array.from({ length: 18 }, (_, index) => {
  const angle = index * Math.PI * 2 / 18;
  const reach = .74 + (index % 4) * .085;
  return {
    '--spark-x': (Math.cos(angle) * reach).toFixed(4),
    '--spark-y': (Math.sin(angle) * reach).toFixed(4),
    '--spark-angle': `${index * 20 + 90}deg`,
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
    {Array.from({ length: variant === 'page' ? 4 : 2 }, (_, index) => <div key={index} className={`diwali-firework diwali-firework-${index}`}>
      <span className="diwali-firework-launch" />
      <span className="diwali-firework-bloom" />
      <span className="diwali-firework-ring" />
      <div className="diwali-firework-sparks">{sparks.map((style, spark) => <i key={spark} className="diwali-firework-spark" style={style} />)}</div>
    </div>)}
  </div>;
}
