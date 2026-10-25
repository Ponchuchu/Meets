// Кирпичики настроек v6 (V6ProfileSettings и подэкраны): шапка «‹ Заголовок», разделы капсом, белые группы,
// строки с иконкой, значением и шевроном, переключатель зелёный как в макете.
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react-native';
import { useEffect, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBackClose } from '../../state/app';
import { colors, fonts } from '../../theme';

export function SettingsPage({ title, sub, children, onBack }: { title: string; sub?: string; children: ReactNode; onBack?: () => void }) {
  const insets = useSafeAreaInsets();
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/me')));
  useBackClose(back);
  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingTop: Math.max(40, insets.top + 10), paddingBottom: insets.bottom + 40, paddingHorizontal: 16, gap: 8 }}
      keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <View style={styles.head}>
        <Pressable onPress={back} style={styles.back} accessibilityRole="button" accessibilityLabel="Назад" hitSlop={6}>
          <ChevronLeft size={26} color={colors.ink} strokeWidth={2} />
        </Pressable>
        <Text style={styles.h1} accessibilityRole="header" numberOfLines={1}>{title}</Text>
      </View>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      {children}
    </ScrollView>
  );
}

export const Cap = ({ children }: { children: string }) => <Text style={styles.cap}>{children}</Text>;

export const Group = ({ children }: { children: ReactNode }) => <View style={styles.group}>{children}</View>;

export function Row({ Icon, title, sub, value, onPress, last, danger, right, left }: {
  Icon?: LucideIcon; left?: ReactNode; title: string; sub?: string; value?: string; onPress?: () => void; last?: boolean; danger?: boolean; right?: ReactNode;
}) {
  const fg = danger ? '#C0392B' : colors.ink;
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.row, !last && styles.sep, pressed && { backgroundColor: '#E0DACD' }]}
      accessibilityRole={onPress ? 'button' : 'text'} accessibilityLabel={[title, sub, value].filter(Boolean).join('. ')}>
      {left}
      {Icon && <Icon size={20} color={fg} strokeWidth={1.8} />}
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={[styles.title, { color: fg }]}>{title}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      {value ? <Text style={styles.value} numberOfLines={1}>{value}</Text> : null}
      {right}
      {onPress && !right && !left ? <ChevronRight size={18} color="#A8A296" strokeWidth={2} /> : null}
    </Pressable>
  );
}

/** Переключатель v6: зелёный, 52×30, кружок ездит. */
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  // Одно значение 0…1 на UI-потоке: ручка и цвет дорожки едут вместе, без перерисовки остального экрана.
  const t = useSharedValue(on ? 1 : 0);
  useEffect(() => { t.set(withTiming(on ? 1 : 0, { duration: 160 })); }, [on, t]);
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: t.get() * 22 }] }));
  const track = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(t.get(), [0, 1], ['#C8C2B2', '#2F8F5B']) }));
  return (
    <Pressable onPress={() => onChange(!on)} hitSlop={8} accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={label}>
      <Animated.View style={[styles.track, track]}><Animated.View style={[styles.knob, knob]} /></Animated.View>
    </Pressable>
  );
}

export function ToggleRow({ Icon, title, sub, on, onChange, last }: { Icon?: LucideIcon; title: string; sub?: string; on: boolean; onChange: (v: boolean) => void; last?: boolean }) {
  return <Row Icon={Icon} title={title} sub={sub} last={last} right={<Toggle on={on} onChange={onChange} label={title} />} />;
}

export const Note = ({ children, Icon }: { children: string; Icon?: LucideIcon }) => (
  <View style={styles.note}>{Icon && <Icon size={16} color="#2F8F5B" strokeWidth={2} />}<Text style={styles.noteText}>{children}</Text></View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, marginLeft: -6 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  h1: { flex: 1, fontFamily: fonts.display800, fontSize: 26, letterSpacing: -0.7, color: colors.ink },
  sub: { fontFamily: fonts.body400, fontSize: 14, lineHeight: 20, color: colors.muted2, marginTop: -6, marginBottom: 4 },
  cap: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.9, color: colors.muted, marginTop: 8, marginLeft: 6 },
  group: { borderRadius: 20, backgroundColor: '#EEE9DE', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 54, paddingHorizontal: 16, paddingVertical: 10 },
  sep: { borderBottomWidth: 1, borderBottomColor: '#D9D3C5' },
  title: { fontFamily: fonts.body700, fontSize: 15.5 },
  rowSub: { fontFamily: fonts.body400, fontSize: 12.5, color: colors.muted2 },
  value: { fontFamily: fonts.body400, fontSize: 14, color: colors.muted2, maxWidth: 170 },
  track: { width: 52, height: 30, borderRadius: 15, padding: 3 },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF', shadowColor: colors.ink, shadowOpacity: 0.2, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, marginTop: 6 },
  noteText: { flex: 1, fontFamily: fonts.body400, fontSize: 13, color: colors.muted2 },
});
