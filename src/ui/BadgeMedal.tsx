// Значок-награда — медаль: розетка с градиентом, внутренний диск и белая иконка (24×24 из src/profile/badges.ts).
// Не открыт — серая медаль и дуга прогресса вокруг. Статичный SVG, без анимаций.
import { memo, useMemo } from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';

const TONES: [string, string, string][] = [
  ['#FFB48A', '#F0521F', '#A8360F'],
  ['#FFD98A', '#E2A21B', '#9A6608'],
  ['#9EDDB0', '#2F8F5B', '#1D5C3A'],
  ['#A9BCFF', '#2447B8', '#162C78'],
  ['#D3B8F5', '#9167CE', '#5B3A8E'],
  ['#FFB3C4', '#E0457B', '#962A50'],
];
const LOCKED: [string, string, string] = ['#E4DFD4', '#C8C2B2', '#A39C8C'];

export const toneOf = (id: string) => TONES[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length];

/** Розетка: 16 мягких зубцов. */
function rosette(c: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 96; i++) {
    const t = (i / 96) * Math.PI * 2;
    const k = 1 - 0.07 * (0.5 - 0.5 * Math.cos(16 * t));
    pts.push(`${(c + r * k * Math.cos(t)).toFixed(2)} ${(c + r * k * Math.sin(t)).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
}

export const BadgeMedal = memo(function BadgeMedal({ id, icon, got, progress = 0, size = 56 }: { id: string; icon: string; got: boolean; progress?: number; size?: number }) {
  const t = got ? toneOf(id) : LOCKED;
  const g = `bm-${id}-${got ? 1 : 0}`;
  const outer = useMemo(() => rosette(50, 44), []);
  const arc = 2 * Math.PI * 48;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={g} x1="0.15" y1="0" x2="0.85" y2="1">
          <Stop offset="0" stopColor={t[0]} />
          <Stop offset="0.55" stopColor={t[1]} />
          <Stop offset="1" stopColor={t[2]} />
        </LinearGradient>
      </Defs>
      {!got && progress > 0 && (
        <Circle cx={50} cy={50} r={48} stroke="#F0521F" strokeWidth={3.5} fill="none" strokeLinecap="round"
          strokeDasharray={`${Math.max(4, arc * Math.min(1, progress))} ${arc}`} transform="rotate(-90 50 50)" />
      )}
      <Path d={outer} fill={`url(#${g})`} />
      <Circle cx={50} cy={50} r={31} fill={t[2]} opacity={0.35} />
      <Circle cx={50} cy={50} r={29} fill={`url(#${g})`} stroke="rgba(255,255,255,0.55)" strokeWidth={1.5} />
      {/* блик сверху — «металл» */}
      <Path d="M27 40Q34 24 50 22Q63 22 70 30" stroke="rgba(255,255,255,0.45)" strokeWidth={3} strokeLinecap="round" fill="none" />
      <G transform="translate(32 32) scale(1.5)">
        <Path d={icon} stroke={got ? '#FFFFFF' : '#8C8577'} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </G>
    </Svg>
  );
});
