// Каркас шагов входа (V5LoginPhone…Allow): «назад» 44 + полоска из 5 шагов, заголовок, текст, кнопка снизу.
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { colors, fonts } from '../../theme';
import { Glyph } from '../Glyph';

function Seg({ on }: { on: boolean }) {
  const p = useSharedValue(0);
  useEffect(() => { p.set(withTiming(on ? 1 : 0, { duration: 360 })); }, [on, p]);
  const st = useAnimatedStyle(() => ({ width: `${p.get() * 100}%` }));
  return (
    <View style={styles.seg}>
      <Animated.View style={[styles.segOn, st]} />
    </View>
  );
}

export function LoginFrame({ step, onBack, title, sub, children, footer, keyboard }: {
  step: number; onBack?: () => void; title: string; sub?: ReactNode; children?: ReactNode; footer?: ReactNode; keyboard?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const body = (
    <View style={[styles.root, { paddingTop: Math.max(52, insets.top + 8) }]}>
      <View style={styles.head}>
        {onBack ? (
          <Pressable onPress={onBack} style={styles.back} accessibilityRole="button" accessibilityLabel="Назад">
            <Glyph name="back" size={20} color={colors.ink} strokeWidth={2} />
          </Pressable>
        ) : <View style={{ width: 44 }} />}
        <View style={styles.bars} accessibilityLabel={`Шаг ${step} из 5`}>
          {[1, 2, 3, 4, 5].map((i) => <Seg key={i} on={i <= step} />)}
        </View>
      </View>
      <View style={styles.titles}>
        <Text style={styles.h1} accessibilityRole="header">{title}</Text>
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
      {footer ? <View style={[styles.footer, { paddingBottom: keyboard ? 0 : insets.bottom + 34 }]}>{footer}</View> : null}
    </View>
  );
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.paper }} behavior="padding">{body}</KeyboardAvoidingView>;
}

/** Большая оранжевая кнопка шага: 56, радиус 16. */
export function StepButton({ label, onPress, disabled, busy }: { label: string; onPress: () => void; disabled?: boolean; busy?: boolean }) {
  return (
    <Pressable onPress={disabled || busy ? undefined : onPress} accessibilityRole="button" accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      style={({ pressed }) => [styles.btn, (disabled || busy) && { opacity: 0.55 }, { transform: [{ scale: pressed && !disabled ? 0.98 : 1 }] }]}>
      <Text style={styles.btnText}>{busy ? 'Секунду…' : label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: 16 },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  bars: { flex: 1, flexDirection: 'row', gap: 6 },
  seg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#DDD8CC', overflow: 'hidden' },
  segOn: { height: 4, borderRadius: 2, backgroundColor: colors.ink },
  titles: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 18, gap: 6 },
  h1: { fontFamily: fonts.display800, fontSize: 31, lineHeight: 34, letterSpacing: -1, color: colors.ink },
  sub: { fontFamily: fonts.body400, fontSize: 15, lineHeight: 21, color: colors.muted },
  footer: { paddingHorizontal: 20 },
  btn: { height: 56, borderRadius: 16, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: fonts.body700, fontSize: 17, color: colors.ink },
});
