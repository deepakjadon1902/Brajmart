import { useId } from 'react';
import type { FestivalTheme } from '@/store/settingsStore';

export type FestivalMotif = 'diya' | 'candle' | 'rocket' | 'sparkler' | 'fountain' | 'balloons' | 'pichkari' | 'gulal' | 'splash';

export function FestivalDefs({ prefix }: { prefix: string }) {
  return <defs>
    <linearGradient id={`${prefix}-brass`} x1="20" y1="80" x2="140" y2="150" gradientUnits="userSpaceOnUse"><stop stopColor="#f8d385" /><stop offset=".36" stopColor="#be772b" /><stop offset=".67" stopColor="#edb957" /><stop offset="1" stopColor="#8f4c20" /></linearGradient>
    <linearGradient id={`${prefix}-flame`} x1="80" y1="15" x2="80" y2="88" gradientUnits="userSpaceOnUse"><stop stopColor="#fff0a0" /><stop offset=".5" stopColor="#ffb730" /><stop offset="1" stopColor="#d95b14" /></linearGradient>
    <radialGradient id={`${prefix}-glow`}><stop stopColor="#ffc34a" stopOpacity=".76" /><stop offset="1" stopColor="#ffb83e" stopOpacity="0" /></radialGradient>
    <linearGradient id={`${prefix}-wax`} x1="45" y1="70" x2="113" y2="115" gradientUnits="userSpaceOnUse"><stop stopColor="#fff3d3" /><stop offset=".5" stopColor="#e6bd74" /><stop offset="1" stopColor="#b77d35" /></linearGradient>
    <linearGradient id={`${prefix}-clay`} x1="30" y1="98" x2="130" y2="146" gradientUnits="userSpaceOnUse"><stop stopColor="#e8a24e" /><stop offset=".3" stopColor="#b95627" /><stop offset=".7" stopColor="#8c351e" /><stop offset="1" stopColor="#d98639" /></linearGradient>
    <radialGradient id={`${prefix}-oil`} cx=".47" cy=".3"><stop stopColor="#ffe8a0" /><stop offset=".4" stopColor="#da9b32" /><stop offset="1" stopColor="#92501c" /></radialGradient>
    <linearGradient id={`${prefix}-ivory`} x1="52" y1="0" x2="108" y2="0" gradientUnits="userSpaceOnUse"><stop stopColor="#d5a15a" /><stop offset=".18" stopColor="#f6dfaa" /><stop offset=".43" stopColor="#fff6db" /><stop offset=".72" stopColor="#edc783" /><stop offset="1" stopColor="#b87936" /></linearGradient>
    <linearGradient id={`${prefix}-pink`} x1="30" y1="30" x2="105" y2="116" gradientUnits="userSpaceOnUse"><stop stopColor="#ff91b4" /><stop offset=".45" stopColor="#e94e87" /><stop offset="1" stopColor="#ad295e" /></linearGradient>
    <linearGradient id={`${prefix}-teal`} x1="20" y1="30" x2="115" y2="120" gradientUnits="userSpaceOnUse"><stop stopColor="#8ce6df" /><stop offset=".45" stopColor="#36b6b6" /><stop offset="1" stopColor="#158582" /></linearGradient>
    <linearGradient id={`${prefix}-orange`} x1="35" y1="30" x2="125" y2="130" gradientUnits="userSpaceOnUse"><stop stopColor="#ffe394" /><stop offset=".45" stopColor="#ffbc48" /><stop offset="1" stopColor="#e78326" /></linearGradient>
    <linearGradient id={`${prefix}-red`} x1="40" y1="30" x2="108" y2="115" gradientUnits="userSpaceOnUse"><stop stopColor="#f27858" /><stop offset=".45" stopColor="#d34f44" /><stop offset="1" stopColor="#952f36" /></linearGradient>
    <radialGradient id={`${prefix}-powder`}><stop stopColor="#f68cb5" /><stop offset=".55" stopColor="#e44f95" /><stop offset="1" stopColor="#b73874" /></radialGradient>
  </defs>;
}

function Flame({ x = 80, y = 45, scale = 1, prefix }: { x?: number; y?: number; scale?: number; prefix: string }) {
  return <g transform={`translate(${x - 80 * scale} ${y - 45 * scale}) scale(${scale})`}>
    <ellipse cx="80" cy="51" rx="44" ry="48" fill={`url(#${prefix}-glow)`} />
    <g className="festival-flame">
      <path d="M80 15C89 33 100 45 93 61C88 75 69 76 65 62C60 48 75 35 80 15Z" fill={`url(#${prefix}-flame)`} />
      <path d="M80 43C87 53 90 60 83 65C75 70 71 62 74 56Z" fill="#fffbe5" />
      <path d="M79 57Q87 67 80 71Q74 67 79 57Z" fill="#fff" />
    </g>
  </g>;
}

