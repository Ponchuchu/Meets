// Обложка события: настоящая фотография, если она есть и открылась; иначе — яркий постер раздела
// (градиент цвета категории, крупная иконка и круги). Поверх можно положить любое содержимое.
import { useState, type ReactNode } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { photo } from '../data/photos';
import type { Category } from '../data/types';
import { CAT_COLOR, CAT_ICON, catFg } from '../map/icons';
import { colors } from '../theme';
import { Ic } from './Ic';

/** Смешать цвет #RRGGBB с чёрным (amt > 0) или белым (amt < 0), 0…1. */
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const to = amt >= 0 ? 0 : 255;
  const k = Math.abs(amt);
  const ch = (v: number) => Math.round(v + (to - v) * k);
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, '0')).join('')}`;
}

export function EventCover({ cover, category, color, style, iconSize = 150, children }: {
  cover?: string | null; category: Category; color?: string; style?: StyleProp<ViewStyle>; iconSize?: number; children?: ReactNode;
}) {
  const [broken, setBroken] = useState(false);
  const base = color ?? CAT_COLOR[category] ?? colors.sand;
  const src = cover && !broken ? photo(cover) : undefined;
  const fg = catFg(category);
  return (
    <View style={[styles.box, { backgroundColor: base }, style]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="poster" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={shade(base, -0.18)} />
            <Stop offset="1" stopColor={shade(base, 0.28)} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#poster)" />
        <Circle cx="88%" cy="18%" r="34%" fill={fg} opacity={0.1} />
        <Circle cx="8%" cy="92%" r="28%" fill={fg} opacity={0.08} />
      </Svg>
      {!src && <View style={styles.icon} pointerEvents="none"><Ic d={CAT_ICON[category]} size={iconSize} color={fg} w={0.9} /></View>}
      {src && <Image source={src} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setBroken(true)} />}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden' },
  icon: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', opacity: 0.34 },
});
