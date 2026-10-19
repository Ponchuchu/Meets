// Нижняя панель v6 (V6.md §1.1, design/screens/V6TabBar): плавающая пилюля 366×64 в стиле iOS, только иконки без подписей.
// Плашка: градиентная кромка, внутренний блик и мягкая тень (src/ui/glass.ts); под выбранной вкладкой — тёплая подложка,
// она переезжает к новой вкладке (одна анимация transform — дёшево и на слабых телефонах).
// Выбранная: заливка чернилами 420 мс + «пружина» 0.84 → 1.12 → 1 за 520 мс; у Профиля — кольцо вокруг аватарки.
// Бейджи: Планы (зовут + новые), Чаты (непрочитанные) — оранжевые, цифра прокручивается вверх при смене.
// Повторный тап обрабатывают экраны (событие tabPress). Долгое нажатие — подсказка с названием вкладки.
// Панель уезжает вниз (−130 px, 300 мс), когда открыта шторка, раскрытая карточка или клавиатура.
import * as Haptics from 'expo-haptics';
import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Image, Keyboard, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useApp } from '../state/app';
import { useTabBadges } from '../state/tabBadges';
import { colors, fonts } from '../theme';
import { glass } from '../ui/glass';

const BAR_H = 64;
const PAD = 5;
const GAP = 2;
const POP = Easing.bezier(0.3, 1.4, 0.5, 1);
const OFF = '#5F5B55';
const ON_DETAIL = '#EEE9DE';

const TABS: Record<string, { label: string; shape?: string; details?: string; back?: string }> = {
  index: { label: 'Карта', shape: 'M3 6.5l6-3 6 3 6-3v14l-6 3-6-3-6 3z', details: 'M9 3.5v14M15 6.5v14' },
  // Рекомендации: передняя карточка со звездой и вторая карточка позади — читается как стопка. Выбрано: всё сплошным чёрным, как в Instagram.
  foryou: { label: 'Рекомендации', shape: 'M8 3h9.5A2.5 2.5 0 0120 5.5v12a2.5 2.5 0 01-2.5 2.5H8A2.5 2.5 0 015.5 17.5v-12A2.5 2.5 0 018 3z', back: 'M3 7v11a3 3 0 003 3h9', details: 'M12.75 7.8l1.2 2.5 2.7.4-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.4z' },
  plans: { label: 'Планы', shape: 'M5 4.5h14a2.5 2.5 0 012.5 2.5v12a2.5 2.5 0 01-2.5 2.5H5A2.5 2.5 0 012.5 19V7A2.5 2.5 0 015 4.5z', details: 'M2.5 9.5h19M8 2.5v4M16 2.5v4M8.5 15l2.3 2.3 4.7-4.6' },
  chats: { label: 'Чаты', shape: 'M4 4h16a1.5 1.5 0 011.5 1.5v10.5a1.5 1.5 0 01-1.5 1.5h-9.5L5.5 21.5v-4H4A1.5 1.5 0 012.5 16V5.5A1.5 1.5 0 014 4z', details: 'M7.5 9h9M7.5 12.5h5.5' },
  me: { label: 'Профиль' },
};

/** Отступ снизу капсулы до края экрана. */
export const tabGap = (bottomInset: number) => Math.max(12, bottomInset);
/** Сколько места снизу занимает панель — на это поднимаем карточки и отступ списков. */
export const tabInset = (bottomInset: number) => BAR_H + tabGap(bottomInset) + 10;
/** Центр вкладки i (0 — Карта … 4 — Профиль) на экране шириной W и высотой H: сюда летят карточки и смотрит обучение. */
export function tabCenter(i: number, W: number, H: number, bottomInset: number) {
  const bar = Math.min(366, W * 0.94);
  const cell = (bar - PAD * 2 - GAP * 4) / 5;
  return { x: (W - bar) / 2 + PAD + i * (cell + GAP) + cell / 2, y: H - tabGap(bottomInset) - BAR_H / 2 };
}
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
          {d.back ? <Path d={d.back} stroke={OFF} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /> : null}
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, filled]}>
        <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
          <Path d={d.shape} fill={colors.ink} stroke={colors.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          <Path d={d.details} stroke={ON_DETAIL} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill={d.back ? ON_DETAIL : 'none'} />
          {d.back ? <Path d={d.back} stroke={colors.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /> : null}
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

function MeIcon({ on, pop }: { on: boolean; pop: SharedValue<number> }) {
  const avatar = useTabBadges((s) => s.avatar);
  const ring = useSharedValue(on ? 1 : 0);
  useEffect(() => { ring.set(withTiming(on ? 1 : 0, { duration: 420 })); }, [on, ring]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }], borderColor: `rgba(${Math.round(23 + 217 * ring.get())},${Math.round(22 + 60 * ring.get())},${Math.round(26 + 5 * ring.get())},${0.16 + 0.84 * ring.get()})` }));
  return (
    <Animated.View style={[styles.meRing, st]}>
      {avatar.url ? <Image source={{ uri: avatar.url }} style={styles.meFace} /> : (
        <View style={[styles.meFace, styles.meEmpty]}><Text style={styles.meLetter}>{avatar.letter || '·'}</Text></View>
      )}
    </Animated.View>
  );
}

