// Общие кирпичики панели разработчика: карточка, заголовок раздела, кнопки, чипсы.
import { ChevronDown, ChevronUp, X, type LucideIcon } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, fonts } from '../../theme';

/**
 * Раздел. С fold — сворачивается: заголовок становится строкой-карточкой (иконка, название, стрелка), содержимое
 * монтируется только когда раздел открыт — так его запросы не идут, пока он свёрнут.
 */
export function Section({ title, hint, children, right, fold, icon: Icon }: { title: string; hint?: string; children: ReactNode; right?: ReactNode; fold?: 'open' | 'closed'; icon?: LucideIcon }) {
  const [open, setOpen] = useState(fold !== 'closed');
  if (fold) {
    return (
      <View style={styles.foldWrap}>
        <Pressable onPress={() => setOpen(v => !v)} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={title}
          style={({ pressed }) => [styles.fold, open && styles.foldOpen, pressed && { opacity: 0.75 }]}>
          {Icon && <View style={styles.foldIcon}><Icon size={19} color={colors.ink} strokeWidth={1.8} /></View>}
          <Text style={styles.foldTitle} accessibilityRole="header" numberOfLines={1}>{title}</Text>
          {right}
          {open ? <ChevronUp size={20} color={colors.muted2} strokeWidth={1.8} /> : <ChevronDown size={20} color={colors.muted2} strokeWidth={1.8} />}
        </Pressable>
        {open && (
          <View style={styles.foldBody}>
            {!!hint && <Text style={styles.hint}>{hint}</Text>}
            {children}
          </View>
        )}
      </View>
    );
  }
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

/** Главная цифра дашборда: крупно, с подписью и подсказкой, что это значит. */
export function Kpi({ n, label, sub, accent }: { n: string | number; label: string; sub?: string; accent?: boolean }) {
  return (
    <View style={[styles.kpi, accent && { backgroundColor: colors.ink, borderColor: colors.ink }]}>
      <Text style={[styles.kpiN, accent && { color: colors.paper }]}>{n}</Text>
      <Text style={[styles.kpiL, accent && { color: '#E8E4DA' }]}>{label}</Text>
      {!!sub && <Text style={[styles.kpiS, accent && { color: '#BDB8AD' }]}>{sub}</Text>}
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

/** Пустой список / загрузка / ошибка: линейная иконка в мягкой плашке, заголовок и пояснение. Без анимаций. */
export function Empty({ icon: Icon, title, text, loading, tone, action }: { icon?: LucideIcon; title: string; text?: string; loading?: boolean; tone?: 'error'; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={styles.empty} accessibilityLiveRegion="polite" accessibilityRole={loading ? 'progressbar' : 'summary'}>
      {loading ? <ActivityIndicator color={colors.accent} /> : Icon ? (
        <View style={[styles.emptyIcon, tone === 'error' && { backgroundColor: 'rgba(240,82,31,0.14)' }]}>
          <Icon size={24} color={tone === 'error' ? colors.accentText : colors.muted2} strokeWidth={1.8} />
        </View>
      ) : null}
      <Text style={styles.emptyTitle}>{title}</Text>
      {!!text && <Text style={styles.emptyText}>{text}</Text>}
      {action && <Pressable onPress={action.onPress} accessibilityRole="button" style={styles.bannerBtn}><Text style={styles.bannerBtnText}>{action.label}</Text></Pressable>}
    </View>
  );
}

/** Полоса прогресса 0…1 — без анимации, перерисовывается только при новом шаге. */
export function Progress({ value }: { value: number }) {
  return <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}><View style={[styles.trackFill, { width: `${Math.max(4, Math.min(100, value * 100))}%` }]} /></View>;
}

/** Шторка снизу: заголовок, крестик, содержимое с прокруткой. Закрывается по фону и «Назад». */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetBack}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Закрыть" />
        <Animated.View entering={FadeInDown.duration(200)} style={styles.sheet} accessibilityViewIsModal accessibilityLabel={title}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle} accessibilityRole="header" numberOfLines={2}>{title}</Text>
            <Pressable onPress={onClose} style={styles.sheetClose} accessibilityRole="button" accessibilityLabel="Закрыть" hitSlop={6}>
              <X size={20} color={colors.ink} strokeWidth={1.8} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Подтверждение «Да / Отмена». На телефоне — системный Alert, в web-версии — window.confirm (Alert там не работает). */
export function confirmAsk(title: string, text: string, yes: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    const w = globalThis as unknown as { confirm?: (m: string) => boolean };
    return Promise.resolve(w.confirm ? w.confirm(`${title}\n\n${text}`) : true);
  }
  return new Promise((resolve) => Alert.alert(title, text, [
    { text: 'Отмена', style: 'cancel', onPress: () => resolve(false) },
    { text: yes, onPress: () => resolve(true) },
  ], { cancelable: true, onDismiss: () => resolve(false) }));
}

const styles = StyleSheet.create({
  sheetBack: { flex: 1, backgroundColor: 'rgba(23,22,26,0.4)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 520, maxHeight: '88%', backgroundColor: colors.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 8 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52 },
  sheetTitle: { flex: 1, fontFamily: fonts.display700, fontSize: 20, color: colors.ink, letterSpacing: -0.3 },
  sheetClose: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 28, paddingHorizontal: 20, borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  emptyIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  emptyTitle: { fontFamily: fonts.display700, fontSize: 16.5, color: colors.ink, textAlign: 'center' },
  emptyText: { fontFamily: fonts.body400, fontSize: 13.5, lineHeight: 19, color: colors.muted, textAlign: 'center' },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.sand, overflow: 'hidden' },
  trackFill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
  section: { gap: 12 },
  foldWrap: { gap: 12 },
  fold: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  foldOpen: { borderColor: colors.line2 },
  foldIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  foldTitle: { flex: 1, fontFamily: fonts.display700, fontSize: 16.5, color: colors.ink, letterSpacing: -0.2 },
  foldBody: { gap: 12, paddingBottom: 4 },
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
  todo: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 10 },
  todoSep: { borderBottomWidth: 1, borderBottomColor: colors.line },
  todoDot: { width: 10, height: 10, borderRadius: 5 },
  todoTitle: { fontFamily: fonts.body700, fontSize: 15, lineHeight: 20, color: colors.ink },
  todoSub: { fontFamily: fonts.body400, fontSize: 13, lineHeight: 18, color: colors.muted2 },
  kpi: { flexGrow: 1, flexBasis: '45%', backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 2 },
  kpiN: { fontFamily: fonts.display800, fontSize: 34, letterSpacing: -1, color: colors.ink },
  kpiL: { fontFamily: fonts.body700, fontSize: 14, color: colors.ink },
  kpiS: { fontFamily: fonts.body400, fontSize: 12.5, color: colors.muted },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  setTitle: { fontFamily: fonts.body700, fontSize: 15, color: colors.ink },
  setSub: { fontFamily: fonts.body400, fontSize: 12.5, lineHeight: 17, color: colors.muted },
});
