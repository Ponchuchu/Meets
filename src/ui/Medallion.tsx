// Рамка-медальон для аватара: тонкий внешний обод, тёплое градиентное кольцо, ряд «бусин» и плашка уровня снизу.
// Оттенок кольца растёт вместе с уровнем (награды): 1–4 — тёплый оранжевый, 5–9 — янтарь, 10+ — ночь с золотом.
// Только статичный SVG: никаких постоянных анимаций и размытия.
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors, fonts } from '../theme';

type Tier = { stops: [string, string, string]; bead: string; plate: string; plateText: string };

const TIERS: Tier[] = [
  { stops: ['#F7A47E', '#F0521F', '#8A3A12'], bead: '#FBE3D4', plate: colors.ink, plateText: '#F7A47E' },
  { stops: ['#F5D08A', '#C98A1B', '#7A4E0E'], bead: '#FBEFD2', plate: colors.ink, plateText: '#F5D08A' },
  { stops: ['#3A393F', '#17161A', '#3A393F'], bead: '#F5D08A', plate: '#F5D08A', plateText: colors.ink },
];

export const medallionTier = (level: number): number => (level >= 10 ? 2 : level >= 5 ? 1 : 0);

export function Medallion({ size, level, children, style, showLevel = true }: {
  size: number; level: number; children: ReactNode; style?: StyleProp<ViewStyle>; showLevel?: boolean;
}) {
  const t = TIERS[medallionTier(level)];
  const c = size / 2;
  const band = Math.max(4, Math.round(size * 0.07));
  const inner = size - 2 * (band + 4);
  const beads = size >= 80 ? 28 : 0;
  const beadR = c - band / 2 - 1.5;
  const id = `med${medallionTier(level)}`;
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={t.stops[0]} />
            <Stop offset="0.55" stopColor={t.stops[1]} />
            <Stop offset="1" stopColor={t.stops[2]} />
          </LinearGradient>
        </Defs>
        <Circle cx={c} cy={c} r={c - 0.75} fill={colors.paper} stroke="rgba(23,22,26,0.18)" strokeWidth={1.5} />
        <Circle cx={c} cy={c} r={c - band / 2 - 1.5} stroke={`url(#${id})`} strokeWidth={band} fill="none" />
        {Array.from({ length: beads }, (_, i) => {
          const a = (i / beads) * Math.PI * 2;
          return <Circle key={i} cx={c + beadR * Math.cos(a)} cy={c + beadR * Math.sin(a)} r={size * 0.008 + 0.6} fill={t.bead} opacity={0.85} />;
        })}
        <Circle cx={c} cy={c} r={inner / 2 + 1.5} fill="none" stroke={colors.paper} strokeWidth={3} />
      </Svg>
      <View style={{ width: inner, height: inner, borderRadius: inner / 2, overflow: 'hidden' }}>{children}</View>
      {showLevel && (
        <View style={[styles.plate, { backgroundColor: t.plate, bottom: -6 }]} accessibilityLabel={`Уровень ${level}`}>
          <Text style={[styles.plateText, { color: t.plateText }]} maxFontSizeMultiplier={1.2}>УР {level}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  plate: { position: 'absolute', alignSelf: 'center', height: 22, paddingHorizontal: 9, borderRadius: 11, borderWidth: 2, borderColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  plateText: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.8, lineHeight: 14, includeFontPadding: false },
});