function Tab({ name, on, badge, land, onPress, onLong }: { name: string; on: boolean; badge: number; land: number; onPress: () => void; onLong: () => void }) {
  const pop = useSharedValue(1);
  const wob = useSharedValue(0);
  const flash = useSharedValue(0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (on) pop.set(withSequence(withTiming(0.84, { duration: 0 }), withTiming(1.12, { duration: 286, easing: POP }), withTiming(1, { duration: 234, easing: POP })));
  }, [on, pop]);
  // Прилёт карточки: scale 1,42 с покачиванием ±10°, затухание 0,5 с, оранжевая вспышка.
  useEffect(() => {
    if (!land) return;
    pop.set(withSequence(withTiming(1.12, { duration: 140, easing: Easing.out(Easing.quad) }), withTiming(1, { duration: 500, easing: POP })));
    wob.set(0);
    flash.set(withSequence(withTiming(1, { duration: 120 }), withTiming(1, { duration: 380 }), withTiming(0, { duration: 260 })));
  }, [land, pop, wob, flash]);
  const wobble = useAnimatedStyle(() => ({ transform: [{ rotate: `${wob.get()}deg` }] }));
  const flashSt = useAnimatedStyle(() => ({ opacity: flash.get(), transform: [{ scale: 0.6 + 0.4 * flash.get() }] }));
  const label = TABS[name].label;
  return (
    <Pressable onPress={onPress} onLongPress={onLong} delayLongPress={350} style={styles.tab}
      accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={badge ? `${label}, ${badge}` : label}>
      {name === 'plans' && <Animated.View pointerEvents="none" style={[styles.flash, flashSt]} />}
      <Animated.View style={wobble}>{name === 'me' ? <MeIcon on={on} pop={pop} /> : <TabIcon name={name} on={on} pop={pop} />}</Animated.View>
      {badge > 0 && <Badge n={badge} label={name === 'plans' ? `Новых планов: ${badge}` : `Непрочитанных: ${badge}`} />}
    </Pressable>
  );
}

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const covers = useApp((s) => s.covers);
  const plans = useTabBadges((s) => s.plans);
  const chats = useTabBadges((s) => s.chats);
  const land = useTabBadges((s) => s.land);
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
  const activeIdx = Math.max(0, routes.findIndex((r) => r.name === activeKey));
  const [cell, setCell] = useState(0);
  const slide = useSharedValue(activeIdx);
  useEffect(() => { slide.set(withTiming(activeIdx, { duration: 320, easing: Easing.bezier(0.25, 1, 0.5, 1) })); }, [activeIdx, slide]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: slide.get() * (cell + GAP) }] }));
  const onBar = (e: LayoutChangeEvent) => setCell((e.nativeEvent.layout.width - PAD * 2 - GAP * 4) / 5);
  return (
    <Animated.View pointerEvents={hidden ? 'none' : 'box-none'} style={[styles.wrap, { bottom: tabGap(insets.bottom) }, wrap]}>
      {hint && <View style={styles.hint} pointerEvents="none"><Text style={styles.hintText}>{hint}</Text></View>}
      <View style={[styles.bar, glass]} accessibilityRole="tablist" onLayout={onBar}>
        {cell > 0 && <Animated.View pointerEvents="none" style={[styles.pill, { width: cell }, pill]} />}
        {routes.map((route) => {
          const on = route.name === activeKey;
          return (
            <Tab key={route.key} name={route.name} on={on} land={route.name === 'plans' ? land : 0} badge={route.name === 'plans' ? plans : route.name === 'chats' ? chats : 0}
              onLong={() => setHint(TABS[route.name].label)}
              onPress={() => {
                const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!on && !e.defaultPrevented) {
                  void Haptics.selectionAsync().catch(() => undefined);
                  navigation.navigate(route.name);
                }
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
    width: 366, maxWidth: '94%', height: BAR_H, padding: PAD, borderRadius: BAR_H / 2, flexDirection: 'row', gap: GAP,
  },
  pill: { position: 'absolute', top: PAD, left: PAD, bottom: PAD, borderRadius: (BAR_H - PAD * 2) / 2, backgroundColor: 'rgba(240,82,31,0.12)' },
  tab: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute', top: 6, left: '50%', marginLeft: 5, minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2, borderColor: '#FCFBF8',
  },
  badgeText: { fontFamily: fonts.mono600, fontSize: 10.5, color: colors.ink },
  flash: { position: 'absolute', width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  spark: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  // Аватар на панели не меньше соседних значков (28): кольцо 36, лицо 30.
  meRing: { width: 36, height: 36, borderRadius: 18, padding: 1.5, borderWidth: 1.5 },
  meFace: { width: 30, height: 30, borderRadius: 15, overflow: 'hidden' },
  meEmpty: { backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  meLetter: { fontFamily: fonts.body700, fontSize: 15, lineHeight: 20, includeFontPadding: false, textAlignVertical: 'center', color: colors.accent },
  hint: { position: 'absolute', bottom: BAR_H + 10, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: colors.ink },
  hintText: { fontFamily: fonts.body600, fontSize: 13, color: colors.paper },
});