/** Original illustrated objects. No emoji, external image download or bitmap scaling. */
export function FestivalGlyph({ motif, prefix }: { motif: FestivalMotif; prefix: string }) {
  switch (motif) {
    case 'diya': return <g data-motif="diya">
      <ellipse cx="80" cy="142" rx="59" ry="7" fill="#6d3c23" opacity=".17" />
      <Flame prefix={prefix} />
      <path d="M18 99Q35 142 80 142Q125 142 143 99Z" fill={`url(#${prefix}-clay)`} stroke="#9e542b" strokeWidth="1.3" />
      <path d="M29 109Q48 136 79 136" stroke="#efb963" strokeWidth="3" opacity=".45" fill="none" strokeLinecap="round" />
      <ellipse cx="80" cy="99" rx="62" ry="14" fill={`url(#${prefix}-brass)`} stroke="#b58038" strokeWidth="1.5" />
      <ellipse cx="80" cy="98" rx="54" ry="9.5" fill="#88471e" /><ellipse cx="80" cy="97" rx="49" ry="7" fill={`url(#${prefix}-oil)`} />
      <path d="M41 97Q56 92 68 94M94 95Q109 95 117 99" stroke="#fff0b8" opacity=".72" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M35 113Q80 144 125 113M50 128Q80 141 111 128" stroke="#ffe1a1" strokeWidth="1.5" fill="none" opacity=".85" />
      {[45, 62, 80, 98, 115].map((x, i) => <path key={x} d={`M${x} ${115 + (2 - Math.abs(i - 2)) * 3}l2 3-2 3-2-3Z`} fill="#ffe3a9" />)}
      <path d="M80 97Q75 84 80 71" stroke="#4a3329" strokeWidth="3" fill="none" strokeLinecap="round" />
    </g>;
    case 'candle': return <g data-motif="candle">
      <ellipse cx="80" cy="145" rx="44" ry="7" fill="#6d3c23" opacity=".12" />
      <path d="M43 132Q80 145 117 132L111 143Q80 153 49 143Z" fill={`url(#${prefix}-brass)`} />
      <path d="M52 62H108V130Q80 143 52 130Z" fill={`url(#${prefix}-ivory)`} stroke="#aa783e" strokeWidth="1" />
      <ellipse cx="80" cy="62" rx="28" ry="9" fill="#fff4d5" stroke="#e2c796" />
      <ellipse cx="80" cy="61" rx="16" ry="4.5" fill="#e7bd73" /><ellipse cx="80" cy="60" rx="10" ry="2.5" fill="#ffe6ac" />
      <path d="M54 64C59 65 57 85 64 83C71 81 64 68 74 68C82 68 77 95 85 94C92 93 87 67 95 66" fill="none" stroke="#fff5db" strokeWidth="5" strokeLinecap="round" />
      <path d="M58 111Q80 118 102 111" stroke="#c49a58" strokeWidth="1.2" fill="none" />
      <path d="M57 88V105M57 119V128" stroke="#fff8e5" strokeWidth="2" strokeLinecap="round" opacity=".65" />
      <path d="M80 112v14m-5-9 5-5 5 5m-5 9-5-5m5 5 5-5" stroke="#c49a58" fill="none" />
      <Flame prefix={prefix} x={80} y={27} scale={.63} /><path d="M80 62V43" stroke="#4a3329" strokeWidth="2" />
    </g>;
    case 'rocket': return <g data-motif="rocket" transform="rotate(-20 80 80)">
      <path d="M78 110V153" stroke="#c9995d" strokeWidth="5" strokeLinecap="round" />
      <rect x="58" y="48" width="44" height="74" rx="5" fill={`url(#${prefix}-red)`} stroke="#a54137" />
      <path d="M63 52V117" stroke="#ffb085" strokeWidth="3" opacity=".65" />
      <path d="M51 49L80 13L109 49Z" fill={`url(#${prefix}-brass)`} stroke="#bc852e" />
      <path d="M64 48L80 22L94 48Z" fill="#f3ce7f" opacity=".7" />
      <path d="M59 64H101M59 104H101" stroke="#f4ce7a" strokeWidth="6" />
      <path d="M80 74l3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1Z" fill="#ffe6aa" />
      <path d="M101 115Q125 116 117 134" stroke="#ac8754" strokeWidth="2" fill="none" />
      <g stroke="#e9ac40" strokeWidth="2" strokeLinecap="round"><path d="M117 139v6m-7-10-5 2m19-2 5 2m-6 7 3 4m-13-4-3 4" /></g>
    </g>;
    case 'fountain': return <g data-motif="fountain">
      <ellipse cx="80" cy="146" rx="43" ry="6" fill="#713b24" opacity=".16" />
      <g className="festival-fountain-sparks" fill="none" strokeLinecap="round">
        <path d="M79 84Q56 25 31 44M82 85Q108 14 133 40M80 83Q72 12 56 20M82 81Q92 5 106 17" stroke="#e99d23" strokeWidth="2" />
        <path d="M79 76Q51 40 42 59M83 75Q107 34 119 52M81 68V17" stroke="#f3c458" strokeWidth="2.5" />
        {[{ x: 26, y: 43 }, { x: 56, y: 14 }, { x: 82, y: 9 }, { x: 109, y: 12 }, { x: 137, y: 38 }].map(({ x, y }) => <path key={x} d={`M${x} ${y - 3}v6m-3-3h6`} stroke="#df8e22" strokeWidth="1.6" />)}
      </g>
      <path d="M80 75 119 139Q80 153 41 139Z" fill={`url(#${prefix}-red)`} stroke="#923f2a" strokeWidth="1.5" />
      <path d="M79 77 66 139Q80 145 89 141Z" fill="#f5c36a" opacity=".6" />
      <path d="M57 111Q80 120 104 111M47 132Q80 145 113 132" stroke="#f8d17b" strokeWidth="4" />
      <path d="m81 92 2 5 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1Z" fill="#fff0ba" />
    </g>;
    case 'sparkler': return <g data-motif="sparkler">
      <path d="M39 151L89 66" stroke="#b8a28b" strokeWidth="3.5" strokeLinecap="round" /><path d="M62 113L86 72" stroke="#726759" strokeWidth="4" strokeLinecap="round" />
      <circle cx="94" cy="52" r="47" fill={`url(#${prefix}-glow)`} />
      <g className="festival-sparkle" transform="translate(94 52)" stroke="#dba64a" strokeWidth="2" strokeLinecap="round">
        {Array.from({ length: 12 }, (_, i) => <g key={i} transform={`rotate(${i * 30})`}><path d={`M0-12V-${i % 2 ? 29 : 38}`} /><circle cy={i % 2 ? -36 : -46} r="1.7" fill="#f3c76e" stroke="none" /></g>)}
        <path d="M0-10 3-3 10 0 3 3 0 10-3 3-10 0-3-3Z" fill="#fff0bb" stroke="#eac06a" />
      </g>
    </g>;
    case 'balloons': return <g data-motif="balloons">
      <path d="M50 85Q80 115 72 150M108 87Q80 116 83 150M80 70Q71 113 78 150" stroke="#c4a7a5" strokeWidth="1.5" fill="none" />
      <ellipse cx="45" cy="59" rx="26" ry="34" transform="rotate(-18 45 59)" fill={`url(#${prefix}-pink)`} />
      <path d="M48 88l-3 7 10-2Z" fill="#ba356b" /><path d="M30 41Q24 51 27 61" stroke="#ffc3d6" strokeWidth="4" fill="none" strokeLinecap="round" opacity=".8" />
      <ellipse cx="111" cy="62" rx="27" ry="34" transform="rotate(17 111 62)" fill={`url(#${prefix}-teal)`} />
      <path d="M107 93l-5 5 10 1Z" fill="#268f93" /><path d="M99 40Q91 46 92 56" stroke="#c3faf3" strokeWidth="4" fill="none" strokeLinecap="round" opacity=".8" />
      <ellipse cx="78" cy="40" rx="28" ry="35" fill={`url(#${prefix}-orange)`} />
      <path d="M78 74l-5 6h10Z" fill="#e99b36" /><path d="M67 17Q59 23 60 34" stroke="#fff2c8" strokeWidth="4" fill="none" strokeLinecap="round" opacity=".8" />
    </g>;
    case 'pichkari': return <g data-motif="pichkari" transform="rotate(-15 80 80)">
      <path d="M34 88L22 122Q32 132 45 126L55 96" fill={`url(#${prefix}-pink)`} stroke="#bf3f77" strokeWidth="1.5" />
      <path d="M23 62H111V97H30Q19 92 23 62Z" fill={`url(#${prefix}-teal)`} stroke="#21969d" strokeWidth="1.4" />
      <rect x="103" y="66" width="25" height="27" rx="5" fill={`url(#${prefix}-orange)`} /><rect x="124" y="72" width="13" height="15" rx="3" fill="#d46476" />
      <rect x="37" y="25" width="49" height="44" rx="18" fill={`url(#${prefix}-orange)`} stroke="#df9c35" />
      <path d="M47 30Q60 22 75 29M32 70H91" stroke="#fff2b8" strokeWidth="4" strokeLinecap="round" opacity=".7" />
      <rect x="47" y="18" width="27" height="10" rx="4" fill="#e86688" /><rect x="53" y="104" width="47" height="10" rx="5" fill="#37a7b0" />
      <path d="M65 96V108" stroke="#e5a84d" strokeWidth="6" /><path d="M141 77l11-4m-10 10 11 2m-12-15 7-8" stroke="#65cbd7" strokeWidth="2" strokeLinecap="round" />
      <circle cx="62" cy="80" r="7" fill="#d2f4e9" /><path d="m62 75 2 4 4 1-3 3v4l-3-2-4 2 1-4-3-3 4-1Z" fill="#e69b35" />
    </g>;
    case 'gulal': return <g data-motif="gulal">
      <ellipse cx="80" cy="141" rx="61" ry="7" fill="#783d50" opacity=".1" />
      <path d="M22 103Q30 143 80 143Q130 143 138 103Z" fill={`url(#${prefix}-brass)`} stroke="#b47b37" />
      <ellipse cx="80" cy="103" rx="58" ry="13" fill="#f7dc9d" stroke="#b47b37" />
      <path d="M29 101C43 94 43 83 55 81C64 79 66 57 81 55C93 55 94 79 108 83C121 88 120 98 132 101Q82 121 29 101Z" fill={`url(#${prefix}-powder)`} />
      <path d="M45 101Q78 113 117 101" stroke="#ffafd0" strokeWidth="2" fill="none" opacity=".7" />
      {Array.from({ length: 20 }, (_, i) => <circle key={i} cx={49 + (i * 17) % 62} cy={80 + (i * 13) % 21} r={.6 + i % 2 * .5} fill={i % 2 ? '#ffb0d1' : '#b43670'} opacity=".7" />)}
      <path d="M40 125Q80 145 120 125" stroke="#ffe6b2" strokeWidth="1.5" fill="none" />
      <g fill="#d95292" opacity=".7"><circle cx="59" cy="58" r="2" /><circle cx="100" cy="48" r="2.3" /><circle cx="109" cy="64" r="1.6" /><circle cx="44" cy="71" r="1.5" /></g>
    </g>;
    case 'splash': return <g data-motif="splash">
      <path d="M74 40C84 13 95 18 94 42C111 30 120 39 107 57C142 44 149 62 121 73C155 84 148 99 119 97C141 122 123 133 105 114C101 146 83 147 80 119C61 147 48 136 57 111C25 124 17 107 43 91C9 88 14 71 44 69C21 45 36 30 57 50C52 21 70 17 74 40Z" fill={`url(#${prefix}-teal)`} opacity=".75" />
      <path d="M78 59Q105 44 112 69Q134 95 101 104Q74 129 59 101Q35 78 61 66Z" fill={`url(#${prefix}-pink)`} opacity=".7" />
      <g fill="#e9aa42"><circle cx="23" cy="43" r="4" /><circle cx="133" cy="35" r="3" /><circle cx="138" cy="129" r="4" /><circle cx="30" cy="135" r="3" /></g>
    </g>;
  }
}

