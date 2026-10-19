// Значок друга на карте — «стикер» с белой каймой, цветной обводкой и хвостиком к точке. Не круг:
// форма зависит от рамки, которую человек открыл уровнем (награда): цветок, печать, мягкий квадрат, соты.
import { useId, useMemo } from 'react';
import { View } from 'react-native';
import Svg, { ClipPath, Defs, Ellipse, Image as SvgImage, Path, Text as SvgText } from 'react-native-svg';
import { photo } from '../data/photos';
import type { Person } from '../data/types';
import { colors, fonts } from '../theme';

export type FrameShape = 'flower' | 'seal' | 'squircle' | 'hex';

export const MAP_FRAMES: { id: string; name: string; color: string; level: number; shape: FrameShape }[] = [
  { id: 'classic', name: 'Рядом', color: colors.friend, level: 1, shape: 'flower' },
  { id: 'sunset', name: 'Закат', color: '#F0521F', level: 2, shape: 'seal' },
  { id: 'forest', name: 'Лес', color: '#2F8F5B', level: 3, shape: 'squircle' },
  { id: 'violet', name: 'Ночь', color: '#9167CE', level: 7, shape: 'hex' },
];

const CX = 32, CY = 30, R = 25;

/** Контур формы в координатах 64×72: радиус как функция угла, 120 точек — гладко и без тяжёлой геометрии. */
export function framePath(shape: FrameShape, r = R): string {
  const pts: string[] = [];
  const n = 120;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    let k: number;
    if (shape === 'flower') k = 1 + 0.075 * Math.cos(10 * t);
    else if (shape === 'seal') k = 0.9 + 0.12 * Math.pow(Math.abs(Math.cos(4 * t)), 0.7);
    else if (shape === 'squircle') { const c = Math.abs(Math.cos(t)), s = Math.abs(Math.sin(t)); k = 0.97 / Math.pow(Math.pow(c, 4) + Math.pow(s, 4), 0.25); }
    else { const a = ((t + Math.PI / 6) % (Math.PI / 3)) - Math.PI / 6; k = 0.82 * (Math.cos(Math.PI / 6) / Math.cos(a)) + 0.18; }
    pts.push(`${(CX + r * k * Math.cos(t)).toFixed(2)} ${(CY + r * k * Math.sin(t)).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
}

const TAIL = 'M25.5 51.5Q32 54 38.5 51.5L33.6 60.2Q32 62.4 30.4 60.2Z';

export function MapAvatar({ person, size = 42, ring }: { person: Person; size?: number; ring?: string }) {
  const clip = `avatar-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const frame = MAP_FRAMES.find((f) => f.id === person.mapFrame) ?? MAP_FRAMES[0];
  const color = ring ?? frame.color;
  const path = useMemo(() => framePath(frame.shape), [frame.shape]);
  return (
    <View style={{ width: size, height: size * 72 / 64 }}>
      <Svg width={size} height={size * 72 / 64} viewBox="0 0 64 72">
        <Defs><ClipPath id={clip}><Path d={path} /></ClipPath></Defs>
        <Ellipse cx={32} cy={66} rx={8} ry={2.6} fill={colors.ink} opacity={0.18} />
        <Path d={TAIL} fill={color} stroke="#FFFFFF" strokeWidth={3} strokeLinejoin="round" />
        <Path d={path} fill="#FFFFFF" stroke="#FFFFFF" strokeWidth={7} strokeLinejoin="round" />
        <Path d={path} fill={person.tint} />
        {person.photo
          ? <SvgImage href={photo(person.photo)!} x={CX - R * 1.1} y={CY - R * 1.1} width={R * 2.2} height={R * 2.2} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clip})`} />
          : <SvgText x={CX} y={CY + 8.5} textAnchor="middle" fontFamily={fonts.body700} fontSize={24} fill={colors.ink}>{person.initial}</SvgText>}
        <Path d={path} fill="none" stroke={color} strokeWidth={2.6} strokeLinejoin="round" />
      </Svg>
    </View>
  );
}
