// Аватар: фото или буква на мягкой заливке; кольцо друга — синее.
import { Image, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { photo } from '../data/photos';
import type { Person } from '../data/types';
import { colors, fonts } from '../theme';

export function Avatar({ p, size = 40, ring, radius, style, outline }: {
  p: Pick<Person, 'photo' | 'initial' | 'tint'>; size?: number; ring?: string; radius?: number; style?: StyleProp<ViewStyle>; outline?: string;
}) {
  const r = radius ?? size / 2;
  const border = ring ? { borderWidth: 2, borderColor: ring } : null;
  const box = [{ width: size, height: size, borderRadius: r }, border, outline ? { outlineColor: outline, outlineWidth: 2, outlineStyle: 'solid' as const } : null, style];
  if (p.photo) return <Image source={photo(p.photo)} style={box as never} resizeMode="cover" resizeMethod="resize" accessibilityIgnoresInvertColors />;
  return (
    <View style={[...box, { backgroundColor: p.tint, alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ fontFamily: fonts.body700, fontSize: Math.round(size * 0.38), lineHeight: Math.round(size * 0.55), includeFontPadding: false, textAlign: 'center', color: colors.ink }}>{p.initial}</Text>
    </View>
  );
}
