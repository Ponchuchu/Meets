// Карточка места (ТРЦ) — design/png/V6Venue.png: значок, название, адрес и часы, события внутри и сеансы кино (если есть в базе).
import { useQuery } from '@tanstack/react-query';
import { Clock, MapPin, ShoppingBag, X } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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

/** Значок ТРЦ: цветная плитка с сумкой, стеклянная кромка, имя подписью и число событий. */
export function MallPin({ m, onPress, events = 0 }: { m: Mall; onPress: () => void; events?: number }) {
  const look = mallLook(m.name);
  return (
    <Pressable onPress={onPress} style={styles.mall} accessibilityRole="button" accessibilityLabel={`ТРЦ ${m.name}${events ? `, событий: ${events}` : ''}`} hitSlop={6}>
      <View style={[styles.pin, { backgroundColor: look.color }]}>
        <ShoppingBag size={18} color="#FFFFFF" strokeWidth={2} />
        {events > 0 && <View style={styles.count}><Text style={styles.countText}>{events > 9 ? '9+' : events}</Text></View>}
      </View>
      <View style={styles.label}><Text style={styles.labelText} numberOfLines={1}>{look.short}</Text></View>
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
        <View style={[styles.logo, { backgroundColor: mallLook(m.name).color }]}><ShoppingBag size={24} color={colors.paper} strokeWidth={1.8} /></View>
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
      {inside.length > 0 && <Text style={styles.cap}>СОБЫТИЯ</Text>}
      {inside.slice(0, onClose ? 5 : 10).map((e) => (
        <Pressable key={e.id} onPress={() => onEvent(e)} style={styles.row} accessibilityRole="button">
          <Text style={styles.time}>{dayHm(e.startsAt)}</Text>
          <Text style={styles.name} numberOfLines={1}>{e.title}</Text>
        </Pressable>
      ))}
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
  mall: { alignItems: 'center', gap: 3, width: 72 },
  pin: { width: 38, height: 38, borderRadius: 13, borderWidth: 2.5, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.45), 0 6px 14px -4px rgba(23,22,26,0.45)' },
  count: { position: 'absolute', top: -7, right: -9, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.accent, borderWidth: 1.5, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  countText: { fontFamily: fonts.mono600, fontSize: 9.5, color: colors.ink },
  label: { maxWidth: 72, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(252,251,248,0.92)', borderWidth: 1, borderColor: 'rgba(23,22,26,0.08)' },
  labelText: { fontFamily: fonts.body700, fontSize: 9.5, color: colors.ink },
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
