// Общий формат профиля (26 октября, по мотивам лучших профилей с Pinterest: Hinge, BeReal, Partiful, bento-сетки).
// Сверху — большое фото на всю ширину, имя крупно прямо на фото, снизу фото уходит в цвет рамки.
// Ниже — плитки разного размера (bento): друзья, шаги, награды, город. Одинаково у меня и у друга.
import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { photo as photoSrc } from '../../data/photos';
import { colors, fonts } from '../../theme';

export const HERO_H = 452;

/** Большое фото профиля. Несколько фото — полоски сверху, нажатие справа/слева листает. */
export function PhotoHero({ photos, initial, tint, accent, top, name, nameExtra, meta, corner, onPhoto, photoLabel }: {
  photos: string[]; initial: string; tint: string; accent: string; top: ReactNode; name: string; nameExtra?: ReactNode;
  meta?: ReactNode; corner?: ReactNode; onPhoto?: () => void; photoLabel?: string;
}) {
  const insets = useSafeAreaInsets();
  const [i, setI] = useState(0);
  const h = HERO_H + insets.top;
  const cur = photos[i % Math.max(1, photos.length)];
  const tap = (right: boolean) => {
    if (photos.length > 1) setI((x) => (x + (right ? 1 : photos.length - 1)) % photos.length);
    else onPhoto?.();
  };
  return (
    <View style={[styles.hero, { height: h }]}>
      {cur ? <Image source={photoSrc(cur)} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={160} accessibilityIgnoresInvertColors />
        : <View style={[StyleSheet.absoluteFill, styles.noPhoto, { backgroundColor: tint }]}><Text style={styles.bigInitial}>{initial}</Text></View>}
      <Svg style={StyleSheet.absoluteFill} width="100%" height={h} pointerEvents="none">
        <Defs>
          <LinearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0B0B0D" stopOpacity={0.38} />
            <Stop offset="0.2" stopColor="#0B0B0D" stopOpacity={0} />
            <Stop offset="0.5" stopColor="#0B0B0D" stopOpacity={0} />
            <Stop offset="1" stopColor="#0B0B0D" stopOpacity={0.86} />
          </LinearGradient>
          <LinearGradient id="tintG" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.55" stopColor={accent} stopOpacity={0} />
            <Stop offset="1" stopColor={accent} stopOpacity={0.45} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height={h} fill="url(#shade)" />
        <Rect x="0" y="0" width="100%" height={h} fill="url(#tintG)" />
      </Svg>
      {/* Зоны нажатия: левая половина — назад, правая — вперёд (как в сторис). */}
      <View style={StyleSheet.absoluteFill}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <Pressable style={{ flex: 1 }} onPress={() => tap(false)} accessibilityRole="button" accessibilityLabel={photos.length > 1 ? 'Предыдущее фото' : photoLabel ?? 'Фото'} />
          <Pressable style={{ flex: 1 }} onPress={() => tap(true)} accessibilityRole="button" accessibilityLabel={photos.length > 1 ? 'Следующее фото' : photoLabel ?? 'Фото'} />
        </View>
      </View>
      {photos.length > 1 && (
        <View style={[styles.bars, { top: insets.top + 6 }]} pointerEvents="none">
          {photos.map((_, k) => <View key={k} style={[styles.bar, k === i % photos.length && styles.barOn]} />)}
        </View>
      )}
      <View style={[styles.top, { top: insets.top + (photos.length > 1 ? 16 : 10) }]} pointerEvents="box-none">{top}</View>
      <View style={styles.bottom} pointerEvents="box-none">
        <View style={{ flex: 1, gap: 8 }} pointerEvents="box-none">
          <View style={styles.nameRow} pointerEvents="box-none">
            <Text style={styles.name} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>{name}</Text>
            {nameExtra}
          </View>
          {meta && <View style={styles.meta} pointerEvents="box-none">{meta}</View>}
        </View>
        {corner}
      </View>
    </View>
  );
}

/** Круглая «стеклянная» кнопка поверх фото. */
export function GlassBtn({ onPress, label, children, size = 44, badge }: { onPress: () => void; label: string; children: ReactNode; size?: number; badge?: ReactNode }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.glass, { width: size, height: size, borderRadius: size / 2 }, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel={label} hitSlop={4}>
      {children}{badge}
    </Pressable>
  );
}

