import { memo, useId } from 'react';
import { View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Image as SvgImage, Path, Text as SvgText } from 'react-native-svg';
import { photo } from '../data/photos';
import { colors, fonts } from '../theme';

export type FrameShape = 'flower' | 'seal' | 'squircle' | 'hex';
type Motif = 'apples' | 'tulips' | 'mountains' | 'dusk' | 'stars' | 'ornament';
export interface AvatarFrameDef {
  id: string; name: string; description: string; color: string; paper: string;
  level: number; motif?: Motif; shape?: FrameShape;
}

export const ILLUSTRATED_FRAMES: AvatarFrameDef[] = [
  { id: 'almaty-apples', name: 'Яблоки Алматы', description: 'Красные яблоки, тонкие веточки и цветы родного города.', color: '#A54138', paper: '#F6E8D9', level: 1, motif: 'apples' },
  { id: 'tulips', name: 'Тюльпаны', description: 'Весенние тюльпаны и зелёные листья на сливочной бумаге.', color: '#A55266', paper: '#F7EDE4', level: 1, motif: 'tulips' },
  { id: 'alatau', name: 'Заилийский Алатау', description: 'Снежные вершины, хвойные склоны и прохладное небо.', color: '#487679', paper: '#DEEBE8', level: 2, motif: 'mountains' },
  { id: 'dusk', name: 'Тёплый закат', description: 'Персиковое солнце и терракотовые волны вечернего неба.', color: '#B56348', paper: '#FAE5CD', level: 3, motif: 'dusk' },
  { id: 'starry-night', name: 'Звёздная ночь', description: 'Луна, созвездия и маленькие золотые звёзды.', color: '#465A87', paper: '#283B60', level: 5, motif: 'stars' },
  { id: 'ornament', name: 'Золотой узор', description: 'Бирюзовая эмаль и нарисованный геометрический орнамент.', color: '#55776F', paper: '#E6EAD9', level: 7, motif: 'ornament' },
];
export const LEGACY_FRAMES: AvatarFrameDef[] = [
  { id: 'classic', name: 'Рядом', description: 'Классический значок с мягкими лепестками.', color: colors.friend, paper: '#F1EADD', level: 1, shape: 'flower' },
  { id: 'sunset', name: 'Закат', description: 'Прежняя рамка в форме тёплой печати.', color: '#F0521F', paper: '#F8E5D7', level: 2, shape: 'seal' },
  { id: 'forest', name: 'Лес', description: 'Прежняя зелёная рамка со скруглёнными углами.', color: '#2F8F5B', paper: '#E2EBDD', level: 3, shape: 'squircle' },
  { id: 'violet', name: 'Ночь', description: 'Прежняя фиолетовая рамка в форме соты.', color: '#9167CE', paper: '#EAE1F1', level: 7, shape: 'hex' },
];
export const MAP_FRAMES = [...ILLUSTRATED_FRAMES, ...LEGACY_FRAMES];
export const frameById = (id?: string | null): AvatarFrameDef => MAP_FRAMES.find(f => f.id === id) ?? LEGACY_FRAMES[0];

/** Прежние формы оставлены для уже сохранённых профилей. */
export function framePath(shape: FrameShape, r = 25): string {
  const points: string[] = [];
  for (let i = 0; i < 120; i++) {
    const t = i / 120 * Math.PI * 2;
    let k: number;
    if (shape === 'flower') k = 1 + .075 * Math.cos(10 * t);
    else if (shape === 'seal') k = .9 + .12 * Math.pow(Math.abs(Math.cos(4 * t)), .7);
    else if (shape === 'squircle') k = .97 / Math.pow(Math.abs(Math.cos(t)) ** 4 + Math.abs(Math.sin(t)) ** 4, .25);
    else { const a = ((t + Math.PI / 6) % (Math.PI / 3)) - Math.PI / 6; k = .82 * Math.cos(Math.PI / 6) / Math.cos(a) + .18; }
    points.push(`${(32 + r * k * Math.cos(t)).toFixed(2)} ${(30 + r * k * Math.sin(t)).toFixed(2)}`);
  }
  return `M${points.join('L')}Z`;
}

