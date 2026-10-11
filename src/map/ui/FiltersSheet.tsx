// Фильтры v6 — design/png/V6Filters.png, V6FiltersDate.png. По умолчанию — неделя; «Ближайшее время» (24 ч) тумблером или дни в календаре,
// разделы лентой, цена ступенями, «Только бесплатное». Внизу — «Показать N событий».
import { Bike, Clock, Dices, Drama, Image as ImageIcon, Mic, Mountain, Music, PartyPopper, Presentation, Utensils, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { EventItem } from '../../data/types';
import { almaty, dayIndex } from '../../lib/clock';
import { colors, fonts } from '../../theme';
import { Ic } from '../../ui/Ic';
import { Toggle as Switch } from '../../ui/v6/Settings';
import { FILTER_CATS, MAX_PRICE, occursOnDay, PRICE_STOPS, WEEK_TO, type FilterCat, type MapFilters } from '../filters';

const ICON: Record<FilterCat, LucideIcon> = {
  music: Music, standup: Mic, theatre: Drama, art: ImageIcon, hike: Mountain, party: PartyPopper, sport: Bike, games: Dices, food: Utensils, talks: Presentation,
};
const STOP_LABEL = ['до 5 тыс', 'до 20 тыс', 'до 50 тыс', 'любая'];
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const WD = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const fmt = (v: number) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** Месяц по смещению от текущего: дни как смещения от сегодня, с пустыми клетками до понедельника. */
function monthGrid(now: Date, shift: number) {
  const a = almaty(now);
  const y = a.getUTCFullYear();
  const m = a.getUTCMonth() + shift;
  const first = new Date(Date.UTC(y, m, 1));
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const today = dayIndex(now);
  const firstIdx = dayIndex(new Date(first.getTime() - 5 * 3600e3 + 12 * 3600e3));
  return {
    title: `${MONTHS[first.getUTCMonth()]} ${first.getUTCFullYear()}`,
    cells: [...Array.from({ length: lead }, () => null), ...Array.from({ length: days }, (_, i) => ({ day: i + 1, offset: firstIdx + i - today }))],
  };
}

/** Клетки месяца по неделям, последняя неделя добита пустыми — в каждой строке ровно 7. */
function weeks<T>(cells: (T | null)[]): (T | null)[][] {
  const out: (T | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
  const last = out[out.length - 1];
  while (last && last.length < 7) last.push(null);
  return out;
}

function Calendar({ now, events, f, set }: { now: Date; events: EventItem[]; f: MapFilters; set: (p: Partial<MapFilters>) => void }) {
  const [shift, setShift] = useState(0);
  const [pending, setPending] = useState(false);
  const g = monthGrid(now, shift);
  const today = dayIndex(now);
  const pick = (d: number) => {
    if (!pending || d < f.from) { set({ from: d, to: d }); setPending(true); } else { set({ to: d }); setPending(false); }
  };
  return (
    <View style={styles.cal}>
      <View style={styles.calHead}>
        <Text style={styles.calTitle}>{g.title}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable disabled={shift === 0} onPress={() => setShift(shift - 1)} style={[styles.arrow, shift === 0 && { opacity: 0.35 }]} accessibilityRole="button" accessibilityLabel="Предыдущий месяц">
            <Ic d="M15 6l-6 6 6 6" size={18} color={colors.ink} w={2.2} />
          </Pressable>
          <Pressable disabled={shift >= 5} onPress={() => setShift(shift + 1)} style={[styles.arrow, shift >= 5 && { opacity: 0.35 }]} accessibilityRole="button" accessibilityLabel="Следующий месяц">
            <Ic d="M9 6l6 6-6 6" size={18} color={colors.ink} w={2.2} />
          </Pressable>
        </View>
      </View>
      <View style={styles.wdRow}>{WD.map((w) => <Text key={w} style={styles.wd}>{w}</Text>)}</View>
      {/* 7 колонок через flex: 1 — без процентов, иначе на Android «вс» уезжает на новую строку (FIX1 И2 п.11). */}
      {weeks(g.cells).map((week, wi) => (
        <View key={wi} style={styles.week}>
          {week.map((c, i) => {
            if (!c) return <View key={`e${i}`} style={styles.cell} />;
            const past = c.offset < 0;
            const on = !past && c.offset >= f.from && c.offset <= f.to;
            const start = on && c.offset === f.from;
            const end = on && c.offset === f.to;
            const has = !past && events.some((e) => occursOnDay(e, today + c.offset));
            return (
              <Pressable key={c.day} disabled={past} onPress={() => pick(c.offset)} style={styles.cell}
                accessibilityRole="button" accessibilityState={{ selected: on, disabled: past }} accessibilityLabel={`${c.day} ${g.title}`}>
                {on && <View style={[styles.strip, start && styles.stripStart, end && styles.stripEnd, (start || end) && styles.stripEdge]} />}
                <Text style={[styles.dayText, past && { color: '#B5AFA3' }, (start || end) && { fontFamily: fonts.body700 }]}>{c.day}</Text>
                {has && <View style={[styles.dot, (start || end) && { backgroundColor: colors.ink }]} />}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export function FiltersSheet({ f, set, reset, onShow, showText, now, events }: {
  f: MapFilters; set: (p: Partial<MapFilters>) => void; reset: () => void; onShow: () => void; showText: string; now: Date; events: EventItem[];
}) {
  const stop = Math.max(0, PRICE_STOPS.findIndex((p) => f.max <= p));
  const priceLabel = f.free ? 'бесплатно' : f.max >= MAX_PRICE ? 'любая' : `до ${fmt(f.max)} ₸`;
  return (
    <ScrollView style={{ maxHeight: 700 }} contentContainerStyle={{ gap: 16 }} showsVerticalScrollIndicator={false}>
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">Фильтры</Text>
        <Pressable onPress={reset} hitSlop={10} accessibilityRole="button" accessibilityLabel="Сбросить фильтры" style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={styles.reset}>Сбросить</Text>
        </Pressable>
      </View>

      <View style={styles.soon}>
        <Clock size={22} color={colors.ink} strokeWidth={1.8} />
        <View style={{ flex: 1 }}>
          <Text style={styles.soonTitle}>Ближайшая неделя</Text>
          <Text style={styles.soonSub}>{f.soon ? 'события на 7 дней вперёд' : 'выключено — выбери любые даты ниже, хоть на 2–3 месяца вперёд'}</Text>
        </View>
        <Switch on={f.soon} onChange={(soon) => set(soon ? { soon } : { soon, from: 0, to: WEEK_TO })} label="Ближайшая неделя" />
      </View>

      {!f.soon && <Calendar now={now} events={events} f={f} set={set} />}

      <View style={{ gap: 10 }}>
        <Text style={styles.cap}>РАЗДЕЛЫ</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }} style={{ marginRight: -16 }}>
          {FILTER_CATS.map(([k, label]) => {
            const on = f.cats.includes(k);
            const I = ICON[k];
            return (
              <Pressable key={k} onPress={() => set({ cats: on ? f.cats.filter((x) => x !== k) : [...f.cats, k] })}
                accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={[styles.chip, on && styles.chipOn]}>
                <I size={17} color={on ? colors.paper : colors.ink} strokeWidth={1.8} />
                <Text style={[styles.chipText, on && { color: colors.paper }]}>{label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={{ gap: 12 }}>
        <View style={styles.priceHead}>
          <Text style={styles.cap}>ЦЕНА</Text>
          <Text style={styles.price}>{priceLabel}</Text>
        </View>
        <Pressable onPress={() => set({ free: !f.free })} style={styles.check} accessibilityRole="checkbox" accessibilityState={{ checked: f.free }}>
          <View style={[styles.box, f.free && styles.boxOn]}>{f.free && <Ic d="M5 12l5 5 9-10" size={16} color={colors.paper} w={2.6} />}</View>
          <Text style={styles.checkText}>Только бесплатное</Text>
        </Pressable>
        <View style={[styles.track, f.free && { opacity: 0.4 }]} accessibilityRole="adjustable" accessibilityLabel={`Цена: ${priceLabel}`}>
          <View style={styles.rail} />
          <View style={[styles.railOn, { width: `${(stop / 3) * 100}%` }]} />
          {PRICE_STOPS.map((p, i) => (
            <Pressable key={p} onPress={() => set({ max: p, free: false })} hitSlop={14} accessibilityRole="button" accessibilityLabel={STOP_LABEL[i]}
              style={[styles.stop, { left: `${(i / 3) * 100}%` }, i <= stop && { backgroundColor: colors.ink }, i === stop && styles.knob]} />
          ))}
        </View>
        <View style={styles.labels}>
          {STOP_LABEL.map((t, i) => <Text key={t} style={[styles.label, i === stop && !f.free && { color: colors.ink, fontFamily: fonts.body700 }]}>{t}</Text>)}
        </View>
      </View>

      <Pressable onPress={onShow} style={styles.show} accessibilityRole="button">
        <Text style={styles.showText}>{showText}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fonts.display800, fontSize: 26, letterSpacing: -0.6, color: colors.ink },
  reset: { fontFamily: fonts.body700, fontSize: 15, color: colors.muted },
  soon: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 16, backgroundColor: '#DDD7CA' },
  soonTitle: { fontFamily: fonts.display700, fontSize: 17, color: colors.ink },
  soonSub: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted },
  cal: { borderRadius: 18, backgroundColor: '#DDD7CA', padding: 12, gap: 8 },
  calHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calTitle: { fontFamily: fonts.display700, fontSize: 17, color: colors.ink },
  arrow: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  wdRow: { flexDirection: 'row' },
  wd: { flex: 1, textAlign: 'center', fontFamily: fonts.mono600, fontSize: 10.5, color: colors.muted, paddingVertical: 4 },
  week: { flexDirection: 'row' },
  cell: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center' },
  // Диапазон: светлая полоса между днями, концы — оранжевые со скруглением снаружи.
  strip: { position: 'absolute', left: 0, right: 0, top: 2, bottom: 2, backgroundColor: '#F7C9B3' },
  stripStart: { left: 2, borderTopLeftRadius: 10, borderBottomLeftRadius: 10 },
  stripEnd: { right: 2, borderTopRightRadius: 10, borderBottomRightRadius: 10 },
  stripEdge: { backgroundColor: colors.accent },
  dayText: { fontFamily: fonts.body500, fontSize: 15, color: colors.ink },
  dot: { position: 'absolute', bottom: 5, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent },
  cap: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.8, color: colors.muted },
  chip: { height: 38, paddingHorizontal: 14, borderRadius: 19, backgroundColor: '#E9E4D8', flexDirection: 'row', alignItems: 'center', gap: 7 },
  chipOn: { backgroundColor: colors.ink },
  chipText: { fontFamily: fonts.body700, fontSize: 14.5, color: colors.ink },
  priceHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  price: { fontFamily: fonts.body700, fontSize: 15.5, color: colors.ink },
  check: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  box: { width: 26, height: 26, borderRadius: 7, borderWidth: 2, borderColor: '#BDB6A8', alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  checkText: { fontFamily: fonts.body700, fontSize: 16, color: colors.ink },
  // Ползунок: по 15 px с краёв — кружок 30 px целиком внутри шторки (FIX1 И2 п.11).
  track: { height: 30, marginHorizontal: 15, justifyContent: 'center' },
  rail: { position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2, backgroundColor: '#CFC9BB' },
  railOn: { position: 'absolute', left: 0, height: 4, borderRadius: 2, backgroundColor: colors.ink },
  stop: { position: 'absolute', width: 8, height: 8, marginLeft: -4, borderRadius: 4, backgroundColor: '#BDB6A8' },
  knob: { width: 30, height: 30, marginLeft: -15, borderRadius: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CFC9BB', shadowColor: colors.ink, shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontFamily: fonts.body500, fontSize: 13, color: colors.muted },
  show: { height: 56, borderRadius: 16, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  showText: { fontFamily: fonts.body700, fontSize: 16.5, color: colors.paper },
});
