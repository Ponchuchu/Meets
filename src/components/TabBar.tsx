// Нижняя панель v6 (V6.md §1.1, design/screens/V6TabBar): пилюля 366×66, только иконки без подписей.
// Выбранная: заливка чернилами 420 мс + «пружина» 0.84 → 1.12 → 1 за 520 мс; у Профиля — кольцо вокруг аватарки.
// Бейджи: Планы (зовут + новые), Чаты (непрочитанные) — оранжевые, цифра прокручивается вверх при смене.
// Повторный тап обрабатывают экраны (событие tabPress). Долгое нажатие — подсказка с названием вкладки.
// Панель уезжает вниз (−130 px, 300 мс), когда открыта шторка, раскрытая карточка или клавиатура.
import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Image, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useApp } from '../state/app';
import { useTabBadges } from '../state/tabBadges';
import { colors, fonts } from '../theme';

const BAR_H = 66;
const POP = Easing.bezier(0.3, 1.4, 0.5, 1);
const OFF = '#5F5B55';
const ON_DETAIL = '#FBFAF6';

const TABS: Record<string, { label: string; shape?: string; details?: string }> = {
  index: { label: 'Карта', shape: 'M3 6.5l6-3 6 3 6-3v14l-6 3-6-3-6 3z', details: 'M9 3.5v14M15 6.5v14' },
  foryou: { label: 'Рекомендации', shape: 'M8.5 2.5h9.5a2.5 2.5 0 012.5 2.5v11.5a2.5 2.5 0 01-2.5 2.5H8.5A2.5 2.5 0 016 16.5V5a2.5 2.5 0 012.5-2.5z', details: 'M3 6.5v12a3 3 0 003 3h9.5M13.25 6.8l1.1 2.3 2.5.35-1.8 1.75.42 2.5-2.22-1.2-2.22 1.2.42-2.5-1.8-1.75 2.5-.35z' },
  plans: { label: 'Планы', shape: 'M5 4.5h14a2.5 2.5 0 012.5 2.5v12a2.5 2.5 0 01-2.5 2.5H5A2.5 2.5 0 012.5 19V7A2.5 2.5 0 015 4.5z', details: 'M2.5 9.5h19M8 2.5v4M16 2.5v4M8.5 15l2.3 2.3 4.7-4.6' },
  chats: { label: 'Чаты', shape: 'M4 4h16a1.5 1.5 0 011.5 1.5v10.5a1.5 1.5 0 01-1.5 1.5h-9.5L5.5 21.5v-4H4A1.5 1.5 0 012.5 16V5.5A1.5 1.5 0 014 4z', details: 'M7.5 9h9M7.5 12.5h5.5' },
  me: { label: 'Профиль' },
};

/** Отступ снизу капсулы до края экрана. */
export const tabGap = (bottomInset: number) => Math.max(12, bottomInset);
/** Сколько места снизу занимает панель — на это поднимаем карточки и отступ списков. */
export const tabInset = (bottomInset: number) => BAR_H + tabGap(bottomInset) + 10;
export const TAB_BAR_HEIGHT = BAR_H + 22;
export function useTabInset() {
  return tabInset(useSafeAreaInsets().bottom);
}

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/** Цифра бейджа: при смене старая уезжает вверх, новая приезжает снизу. */
function Badge({ n, label }: { n: number; label: string }) {
  const [shown, setShown] = useState(n);
  const y = useSharedValue(0);
  useEffect(() => {
    if (n === shown) return;
    y.set(withSequence(withTiming(-14, { duration: 140 }), withTiming(14, { duration: 0 }), withTiming(0, { duration: 160 })));
    const t = setTimeout(() => setShown(n), 140);
    return () => clearTimeout(t);
  }, [n]); // eslint-disable-line react-hooks/exhaustive-deps
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  return (
    <View style={styles.badge} accessibilityLabel={label}>
      <Animated.Text style={[styles.badgeText, st]}>{shown > 9 ? '9+' : shown}</Animated.Text>
    </View>
  );
}

