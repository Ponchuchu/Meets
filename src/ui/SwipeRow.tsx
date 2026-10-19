// Строка списка со смахиванием, как в Telegram: потянул влево — справа под строкой открываются круглые кнопки-значки,
// никаких окон. Отпустил за половину — кнопки остаются открытыми, нажал значок — действие и строка закрывается.
// Вертикальная прокрутка списка не перехватывается. Открыта может быть одна строка — остальные закрываются.
import type { ReactNode } from 'react';
import { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { colors, fonts } from '../theme';

export interface RowAction {
  key: string;
  label: string;
  color: string;
  /** Цвет значка и подписи. */
  fg?: string;
  icon: ReactNode;
  onPress: () => void;
}

const BTN = 76;
const registry: { open: (() => void) | null } = { open: null };
/** Эта строка открылась — предыдущую открытую закрываем. */
function claim(close: () => void) {
  if (registry.open && registry.open !== close) registry.open();
  registry.open = close;
}
function release(close: () => void) {
  if (registry.open === close) registry.open = null;
}

export function SwipeRow({ children, actions, background = colors.paper, radius = 20, iconOnly = false }: {
  children: ReactNode; actions: RowAction[]; background?: string; radius?: number; iconOnly?: boolean;
}) {
  const x = useSharedValue(0);
  const start = useSharedValue(0);
  const buttonWidth = iconOnly ? 58 : BTN;
  const full = actions.length * buttonWidth;
  const close = useCallback(() => { x.set(withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) })); }, [x]);
  useEffect(() => () => release(close), [close]);
  const opened = () => claim(close);

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-12, 12])
    .onStart(() => { start.set(x.get()); scheduleOnRN(opened); })
    .onUpdate((e) => {
      const next = start.get() + e.translationX;
      // За край тянется туго, как резинка.
      x.set(next < -full ? -full + (next + full) * 0.25 : next > 0 ? next * 0.2 : next);
    })
    .onEnd((e) => {
      const open = x.get() < -full * 0.4 || e.velocityX < -600;
      x.set(withTiming(open && e.velocityX < 600 ? -full : 0, { duration: 220, easing: Easing.out(Easing.cubic) }));
    });

  const row = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const rail = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.abs(x.get()) / 24) }));
  return (
    <View style={[styles.wrap, { borderRadius: radius }]}>
      <Animated.View style={[styles.rail, { width: full }, rail]} pointerEvents="box-none">
        {actions.map((a) => (
          <Pressable key={a.key} onPress={() => { close(); a.onPress(); }} style={[styles.btn, { width: buttonWidth, backgroundColor: a.color, borderRadius: iconOnly ? 18 : 0, marginVertical: iconOnly ? 5 : 0, borderWidth: iconOnly ? 3 : 0, borderColor: background }]} accessibilityRole="button" accessibilityLabel={a.label}>
            {a.icon}
            {!iconOnly && <Text style={[styles.label, a.fg ? { color: a.fg } : null]} numberOfLines={1}>{a.label}</Text>}
          </Pressable>
        ))}
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[{ backgroundColor: background, borderRadius: radius }, row]}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  rail: { position: 'absolute', right: 0, top: 0, bottom: 0, flexDirection: 'row' },
  btn: { width: BTN, alignItems: 'center', justifyContent: 'center', gap: 5 },
  label: { fontFamily: fonts.body600, fontSize: 11.5, color: '#FFFFFF' },
});
