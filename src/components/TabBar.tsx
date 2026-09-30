// Таб-бар: плавающая закруглённая капсула в стиле iOS, у активной вкладки — светлая «таблетка». Точка «новое», бейджи.
import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
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

export const TAB_BAR_HEIGHT = 84;

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

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const newPlans = useApp((s) => s.newPlans);
  const freshFeed = useApp((s) => s.freshFeed);
  const { data: requests } = useQuery({ queryKey: ['chatRequests'], queryFn: () => data.getChatRequests() });
  const answered = useChat((s) => s.requests);
  const unread = (requests ?? []).filter((r) => !answered[r.id]).length;
  const activeKey = state.routes[state.index]?.name;

  return (
    <View style={[styles.wrap, { height: TAB_BAR_HEIGHT + Math.max(0, insets.bottom - 20), paddingBottom: Math.max(8, insets.bottom - 12) }]}>
    <View style={styles.bar} accessibilityRole="tablist">
      {state.routes.map((route, i) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const active = state.index === i;
        const color = active ? colors.ink : colors.muted3;
        const onPress = () => {
          const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!active && !e.defaultPrevented) navigation.navigate(route.name);
        };
        return (
          <Pressable key={route.key} onPress={onPress} style={[styles.tab, active && styles.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={tab.label}>
            {route.name === 'foryou' && freshFeed && activeKey !== 'foryou' && (
              <View style={styles.dot} accessibilityLabel="Есть новые карточки" />
            )}
            {route.name === 'chats' && unread > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.accent }]} accessibilityLabel={`${unread} непрочитанных`}>
                <Text style={[styles.badgeText, { color: colors.ink }]}>{unread}</Text>
              </View>
            )}
            {route.name === 'me' && newPlans > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.ink }]} accessibilityLabel={`Новых планов: ${newPlans}`}>
                <Text style={[styles.badgeText, { color: colors.paper }]}>{newPlans}</Text>
              </View>
            )}
            {route.name === 'me' && <PlanPulse />}
            <Icon name={tab.icon} color={color} />
            <Text style={[styles.label, { color, fontFamily: active ? fonts.body600 : fonts.body500 }]} numberOfLines={1} adjustsFontSizeToFit>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.paper, paddingHorizontal: 12, justifyContent: 'flex-end' },
  bar: {
    flexDirection: 'row', height: 64, padding: 5, borderRadius: 32, backgroundColor: colors.cardAlt,
    borderWidth: 1, borderColor: 'rgba(23,22,26,0.06)',
    shadowColor: colors.ink, shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 10,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: 27, position: 'relative' },
  tabOn: { backgroundColor: colors.sand2 },
  label: { fontSize: 10.5, maxWidth: '96%' },
  dot: {
    // 9 px точка + 2 px отбивка цветом paper (в макете box-shadow 0 0 0 2px).
    position: 'absolute', top: 5, left: '50%', marginLeft: 7, width: 13, height: 13, borderRadius: 6.5,
    backgroundColor: colors.accent, borderWidth: 2, borderColor: colors.paper, zIndex: 2,
  },
  badge: {
    position: 'absolute', top: 1, left: '50%', marginLeft: 3, minWidth: 22, height: 22, paddingHorizontal: 5,
    borderRadius: 11, alignItems: 'center', justifyContent: 'center', zIndex: 2,
    borderWidth: 2, borderColor: colors.cardAlt,
  },
  badgeText: { fontFamily: fonts.mono600, fontSize: 10 },
  ring: { position: 'absolute', top: 4, left: '50%', marginLeft: -24, width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: colors.accent },
  plus: { position: 'absolute', top: -18, left: '50%', marginLeft: 9, fontFamily: fonts.display800, fontSize: 15, color: colors.accent },
});
