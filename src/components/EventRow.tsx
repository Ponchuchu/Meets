import { StyleSheet, Text, View } from 'react-native';
import type { EventItem } from '../data';
import { formatPrice, formatWhen } from '../lib/format';
import { colors, fonts } from '../theme';

const CAT: Record<string, string> = {
  music: 'МУЗЫКА', standup: 'СТЕНДАП', art: 'ВЫСТАВКА', hike: 'ГОРЫ', games: 'НАСТОЛКИ', food: 'ЕДА', sport: 'СПОРТ',
  talks: 'ЛЕКЦИЯ', lecture: 'ЛЕКЦИЯ', theatre: 'ТЕАТР', meetup: 'ВСТРЕЧА', party: 'ВЕЧЕРИНКА', bike: 'ВЕЛО', concert: 'КОНЦЕРТ',
};

export function EventRow({ e }: { e: EventItem }) {
  const hot = e.friendsGoing.length > 0;
  return (
    <View style={styles.row}>
      <View style={styles.meta}>
        <View style={[styles.dot, { backgroundColor: hot ? colors.accent : colors.ink }]} />
        <Text style={styles.label} numberOfLines={1}>{CAT[e.category] ?? e.category.toUpperCase()} · {formatWhen(e.startsAt)}</Text>
        <Text style={styles.price}>{formatPrice(e.priceMin, e.priceMax, e.isFree)}</Text>
      </View>
      <Text style={styles.title}>{e.title}</Text>
      <Text style={styles.address} numberOfLines={1}>{e.address}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 14, marginBottom: 10, gap: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 2 },
  label: { flex: 1, fontFamily: fonts.mono500, fontSize: 11, letterSpacing: 0.8, color: colors.muted },
  price: { fontFamily: fonts.mono600, fontSize: 11, color: colors.ink },
  title: { fontFamily: fonts.display700, fontSize: 19, color: colors.ink, letterSpacing: -0.3 },
  address: { fontFamily: fonts.body400, fontSize: 13.5, color: colors.muted },
});
