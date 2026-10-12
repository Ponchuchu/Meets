import { View } from 'react-native';
import Svg, { ClipPath, Defs, Image as SvgImage, Path, Text as SvgText } from 'react-native-svg';
import type { Person } from '../data/types';
import { photo } from '../data/photos';
import { colors, fonts } from '../theme';
import { useId } from 'react';
export const MAP_FRAMES = [
  { id: 'classic', name: 'Рядом', color: colors.friend, level: 1 },
  { id: 'sunset', name: 'Закат', color: '#F0521F', level: 2 },
  { id: 'forest', name: 'Лес', color: '#2F8F5B', level: 3 },
  { id: 'violet', name: 'Ночь', color: '#9167CE', level: 7 },
];
/** Мягкий прямоугольник с сужением к точке на карте. */
export function MapAvatar({ person, size = 42, ring }: { person: Person; size?: number; ring?: string }) {
  const clip = `avatar-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const color = ring ?? MAP_FRAMES.find(f => f.id === person.mapFrame)?.color ?? colors.friend;
  const path = 'M14 3H46Q58 3 57 16L54 46Q53 54 44 54H36L30 60L24 54H16Q7 54 6 46L3 16Q2 3 14 3Z';
  return <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 60 63">
      <Defs><ClipPath id={clip}><Path d={path} /></ClipPath></Defs>
      <Path d={path} fill={person.tint} />
      {person.photo ? <SvgImage href={photo(person.photo)!} width={60} height={58} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clip})`} /> : <SvgText x={30} y={36} textAnchor="middle" fontFamily={fonts.body700} fontSize={24} fill={colors.ink}>{person.initial}</SvgText>}
      <Path d={path} fill="none" stroke="#FFFFFF" strokeWidth={6} />
      <Path d={path} fill="none" stroke={color} strokeWidth={3} />
    </Svg>
  </View>;
}
