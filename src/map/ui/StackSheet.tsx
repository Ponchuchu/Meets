// Несколько событий в одной точке (кинотеатр в ТРЦ, площадка с программой): список по дням — выбираешь дату и событие.
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { EventItem } from '../../data/types';
import { almaty, dayIndex } from '../../lib/clock';
import { formatPrice } from '../../lib/format';
import { colors, fonts } from '../../theme';
import { Ic } from '../../ui/Ic';
import { CAT_COLOR, CAT_ICON, catFg } from '../icons';

const WD = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];
const MON = ['ЯНВ', 'ФЕВ', 'МАР', 'АПР', 'МАЯ', 'ИЮН', 'ИЮЛ', 'АВГ', 'СЕН', 'ОКТ', 'НОЯ', 'ДЕК'];

function dayTitle(iso: string, today: number): string {
  const d = almaty(iso);
  const i = dayIndex(iso);
  const base = `${WD[d.getUTCDay()]}, ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
  return i === today ? `СЕГОДНЯ · ${base}` : i === today + 1 ? `ЗАВТРА · ${base}` : base;
}

const hm = (iso: string) => {
  const d = almaty(iso);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
};

export function StackSheet({ events, now, onPick }: { events: EventItem[]; now: Date; onPick: (e: EventItem) => void }) {
  const today = dayIndex(now);
  const days = new Map<number, EventItem[]>();
  for (const e of events) {
    const k = Math.max(today, dayIndex(e.startsAt));
    days.set(k, [...(days.get(k) ?? []), e]);
  }
  const place = events[0]?.venueName ?? events[0]?.address ?? '';
  return (
    <View style={{ gap: 12 }}>
      <View>
        <Text style={styles.h1} numberOfLines={1}>{place}</Text>
        <Text style={styles.sub}>{events.length} {events.length < 5 ? 'события' : 'событий'} в этом месте</Text>
      </View>
      <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 14 }}>
        {[...days.entries()].sort((a, b) => a[0] - b[0]).map(([d, list]) => (
          <View key={d} style={{ gap: 6 }}>
            <Text style={styles.day}>{dayTitle(list[0].startsAt < now.toISOString() ? now.toISOString() : list[0].startsAt, today)}</Text>
            {list.map((e) => (
              <Pressable key={e.id} onPress={() => onPick(e)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.sand2 }]} accessibilityRole="button" accessibilityLabel={`${e.title}, ${hm(e.startsAt)}`}>
                <View style={[styles.icon, { backgroundColor: CAT_COLOR[e.category] }]}><Ic d={CAT_ICON[e.category]} size={18} color={catFg(e.category)} w={2} /></View>
                <Text style={styles.time}>{e.isLong ? 'весь день' : hm(e.startsAt)}</Text>
                <Text style={styles.title} numberOfLines={2}>{e.title}</Text>
                <Text style={styles.price}>{formatPrice(e.priceMin, e.priceMax, e.isFree)}</Text>
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: fonts.display700, fontSize: 22, color: colors.ink, letterSpacing: -0.3 },
  sub: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted2 },
  day: { fontFamily: fonts.mono600, fontSize: 11, letterSpacing: 0.6, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 10, borderRadius: 14, backgroundColor: colors.card },
  icon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  time: { width: 64, fontFamily: fonts.mono600, fontSize: 12, color: colors.ink },
  title: { flex: 1, fontFamily: fonts.body600, fontSize: 14.5, color: colors.ink },
  price: { fontFamily: fonts.mono500, fontSize: 11, color: colors.muted2 },
});
