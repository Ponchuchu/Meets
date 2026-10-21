// Карточка места (ТРЦ) — design/png/V6Venue.png: значок, название, адрес и часы, события внутри и сеансы кино (если есть в базе).
import { useQuery } from '@tanstack/react-query';
import { Building2, Clock, MapPin, X } from 'lucide-react-native';
import { useEffect } from 'react';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CAT_COLOR, CAT_ICON, catFg } from '../icons';
import { EventCover } from '../../ui/EventCover';
import { Ic } from '../../ui/Ic';
import { useEco } from '../../state/perf';
import type { EventItem } from '../../data/types';
import { almaty } from '../../lib/clock';
import { getSessions, type Mall } from '../../live/api';
import { distM } from '../../live/geo';
import { config } from '../../lib/config';
import { colors, fonts, radii, space } from '../../theme';
import { StateView } from '../../ui/StateView';
import { glass } from '../../ui/glass';
import { useBackClose } from '../../state/app';
import Animated, { cancelAnimation, Easing, SlideInDown, SlideOutDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

/** Событие «в этом центре»: точка в пределах 350 м от центра или название площадки содержит имя центра. */
export function insideMall(m: Mall, events: EventItem[]): EventItem[] {
  const name = m.name.toLowerCase();
  return events
    .filter((e) => (!e.noPoint && !e.needsPin && distM(e, m) <= 350) || (!!e.venueName && e.venueName.toLowerCase().includes(name)))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
const dayHm = (iso: string) => { const d = almaty(iso); const n = almaty(new Date().toISOString()); const same = d.getUTCDate() === n.getUTCDate() && d.getUTCMonth() === n.getUTCMonth(); return `${same ? '' : `${d.getUTCDate()}.${String(d.getUTCMonth() + 1).padStart(2, '0')} `}${hm(iso)}`; };
const hm = (iso: string) => { const d = almaty(iso); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };

/** Цвет и короткое имя ТРЦ на карте (FIX3): свой цвет у каждого центра, без чужих логотипов. */
const MALL_LOOK: [RegExp, string, string][] = [
  [/dostyk/i, '#1F8A8A', 'Dostyk Plaza'], [/esentai/i, '#2B2620', 'Esentai'], [/aport.*east/i, '#2F8F5B', 'Aport East'],
  [/aport/i, '#3E7E4E', 'Aport West'], [/mega park/i, '#C8372D', 'MEGA Park'], [/mega/i, '#B32F27', 'MEGA'],
];
export const mallLook = (name: string): { color: string; short: string } => {
  const hit = MALL_LOOK.find(([re]) => re.test(name));
  return { color: hit?.[1] ?? colors.friend, short: hit?.[2] ?? name };
};

/** Оттенок цвета: k > 0 — светлее, k < 0 — темнее. Для граней здания. */
function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k));
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

/** Значок ТРЦ (21 окт.): маленькое объёмное здание висит над местом центра и мягко покачивается, под ним — тень.
 *  Грани своего цвета у каждого центра, окна-полосы и стеклянный блик; число событий — на крыше. */