function TabIcon({ name, on, pop }: { name: string; on: boolean; pop: SharedValue<number> }) {
  const d = TABS[name];
  const fill = useSharedValue(on ? 1 : 0);
  useEffect(() => { fill.set(withTiming(on ? 1 : 0, { duration: on ? 420 : 160 })); }, [on, fill]);
  const filled = useAnimatedStyle(() => ({ opacity: fill.get() }));
  const outline = useAnimatedStyle(() => ({ opacity: 1 - fill.get() }));
  const bounce = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));
  return (
    <Animated.View style={[{ width: 28, height: 28 }, bounce]}>
      <Animated.View style={[StyleSheet.absoluteFill, outline]}>
        <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
          <Path d={d.shape} stroke={OFF} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          <Path d={d.details} stroke={OFF} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, filled]}>
        <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
          <Path d={d.shape} fill={colors.ink} stroke={colors.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          <Path d={d.details} stroke={ON_DETAIL} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

function MeIcon({ on, pop }: { on: boolean; pop: SharedValue<number> }) {
  const avatar = useTabBadges((s) => s.avatar);
  const ring = useSharedValue(on ? 1 : 0);
  useEffect(() => { ring.set(withTiming(on ? 1 : 0, { duration: 420 })); }, [on, ring]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }], borderColor: `rgba(23,22,26,${ring.get()})` }));
  return (
    <Animated.View style={[styles.meRing, st]}>
      {avatar.url ? <Image source={{ uri: avatar.url }} style={styles.meFace} /> : (
        <View style={[styles.meFace, styles.meEmpty]}><Text style={styles.meLetter}>{avatar.letter || '·'}</Text></View>
      )}
    </Animated.View>
  );
}

function Tab({ name, on, badge, onPress, onLong }: { name: string; on: boolean; badge: number; onPress: () => void; onLong: () => void }) {
  const pop = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (on) pop.set(withSequence(withTiming(0.84, { duration: 0 }), withTiming(1.12, { duration: 286, easing: POP }), withTiming(1, { duration: 234, easing: POP })));
  }, [on, pop]);
  const label = TABS[name].label;
  return (
    <Pressable onPress={onPress} onLongPress={onLong} delayLongPress={350} style={styles.tab}
      accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={badge ? `${label}, ${badge}` : label}>
      {name === 'me' ? <MeIcon on={on} pop={pop} /> : <TabIcon name={name} on={on} pop={pop} />}
      {badge > 0 && <Badge n={badge} label={name === 'plans' ? `Новых планов: ${badge}` : `Непрочитанных: ${badge}`} />}
    </Pressable>
  );
}

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const covers = useApp((s) => s.covers);
  const plans = useTabBadges((s) => s.plans);
  const chats = useTabBadges((s) => s.chats);
  const [kb, setKb] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  useEffect(() => {
    const a = Keyboard.addListener('keyboardDidShow', () => setKb(true));
    const b = Keyboard.addListener('keyboardDidHide', () => setKb(false));
    return () => { a.remove(); b.remove(); };
  }, []);
  const hidden = covers > 0 || kb;
  const hide = useSharedValue(0);
  useEffect(() => { hide.set(withTiming(hidden ? 1 : 0, { duration: 300 })); }, [hidden, hide]);
  const wrap = useAnimatedStyle(() => ({ transform: [{ translateY: hide.get() * 130 }] }));
  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(null), 1400);
    return () => clearTimeout(t);
  }, [hint]);

  const routes = state.routes.filter((r) => TABS[r.name]);
  const activeKey = state.routes[state.index]?.name;
  return (
    <Animated.View pointerEvents={hidden ? 'none' : 'box-none'} style={[styles.wrap, { bottom: tabGap(insets.bottom) }, wrap]}>
      {hint && <View style={styles.hint} pointerEvents="none"><Text style={styles.hintText}>{hint}</Text></View>}
      <View style={styles.bar} accessibilityRole="tablist">
        {routes.map((route) => {
          const on = route.name === activeKey;
          return (
            <Tab key={route.key} name={route.name} on={on} badge={route.name === 'plans' ? plans : route.name === 'chats' ? chats : 0}
              onLong={() => setHint(TABS[route.name].label)}
              onPress={() => {
                const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!on && !e.defaultPrevented) navigation.navigate(route.name);
              }} />
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bar: {
    width: 366, maxWidth: '94%', height: BAR_H, padding: 5, borderRadius: 33, flexDirection: 'row', gap: 2,
    backgroundColor: '#FBFAF6', borderWidth: 1, borderColor: 'rgba(23,22,26,0.08)',
    shadowColor: colors.ink, shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 10 }, elevation: 12,
  },
  tab: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute', top: 6, left: '50%', marginLeft: 5, minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2, borderColor: '#FBFAF6',
  },
  badgeText: { fontFamily: fonts.mono600, fontSize: 10.5, color: colors.ink },
  meRing: { width: 30, height: 30, borderRadius: 15, padding: 2, borderWidth: 2 },
  meFace: { flex: 1, borderRadius: 13, overflow: 'hidden' },
  meEmpty: { backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  meLetter: { fontFamily: fonts.display800, fontSize: 13, color: colors.accent },
  hint: { position: 'absolute', bottom: BAR_H + 10, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: colors.ink },
  hintText: { fontFamily: fonts.body600, fontSize: 13, color: colors.paper },
});
