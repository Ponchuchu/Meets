// Общие кирпичики панели разработчика: карточка, заголовок раздела, кнопки, чипсы.
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts } from '../../theme';

export function Section({ title, hint, children, right }: { title: string; hint?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>
        {right}
      </View>
      {!!hint && <Text style={styles.hint}>{hint}</Text>}
      {children}
    </View>
  );
}

export const Card = ({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) => <View style={[styles.card, style]}>{children}</View>;

export function Chip({ label, on, onPress, count }: { label: string; on?: boolean; onPress: () => void; count?: number }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!on }} style={[styles.chip, on && styles.chipOn]}>
      <Text style={[styles.chipText, on && { color: colors.paper }]}>{label}{count != null ? `  ${count}` : ''}</Text>
    </Pressable>
  );
}

export function Btn({ label, onPress, kind = 'solid', disabled, flex }: { label: string; onPress: () => void; kind?: 'solid' | 'ghost'; disabled?: boolean; flex?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}
      style={[styles.btn, kind === 'solid' ? styles.btnSolid : styles.btnGhost, flex && { flex: 1 }, disabled && { opacity: 0.45 }]}>
      <Text style={[styles.btnText, kind === 'solid' && { color: colors.paper }]}>{label}</Text>
    </Pressable>
  );
}

export function Stat({ n, label, warn }: { n: string | number; label: string; warn?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statN, warn && { color: colors.accentText }]}>{n}</Text>
      <Text style={styles.statL}>{label}</Text>
    </View>
  );
}

export function Banner({ tone, text }: { tone: 'error' | 'ok' | 'info'; text: string }) {
  const bg = tone === 'error' ? '#EDC6B2' : tone === 'ok' ? '#C5D3BB' : '#D5CFC1';
  return <View style={[styles.banner, { backgroundColor: bg }]} accessibilityLiveRegion="polite"><Text style={[styles.bannerText, tone === 'error' && { color: colors.accentText }]}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sectionTitle: { fontFamily: fonts.display700, fontSize: 22, color: colors.ink, letterSpacing: -0.3, flexShrink: 1 },
  hint: { fontFamily: fonts.body400, fontSize: 13.5, lineHeight: 19, color: colors.muted },
  card: { backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 12 },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line2, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: fonts.body600, fontSize: 13.5, color: colors.ink },
  btn: { minHeight: 48, borderRadius: 14, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  btnSolid: { backgroundColor: colors.ink },
  btnGhost: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line2 },
  btnText: { fontFamily: fonts.body700, fontSize: 15, color: colors.ink },
  stat: { flexGrow: 1, flexBasis: '30%', minWidth: 96, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 2 },
  statN: { fontFamily: fonts.display700, fontSize: 28, color: colors.ink },
  statL: { fontFamily: fonts.body500, fontSize: 12.5, color: colors.muted },
  banner: { borderRadius: 14, padding: 12 },
  bannerText: { fontFamily: fonts.body600, fontSize: 14, lineHeight: 20, color: colors.ink },
});
