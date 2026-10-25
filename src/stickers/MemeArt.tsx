// Мемные стикеры (FIX5, вместо оранжевых персонажей): векторные картинки 100×100 — рожицы, баклажан, персик, череп, огонь…
// Всё рисуется кодом (без картинок): чёткие на любом размере и почти ничего не весят.
import Svg, { Circle, Ellipse, G, Path, Rect, Text as SvgText } from 'react-native-svg';

export type MemeKind =
  | 'skull' | 'clown' | 'hundred' | 'fire' | 'peach' | 'eggplant' | 'crown' | 'laugh' | 'think' | 'shock' | 'pizza'
  | 'rocket' | 'eyes' | 'wave' | 'coffee' | 'clock' | 'sweat' | 'pin' | 'car' | 'cool' | 'cringe' | 'skewer' | 'disco'
  | 'sad' | 'love' | 'mountain' | 'bike' | 'popcorn' | 'house' | 'moon' | 'sparkles' | 'trophy' | 'music' | 'hug' | 'ghost';

const O = '#2A2230';
const W = 3;

/** Жёлтая рожица: основа для эмоций. */
function Face({ children, color = '#FFC93C' }: { children?: React.ReactNode; color?: string }) {
  return <>
    <Circle cx={50} cy={52} r={38} fill={color} stroke={O} strokeWidth={W} />
    <Ellipse cx={38} cy={30} rx={13} ry={7} fill="#FFFFFF" opacity={0.45} />
    {children}
  </>;
}

