// ТРЦ — design/png/V6Venue.png: название, адрес, часы, события внутри и сеансы кино (если есть в базе).
import { useQuery } from '@tanstack/react-query';
import { Building2 } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { EventItem } from '../../data/types';
import { almaty } from '../../lib/clock';
import { getSessions, type Mall } from '../../live/api';
import { colors, fonts } from '../../theme';

const hm = (iso: string) => { const d = almaty(iso); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };

export function MallPin({ m, onPress }: { m: Mall; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.pin} accessibilityRole="button" accessibilityLabel={`ТРЦ ${m.name}`} hitSlop={6}>
      <Building2 size={16} color={colors.paper} strokeWidth={1.9} />
    </Pressable>
  );
}

export function VenueSheet({ m, events, onEvent }: { m: Mall; events: EventItem[]; onEvent: (e: EventItem) => void }) {
  const { data: sessions = [] } = useQuery({ queryKey: ['sessions', m.id], queryFn: () => getSessions(m.id) });
  const inside = events.filter((e) => e.venueName && e.venueName.toLowerCase() === m.name.toLowerCase());
  return (
    <View style={{ gap: 12 }}>
      <View>
        <Text style={styles.title} accessibilityRole="header">{m.name}</Text>
        <Text style={styles.sub}>{[m.address, m.hours].filter(Boolean).join(' · ')}</Text>
      </View>
      {inside.length > 0 && <Text style={styles.cap}>СОБЫТИЯ</Text>}
      {inside.slice(0, 6).map((e) => (
        <Pressable key={e.id} onPress={() => onEvent(e)} style={styles.row} accessibilityRole="button">
          <Text style={styles.time}>{hm(e.startsAt)}</Text>
          <Text style={styles.name} numberOfLines={1}>{e.title}</Text>
        </Pressable>
      ))}
      {sessions.length > 0 && <Text style={styles.cap}>КИНО</Text>}
      {sessions.slice(0, 8).map((s) => (
        <View key={s.id} style={styles.row}>
          <Text style={styles.time}>{hm(s.starts_at)}</Text>
          <Text style={styles.name} numberOfLines={1}>{s.title}{s.format ? ` · ${s.format}` : ''}</Text>
        </View>
      ))}
      {!inside.length && !sessions.length && <Text style={styles.sub}>Пока нет событий и сеансов в базе.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  pin: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.friend, borderWidth: 2.5, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.display800, fontSize: 24, letterSpacing: -0.6, color: colors.ink },
  sub: { fontFamily: fonts.body400, fontSize: 14, color: colors.muted },
  cap: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.8, color: colors.muted, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, borderBottomWidth: 1, borderBottomColor: '#ECE7DC' },
  time: { fontFamily: fonts.mono600, fontSize: 14, color: colors.ink, width: 50 },
  name: { flex: 1, fontFamily: fonts.body600, fontSize: 15, color: colors.ink },
});
