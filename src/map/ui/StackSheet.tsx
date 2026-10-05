// Несколько событий в одной точке (кинотеатр в ТРЦ, площадка с программой): карточки по датам — «1 октября», время, название.
// Тап по карточке сразу раскрывает событие.
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { EventItem } from '../../data/types';
import { almaty, dayIndex } from '../../lib/clock';
import { formatPrice } from '../../lib/format';
import { colors, fonts } from '../../theme';
import { Ic } from '../../ui/Ic';
import { CAT_COLOR, CAT_ICON, catFg } from '../icons';

const MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

/** «1 октября» — дата без «завтра» и дня недели. */
export function dayMonth(iso: string): string {
  const d = almaty(iso);
  return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
}

const hm = (iso: string) => {
  const d = almaty(iso);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
};

export function StackSheet({ events, now, onPick }: { events: EventItem[]; now: Date; onPick: (e: EventItem) => void }) {
  const today = dayIndex(now);
  const place = events[0]?.venueName ?? events[0]?.address.split(',')[0] ?? '';
  const list = [...events].sort((a, b) => Date.parse(a.startsAt)-Date.parse(b.startsAt));
  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.h1} numberOfLines={1} accessibilityRole="header">{place}</Text>
      <ScrollView style={{ maxHeight: 440 }} contentContainerStyle={{ gap: 8 }}>
        {list.map((e, i) => {
          // Длинное событие, которое уже идёт, показываем сегодняшним днём.
          const iso = dayIndex(e.startsAt) < today ? now.toISOString() : e.startsAt;
          const d = almaty(iso);
          return (
            <Animated.View key={e.id} entering={FadeInDown.delay(i * 40).duration(220)}>
              <Pressable onPress={() => onPick(e)} style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.98 }] }]}
                accessibilityRole="button" accessibilityLabel={`${e.title}, ${dayMonth(iso)}, ${e.isLong ? 'весь день' : hm(e.startsAt)}`}>
                <View style={styles.date}>
                  <Text style={styles.day}>{d.getUTCDate()}</Text>
                  <Text style={styles.mon}>{MON[d.getUTCMonth()].slice(0, 3)}</Text>
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.title} numberOfLines={2}>{e.title}</Text>
                  <Text style={styles.sub}>{e.isLong ? 'весь день' : hm(e.startsAt)} · {formatPrice(e.priceMin, e.priceMax, e.isFree)}</Text>
                </View>
                <View style={[styles.icon, { backgroundColor: CAT_COLOR[e.category] }]}><Ic d={CAT_ICON[e.category]} size={18} color={catFg(e.category)} w={2} /></View>
              </Pressable>
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: fonts.display700, fontSize: 22, color: colors.ink, letterSpacing: -0.3 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, paddingRight: 12, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  date: { width: 54, height: 58, borderRadius: 14, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  day: { fontFamily: fonts.display700, fontSize: 22, lineHeight: 24, color: colors.paper },
  mon: { fontFamily: fonts.mono600, fontSize: 10, letterSpacing: 0.5, color: '#CFCAC0' },
  title: { fontFamily: fonts.body700, fontSize: 15, color: colors.ink },
  sub: { fontFamily: fonts.mono500, fontSize: 11.5, color: colors.muted2 },
  icon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
