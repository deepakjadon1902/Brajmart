import { useId } from 'react';
import { useLocation } from 'react-router-dom';
import { DiwaliLampCluster, FestivalIcon, type FestivalMotif } from './FestivalArtwork';
import { useFestivalTheme, type FestivalSurface } from './festivalTheme';
import DiwaliFireworks from './DiwaliFireworks';
import './festival.css';

export function FestivalToran({ surface = 'storefront' }: { surface?: FestivalSurface }) {
  const theme = useFestivalTheme(surface);
  const prefix = `toran-${useId().replace(/:/g, '')}`;
  if (theme === 'none') return null;
  return <div className={`festival-toran festival-${theme}`} data-testid="festival-toran" aria-hidden="true">
    <svg width="100%" height="34" focusable="false"><defs>
      <radialGradient id={`${prefix}-marigold`} cx=".35" cy=".3"><stop stopColor="#ffdc7c" /><stop offset=".55" stopColor="#f5aa2f" /><stop offset="1" stopColor="#d7751c" /></radialGradient>
      <linearGradient id={`${prefix}-leaf`} x2="1" y2="1"><stop stopColor="#829946" /><stop offset="1" stopColor="#3f632a" /></linearGradient>
      <pattern id={prefix} width="180" height="34" patternUnits="userSpaceOnUse">
      <path d="M0 1Q45 24 90 1Q135 24 180 1" stroke={theme === 'diwali' ? '#bd8436' : '#c44c7b'} fill="none" strokeWidth="1.2" />
      {[16, 30, 44, 58, 72, 106, 120, 134, 148, 162].map((x, i) => <g key={x} transform={`translate(${x} ${8 + Math.sin((i % 5) * Math.PI / 4) * 7})`}>
        {theme === 'diwali' ? <>
          <path d="M0 0Q-8 6 0 17Q8 6 0 0Z" fill={`url(#${prefix}-leaf)`} /><path d="M0 5V14M0 11l-3-3m3 5 3-4" stroke="#bdc675" strokeWidth=".55" opacity=".75" />
          {Array.from({ length: 8 }, (_, petal) => <ellipse key={petal} cy="-3" rx="2.1" ry="3.2" transform={`rotate(${petal * 45})`} fill={`url(#${prefix}-marigold)`} />)}
          <circle r="3" fill={i % 2 ? '#e99826' : '#ffd17a'} /><circle r="1.6" fill="#bc681c" opacity=".65" />
        </> : <><path d="M0-5Q9-10 6-2Q14 2 5 5Q5 14 0 7Q-8 13-6 4Q-15 0-6-3Q-7-12 0-5Z" fill={['#d54c83', '#eca13e', '#4eaa9a'][i % 3]} /><circle r="2.4" fill="#fbe3a8" /></>}
      </g>)}
      <path d="M90 2V20" stroke="#c69848" /><path d="M90 18l3 5-3 5-3-5Z" fill="#c69848" />
    </pattern></defs><rect width="100%" height="34" fill={`url(#${prefix})`} /></svg>
  </div>;
}

export function FestivalDecorations({ surface = 'storefront' }: { surface?: FestivalSurface }) {
  const theme = useFestivalTheme(surface);
  const { pathname } = useLocation();
  if (theme === 'none') return null;
  const motifs: FestivalMotif[] = theme === 'diwali'
    ? ['sparkler', 'rocket']
    : ['balloons', 'pichkari', 'splash', 'gulal', 'gulal', 'balloons'];
  const quiet = /^\/(checkout|payment|thank-you)(\/|-|$)/.test(pathname);
  return <div className={`festival-decorations festival-${theme}${quiet ? ' festival-quiet' : ''}${surface === 'admin-dashboard' ? ' festival-admin-dashboard' : ''}`} aria-hidden="true" data-testid="festival-decorations">
    {theme === 'diwali' && !quiet && <DiwaliFireworks />}
    <div className="festival-edge-light festival-edge-light-left" /><div className="festival-edge-light festival-edge-light-right" />
    {motifs.map((motif, i) => <div key={`${theme}-${i}`} className={`festival-edge-object festival-edge-object-${i}`}>
      <FestivalIcon motif={motif} />
    </div>)}
    {theme === 'diwali' && <>
      <div className="diwali-lamp-cluster diwali-lamp-cluster-left"><DiwaliLampCluster side="left" /></div>
      <div className="diwali-lamp-cluster diwali-lamp-cluster-right"><DiwaliLampCluster side="right" /></div>
    </>}
    <svg className="festival-edge-sparks" viewBox="0 0 1000 800" preserveAspectRatio="none" focusable="false">
      {[{ x: 26, y: 234 }, { x: 978, y: 326 }, { x: 18, y: 464 }, { x: 982, y: 570 }, { x: 39, y: 663 }, { x: 960, y: 717 }].map(({ x, y }, i) => <g key={x} transform={`translate(${x} ${y})`} className="festival-sparkle" style={{ animationDelay: `${i * .5}s` }} fill={theme === 'diwali' ? '#c7953d' : ['#d76499', '#57aaa9', '#e9b246'][i % 3]}><path d="M0-4 1-1 4 0 1 1 0 4-1 1-4 0-1-1Z" /><circle cx="8" cy="13" r="1.2" /></g>)}
    </svg>
  </div>;
}

export function FestivalFooter() {
  const theme = useFestivalTheme();
  if (theme === 'none') return null;
  return <div className={`festival-footer-ornaments festival-${theme}`} aria-hidden="true">
    <span /><FestivalIcon motif={theme === 'diwali' ? 'diya' : 'gulal'} /><FestivalIcon motif={theme === 'diwali' ? 'candle' : 'pichkari'} /><FestivalIcon motif={theme === 'diwali' ? 'diya' : 'balloons'} /><span />
  </div>;
}
