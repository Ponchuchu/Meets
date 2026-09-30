// Таб-бар: плавающая полупрозрачная капсула поверх экрана (карта видна сквозь неё и вокруг).
// Активная вкладка — тёмная «таблетка» по ширине подписи; переезжает пружиной, иконка «закрашивается» снизу вверх.
// Остальные вкладки — только иконки. Таблетку можно вести пальцем по капсуле — вкладки переключаются на лету.
// Когда открыта шторка или раскрытая карточка — капсула уезжает вниз.
import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { data } from '../data';
import { useApp } from '../state/app';
import { useChat } from '../state/chat';
import { colors, fonts } from '../theme';
import { Icon, type IconName } from './Icon';

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Карта', icon: 'map' },
  foryou: { label: 'Рекомендации', icon: 'foryou' },
  chats: { label: 'Чаты', icon: 'chats' },
  people: { label: 'Друзья', icon: 'people' },
  me: { label: 'Профиль', icon: 'me' },
};

const BAR_H = 62;
// На вебе — настоящее «стекло»: размытие того, что под капсулой (в RN такого стиля нет, поэтому вне StyleSheet).
const GLASS_WEB = { backdropFilter: 'blur(18px) saturate(170%)', WebkitBackdropFilter: 'blur(18px) saturate(170%)', backgroundColor: 'rgba(251,249,244,0.62)' } as object;
const PAD = 5;
const SIDE = 16;
const SPRING = { damping: 17, stiffness: 190, mass: 0.8 };

/** Отступ снизу капсулы до края экрана. */
export const tabGap = (bottomInset: number) => Math.max(14, bottomInset - 8);
/** Сколько места снизу занимает таб-бар — на это поднимаем карточки и отступ списков. */
export const tabInset = (bottomInset: number) => BAR_H + tabGap(bottomInset) + 10;
/** Для старых расчётов «высота над таб-баром» (лента рекомендаций). */
export const TAB_BAR_HEIGHT = BAR_H + 24;

export function useTabInset() {
  return tabInset(useSafeAreaInsets().bottom);
}

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/** Кольцо расходится (0.4 → 1.9) и всплывает «+1» — когда «пойду» прилетает в профиль. */
function PlanPulse() {
  const pulse = useApp((s) => s.planPulse);
  const t = useSharedValue(1);
  useEffect(() => {
    if (!pulse) return;
    t.value = 0;
    t.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) });
  }, [pulse, t]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.9 * (1 - t.value), transform: [{ scale: 0.4 + 1.5 * t.value }] }));
  const plus = useAnimatedStyle(() => ({
    opacity: t.value < 0.25 ? t.value / 0.25 : 1 - (t.value - 0.25) / 0.75,
    transform: [{ translateY: 6 - 32 * t.value }],
  }));
  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.ring, ring]} />
      <Animated.Text pointerEvents="none" style={[styles.plus, plus]}>+1</Animated.Text>
    </>
  );
}

const ICON = 24;
const GAP = 7;
const PADX = 16;
/** Примерная ширина подписи, пока не измерили настоящую (Golos 600, 12.5 px). */
const guessW = (t: string) => Math.round(t.length * 7.2);

/** Раскладка для выбранной вкладки: активная — по ширине подписи, остальные делят остаток поровну. */
function layout(n: number, active: number, total: number, labelW: number) {
  const out = Math.min(total - n * 40, PADX * 2 + ICON + GAP + labelW);
  const inn = (total - out) / (n - 1);
  const widths = Array.from({ length: n }, (_, i) => (i === active ? out : inn));
  return { widths, x: inn * active, w: out };
}

