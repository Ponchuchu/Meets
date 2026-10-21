// Значок-награда (переделан 21 октября): не медаль с иконкой-линией, а маленькая картинка, как эмалевый значок —
// мишка, кроссовок, горы (src/ui/PinArt.tsx). Не открыт — серый и бледный, дуга прогресса вокруг. Статичный SVG.
import { memo } from 'react';
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';
import { ART, artOf } from './PinArt';

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

export const BadgeMedal = memo(function BadgeMedal({ id, got, progress = 0, size = 56 }: { id: string; icon?: string; got: boolean; progress?: number; size?: number }) {
  const t = got ? toneOf(id) : LOCKED;
  const g = `bm-${id}-${got ? 1 : 0}`;
  const arc = 2 * Math.PI * 48;
  const Art = ART[artOf(id)];
  // Значок как эмалевый: светлый диск цвета награды, белая кромка, рисунок внутри. Не получен — серый, рисунок бледный.
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id={g} cx="38%" cy="30%" r="80%">
          <Stop offset="0" stopColor={got ? '#FFFFFF' : '#F1EEE7'} />
          <Stop offset="0.5" stopColor={t[0]} />
          <Stop offset="1" stopColor={t[1]} />
        </RadialGradient>
      </Defs>
      {!got && progress > 0 && (
        <Circle cx={50} cy={50} r={48} stroke="#F0521F" strokeWidth={3.5} fill="none" strokeLinecap="round"
          strokeDasharray={`${Math.max(4, arc * Math.min(1, progress))} ${arc}`} transform="rotate(-90 50 50)" />
      )}
      <Circle cx={50} cy={52} r={43} fill={t[2]} opacity={got ? 0.45 : 0.25} />
      <Circle cx={50} cy={50} r={43} fill="#FFFFFF" />
      <Circle cx={50} cy={50} r={38} fill={`url(#${g})`} />
      <G opacity={got ? 1 : 0.28} transform="translate(50 50) scale(0.84) translate(-50 -50)"><Art /></G>
      <Path d="M24 36Q32 18 52 15" stroke="rgba(255,255,255,0.7)" strokeWidth={3} strokeLinecap="round" fill="none" />
    </Svg>
  );
});
