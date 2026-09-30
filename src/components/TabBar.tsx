// Таб-бар: плавающая полупрозрачная капсула поверх экрана (карта видна сквозь неё и вокруг).
// Активная вкладка — тёмная «таблетка» с иконкой и подписью; она плавно переезжает пружиной, как в iOS.
// Остальные вкладки — только иконки, поэтому длинное «Рекомендации» не обрезается.
// Когда открыта шторка или раскрытая карточка — капсула уезжает вниз.
import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
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

function Tab({ i, pos, inW, outW, name, active, onPress, badge }: {
  i: number; pos: SharedValue<number>; inW: number; outW: number; name: string; active: boolean; onPress: () => void; badge?: React.ReactNode;
}) {
  const tab = TABS[name];
  const bounce = useSharedValue(1);
  const tilt = useSharedValue(0);
  useEffect(() => {
    if (!active) return;
    // Иконка «подпрыгивает» при выборе: сжатие → пружина, лёгкий наклон.
    bounce.set(withSequence(withTiming(0.78, { duration: 90 }), withSpring(1, { damping: 7, stiffness: 260 })));
    tilt.set(withSequence(withTiming(-10, { duration: 110 }), withSpring(0, { damping: 6, stiffness: 200 })));
  }, [active, bounce, tilt]);
  const box = useAnimatedStyle(() => {
    const d = Math.min(1, Math.abs(pos.get() - i));
    return { width: interpolate(d, [0, 1], [outW, inW]) };
  });
  const label = useAnimatedStyle(() => {
    const d = Math.min(1, Math.abs(pos.get() - i));
    return { opacity: interpolate(d, [0, 0.6], [1, 0], 'clamp'), maxWidth: interpolate(d, [0, 1], [outW - 36, 0]), marginLeft: interpolate(d, [0, 1], [7, 0]) };
  });
  const icon = useAnimatedStyle(() => ({ transform: [{ scale: bounce.get() }, { rotate: `${tilt.get()}deg` }] }));
  const light = useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, Math.abs(pos.get() - i)) }));
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={tab.label}>
      {({ pressed }) => (
        <Animated.View style={[styles.tab, box, { transform: [{ scale: pressed ? 0.92 : 1 }] }]}>
          <Animated.View style={icon}>
            <Icon name={tab.icon} color={colors.ink} />
            <Animated.View style={[StyleSheet.absoluteFill, light]}><Icon name={tab.icon} color={colors.paper} strokeWidth={2} /></Animated.View>
          </Animated.View>
          <Animated.View style={[{ overflow: 'hidden' }, label]}>
            <Text style={styles.label} numberOfLines={1}>{tab.label}</Text>
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

  // Ширины: неактивные — квадраты под иконку, активная забирает остаток под иконку + подпись.
  const barW = Math.min(width - SIDE * 2, 460);
  const inW = Math.min(54, (barW - PAD * 2) / 6.6);
  const outW = barW - PAD * 2 - inW * (routes.length - 1);

  const pos = useSharedValue(idx);
  useEffect(() => { pos.set(withSpring(idx, SPRING)); }, [idx, pos]);
  const hide = useSharedValue(0);
  useEffect(() => { hide.set(withTiming(covers > 0 ? 1 : 0, { duration: covers > 0 ? 200 : 260 })); }, [covers, hide]);

  const pill = useAnimatedStyle(() => ({ width: outW, transform: [{ translateX: pos.get() * inW }] }));
  const wrap = useAnimatedStyle(() => ({ opacity: 1 - hide.get(), transform: [{ translateY: hide.get() * (BAR_H + 40) }] }));

  return (
    <Animated.View pointerEvents={covers > 0 ? 'none' : 'box-none'} style={[styles.wrap, { bottom: tabGap(insets.bottom) }, wrap]}>
      <View style={[styles.bar, { width: barW }, Platform.OS === 'web' ? GLASS_WEB : null]} accessibilityRole="tablist">
        <Animated.View pointerEvents="none" style={[styles.pill, pill]} />
        {routes.map((route, i) => {
          const active = route.name === activeKey;
          const onPress = () => {
            const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!active && !e.defaultPrevented) navigation.navigate(route.name);
          };
          const badge = (
            <>
              {route.name === 'foryou' && freshFeed && !active && <View style={styles.dot} accessibilityLabel="Есть новые карточки" />}
              {route.name === 'chats' && unread > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.accent }]} accessibilityLabel={`${unread} непрочитанных`}>
                  <Text style={[styles.badgeText, { color: colors.ink }]}>{unread}</Text>
                </View>
              )}
              {route.name === 'me' && newPlans > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.accent }]} accessibilityLabel={`Новых планов: ${newPlans}`}>
                  <Text style={[styles.badgeText, { color: colors.ink }]}>{newPlans}</Text>
                </View>
              )}
              {route.name === 'me' && <PlanPulse />}
            </>
          );
          return <Tab key={route.key} i={i} pos={pos} inW={inW} outW={outW} name={route.name} active={active} onPress={onPress} badge={badge} />;
        })}
      </View>
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
  dot: {
    position: 'absolute', top: 7, right: 9, width: 11, height: 11, borderRadius: 5.5,
    backgroundColor: colors.accent, borderWidth: 2, borderColor: colors.cardAlt, zIndex: 2,
  },
  badge: {
    position: 'absolute', top: 1, right: 2, minWidth: 20, height: 20, paddingHorizontal: 4,
    borderRadius: 10, alignItems: 'center', justifyContent: 'center', zIndex: 2,
    borderWidth: 2, borderColor: colors.cardAlt,
  },
  badgeText: { fontFamily: fonts.mono600, fontSize: 9.5 },
  ring: { position: 'absolute', top: 2, left: '50%', marginLeft: -24, width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: colors.accent },
  plus: { position: 'absolute', top: -20, right: 0, fontFamily: fonts.display800, fontSize: 15, color: colors.accent },
});