export function MallPin({ m, onPress, events = 0 }: { m: Mall; onPress: () => void; events?: number }) {
  const look = mallLook(m.name);
  const eco = useEco();
  const lift = useSharedValue(0);
  useEffect(() => {
    if (eco) return;
    // Несколько покачиваний при появлении и замирает в воздухе: бесконечная анимация на карте греет телефон.
    lift.set(withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }), 5, true));
    return () => cancelAnimation(lift);
  }, [eco, lift]);
  const float = useAnimatedStyle(() => ({ transform: [{ translateY: -4 * lift.get() }] }));
  const shadow = useAnimatedStyle(() => ({ transform: [{ scaleX: 1 - 0.18 * lift.get() }], opacity: 0.32 - 0.1 * lift.get() }));
  const top = shade(look.color, 0.35), left = shade(look.color, 0.05), right = shade(look.color, -0.3);
  return (
    <Pressable onPress={onPress} style={styles.mall} accessibilityRole="button" accessibilityLabel={`ТРЦ ${m.name}${events ? `, событий: ${events}` : ''}`} hitSlop={6}>
      <Animated.View style={[styles.mallShadow, shadow]} />
      <Animated.View style={float}>
        <Svg width={46} height={54} viewBox="0 0 46 54">
          <Defs>
            <LinearGradient id={`g-${m.id}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.55} />
              <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {/* Корпус: крыша, левая и правая грани (изометрия). */}
          <Path d="M23 4 L42 13 L23 22 L4 13 Z" fill={top} />
          <Path d="M4 13 L23 22 L23 50 L4 41 Z" fill={left} />
          <Path d="M23 22 L42 13 L42 41 L23 50 Z" fill={right} />
          {/* Окна-полосы. */}
          {[0, 1, 2, 3].map(i => <Path key={`l${i}`} d={`M7 ${20 + i * 6} L20 ${26 + i * 6}`} stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={1.6} strokeLinecap="round" />)}
          {[0, 1, 2, 3].map(i => <Path key={`r${i}`} d={`M26 ${26 + i * 6} L39 ${20 + i * 6}`} stroke="#FFFFFF" strokeOpacity={0.28} strokeWidth={1.6} strokeLinecap="round" />)}
          <Path d="M4 13 L23 22 L23 50 L4 41 Z" fill={`url(#g-${m.id})`} />
          <Path d="M23 4 L42 13 L23 22 L4 13 Z M4 13 L4 41 L23 50 L42 41 L42 13 M23 22 L23 50" fill="none" stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth={1} strokeLinejoin="round" />
        </Svg>
        {events > 0 && <View style={styles.count}><Text style={styles.countText}>{events > 9 ? '9+' : events}</Text></View>}
      </Animated.View>
    </Pressable>
  );
}

/** Плавающая карточка места над нижней панелью (референс «Айналма»): карта остаётся живой, крестик — закрыть. */
export function PlaceCard({ m, events, onEvent, onClose }: { m: Mall; events: EventItem[]; onEvent: (e: EventItem) => void; onClose: () => void }) {
  useBackClose(onClose);
  return (
    <Animated.View entering={SlideInDown.duration(260)} exiting={SlideOutDown.duration(200)} style={[styles.card, glass]} accessibilityLabel={`Место: ${m.name}`}>
      <VenueSheet m={m} events={events} onEvent={onEvent} onClose={onClose} />
    </Animated.View>
  );
}

export function VenueSheet({ m, events, onEvent, onClose }: { m: Mall; events: EventItem[]; onEvent: (e: EventItem) => void; onClose?: () => void }) {
  const q = useQuery({ queryKey: ['sessions', m.id], queryFn: () => getSessions(m.id), enabled: config.dataMode !== 'demo' });
  const sessions = q.data ?? [];
  const inside = insideMall(m, events);
  return (
    <View style={{ gap: space.m }}>
      <View style={styles.head}>
        <View style={[styles.logo, { backgroundColor: mallLook(m.name).color }]}><Building2 size={26} color={colors.paper} strokeWidth={1.8} /></View>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>{m.name}</Text>
          {!!m.address && <View style={styles.meta}><MapPin size={14} color={colors.muted} strokeWidth={1.9} /><Text style={styles.sub} numberOfLines={2}>{m.address}</Text></View>}
          {!!m.hours && <View style={styles.meta}><Clock size={14} color={colors.muted} strokeWidth={1.9} /><Text style={styles.sub} numberOfLines={1}>{m.hours}</Text></View>}
        </View>
        {onClose && (
          <Pressable onPress={onClose} hitSlop={8} style={styles.close} accessibilityRole="button" accessibilityLabel="Закрыть карточку места">
            <X size={22} color={colors.ink} strokeWidth={2} />
          </Pressable>
        )}
      </View>
      {inside.length > 0 && <Text style={styles.cap}>СОБЫТИЯ ВНУТРИ · {inside.length}</Text>}
      {inside.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 4 }} style={{ marginHorizontal: -2 }}>
          {inside.slice(0, onClose ? 8 : 16).map((e) => (
            <Pressable key={e.id} onPress={() => onEvent(e)} style={({ pressed }) => [styles.tile, pressed && { transform: [{ scale: 0.97 }] }]} accessibilityRole="button" accessibilityLabel={`${e.title}, ${dayHm(e.startsAt)}`}>
              <EventCover cover={e.cover} category={e.category} color={e.coverColor} style={styles.tileCover} iconSize={46} />
              <View style={styles.tileShade} />
              <View style={styles.tileWhen}><Text style={styles.tileWhenText}>{dayHm(e.startsAt)}</Text></View>
              <View style={styles.tileBody}>
                <View style={[styles.tileCat, { backgroundColor: CAT_COLOR[e.category] }]}><Ic d={CAT_ICON[e.category]} size={12} color={catFg(e.category)} w={2.2} /></View>
                <Text style={styles.tileTitle} numberOfLines={2}>{e.title}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
      {sessions.length > 0 && <Text style={styles.cap}>КИНО</Text>}
      {sessions.slice(0, onClose ? 4 : 8).map((s) => (
        <View key={s.id} style={styles.row}>
          <Text style={styles.time}>{hm(s.starts_at)}</Text>
          <Text style={styles.name} numberOfLines={1}>{s.title}{s.format ? ` · ${s.format}` : ''}</Text>
        </View>
      ))}
      {!inside.length && !sessions.length && (q.isLoading ? <StateView kind="loading" compact title="Загружаю сеансы…" />
        : q.isError ? <StateView kind="error" compact text="Сеансы не загрузились." onAction={() => void q.refetch()} />
        : <StateView kind="empty" compact title="Пока нет событий и сеансов" text="Как только появятся — покажу здесь." />)}
    </View>
  );
}

const styles = StyleSheet.create({
  mall: { alignItems: 'center', justifyContent: 'flex-end', width: 64, height: 70 },
  mallShadow: { position: 'absolute', bottom: 2, width: 34, height: 9, borderRadius: 5, backgroundColor: '#17161A' },
  count: { position: 'absolute', top: -4, right: -6, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.accent, borderWidth: 1.5, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  countText: { fontFamily: fonts.mono600, fontSize: 9.5, color: colors.ink },
  tile: { width: 148, height: 168, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.sand },
  tileCover: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  tileShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 96, backgroundColor: 'rgba(23,22,26,0.55)' },
  tileWhen: { position: 'absolute', top: 8, left: 8, paddingHorizontal: 8, height: 24, borderRadius: 12, backgroundColor: 'rgba(252,251,248,0.94)', justifyContent: 'center' },
  tileWhenText: { fontFamily: fonts.mono600, fontSize: 11, color: colors.ink },
  tileBody: { position: 'absolute', left: 10, right: 10, bottom: 10, gap: 6 },
  tileCat: { width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  tileTitle: { fontFamily: fonts.display700, fontSize: 14.5, lineHeight: 17, color: '#FFFFFF' },
  card: { borderRadius: radii.xl, padding: space.l, paddingTop: space.l },
  close: { width: 44, height: 44, borderRadius: 22, marginTop: -6, marginRight: -8, alignItems: 'center', justifyContent: 'center' },
  head: { flexDirection: 'row', gap: space.m, alignItems: 'flex-start' },
  logo: { width: 52, height: 52, borderRadius: radii.md, backgroundColor: colors.friend, alignItems: 'center', justifyContent: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontFamily: fonts.display800, fontSize: 22, lineHeight: 26, letterSpacing: -0.5, color: colors.ink },
  sub: { flexShrink: 1, fontFamily: fonts.body400, fontSize: 14, color: colors.muted },
  cap: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.8, color: colors.muted, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, borderBottomWidth: 1, borderBottomColor: '#D9D3C5' },
  time: { fontFamily: fonts.mono600, fontSize: 13, color: colors.ink, minWidth: 50 },
  name: { flex: 1, fontFamily: fonts.body600, fontSize: 15, color: colors.ink },
});