function Apple({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return <G transform={`translate(${x} ${y}) scale(${scale})`}>
    <Path d="M0-3C-10-12-17-1-11 8C-8 14-3 14 0 12C4 15 10 12 13 6C18-5 7-12 0-3Z" fill="#CB5346" stroke="#9D4038" strokeWidth={1.1} />
    <Path d="M0-4Q-2-10 2-13M2-9Q10-16 13-10Q8-5 2-9" fill="#6D8855" stroke="#526D46" strokeWidth={1.3} strokeLinecap="round" />
    <Path d="M-9-1Q-12 4-8 7" fill="none" stroke="#F8BB9F" strokeWidth={2} strokeLinecap="round" />
  </G>;
}

/** Статичные векторные рисунки; мелкие детали опускаем у небольших пинов. */
function FrameArt({ motif, compact }: { motif: Motif; compact: boolean }) {
  if (motif === 'apples') return <G>
    <Path d="M14 79Q-3 39 28 17M80 104Q110 94 109 61" fill="none" stroke="#74845D" strokeWidth={2} strokeLinecap="round" />
    <Path d="M13 54Q-2 43 8 31Q20 39 13 54M18 34Q14 17 29 14Q34 29 18 34M100 88Q116 87 118 73Q101 71 100 88M88 100Q93 114 105 106Q104 94 88 100" fill="#93A77A" />
    <Apple x={22} y={19} scale={.7} /><Apple x={101} y={92} scale={.75} />
    {!compact && <><Apple x={11} y={68} scale={.45} /><Circle cx={89} cy={12} r={3} fill="#E0B674" /><Path d="M84 9L94 15M85 16L93 8" stroke="#FEF9EC" strokeWidth={2} /></>}
  </G>;
  if (motif === 'tulips') return <G strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20 91Q10 60 18 29M98 89Q114 59 101 27M77 108Q83 96 87 84" fill="none" stroke="#728965" strokeWidth={2.5} />
    <Path d="M15 70Q-1 52 6 43Q20 50 15 70M104 66Q118 47 114 38Q100 47 104 66M87 96Q101 85 98 77Q85 80 87 96" fill="#A0B18A" />
    <Path d="M7 25L10 9L17 18L24 7L28 27Q19 43 7 25Z" fill="#C96F84" stroke="#A55266" strokeWidth={1.3} />
    <Path d="M91 26L94 8L101 17L109 10L111 27Q103 40 91 26Z" fill="#E29B95" stroke="#B96C78" strokeWidth={1.3} />
    <Path d="M80 83L81 72L87 77L93 72L94 84Q87 94 80 83Z" fill="#C96F84" />
    {!compact && <Path d="M35 105Q54 118 76 109M25 102L23 96M45 10L50 12M62 7L66 8" fill="none" stroke="#CDA890" strokeWidth={1.5} />}
  </G>;
  if (motif === 'mountains') return <G strokeLinejoin="round">
    <Circle cx={88} cy={18} r={9} fill="#EAC98B" />
    <Path d="M28 25L43 7L55 20L68 3L89 27" fill="#7E9D9D" />
    <Path d="M37 14L43 7L49 14L44 12L42 15ZM61 12L68 3L77 13L70 9L67 13L65 9Z" fill="#F3F5E9" />
    <Path d="M4 85L24 48L43 76L66 40L99 78L115 64L116 107L4 107Z" fill="#7E9D9D" />
    <Path d="M16 64L24 48L35 65L27 61L24 65L21 60ZM52 58L66 40L79 57L69 52L66 57L62 51Z" fill="#F3F5E9" />
    <Path d="M5 104L35 84L59 99L86 80L115 105" fill="#567C72" />
    <Path d="M12 88L18 73L24 88H20L25 97H10L15 88ZM96 98L102 82L108 98H105L110 107H94L99 98Z" fill="#355B53" />
    {!compact && <Path d="M23 19L29 16L40 17M65 8L70 10L75 8" fill="none" stroke="#91AEAD" strokeWidth={2} strokeLinecap="round" />}
  </G>;
  if (motif === 'dusk') return <G strokeLinecap="round">
    <Circle cx={86} cy={25} r={15} fill="#DF9870" />
    <Path d="M10 88Q35 76 59 90T113 87L113 108H10Z" fill="#DC9F7F" />
    <Path d="M6 102Q33 91 60 104T114 99" fill="none" stroke="#B97359" strokeWidth={5} />
    <Path d="M15 27H40M12 32H29M79 18H105M8 71H19M91 44H113" fill="none" stroke="#FFF4DB" strokeWidth={2} />
    {!compact && <Path d="M40 11L44 16M27 14L29 20M69 7V12M108 61L113 57" stroke="#C78155" strokeWidth={1.4} />}
  </G>;
  if (motif === 'stars') return <G>
    <Path d="M97 7A16 16 0 1 0 111 30A15 15 0 0 1 97 7Z" fill="#F1D797" />
    <Path d="M14 26L22 13L39 9M8 65L13 81L26 96M77 106L95 99L105 83" fill="none" stroke="#8199BC" strokeWidth={1} />
    {[[14,26],[22,13],[39,9],[8,65],[13,81],[26,96],[77,106],[95,99],[105,83]].map(([x,y]) => <Circle key={`${x}-${y}`} cx={x} cy={y} r={compact ? 1.8 : 2.2} fill="#F2DCA8" />)}
    <Path d="M60 4L62 10L68 12L62 14L60 20L58 14L52 12L58 10ZM44 99L46 104L51 106L46 108L44 113L42 108L37 106L42 104Z" fill="#EBCF8B" />
    {!compact && <Path d="M9 44H15M12 41V47M107 59H113M110 56V62" stroke="#BCCBDC" strokeWidth={1.5} />}
  </G>;
  return <G fill="none" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M22 18L32 8L44 17L32 28ZM77 96L89 85L100 96L89 107ZM8 50L18 41L27 50L18 60ZM92 45L103 34L114 45L103 55Z" fill="#72958C" stroke="#B79454" strokeWidth={2} />
    <Path d="M22 18H42M32 9V27M79 96H99M89 87V105M9 50H26M18 42V59M94 45H112M103 36V54" stroke="#EBD5A3" strokeWidth={1.6} />
    <Path d="M46 8Q60 2 72 9M108 65Q114 78 105 89M13 72Q8 85 19 95M38 105Q51 115 67 109" stroke="#B99B65" strokeWidth={2} />
    {!compact && <><Circle cx={61} cy={9} r={2} fill="#D2AD61" /><Circle cx={12} cy={83} r={2} fill="#D2AD61" /></>}
  </G>;
}

export const AvatarFrame = memo(function AvatarFrame({ frameId, photo: image, initial, tint = '#DDD8CB', size = 104, mapPin = false, ring }: {
  frameId?: string | null; photo?: string | null; initial: string; tint?: string; size?: number; mapPin?: boolean; ring?: string;
}) {
  const id = `portrait-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const frame = frameById(frameId);
  const color = ring ?? frame.color;
  const outline = frame.shape ? framePath(frame.shape) : 'M32 3A27 27 0 1 1 31.999 3Z';
  const aperture = frame.shape ? outline : 'M32 9.2A20.8 20.8 0 1 1 31.999 9.2Z';
  const extent = mapPin ? 72 : 64;
  const compact = size < 72;
  return <View pointerEvents="none" style={{ width: size, height: size * extent / 64 }}>
    <Svg width={size} height={size * extent / 64} viewBox={`0 0 64 ${extent}`}>
      <Defs><ClipPath id={id}><Path d={aperture} /></ClipPath></Defs>
      {mapPin && <><Ellipse cx={32} cy={67} rx={7} ry={2} fill={colors.ink} opacity={.14} /><Path d="M25 51L32 63L39 51" fill={color} stroke="#FFFCF4" strokeWidth={2.5} strokeLinejoin="round" /></>}
      <Path d={outline} fill={frame.paper} stroke="#FFFCF4" strokeWidth={4.5} strokeLinejoin="round" />
      <Path d={outline} fill="none" stroke={color} strokeWidth={.8} opacity={.7} />
      {frame.motif && <G transform="scale(0.533333)"><FrameArt motif={frame.motif} compact={compact} /></G>}
      <Path d={aperture} fill={tint} />
      {image ? <SvgImage href={photo(image)!} x={frame.shape ? 4 : 11.2} y={frame.shape ? 2 : 9.2} width={frame.shape ? 56 : 41.6} height={frame.shape ? 56 : 41.6} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id})`} />
        : <SvgText x={32} y={37} textAnchor="middle" fontFamily={fonts.body700} fontSize={frame.shape ? 24 : 22} fill={colors.ink}>{initial}</SvgText>}
      <Path d={aperture} fill="none" stroke={frame.motif ? '#FFFCF4' : color} strokeWidth={frame.motif ? 1.5 : 2.6} />
    </Svg>
  </View>;
});
