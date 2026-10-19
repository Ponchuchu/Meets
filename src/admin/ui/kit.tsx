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

export function Chip({ label, on, onPress, count, a11y }: { label: string; on?: boolean; onPress: () => void; count?: number; a11y?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y} accessibilityState={{ selected: !!on }} style={[styles.chip, on && styles.chipOn]}>
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

/** Сообщение: ошибка / успех / нейтральное. С заголовком и подсказкой «что делать», при желании с кнопкой. */
export function Banner({ tone, text, title, hint, action }: { tone: 'error' | 'ok' | 'info' | 'warn'; text?: string; title?: string; hint?: string; action?: { label: string; onPress: () => void } }) {
  const bg = tone === 'error' ? '#EDC6B2' : tone === 'ok' ? '#C5D3BB' : tone === 'warn' ? '#E3D3A8' : '#D5CFC1';
  return (
    <View style={[styles.banner, { backgroundColor: bg }]} accessibilityLiveRegion="polite">
      {!!title && <Text style={[styles.bannerTitle, tone === 'error' && { color: colors.accentText }]}>{title}</Text>}
      {!!text && <Text style={[styles.bannerText, tone === 'error' && !title && { color: colors.accentText }]}>{text}</Text>}
      {!!hint && <Text style={styles.bannerHint}>{hint}</Text>}
      {action && <Pressable onPress={action.onPress} accessibilityRole="button" style={styles.bannerBtn}><Text style={styles.bannerBtnText}>{action.label}</Text></Pressable>}
    </View>
  );
}

/** Переключатель из 2–3 вариантов: одна полоса, выбранный чёрный. */
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string; sub?: string }[]; onChange: (v: T) => void }) {
  return (
    <View style={styles.seg} accessibilityRole="tablist">
      {options.map((o) => (
        <Pressable key={o.id} onPress={() => onChange(o.id)} accessibilityRole="tab" accessibilityState={{ selected: value === o.id }} style={[styles.segBtn, value === o.id && styles.segOn]}>
          <Text style={[styles.segText, value === o.id && { color: colors.paper }]} numberOfLines={1}>{o.label}</Text>
          {!!o.sub && <Text style={[styles.segSub, value === o.id && { color: '#BDB8AD' }]} numberOfLines={1}>{o.sub}</Text>}
        </Pressable>
      ))}
    </View>
  );
}

/** Число с кнопками − и +: без клавиатуры и опечаток. */
export function Stepper({ value, min, max, step = 1, onChange, label, unit }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; label: string; unit?: string }) {
  const set = (v: number) => onChange(Math.max(min, Math.min(max, v)));
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepLabel}>{label}</Text>
      <View style={styles.stepCtl}>
        <Pressable onPress={() => set(value - step)} disabled={value <= min} accessibilityRole="button" accessibilityLabel={`${label}: меньше`} style={[styles.stepBtn, value <= min && { opacity: 0.35 }]}><Text style={styles.stepSign}>−</Text></Pressable>
        <Text style={styles.stepVal}>{value}{unit ? ` ${unit}` : ''}</Text>
        <Pressable onPress={() => set(value + step)} disabled={value >= max} accessibilityRole="button" accessibilityLabel={`${label}: больше`} style={[styles.stepBtn, value >= max && { opacity: 0.35 }]}><Text style={styles.stepSign}>+</Text></Pressable>
      </View>
    </View>
  );
}

/** Строка настройки: слева название и пояснение, справа переключатель или что-то своё. */
export function SettingRow({ title, sub, right }: { title: string; sub?: string; right: ReactNode }) {
  return (
    <View style={styles.setRow}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.setTitle}>{title}</Text>
        {!!sub && <Text style={styles.setSub}>{sub}</Text>}
      </View>
      {right}
    </View>
  );
}


const styles = StyleSheet.create({
  section: { gap: 10 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sectionTitle: { fontFamily: fonts.display700, fontSize: 22, color: colors.ink, letterSpacing: -0.3, flexShrink: 1 },
  hint: { fontFamily: fonts.body400, fontSize: 13.5, lineHeight: 19, color: colors.muted },
  card: { backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 12 },
  chip: { minHeight: 44, paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line2, alignItems: 'center', justifyContent: 'center' },
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
  bannerTitle: { fontFamily: fonts.display700, fontSize: 15.5, lineHeight: 20, color: colors.ink },
  bannerHint: { fontFamily: fonts.body400, fontSize: 13.5, lineHeight: 19, color: colors.muted2 },
  bannerBtn: { alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.ink, justifyContent: 'center', marginTop: 4 },
  bannerBtnText: { fontFamily: fonts.body700, fontSize: 13.5, color: colors.paper },
  seg: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 16, backgroundColor: colors.sand },
  segBtn: { flex: 1, minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  segOn: { backgroundColor: colors.ink },
  segText: { fontFamily: fonts.body700, fontSize: 13.5, color: colors.ink },
  segSub: { fontFamily: fonts.body400, fontSize: 11, color: colors.muted },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 48 },
  stepLabel: { fontFamily: fonts.body600, fontSize: 15, color: colors.ink, flexShrink: 1 },
  stepCtl: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.sand, borderRadius: 14, padding: 3 },
  stepBtn: { width: 44, height: 44, borderRadius: 11, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  stepSign: { fontFamily: fonts.display700, fontSize: 20, color: colors.ink, lineHeight: 24 },
  stepVal: { minWidth: 72, textAlign: 'center', fontFamily: fonts.display700, fontSize: 16, color: colors.ink },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  setTitle: { fontFamily: fonts.body700, fontSize: 15, color: colors.ink },
  setSub: { fontFamily: fonts.body400, fontSize: 12.5, lineHeight: 17, color: colors.muted },
});
