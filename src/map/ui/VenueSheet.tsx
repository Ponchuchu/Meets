// Карточка места (ТРЦ) — design/png/V6Venue.png: значок, название, адрес и часы, события внутри и сеансы кино (если есть в базе).
import { useQuery } from '@tanstack/react-query';
import { Building2, Clock, MapPin, X } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { EventItem } from '../../data/types';
import { almaty } from '../../lib/clock';
import { getSessions, type Mall } from '../../live/api';
import { config } from '../../lib/config';
import { colors, fonts, radii, space } from '../../theme';
import { StateView } from '../../ui/StateView';
import { glass } from '../../ui/glass';
import { useBackClose } from '../../state/app';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';

const hm = (iso: string) => { const d = almaty(iso); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };

export function MallPin({ m, onPress }: { m: Mall; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.pin} accessibilityRole="button" accessibilityLabel={`ТРЦ ${m.name}`} hitSlop={6}>
      <Building2 size={16} color={colors.paper} strokeWidth={1.9} />
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
  const inside = events.filter((e) => e.venueName && e.venueName.toLowerCase() === m.name.toLowerCase());
  return (
    <View style={{ gap: space.m }}>
      <View style={styles.head}>
        <View style={styles.logo}><Building2 size={24} color={colors.paper} strokeWidth={1.8} /></View>
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
      {inside.slice(0, onClose ? 3 : 6).map((e) => (
        <Pressable key={e.id} onPress={() => onEvent(e)} style={styles.row} accessibilityRole="button">
          <Text style={styles.time}>{hm(e.startsAt)}</Text>
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
  pin: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.friend, borderWidth: 2.5, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: radii.xl, padding: space.l, paddingTop: space.l },
  close: { width: 44, height: 44, borderRadius: 22, marginTop: -6, marginRight: -8, alignItems: 'center', justifyContent: 'center' },
  head: { flexDirection: 'row', gap: space.m, alignItems: 'flex-start' },
  logo: { width: 52, height: 52, borderRadius: radii.md, backgroundColor: colors.friend, alignItems: 'center', justifyContent: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontFamily: fonts.display800, fontSize: 22, lineHeight: 26, letterSpacing: -0.5, color: colors.ink },
  sub: { flexShrink: 1, fontFamily: fonts.body400, fontSize: 14, color: colors.muted },
  cap: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.8, color: colors.muted, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, borderBottomWidth: 1, borderBottomColor: '#D9D3C5' },
  time: { fontFamily: fonts.mono600, fontSize: 14, color: colors.ink, width: 50 },
  name: { flex: 1, fontFamily: fonts.body600, fontSize: 15, color: colors.ink },
});