const ART: Record<MemeKind, () => React.ReactNode> = {
  skull: () => <>
    <Path d="M50 12C29 12 16 27 16 46c0 12 6 20 13 24v12c0 4 3 6 6 6h30c3 0 6-2 6-6V70c7-4 13-12 13-24 0-19-13-34-34-34z" fill="#F3EFE6" stroke={O} strokeWidth={W} />
    <Ellipse cx={36} cy={47} rx={9} ry={10} fill={O} /><Ellipse cx={64} cy={47} rx={9} ry={10} fill={O} />
    <Path d="M50 58l-5 9h10z" fill={O} /><Path d="M38 80v-7M46 81v-7M54 81v-7M62 80v-7" stroke={O} strokeWidth={2.5} strokeLinecap="round" />
  </>,
  clown: () => <Face color="#FCEBD7">
    <Circle cx={22} cy={30} r={11} fill="#F0521F" stroke={O} strokeWidth={W} /><Circle cx={78} cy={30} r={11} fill="#F0521F" stroke={O} strokeWidth={W} />
    <Path d="M34 44l6-6 6 6M54 44l6-6 6 6" stroke={O} strokeWidth={W} fill="none" strokeLinecap="round" />
    <Circle cx={50} cy={56} r={8} fill="#E5383B" stroke={O} strokeWidth={W} />
    <Path d="M30 68q20 18 40 0" fill="#E5383B" stroke={O} strokeWidth={W} />
  </Face>,
  hundred: () => <>
    <SvgText x={50} y={62} fontSize={44} fontWeight="900" fill="#E5383B" stroke={O} strokeWidth={2.5} textAnchor="middle" fontStyle="italic">100</SvgText>
    <Path d="M16 74q34 10 70-2M20 84q30 8 60-1" stroke="#E5383B" strokeWidth={5} strokeLinecap="round" fill="none" />
  </>,
  fire: () => <>
    <Path d="M50 90c-20 0-32-13-32-30 0-17 12-24 14-40 9 7 12 16 12 22 4-4 6-12 5-20 14 9 25 23 25 38 0 18-13 30-24 30z" fill="#FF7A1A" stroke={O} strokeWidth={W} />
    <Path d="M50 88c-10 0-17-7-17-16 0-9 7-13 9-21 6 6 7 10 7 14 3-2 5-6 5-10 7 6 12 11 12 18 0 9-7 15-16 15z" fill="#FFD23F" />
  </>,
  peach: () => <>
    <Path d="M50 30c-24-8-38 10-36 30 2 18 18 30 36 30s34-12 36-30c2-20-12-38-36-30z" fill="#FF9A76" stroke={O} strokeWidth={W} />
    <Path d="M50 32c-6 14-6 40 0 56" stroke="#E0613F" strokeWidth={3} fill="none" />
    <Path d="M50 30c4-12 14-18 26-16-4 10-14 16-26 16z" fill="#5BAA4F" stroke={O} strokeWidth={2.5} />
    <Ellipse cx={32} cy={48} rx={8} ry={5} fill="#FFFFFF" opacity={0.5} />
  </>,
  eggplant: () => <>
    <Path d="M68 22c20 10 10 44-8 58-16 12-38 12-44 2-6-10 8-16 18-28 10-12 12-28 34-32z" fill="#8E4FC9" stroke={O} strokeWidth={W} />
    <Path d="M60 26l6-14 8 8 14-2-8 12-6-4z" fill="#4E9A3E" stroke={O} strokeWidth={2.5} />
    <Path d="M28 76q16-6 26-26" stroke="#C4A0EB" strokeWidth={4} fill="none" strokeLinecap="round" />
  </>,
  crown: () => <>
    <Path d="M16 72l-4-42 22 18 16-28 16 28 22-18-4 42z" fill="#FFC93C" stroke={O} strokeWidth={W} strokeLinejoin="round" />
    <Rect x={16} y={72} width={68} height={12} rx={4} fill="#F0A21B" stroke={O} strokeWidth={W} />
    <Circle cx={50} cy={58} r={6} fill="#E5383B" stroke={O} strokeWidth={2} /><Circle cx={30} cy={62} r={4} fill="#3BA3E5" /><Circle cx={70} cy={62} r={4} fill="#3BA3E5" />
  </>,
  laugh: () => <Face>
    <Path d="M30 42q6-8 12 0M58 42q6-8 12 0" stroke={O} strokeWidth={W} fill="none" strokeLinecap="round" />
    <Path d="M28 56q22 30 44 0z" fill={O} /><Path d="M36 66q14 10 28 0" fill="#E5383B" />
    <Path d="M22 46q-8 6-4 16 6-2 6-10z" fill="#5BC0F8" /><Path d="M78 46q8 6 4 16-6-2-6-10z" fill="#5BC0F8" />
  </Face>,
  think: () => <Face>
    <Circle cx={37} cy={44} r={4.5} fill={O} /><Circle cx={63} cy={42} r={4.5} fill={O} />
    <Path d="M30 34l12-3M58 30l12 4" stroke={O} strokeWidth={W} strokeLinecap="round" />
    <Path d="M40 66h18" stroke={O} strokeWidth={W} strokeLinecap="round" />
    <Path d="M30 86c-4-8 0-16 10-16h8c4 0 4 6 0 6h-6" fill="#FFC93C" stroke={O} strokeWidth={W} strokeLinejoin="round" />
  </Face>,
  shock: () => <Face>
    <Circle cx={36} cy={42} r={8} fill="#FFFFFF" stroke={O} strokeWidth={2.5} /><Circle cx={64} cy={42} r={8} fill="#FFFFFF" stroke={O} strokeWidth={2.5} />
    <Circle cx={36} cy={42} r={3} fill={O} /><Circle cx={64} cy={42} r={3} fill={O} />
    <Ellipse cx={50} cy={68} rx={8} ry={11} fill={O} />
  </Face>,
  pizza: () => <>
    <Path d="M14 22q36-14 72 0L50 90z" fill="#FFC93C" stroke={O} strokeWidth={W} strokeLinejoin="round" />
    <Path d="M14 22q36-14 72 0l-4 9q-32-12-64 0z" fill="#D9822B" stroke={O} strokeWidth={2.5} />
    <Circle cx={40} cy={42} r={6} fill="#E5383B" /><Circle cx={60} cy={44} r={6} fill="#E5383B" /><Circle cx={50} cy={62} r={5} fill="#E5383B" />
  </>,
  rocket: () => <>
    <Path d="M70 14c-24 4-40 24-44 44l16 16c20-4 40-20 44-44z" fill="#F3EFE6" stroke={O} strokeWidth={W} />
    <Circle cx={60} cy={38} r={8} fill="#3BA3E5" stroke={O} strokeWidth={2.5} />
    <Path d="M28 58l-14 4 8 10zM42 72l-4 14 10-8z" fill="#E5383B" stroke={O} strokeWidth={2.5} />
    <Path d="M30 72l-14 14" stroke="#FF7A1A" strokeWidth={7} strokeLinecap="round" />
  </>,
  eyes: () => <>
    <Ellipse cx={32} cy={50} rx={18} ry={26} fill="#FFFFFF" stroke={O} strokeWidth={W} /><Ellipse cx={68} cy={50} rx={18} ry={26} fill="#FFFFFF" stroke={O} strokeWidth={W} />
    <Circle cx={40} cy={56} r={9} fill={O} /><Circle cx={76} cy={56} r={9} fill={O} />
    <Circle cx={43} cy={52} r={3} fill="#FFFFFF" /><Circle cx={79} cy={52} r={3} fill="#FFFFFF" />
  </>,
  wave: () => <>
    <Path d="M36 86c-14-6-20-22-18-34l4-18c1-5 8-4 8 1v14l2-28c0-6 9-6 9 0l1 24 3-28c0-6 9-6 9 0l-1 28 4-22c1-6 9-5 9 1l-3 30c6-6 14-6 16-2-8 8-12 20-18 28-6 6-14 8-25 6z" fill="#FFC93C" stroke={O} strokeWidth={W} strokeLinejoin="round" />
    <Path d="M82 22q8 6 6 16M76 14q12 6 14 18" stroke={O} strokeWidth={2.5} fill="none" strokeLinecap="round" />
  </>,
  coffee: () => <>
    <Path d="M22 40h50l-6 42c-1 4-4 6-8 6H36c-4 0-7-2-8-6z" fill="#F3EFE6" stroke={O} strokeWidth={W} />
    <Path d="M70 48h6c10 0 10 18-2 18h-5" fill="none" stroke={O} strokeWidth={W} />
    <Rect x={18} y={34} width={58} height={9} rx={4} fill="#8A5A3C" stroke={O} strokeWidth={2.5} />
    <Path d="M38 26q-4-8 2-14M50 26q-4-8 2-14" stroke="#B9B3A6" strokeWidth={3.5} fill="none" strokeLinecap="round" />
    <Path d="M38 62q8-8 16 0-8 10-16 0z" fill="#E0457B" />
  </>,
  clock: () => <>
    <Circle cx={50} cy={54} r={34} fill="#F3EFE6" stroke={O} strokeWidth={W} />
    <Path d="M50 54V34M50 54l14 8" stroke={O} strokeWidth={4} strokeLinecap="round" />
    <Path d="M20 22l12-8M80 22l-12-8" stroke="#E5383B" strokeWidth={7} strokeLinecap="round" />
  </>,
  sweat: () => <Face>
    <Path d="M30 44q6-6 12 0M58 44q6-6 12 0" stroke={O} strokeWidth={W} fill="none" strokeLinecap="round" />
    <Path d="M34 64q16 10 32 0" stroke={O} strokeWidth={W} fill="none" strokeLinecap="round" />
    <Path d="M76 18q8 12 0 18-8-6 0-18z" fill="#5BC0F8" stroke={O} strokeWidth={2} />
  </Face>,
  pin: () => <>
    <Path d="M50 92S20 60 20 40a30 30 0 0160 0c0 20-30 52-30 52z" fill="#F0521F" stroke={O} strokeWidth={W} />
    <Circle cx={50} cy={40} r={12} fill="#FFFFFF" stroke={O} strokeWidth={2.5} />
  </>,
  car: () => <>
    <Path d="M12 66V54l10-18c2-4 6-6 10-6h32c4 0 8 2 10 6l10 18v12z" fill="#3BA3E5" stroke={O} strokeWidth={W} strokeLinejoin="round" />
    <Path d="M28 50l6-12h32l6 12z" fill="#DDF1FF" stroke={O} strokeWidth={2.5} />
    <Circle cx={28} cy={68} r={9} fill={O} /><Circle cx={72} cy={68} r={9} fill={O} />
    <Circle cx={28} cy={68} r={3} fill="#B9B3A6" /><Circle cx={72} cy={68} r={3} fill="#B9B3A6" />
  </>,
  cool: () => <Face>
    <Path d="M18 38h64l-4 12c-2 5-10 6-14 2l-6-6h-8l-6 6c-4 4-12 3-14-2z" fill={O} />
    <Path d="M36 66q14 8 28-2" stroke={O} strokeWidth={W} fill="none" strokeLinecap="round" />
  </Face>,
  cringe: () => <Face color="#C9E26A">
    <Path d="M30 40l10 6M70 40l-10 6" stroke={O} strokeWidth={W} strokeLinecap="round" />
    <Rect x={30} y={58} width={40} height={14} rx={4} fill="#FFFFFF" stroke={O} strokeWidth={W} />
    <Path d="M40 58v14M50 58v14M60 58v14" stroke={O} strokeWidth={2} />
  </Face>,
  skewer: () => <>
    <Path d="M14 86L88 12" stroke="#8C8577" strokeWidth={4} strokeLinecap="round" />
    <Rect x={22} y={56} width={18} height={16} rx={5} fill="#A0522D" stroke={O} strokeWidth={2.5} transform="rotate(-45 31 64)" />
    <Rect x={38} y={40} width={18} height={16} rx={5} fill="#E5383B" stroke={O} strokeWidth={2.5} transform="rotate(-45 47 48)" />
    <Rect x={54} y={24} width={18} height={16} rx={5} fill="#A0522D" stroke={O} strokeWidth={2.5} transform="rotate(-45 63 32)" />
    <Path d="M70 70q6-6 12 0M76 82q6-6 12 0" stroke="#B9B3A6" strokeWidth={3} fill="none" strokeLinecap="round" />
  </>,
  disco: () => <>
    <Path d="M50 4v12" stroke={O} strokeWidth={3} />
    <Circle cx={50} cy={52} r={34} fill="#C9D3DE" stroke={O} strokeWidth={W} />
    <Path d="M16 52h68M50 18v68M24 32h52M24 72h52M34 22q-8 30 0 60M66 22q8 30 0 60" stroke="#8A97A6" strokeWidth={2} fill="none" />
    <Path d="M30 30l6 2-2 6zM62 60l8 2-3 7z" fill="#FFFFFF" />
    <Path d="M86 18l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="#FFC93C" />
  </>,
  sad: () => <Face color="#8FC6F2">
    <Path d="M30 40q6 4 12 0M58 40q6 4 12 0" stroke={O} strokeWidth={W} fill="none" strokeLinecap="round" />
    <Path d="M36 72q14-12 28 0" stroke={O} strokeWidth={W} fill="none" strokeLinecap="round" />
    <Path d="M36 46q-6 12 0 18 6-6 0-18z" fill="#FFFFFF" opacity={0.85} />
  </Face>,
  love: () => <Face>
    <Path d="M36 50Q22 40 28 33q5-4 8 2 3-6 8-2 6 7-8 17zM64 50q-14-10-8-17 5-4 8 2 3-6 8-2 6 7-8 17z" fill="#E5383B" stroke={O} strokeWidth={2} />
    <Path d="M34 64q16 14 32 0" stroke={O} strokeWidth={W} fill="none" strokeLinecap="round" />
  </Face>,
  mountain: () => <>
    <Path d="M6 84l30-50 14 20 12-16 32 46z" fill="#5B8C6A" stroke={O} strokeWidth={W} strokeLinejoin="round" />
    <Path d="M30 44l6-10 7 10-6 4zM56 46l6-8 6 8-6 3z" fill="#FFFFFF" />
    <Circle cx={78} cy={22} r={9} fill="#FFC93C" stroke={O} strokeWidth={2.5} />
  </>,
  bike: () => <>
    <Circle cx={26} cy={66} r={16} fill="none" stroke={O} strokeWidth={W} /><Circle cx={74} cy={66} r={16} fill="none" stroke={O} strokeWidth={W} />
    <Path d="M26 66l16-28h24l8 28M42 38l12 28 12-28M36 30h12" stroke="#F0521F" strokeWidth={4.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </>,
  popcorn: () => <>
    <Circle cx={30} cy={30} r={11} fill="#FFF6DD" stroke={O} strokeWidth={2.5} /><Circle cx={50} cy={24} r={12} fill="#FFF6DD" stroke={O} strokeWidth={2.5} /><Circle cx={70} cy={30} r={11} fill="#FFF6DD" stroke={O} strokeWidth={2.5} />
    <Path d="M20 36h60l-8 52H28z" fill="#FFFFFF" stroke={O} strokeWidth={W} strokeLinejoin="round" />
    <Path d="M34 36l4 52M50 36v52M66 36l-4 52" stroke="#E5383B" strokeWidth={6} />
  </>,
  house: () => <>
    <Path d="M14 48L50 16l36 32" fill="none" stroke={O} strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M22 44v42h56V44L50 20z" fill="#F7D9C9" stroke={O} strokeWidth={W} strokeLinejoin="round" />
    <Rect x={42} y={60} width={16} height={26} rx={3} fill="#8A5A3C" stroke={O} strokeWidth={2.5} />
    <Path d="M50 50q-8-8 0-12 8 4 0 12z" fill="#E5383B" />
  </>,
  moon: () => <>
    <Path d="M62 12a38 38 0 1 0 26 54A30 30 0 0 1 62 12z" fill="#FFD23F" stroke={O} strokeWidth={W} />
    <SvgText x={70} y={30} fontSize={16} fontWeight="900" fill={O}>z</SvgText><SvgText x={80} y={18} fontSize={12} fontWeight="900" fill={O}>z</SvgText>
  </>,
  sparkles: () => <>
    <Path d="M44 14l7 22 22 7-22 7-7 22-7-22-22-7 22-7z" fill="#FFC93C" stroke={O} strokeWidth={W} strokeLinejoin="round" />
    <Path d="M76 56l4 11 11 4-11 4-4 11-4-11-11-4 11-4z" fill="#F7A6C4" stroke={O} strokeWidth={2.5} strokeLinejoin="round" />
    <Circle cx={22} cy={78} r={6} fill="#8FC6F2" stroke={O} strokeWidth={2.5} />
  </>,
  trophy: () => <>
    <Path d="M30 14h40v22c0 12-9 22-20 22S30 48 30 36z" fill="#FFC93C" stroke={O} strokeWidth={W} />
    <Path d="M30 22H16c0 14 8 20 16 20M70 22h14c0 14-8 20-16 20" fill="none" stroke={O} strokeWidth={W} />
    <Path d="M44 58h12v12H44z" fill="#F0A21B" stroke={O} strokeWidth={2.5} /><Rect x={30} y={70} width={40} height={14} rx={4} fill="#8A5A3C" stroke={O} strokeWidth={W} />
    <SvgText x={50} y={40} fontSize={18} fontWeight="900" fill={O} textAnchor="middle">1</SvgText>
  </>,
  music: () => <>
    <Path d="M40 70V22l40-8v48" fill="none" stroke={O} strokeWidth={5} strokeLinejoin="round" />
    <Ellipse cx={30} cy={72} rx={12} ry={9} fill="#9167CE" stroke={O} strokeWidth={W} /><Ellipse cx={70} cy={64} rx={12} ry={9} fill="#9167CE" stroke={O} strokeWidth={W} />
  </>,
  hug: () => <Face>
    <Path d="M30 42q6-6 12 0M58 42q6-6 12 0" stroke={O} strokeWidth={W} fill="none" strokeLinecap="round" />
    <Path d="M38 60q12 8 24 0" stroke={O} strokeWidth={W} fill="none" strokeLinecap="round" />
    <Path d="M8 70q8-10 22-4l8 10M92 70q-8-10-22-4l-8 10" fill="#FFC93C" stroke={O} strokeWidth={W} strokeLinejoin="round" />
    <Circle cx={30} cy={56} r={5} fill="#F7A6C4" /><Circle cx={70} cy={56} r={5} fill="#F7A6C4" />
  </Face>,
  ghost: () => <>
    <Path d="M20 86V44C20 24 33 12 50 12s30 12 30 32v42l-10-8-10 8-10-8-10 8-10-8z" fill="#FBFAF6" stroke={O} strokeWidth={W} strokeLinejoin="round" />
    <Ellipse cx={40} cy={42} rx={5} ry={7} fill={O} /><Ellipse cx={60} cy={42} rx={5} ry={7} fill={O} />
    <Ellipse cx={50} cy={60} rx={6} ry={8} fill={O} />
  </>,
};

export function MemeArt({ kind, size }: { kind: MemeKind; size: number }) {
  return <Svg width={size} height={size} viewBox="0 0 100 100"><G>{ART[kind]()}</G></Svg>;
}
