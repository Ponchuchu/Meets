// Рисунки для значков-наград (21 октября, просьба владельца): не иконки-линии, а маленькие картинки, как эмалевые
// значки — мишка, кроссовок, машина, горы. Без надписей. Рисуются в квадрате 100×100, центр — 50,50, радиус ~30.
import type { ReactElement } from 'react';
import { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

const INK = '#2A2520';
const o = { stroke: INK, strokeWidth: 2.6, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

export type ArtId = 'bear' | 'sneaker' | 'car' | 'mountain' | 'moon' | 'sun' | 'coffee' | 'vinyl' | 'clapper' | 'mic' | 'dice' | 'umbrella'
  | 'star' | 'compass' | 'globe' | 'city' | 'friends' | 'heart' | 'chat' | 'book' | 'flag' | 'flame' | 'disco' | 'camera' | 'palette' | 'apple' | 'bike';

export const ART: Record<ArtId, () => ReactElement> = {
  bear: () => <G>
    <Circle cx={33} cy={33} r={9} fill="#A86B3C" {...o} /><Circle cx={67} cy={33} r={9} fill="#A86B3C" {...o} />
    <Circle cx={33} cy={33} r={4} fill="#E6B88A" /><Circle cx={67} cy={33} r={4} fill="#E6B88A" />
    <Circle cx={50} cy={53} r={24} fill="#B97A47" {...o} />
    <Ellipse cx={50} cy={62} rx={12} ry={9} fill="#EBC79F" {...o} />
    <Ellipse cx={50} cy={58} rx={4.5} ry={3.2} fill={INK} />
    <Path d="M50 61v4M46 66q4 3 8 0" {...o} fill="none" />
    <Circle cx={41} cy={48} r={2.8} fill={INK} /><Circle cx={59} cy={48} r={2.8} fill={INK} />
    <Circle cx={38} cy={57} r={3} fill="#F28C8C" opacity={0.7} /><Circle cx={62} cy={57} r={3} fill="#F28C8C" opacity={0.7} />
  </G>,
  sneaker: () => <G>
    <Path d="M22 64V44q0-5 5-5h10q4 0 6 4l5 8q4 6 12 7l13 2q6 1 6 7v2H22z" fill="#F0521F" {...o} />
    <Path d="M22 64h56v5q0 4-4 4H26q-4 0-4-4z" fill="#FFFFFF" {...o} />
    <Path d="M42 47l6-3M46 52l6-3M51 57l5-3" {...o} stroke="#FFFFFF" />
    <Path d="M27 39v-3q0-3 3-3h5" {...o} fill="none" />
  </G>,
  car: () => <G>
    <Path d="M20 62v-8q0-4 4-5l9-2 7-9q2-3 6-3h14q4 0 6 3l6 9 6 2q2 1 2 4v9z" fill="#2E7BD8" {...o} />
    <Path d="M41 40h8v8H35zM53 40h8l5 8H53z" fill="#CFE6FF" {...o} />
    <Circle cx={34} cy={63} r={7} fill={INK} /><Circle cx={34} cy={63} r={2.6} fill="#BDB8AD" />
    <Circle cx={68} cy={63} r={7} fill={INK} /><Circle cx={68} cy={63} r={2.6} fill="#BDB8AD" />
    <Rect x={74} y={52} width={5} height={3} rx={1.5} fill="#FFD84D" />
  </G>,
  mountain: () => <G>
    <Path d="M16 72l22-34 10 14 9-12 27 32z" fill="#5E8BB8" {...o} />
    <Path d="M38 38l-7 11 4 2 3-4 4 4 3-4zM57 40l-6 8 3 2 3-3 3 3 3-1z" fill="#FFFFFF" {...o} strokeWidth={2} />
    <Circle cx={72} cy={30} r={6} fill="#FFD84D" {...o} />
  </G>,
  moon: () => <G>
    <Path d="M60 22a26 26 0 1 0 18 40A21 21 0 0 1 60 22z" fill="#FFD84D" {...o} />
    <Path d="M28 30l1.6 3.4 3.4 1.6-3.4 1.6L28 40l-1.6-3.4L23 35l3.4-1.6zM71 24l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill="#FFFFFF" {...o} strokeWidth={1.6} />
    <Circle cx={50} cy={50} r={2.4} fill={INK} /><Path d="M47 58q4 3 8 0" {...o} fill="none" />
  </G>,
  sun: () => <G>
    {Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return <Path key={i} d={`M${50 + 24 * Math.cos(a)} ${50 + 24 * Math.sin(a)}L${50 + 32 * Math.cos(a)} ${50 + 32 * Math.sin(a)}`} {...o} stroke="#E2A21B" strokeWidth={4} />; })}
    <Circle cx={50} cy={50} r={18} fill="#FFC93C" {...o} />
    <Circle cx={44} cy={47} r={2.2} fill={INK} /><Circle cx={56} cy={47} r={2.2} fill={INK} /><Path d="M44 55q6 5 12 0" {...o} fill="none" />
  </G>,
  coffee: () => <G>
    <Path d="M42 24q-4 5 0 9t0 9M54 22q-4 5 0 9t0 9" {...o} fill="none" stroke="#BDB8AD" />
    <Path d="M27 44h40v12q0 16-20 16t-20-16z" fill="#FFFFFF" {...o} />
    <Path d="M67 48h4q7 0 7 7t-7 7h-6" {...o} fill="none" />
    <Path d="M30 50h34" {...o} stroke="#A86B3C" strokeWidth={5} />
  </G>,
  vinyl: () => <G>
    <Circle cx={50} cy={50} r={27} fill={INK} />
    <Circle cx={50} cy={50} r={20} fill="none" stroke="#4A433C" strokeWidth={1.5} /><Circle cx={50} cy={50} r={14} fill="none" stroke="#4A433C" strokeWidth={1.5} />
    <Circle cx={50} cy={50} r={9} fill="#E0457B" /><Circle cx={50} cy={50} r={2} fill="#FFFFFF" />
    <Path d="M30 34q6-8 16-10" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" fill="none" opacity={0.5} />
  </G>,
  clapper: () => <G>
    <Rect x={24} y={42} width={52} height={32} rx={4} fill={INK} {...o} />
    <Path d="M24 42l48-12 3 9-48 12z" fill="#FFFFFF" {...o} />
    <Path d="M33 39l6 9M45 36l6 9M57 33l6 9" stroke={INK} strokeWidth={5} />
    <Path d="M32 56h36M32 64h22" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" />
  </G>,
  mic: () => <G>
    <Path d="M50 62v12M40 76h20" {...o} fill="none" />
    <Rect x={38} y={22} width={24} height={40} rx={12} fill="#9AA3B5" {...o} />
    <Path d="M38 40h24M38 48h24" stroke={INK} strokeWidth={2} />
    <Path d="M30 44q0 22 20 22t20-22" {...o} fill="none" />
  </G>,
  dice: () => <G>
    <Rect x={22} y={30} width={34} height={34} rx={7} fill="#FFFFFF" {...o} transform="rotate(-12 39 47)" />
    <Rect x={46} y={36} width={32} height={32} rx={7} fill="#E0457B" {...o} transform="rotate(10 62 52)" />
    <Circle cx={33} cy={41} r={2.8} fill={INK} /><Circle cx={45} cy={52} r={2.8} fill={INK} /><Circle cx={39} cy={47} r={2.8} fill={INK} />
    <Circle cx={56} cy={46} r={2.6} fill="#FFFFFF" /><Circle cx={68} cy={58} r={2.6} fill="#FFFFFF" />
  </G>,
  umbrella: () => <G>
    <Path d="M22 50q2-24 28-24t28 24q-5-5-9 0-5-5-9 0-5-5-10 0-5-5-9 0-5-5-9 0z" fill="#E0457B" {...o} />
    <Path d="M50 50v18q0 6-6 6t-6-6" {...o} fill="none" />
    <Path d="M30 70l-2 5M70 64l-2 5M62 74l-2 5" stroke="#4FA3D9" strokeWidth={3} strokeLinecap="round" />
  </G>,
  star: () => <G>
    <Path d="M50 20l9 19 21 3-15 14 4 21-19-10-19 10 4-21-15-14 21-3z" fill="#FFC93C" {...o} />
    <Circle cx={44} cy={47} r={2.4} fill={INK} /><Circle cx={56} cy={47} r={2.4} fill={INK} /><Path d="M45 55q5 4 10 0" {...o} fill="none" />
  </G>,
  compass: () => <G>
    <Circle cx={50} cy={50} r={26} fill="#FFFFFF" {...o} />
    <Path d="M50 28l7 22-7 22-7-22z" fill="#F0521F" {...o} strokeWidth={2} />
    <Path d="M50 50l7 0-7 22-7-22z" fill="#BDB8AD" {...o} strokeWidth={2} />
    <Circle cx={50} cy={50} r={3} fill={INK} />
  </G>,
  globe: () => <G>
    <Circle cx={50} cy={50} r={26} fill="#4FA3D9" {...o} />
    <Path d="M34 36q8 2 9 10t-7 12q-6-4-6-12M60 28q-6 6 0 12t12 4M58 62q6-2 10 4" fill="#5DBB6B" {...o} strokeWidth={2} />
  </G>,
  city: () => <G>
    <Rect x={22} y={40} width={16} height={34} fill="#9167CE" {...o} />
    <Rect x={38} y={26} width={18} height={48} fill="#2447B8" {...o} />
    <Rect x={56} y={46} width={22} height={28} fill="#E0457B" {...o} />
    <Path d="M43 34h3M50 34h2M43 42h3M50 42h2M43 50h3M50 50h2M26 48h4M26 56h4M61 54h4M70 54h3M61 62h4M70 62h3" stroke="#FFD84D" strokeWidth={2.4} strokeLinecap="round" />
  </G>,
  friends: () => <G>
    <Circle cx={37} cy={45} r={13} fill="#FFB48A" {...o} /><Circle cx={63} cy={45} r={13} fill="#9EDDB0" {...o} />
    <Path d="M18 76q2-16 19-16t17 16zM46 76q2-16 17-16t19 16z" fill="#F7D9C9" {...o} />
    <Circle cx={33} cy={44} r={1.8} fill={INK} /><Circle cx={41} cy={44} r={1.8} fill={INK} /><Circle cx={59} cy={44} r={1.8} fill={INK} /><Circle cx={67} cy={44} r={1.8} fill={INK} />
    <Path d="M34 50q3 2 6 0M60 50q3 2 6 0" {...o} strokeWidth={2} fill="none" />
  </G>,
  heart: () => <G>
    <Path d="M50 76S22 60 22 40a14 14 0 0 1 28-6 14 14 0 0 1 28 6c0 20-28 36-28 36z" fill="#E0457B" {...o} />
    <Path d="M32 38q2-6 8-7" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.6} />
  </G>,
  chat: () => <G>
    <Path d="M22 30h44q6 0 6 6v20q0 6-6 6H40l-12 10v-10h-6q-6 0-6-6V36q0-6 6-6z" fill="#FFFFFF" {...o} />
    <Circle cx={36} cy={46} r={3} fill="#F0521F" /><Circle cx={46} cy={46} r={3} fill="#F0521F" /><Circle cx={56} cy={46} r={3} fill="#F0521F" />
  </G>,
  book: () => <G>
    <Path d="M50 32q-12-8-26-4v42q14-4 26 4z" fill="#FFFFFF" {...o} /><Path d="M50 32q12-8 26-4v42q-14-4-26 4z" fill="#FFF3D6" {...o} />
    <Path d="M30 40q8-2 14 1M30 48q8-2 14 1M56 41q6-3 14-1M56 49q6-3 14-1" stroke="#BDB8AD" strokeWidth={2} strokeLinecap="round" fill="none" />
  </G>,
  flag: () => <G>
    <Path d="M32 78V22" {...o} fill="none" />
    <Path d="M32 24q10-6 20 0t20 0v24q-10 6-20 0t-20 0z" fill="#F0521F" {...o} />
    <Path d="M44 30l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1z" fill="#FFD84D" />
  </G>,
  flame: () => <G>
    <Path d="M50 78c-14 0-22-10-22-21 0-12 10-18 12-30 6 6 6 12 6 16 2-4 6-8 6-16 10 8 20 18 20 30 0 11-8 21-22 21z" fill="#F0521F" {...o} />
    <Path d="M50 76c-7 0-11-5-11-11 0-6 6-9 7-15 5 5 15 9 15 15 0 6-4 11-11 11z" fill="#FFC93C" />
  </G>,
  disco: () => <G>
    <Path d="M50 20v8" {...o} />
    <Circle cx={50} cy={52} r={24} fill="#C9D2E6" {...o} />
    <Path d="M28 44h44M26 54h48M30 64h40M42 29v46M58 29v46" stroke="#8C95AD" strokeWidth={1.6} />
    <Rect x={44} y={40} width={8} height={8} fill="#FFFFFF" /><Rect x={58} y={56} width={6} height={6} fill="#FFFFFF" opacity={0.8} />
  </G>,
  camera: () => <G>
    <Path d="M24 38h12l4-6h20l4 6h12v32H24z" fill="#3A3046" {...o} />
    <Circle cx={50} cy={54} r={11} fill="#7FB3E6" {...o} /><Circle cx={46} cy={50} r={3} fill="#FFFFFF" opacity={0.8} />
    <Rect x={64} y={42} width={6} height={4} rx={1} fill="#FFD84D" />
  </G>,
  palette: () => <G>
    <Path d="M50 24c-16 0-28 11-28 25 0 12 10 18 18 16 6-2 2 9 10 9 16 0 28-12 28-26S66 24 50 24z" fill="#F3E3C7" {...o} />
    <Circle cx={38} cy={40} r={5} fill="#E0457B" /><Circle cx={52} cy={34} r={5} fill="#FFC93C" /><Circle cx={65} cy={42} r={5} fill="#2E7BD8" /><Circle cx={66} cy={57} r={5} fill="#2F8F5B" />
    <Circle cx={45} cy={56} r={5} fill="#FFFFFF" {...o} strokeWidth={2} />
  </G>,
  apple: () => <G>
    <Path d="M50 34c-6-6-26-6-26 14 0 16 12 28 20 28 3 0 4-2 6-2s3 2 6 2c8 0 20-12 20-28 0-20-20-20-26-14z" fill="#D6342E" {...o} />
    <Path d="M50 34q0-8 4-12" {...o} fill="none" /><Path d="M54 26q8-6 14-2-6 8-14 2z" fill="#5DBB6B" {...o} strokeWidth={2} />
    <Path d="M34 44q2-6 8-7" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.6} />
  </G>,
  bike: () => <G>
    <Circle cx={30} cy={60} r={12} fill="none" {...o} /><Circle cx={70} cy={60} r={12} fill="none" {...o} />
    <Path d="M30 60l12-20h18l10 20M42 40l8 20h-20M60 40l-4-8h-6M50 60l10-20" {...o} fill="none" stroke="#2F8F5B" strokeWidth={3.2} />
    <Circle cx={50} cy={60} r={3} fill={INK} />
  </G>,
};

/** Какой рисунок у какой награды. Нет в списке — звезда. */
export const BADGE_ART: Record<string, ArtId> = {
  opener: 'compass', above: 'mountain', host: 'bear', countries3: 'globe', cities5: 'city', regular: 'friends', night: 'moon', districts: 'car',
  conqueror: 'sneaker', film: 'clapper', laugh: 'mic', jazz: 'vinyl', soul: 'heart', early: 'sun', rain: 'umbrella', first: 'star', games: 'dice',
  coffee: 'coffee', wheels: 'bike', icebreaker: 'chat', plusone: 'friends', lecture: 'book', scout: 'flag', streak: 'flame', party: 'disco',
  photo: 'camera', art: 'palette', genres: 'compass', newcomer: 'bear', city25: 'apple', walker: 'sneaker', 'night-city': 'moon', 'call-friend': 'chat', 'first-bump': 'star',
};
export const artOf = (id: string): ArtId => (id.startsWith('steps-') ? 'sneaker' : BADGE_ART[id] ?? 'star');