/** Плашка на фото: «в сети», «@ник», уровень. */
export function HeroChip({ children, dot }: { children: string; dot?: string }) {
  return (
    <View style={styles.chip}>
      {dot && <View style={[styles.chipDot, { backgroundColor: dot }]} />}
      <Text style={styles.chipText} numberOfLines={1}>{children}</Text>
    </View>
  );
}

/** Плитка сетки. */
export function Tile({ onPress, label, dark, accent, style, children }: { onPress?: () => void; label?: string; dark?: boolean; accent?: string; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={label}
      style={({ pressed }) => [styles.tile, dark && styles.tileDark, accent ? { backgroundColor: accent } : null, style, pressed && { transform: [{ scale: 0.97 }] }]}>
      {children}
    </Pressable>
  );
}

export function TileCap({ children, light }: { children: string; light?: boolean }) {
  return <Text style={[styles.cap, light && { color: 'rgba(255,255,255,0.72)' }]}>{children}</Text>;
}
export function TileNum({ children, light, size = 34 }: { children: string; light?: boolean; size?: number }) {
  return <Text style={[styles.num, { fontSize: size, lineHeight: size * 1.05 }, light && { color: '#FFFFFF' }]} numberOfLines={1} adjustsFontSizeToFit>{children}</Text>;
}
export function TileSub({ children, light }: { children: string; light?: boolean }) {
  return <Text style={[styles.sub, light && { color: 'rgba(255,255,255,0.78)' }]} numberOfLines={2}>{children}</Text>;
}

export function Ring({ value, size, stroke, color, track }: { value: number; size: number; stroke: number; color: string; track: string }) {
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
        strokeDasharray={`${Math.max(1, len * Math.min(1, value))} ${len}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </Svg>
  );
}

export const kit = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  actions: { flexDirection: 'row', gap: 10, marginTop: -26, paddingHorizontal: 16 },
  primary: { flex: 1, flexDirection: 'row', gap: 8, minHeight: 54, borderRadius: 27, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 24px -12px rgba(23,22,26,0.7)' },
  primaryText: { fontFamily: fonts.body700, fontSize: 16, color: '#FFFFFF' },
  secondary: { flex: 1, flexDirection: 'row', gap: 8, minHeight: 54, borderRadius: 27, backgroundColor: '#FBFAF6', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 24px -14px rgba(23,22,26,0.5)' },
  secondaryText: { fontFamily: fonts.body700, fontSize: 16, color: colors.ink },
  square: { width: 54, minHeight: 54, borderRadius: 27, backgroundColor: '#FBFAF6', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 24px -14px rgba(23,22,26,0.5)' },
  faces: { flexDirection: 'row', alignItems: 'center' },
});

const styles = StyleSheet.create({
  hero: { width: '100%', overflow: 'hidden', borderBottomLeftRadius: 36, borderBottomRightRadius: 36, backgroundColor: '#2A2930' },
  noPhoto: { alignItems: 'center', justifyContent: 'center' },
  bigInitial: { fontFamily: fonts.display800, fontSize: 180, color: 'rgba(23,22,26,0.18)' },
  bars: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)' },
  barOn: { backgroundColor: '#FFFFFF' },
  top: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bottom: { position: 'absolute', left: 20, right: 16, bottom: 46, flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flexShrink: 1, fontFamily: fonts.display800, fontSize: 44, lineHeight: 46, letterSpacing: -1.2, color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.25)', textShadowRadius: 12 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  glass: { backgroundColor: 'rgba(20,19,24,0.38)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontFamily: fonts.body600, fontSize: 13.5, color: '#FFFFFF' },
  tile: { flex: 1, minHeight: 148, borderRadius: 28, padding: 16, backgroundColor: '#F4F0E7', justifyContent: 'space-between', overflow: 'hidden' },
  tileDark: { backgroundColor: '#1D1C22' },
  cap: { fontFamily: fonts.body600, fontSize: 13, color: colors.muted },
  num: { fontFamily: fonts.display800, letterSpacing: -1, color: colors.ink },
  sub: { fontFamily: fonts.body500, fontSize: 13.5, color: colors.muted },
});