export function FestivalIcon({ motif, className = '', idPrefix }: { motif: FestivalMotif; className?: string; idPrefix?: string }) {
  const unique = useId().replace(/:/g, '');
  const prefix = idPrefix || `festival-object-${unique}`;
  return <svg className={`festival-icon ${className}`} viewBox="0 0 160 160" fill="none" aria-hidden="true" focusable="false">
    <FestivalDefs prefix={prefix} /><FestivalGlyph motif={motif} prefix={prefix} />
  </svg>;
}

/** A layered still life rather than enlarged floating icons. The asymmetric
 * arrangements leave room for the storefront's floating contact button. */
export function DiwaliLampCluster({ side }: { side: 'left' | 'right' }) {
  const prefix = `diwali-lamps-${useId().replace(/:/g, '')}`;
  const objects: { motif: FestivalMotif; x: number; y: number; scale: number }[] = side === 'left'
    ? [{ motif: 'candle', x: 5, y: 0, scale: .96 }, { motif: 'candle', x: 69, y: 41, scale: .67 }, { motif: 'diya', x: 20, y: 79, scale: .93 }, { motif: 'diya', x: 143, y: 122, scale: .56 }]
    : [{ motif: 'candle', x: 124, y: 0, scale: .88 }, { motif: 'fountain', x: -5, y: 20, scale: .74 }, { motif: 'diya', x: 86, y: 89, scale: .88 }, { motif: 'diya', x: 0, y: 133, scale: .48 }];
  const compact: typeof objects = side === 'left'
    ? [{ motif: 'candle', x: 0, y: 0, scale: .94 }, { motif: 'diya', x: -20, y: 85, scale: .97 }, { motif: 'diya', x: 70, y: 132, scale: .55 }]
    : [{ motif: 'fountain', x: 10, y: 0, scale: .7 }, { motif: 'candle', x: 55, y: 17, scale: .78 }, { motif: 'diya', x: -15, y: 88, scale: .95 }, { motif: 'diya', x: 80, y: 153, scale: .4 }];
  const drawObjects = (items: typeof objects) => items.map(({ motif, x, y, scale }, index) => <g key={index} transform={`translate(${x} ${y}) scale(${scale})`}><FestivalGlyph motif={motif} prefix={prefix} /></g>);
  return <svg className="diwali-lamp-art" viewBox="0 0 260 220" fill="none" aria-hidden="true" focusable="false">
    <FestivalDefs prefix={prefix} />
    <g className="diwali-lamps-wide diwali-lamps-layout">
      <ellipse cx="130" cy="199" rx="121" ry="17" fill={`url(#${prefix}-glow)`} opacity=".5" />
      {drawObjects(objects)}
    </g>
    <svg className="diwali-lamps-compact" viewBox="0 0 160 240" width="260" height="220" preserveAspectRatio="xMinYMax meet" overflow="visible" focusable="false">
      <g className="diwali-lamps-layout">
        <ellipse cx="75" cy="216" rx="70" ry="13" fill={`url(#${prefix}-glow)`} opacity=".4" />
        {drawObjects(compact)}
      </g>
    </svg>
  </svg>;
}