function Tab({ name, width, on, active, onPress, badge, count }: {
  name: string; width: SharedValue<number>; on: SharedValue<number>; active: boolean; onPress: () => void; badge?: React.ReactNode; count?: number;
}) {
  const tab = TABS[name];
  // Заливка «поднимается» снизу вверх, когда вкладка становится активной, и уходит, когда нет.
  const fill = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    fill.set(active ? withDelay(90, withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) })) : withTiming(0, { duration: 160 }));
  }, [active, fill]);
  const box = useAnimatedStyle(() => ({ width: width.get() }));
  const label = useAnimatedStyle(() => ({ opacity: on.get(), maxWidth: on.get() * 140, marginLeft: on.get() * GAP }));
  const dark = useAnimatedStyle(() => ({ opacity: 1 - on.get() }));
  const light = useAnimatedStyle(() => ({ opacity: on.get() }));
  const rise = useAnimatedStyle(() => ({ height: ICON * fill.get() }));
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={count ? `${tab.label}, ${count} новых` : tab.label}>
      {({ pressed }) => (
        <Animated.View style={[styles.tab, box, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
          <View style={{ width: ICON, height: ICON }}>
            <Animated.View style={[StyleSheet.absoluteFill, dark]}><Icon name={tab.icon} color={colors.ink} /></Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, light]}><Icon name={tab.icon} color={colors.paper} /></Animated.View>
            <Animated.View style={[styles.rise, rise]}>
              <View style={styles.riseInner}><Icon name={tab.icon} color={colors.paper} filled detail={colors.ink} /></View>
            </Animated.View>
          </View>
          <Animated.View style={[styles.labelBox, label]}>
            <Text style={styles.label} numberOfLines={1}>{tab.label}</Text>
            {!!count && <View style={styles.count}><Text style={styles.countText}>{count}</Text></View>}
          </Animated.View>
          {badge}
        </Animated.View>
      )}
    </Pressable>
  );
}

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const newPlans = useApp((s) => s.newPlans);
  const freshFeed = useApp((s) => s.freshFeed);
  const covers = useApp((s) => s.covers);
  const { data: requests } = useQuery({ queryKey: ['chatRequests'], queryFn: () => data.getChatRequests() });
  const answered = useChat((s) => s.requests);
  const unread = (requests ?? []).filter((r) => !answered[r.id]).length;
  const routes = state.routes.filter((r) => TABS[r.name]);
  const activeKey = state.routes[state.index]?.name;
  const idx = Math.max(0, routes.findIndex((r) => r.name === activeKey));
  const countOf = (name: string) => (name === 'chats' ? unread : name === 'me' ? newPlans : 0);

  const barW = Math.min(width - SIDE * 2, 460);
  const total = barW - PAD * 2;
  // Настоящие ширины подписей меряем невидимым текстом (шрифт может отличаться от оценки).
  const [measured, setMeasured] = useState<Record<string, number>>({});
  const labelW = (name: string) => (measured[name] ?? guessW(TABS[name].label)) + (countOf(name) ? 24 : 0);
  const L = layout(routes.length, idx, total, labelW(routes[idx]?.name ?? 'index'));

  // Пять вкладок фиксированы — по общему значению ширины и «включённости» на каждую.
  const w0 = useSharedValue(L.widths[0] ?? 0); const w1 = useSharedValue(L.widths[1] ?? 0); const w2 = useSharedValue(L.widths[2] ?? 0);
  const w3 = useSharedValue(L.widths[3] ?? 0); const w4 = useSharedValue(L.widths[4] ?? 0);
  const o0 = useSharedValue(idx === 0 ? 1 : 0); const o1 = useSharedValue(idx === 1 ? 1 : 0); const o2 = useSharedValue(idx === 2 ? 1 : 0);
  const o3 = useSharedValue(idx === 3 ? 1 : 0); const o4 = useSharedValue(idx === 4 ? 1 : 0);
  const ws = [w0, w1, w2, w3, w4];
  const os = [o0, o1, o2, o3, o4];
  const px = useSharedValue(L.x);
  const pw = useSharedValue(L.w);
  const key = L.widths.map((x) => x.toFixed(1)).join(',');
  useEffect(() => {
    L.widths.forEach((w, i) => { ws[i].set(withSpring(w, SPRING)); os[i].set(withTiming(i === idx ? 1 : 0, { duration: i === idx ? 260 : 140 })); });
    px.set(withSpring(L.x, SPRING));
    pw.set(withSpring(L.w, SPRING));
  }, [key, idx]); // eslint-disable-line react-hooks/exhaustive-deps

  const hide = useSharedValue(0);
  useEffect(() => { hide.set(withTiming(covers > 0 ? 1 : 0, { duration: covers > 0 ? 200 : 260 })); }, [covers, hide]);
  const pill = useAnimatedStyle(() => ({ width: pw.get(), transform: [{ translateX: px.get() }] }));
  const wrap = useAnimatedStyle(() => ({ opacity: 1 - hide.get(), transform: [{ translateY: hide.get() * (BAR_H + 40) }] }));

  const go = (i: number) => {
    const route = routes[i];
    if (!route || route.name === activeKey) return;
    const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!e.defaultPrevented) navigation.navigate(route.name);
  };
  // Держишь таблетку и ведёшь пальцем — вкладка под пальцем включается сразу («хоп»), как в iOS.
  const dragTo = (x: number) => {
    let acc = 0;
    for (let i = 0; i < L.widths.length; i++) {
      acc += L.widths[i];
      if (x < acc) { go(i); return; }
    }
    go(L.widths.length - 1);
  };
  const drag = Gesture.Pan().activeOffsetX([-10, 10]).failOffsetY([-14, 14])
    .onUpdate((e) => { scheduleOnRN(dragTo, e.x - PAD); });

  return (
    <Animated.View pointerEvents={covers > 0 ? 'none' : 'box-none'} style={[styles.wrap, { bottom: tabGap(insets.bottom) }, wrap]}>
      <View style={styles.measure} pointerEvents="none">
        {routes.map((r) => (
          <Text key={r.key} style={styles.label} onLayout={(e) => {
            const w = Math.ceil(e.nativeEvent.layout.width);
            if (w && measured[r.name] !== w) setMeasured((m) => ({ ...m, [r.name]: w }));
          }}>{TABS[r.name].label}</Text>
        ))}
      </View>
      <GestureDetector gesture={drag}>
        <View style={[styles.bar, { width: barW }, Platform.OS === 'web' ? GLASS_WEB : null]} accessibilityRole="tablist">
          <Animated.View pointerEvents="none" style={[styles.pill, pill]} />
          {routes.map((route, i) => {
            const active = route.name === activeKey;
            const n = countOf(route.name);
            // Непрочитанное у неактивной вкладки — маленькая точка; у активной число стоит рядом с подписью.
            const badge = (
              <>
                {!active && ((route.name === 'foryou' && freshFeed) || n > 0) && <View style={styles.dot} accessibilityElementsHidden />}
                {route.name === 'me' && <PlanPulse />}
              </>
            );
            return <Tab key={route.key} name={route.name} width={ws[i]} on={os[i]} active={active} onPress={() => go(i)} badge={badge} count={n} />;
          })}
        </View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bar: {
    flexDirection: 'row', height: BAR_H, padding: PAD, borderRadius: BAR_H / 2,
    backgroundColor: 'rgba(251,249,244,0.78)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: colors.ink, shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 12,
  },
  pill: { position: 'absolute', left: PAD, top: PAD, bottom: PAD, borderRadius: (BAR_H - PAD * 2) / 2, backgroundColor: colors.ink },
  tab: { height: BAR_H - PAD * 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 26, position: 'relative' },
  label: { fontFamily: fonts.body600, fontSize: 12.5, letterSpacing: -0.25, color: colors.paper },
  labelBox: { flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  measure: { position: 'absolute', opacity: 0, left: -1000, flexDirection: 'row' },
  rise: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  riseInner: { position: 'absolute', left: 0, bottom: 0, width: ICON, height: ICON },
  count: { marginLeft: 6, minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  countText: { fontFamily: fonts.mono600, fontSize: 10, color: colors.ink },
  dot: { position: 'absolute', top: 12, left: '50%', marginLeft: 7, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, zIndex: 2 },
  ring: { position: 'absolute', top: 2, left: '50%', marginLeft: -24, width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: colors.accent },
  plus: { position: 'absolute', top: -20, right: 0, fontFamily: fonts.display800, fontSize: 15, color: colors.accent },
});
