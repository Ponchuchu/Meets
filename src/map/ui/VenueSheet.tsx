// Карточка места (ТРЦ) — design/png/V6Venue.png: значок, название, адрес и часы, события внутри и сеансы кино (если есть в базе).
import { useQuery } from '@tanstack/react-query';
import { Building2, Clock, MapPin, X } from 'lucide-react-native';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { KIND_COLOR, KIND_LABEL, type Attraction } from '../../data/attractions';
import { remote } from '../../data/photos';
import { AttractionPin } from './AttractionPin';
import { CAT_COLOR, CAT_ICON, catFg } from '../icons';
import { EventCover } from '../../ui/EventCover';
import { Ic } from '../../ui/Ic';
import type { EventItem } from '../../data/types';
import { almaty } from '../../lib/clock';
import { getSessions, type Mall } from '../../live/api';
import { distM } from '../../live/geo';
import { config } from '../../lib/config';
import { colors, fonts, radii, space } from '../../theme';
import { StateView } from '../../ui/StateView';
import { glass } from '../../ui/glass';
import { useBackClose } from '../../state/app';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';

/** Событие «в этом центре»: точка в пределах 350 м от центра или название площадки содержит имя центра. */
export function insideMall(m: Mall, events: EventItem[]): EventItem[] {
  const name = m.name.toLowerCase();
  return events
    .filter((e) => (!e.noPoint && !e.needsPin && distM(e, m) <= 350) || (!!e.venueName && e.venueName.toLowerCase().includes(name)))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
/** Постоянные места в этом центре: явно привязанные (mall) или стоящие в пределах 250 м от его точки. */
export function spotsInMall(m: Mall, spots: Attraction[]): Attraction[] {
  const name = m.name.toLowerCase();
  return spots.filter((a) => !a.parent && ((a.mall && (a.mall.toLowerCase() === name || name.includes(a.mall.toLowerCase()) || a.mall.toLowerCase().includes(name))) || distM(a, m) <= 250));
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

/** Плавающая карточка места над нижней панелью (референс «Айналма»): карта остаётся живой, крестик — закрыть. */
export function PlaceCard({ m, events, spots = [], onEvent, onSpot, onClose }: { m: Mall; events: EventItem[]; spots?: Attraction[]; onEvent: (e: EventItem) => void; onSpot?: (a: Attraction) => void; onClose: () => void }) {
  useBackClose(onClose);
  return (
    <Animated.View entering={SlideInDown.duration(260)} exiting={SlideOutDown.duration(200)} style={[styles.card, glass]} accessibilityLabel={`Место: ${m.name}`}>
      <VenueSheet m={m} events={events} spots={spots} onEvent={onEvent} onSpot={onSpot} onClose={onClose} />
    </Animated.View>
  );
}

export function VenueSheet({ m, events, spots = [], onEvent, onSpot, onClose }: { m: Mall; events: EventItem[]; spots?: Attraction[]; onEvent: (e: EventItem) => void; onSpot?: (a: Attraction) => void; onClose?: () => void }) {
  const q = useQuery({ queryKey: ['sessions', m.id], queryFn: () => getSessions(m.id), enabled: config.dataMode !== 'demo' });
  const sessions = q.data ?? [];
  const inside = insideMall(m, events);
  // Что есть в центре постоянно (26 окт.): аквапарк в Aport Mall West, батуты в MEGA, боулинг в Forum — с фото.
  const fun = spotsInMall(m, spots);
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
      {fun.length > 0 && <Text style={styles.cap}>РАЗВЛЕЧЕНИЯ ВНУТРИ</Text>}
      {fun.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 4 }} style={{ marginHorizontal: -2 }}>
          {fun.map((a) => (
            <Pressable key={a.id} onPress={() => onSpot?.(a)} style={({ pressed }) => [styles.tile, { backgroundColor: KIND_COLOR[a.kind] }, pressed && { transform: [{ scale: 0.97 }] }]} accessibilityRole="button" accessibilityLabel={`${a.name}, ${KIND_LABEL[a.kind]}`}>
              {a.photos?.[0] ? <Image source={remote(a.photos[0])} style={styles.tileCover} resizeMode="cover" accessibilityIgnoresInvertColors />
                : <View style={[styles.tileCover, { alignItems: 'center', justifyContent: 'center', paddingBottom: 50 }]}><AttractionPin a={a} label={false} onPress={() => undefined} /></View>}
              <View style={styles.tileShade} />
              {!!a.priceFrom && <View style={styles.tileWhen}><Text style={styles.tileWhenText}>от {a.priceFrom.toLocaleString('ru-RU')} ₸</Text></View>}
              <View style={styles.tileBody}>
                <Text style={styles.tileKind}>{KIND_LABEL[a.kind].toUpperCase()}</Text>
                <Text style={styles.tileTitle} numberOfLines={2}>{a.name}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
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
      {!inside.length && !sessions.length && !fun.length && (q.isLoading ? <StateView kind="loading" compact title="Загружаю сеансы…" />
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
  tileKind: { fontFamily: fonts.mono600, fontSize: 9.5, letterSpacing: 0.6, color: 'rgba(255,255,255,0.85)' },
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
