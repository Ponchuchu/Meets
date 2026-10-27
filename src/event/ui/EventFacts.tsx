import { Clock, Ticket } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import type { EventItem } from '../../data/types';
import { formatPrice } from '../../lib/format';
import { colors, fonts } from '../../theme';
import { whenTitle } from '../text';

/** Shared by the opening preview and the page so the first rows do not change mid-transition. */
export function EventFacts({ e, now }: { e: EventItem; now: Date }) {
  const price = formatPrice(e.priceMin, e.priceMax, e.isFree);
  const toStart = Date.parse(e.startsAt) - now.getTime();
  const end = e.endsAt ? Date.parse(e.endsAt) : Date.parse(e.startsAt) + 2 * 3600e3;
  const soon = toStart > 0 && toStart < 24 * 3600e3
    ? `через ${toStart >= 3600e3 ? `${Math.floor(toStart / 3600e3)} ч ` : ''}${Math.max(1, Math.round((toStart % 3600e3) / 60000))} мин`
    : toStart <= 0 && now.getTime() < end ? 'уже идёт' : null;
  return <View style={styles.facts}>
    <View style={styles.row}>
      <View style={styles.icon}><Clock size={19} color={colors.ink} strokeWidth={1.9} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.main} numberOfLines={2}>{whenTitle(e, now)}</Text>
        {!!soon && <Text style={styles.sub}>{soon}</Text>}
      </View>
    </View>
    <View style={styles.line} />
    <View style={styles.row}>
      <View style={styles.icon}><Ticket size={19} color={colors.ink} strokeWidth={1.9} /></View>
      <Text style={[styles.main, { flex: 1 }, !price && { color: colors.muted3 }]} numberOfLines={1}>
        {price ? (e.isFree || e.priceMin === 0 ? 'Бесплатно' : price.replace(/^ОТ/, 'от')) : 'Цена не указана'}
      </Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  facts: { borderRadius: 22, backgroundColor: '#FBFAF6', paddingHorizontal: 12, paddingVertical: 4, boxShadow: '0 10px 22px -18px rgba(23,22,26,0.6)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8 },
  icon: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  main: { fontFamily: fonts.body700, fontSize: 16, lineHeight: 21, color: colors.ink },
  sub: { fontFamily: fonts.body600, fontSize: 13, marginTop: 1, color: colors.accentText },
  line: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line2, marginLeft: 50 },
});