export function FestivalArtwork({ theme, idPrefix = `festival-scene-${theme}`, className = '' }: { theme: Exclude<FestivalTheme, 'none'>; idPrefix?: string; className?: string }) {
  const motifs: FestivalMotif[] = theme === 'diwali' ? ['rocket', 'candle', 'diya', 'diya', 'sparkler'] : ['splash', 'balloons', 'gulal', 'pichkari', 'splash'];
  const placements = theme === 'diwali'
    ? [{ x: 46, y: 98, s: .7, r: -9 }, { x: 174, y: 30, s: 1.05, r: -5 }, { x: 265, y: 108, s: 1.25, r: 0 }, { x: 420, y: 141, s: .66, r: 0 }, { x: 484, y: 53, s: .85, r: 14 }]
    : [{ x: 44, y: 116, s: .72, r: 12 }, { x: 133, y: 18, s: 1.08, r: -10 }, { x: 270, y: 114, s: 1.2, r: 0 }, { x: 453, y: 97, s: .95, r: 7 }, { x: 561, y: 38, s: .47, r: -18 }];
  return <svg className={`festival-art ${className}`} viewBox="0 0 680 300" fill="none" aria-hidden="true" focusable="false">
    <FestivalDefs prefix={idPrefix} />
    <ellipse cx="340" cy="252" rx="243" ry="21" fill={theme === 'diwali' ? '#c79a50' : '#b36a95'} opacity=".08" />
    <g fill="none" stroke={theme === 'diwali' ? '#d6b168' : '#e7a3b8'} opacity=".3"><circle cx="340" cy="143" r="105" /><circle cx="340" cy="143" r="119" strokeDasharray="1 8" /></g>
    {[{ x: 137, y: 61 }, { x: 415, y: 27 }, { x: 539, y: 180 }, { x: 389, y: 84 }, { x: 82, y: 211 }].map(({ x, y }, i) => <g key={x} transform={`translate(${x} ${y})`} fill={theme === 'diwali' ? '#d6a44c' : ['#db729f', '#53b3ae', '#efb746'][i % 3]}><path d="M0-5 1.5-1.5 5 0 1.5 1.5 0 5-1.5 1.5-5 0-1.5-1.5Z" /><circle cx="9" cy="10" r="1.3" /></g>)}
    {motifs.map((motif, i) => <g key={`${motif}-${i}`} transform={`translate(${placements[i].x} ${placements[i].y}) scale(${placements[i].s}) rotate(${placements[i].r} 80 80)`}><FestivalGlyph motif={motif} prefix={idPrefix} /></g>)}
  </svg>;
}
