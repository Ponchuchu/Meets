// Выбор даты (календарь), времени (барабан, как будильник iPhone) и места (точка на карте, как в доставке).
import { useEffect, useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { almaty, dayIndex, dayStart } from '../../lib/clock';
import { MapCanvas } from '../../map/MapCanvas';
import type { MapCanvasHandle } from '../../map/types';
import { colors, fonts } from '../../theme';
import { Ic, IC } from '../../ui/Ic';

const WD = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

/** Календарь на два месяца вперёд: листаешь месяцы стрелками, прошедшие дни неактивны. */
export function MonthCalendar({ now, value, onPick }: { now: Date; value: number; onPick: (offset: number) => void }) {
  const today = dayIndex(now);
  const t = almaty(now);
  const [month, setMonth] = useState(() => {
    const d = almaty(dayStart(today + value));
    return (d.getUTCFullYear() - t.getUTCFullYear()) * 12 + d.getUTCMonth() - t.getUTCMonth();
  });
  const first = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + month, 1));
  const days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const firstIndex = Math.floor(first.getTime() / 86400000);
  const cells = [...Array.from({ length: lead }, () => null), ...Array.from({ length: days }, (_, i) => firstIndex + i)];
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.calHead}>
        <Pressable disabled={month <= 0} onPress={() => setMonth(month - 1)} style={[styles.arrow, month <= 0 && { opacity: 0.3 }]} accessibilityRole="button" accessibilityLabel="Предыдущий месяц"><Ic d={IC.back} size={18} color={colors.ink} w={2} /></Pressable>
        <Text style={styles.month}>{MONTHS[first.getUTCMonth()]} {first.getUTCFullYear()}</Text>
        <Pressable disabled={month >= 3} onPress={() => setMonth(month + 1)} style={[styles.arrow, month >= 3 && { opacity: 0.3 }]} accessibilityRole="button" accessibilityLabel="Следующий месяц"><Ic d={IC.chevron} size={18} color={colors.ink} w={2} /></Pressable>
      </View>
      <View style={styles.grid}>
        {WD.map((d, i) => <Text key={d} style={[styles.wd, i >= 5 && { color: colors.accentText }]}>{d}</Text>)}
        {cells.map((idx, i) => {
          if (idx == null) return <View key={`e${i}`} style={styles.cell} />;
          const off = idx - today;
          const past = off < 0;
          const on = off === value;
          return (
            <Pressable key={idx} disabled={past} onPress={() => onPick(off)} style={[styles.cell, on && styles.cellOn, off === 0 && !on && styles.cellToday]}
              accessibilityRole="button" accessibilityState={{ selected: on, disabled: past }}>
              <Text style={[styles.num, past && { color: '#B3AC9E' }, on && { color: colors.paper }]}>{idx - firstIndex + 1}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const ROW = 44;

/** Одна колонка барабана: прокрутка со «щелчком» на значении, выбранное — в центре под плашкой. */
function Wheel({ items, value, onChange, label }: { items: string[]; value: string; onChange: (v: string) => void; label: string }) {
  const ref = useRef<ScrollView>(null);
  const idx = Math.max(0, items.indexOf(value));
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { ref.current?.scrollTo({ y: idx * ROW, animated: false }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    if (settle.current) clearTimeout(settle.current);
    // На web инерции нет — ждём паузу и сами доводим до ближайшего значения.
    settle.current = setTimeout(() => {
      const i = Math.min(items.length - 1, Math.max(0, Math.round(y / ROW)));
      ref.current?.scrollTo({ y: i * ROW, animated: true });
      if (items[i] !== value) onChange(items[i]);
    }, 120);
  };
  return (
    <View style={styles.wheel} accessibilityRole="adjustable" accessibilityLabel={`${label}: ${value}`}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(a) => {
        const i = idx + (a.nativeEvent.actionName === 'increment' ? 1 : -1);
        if (items[i]) { onChange(items[i]); ref.current?.scrollTo({ y: i * ROW, animated: true }); }
      }}>
      <ScrollView ref={ref} showsVerticalScrollIndicator={false} snapToInterval={ROW} decelerationRate="fast" onScroll={onScroll} scrollEventThrottle={32}
        contentContainerStyle={{ paddingVertical: ROW * 2 }}>
        {items.map((it) => (
          <Pressable key={it} onPress={() => { onChange(it); ref.current?.scrollTo({ y: items.indexOf(it) * ROW, animated: true }); }} style={styles.wheelRow}>
            <Text style={[styles.wheelText, it === value && styles.wheelOn]}>{it}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

/** Время как в будильнике: две колонки, часы и минуты (шаг 5). */
export function TimeWheel({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [h, m] = value.split(':');
  const mm = MINUTES.includes(m) ? m : MINUTES[Math.round(Number(m) / 5) % 12];
  return (
    <View style={styles.wheels}>
      <View pointerEvents="none" style={styles.wheelBand} />
      <Wheel items={HOURS} value={h} onChange={(x) => onChange(`${x}:${mm}`)} label="Часы" />
      <Text style={styles.colon}>:</Text>
      <Wheel items={MINUTES} value={mm} onChange={(x) => onChange(`${h}:${x}`)} label="Минуты" />
    </View>
  );
}

export interface PlaceValue {
  point: { lat: number; lon: number };
  address: string;
  entrance: string;
  floor: string;
  apt: string;
}

/** Точка на карте «как в доставке»: двигаешь карту под булавкой, адрес подтягивается сам; подъезд, этаж, квартира — полями. */
export function PlacePicker({ value, onDone }: { value: PlaceValue; onDone: (v: PlaceValue) => void }) {
  const [v, setV] = useState(value);
  const [q, setQ] = useState('');
  const map = useRef<MapCanvasHandle>(null);
  const reverse = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCenter = (lat: number, lon: number) => {
    setV((s) => ({ ...s, point: { lat, lon } }));
    if (reverse.current) clearTimeout(reverse.current);
    reverse.current = setTimeout(async () => {
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=ru&zoom=18&lat=${lat}&lon=${lon}`);
        const j = (await r.json()) as { address?: { road?: string; house_number?: string } };
        const a = [j.address?.road, j.address?.house_number].filter(Boolean).join(' ');
        if (a) setV((s) => ({ ...s, address: a }));
      } catch { /* без сети — адрес вводится вручную */ }
    }, 500);
  };
  const find = async () => {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=kz&accept-language=ru&bounded=1&viewbox=76.70,43.40,77.20,43.05&q=${encodeURIComponent(`${q}, Алматы`)}`);
      const [hit] = (await r.json()) as { lat: string; lon: string }[];
      if (hit) map.current?.flyTo(Number(hit.lat), Number(hit.lon), 16.5);
    } catch { /* нет сети */ }
  };
  const field = (key: 'entrance' | 'floor' | 'apt', label: string) => (
    <TextInput value={v[key]} onChangeText={(t) => setV({ ...v, [key]: t.slice(0, 6) })} placeholder={label} placeholderTextColor={colors.muted3}
      style={[styles.input, { flex: 1 }]} accessibilityLabel={label} keyboardType="default" />
  );
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.search}>
        <Ic d="M20 20l-3.5-3.5" c={[[11, 11, 7]]} size={17} color={colors.muted} w={2} />
        <TextInput value={q} onChangeText={setQ} onSubmitEditing={find} placeholder="Найти улицу или место" placeholderTextColor={colors.muted3} style={{ flex: 1, height: 44, fontFamily: fonts.body400, fontSize: 15, color: colors.ink }} accessibilityLabel="Найти адрес" returnKeyType="search" />
      </View>
      <View style={styles.mapBox}>
        <MapCanvas ref={map} theme="paper" camera={{ ...value.point, zoom: 16 }} markers={[]} onCenter={onCenter} />
        <View pointerEvents="none" style={styles.centerPin}>
          <View style={styles.pinHead}><Ic d={IC.home} size={16} color={colors.ink} w={2} /></View>
          <View style={styles.pinLeg} />
        </View>
      </View>
      <TextInput value={v.address} onChangeText={(address) => setV({ ...v, address })} placeholder="Улица и дом" placeholderTextColor={colors.muted3} style={styles.input} accessibilityLabel="Улица и дом" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {field('entrance', 'Подъезд')}
        {field('floor', 'Этаж')}
        {field('apt', 'Кв.')}
      </View>
      <Pressable onPress={() => onDone(v)} style={styles.done} accessibilityRole="button"><Text style={styles.doneText}>Готово</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  calHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  month: { fontFamily: fonts.display700, fontSize: 18, color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  wd: { width: `${100 / 7}%`, textAlign: 'center', fontFamily: fonts.mono600, fontSize: 10, color: colors.muted, paddingBottom: 6 },
  cell: { width: `${100 / 7}%`, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cellOn: { backgroundColor: colors.ink },
  cellToday: { borderWidth: 1.5, borderColor: colors.ink },
  num: { fontFamily: fonts.display600, fontSize: 16, color: colors.ink },
  wheels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: ROW * 5, gap: 4 },
  wheelBand: { position: 'absolute', left: 24, right: 24, top: ROW * 2, height: ROW, borderRadius: 12, backgroundColor: colors.sand2 },
  wheel: { width: 90, height: ROW * 5 },
  wheelRow: { height: ROW, alignItems: 'center', justifyContent: 'center' },
  wheelText: { fontFamily: fonts.display600, fontSize: 22, color: colors.muted3 },
  wheelOn: { fontFamily: fonts.display800, fontSize: 28, color: colors.ink },
  colon: { fontFamily: fonts.display800, fontSize: 28, color: colors.ink },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.card },
  mapBox: { height: 230, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, backgroundColor: '#EFEBE2' },
  centerPin: { position: 'absolute', left: '50%', top: '50%', marginLeft: -20, marginTop: -52, alignItems: 'center' },
  pinHead: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.accent, borderWidth: 3, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  pinLeg: { width: 3, height: 12, backgroundColor: colors.ink, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  input: { height: 48, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.card, fontFamily: fonts.body400, fontSize: 15, color: colors.ink },
  done: { height: 54, borderRadius: 16, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  doneText: { fontFamily: fonts.body600, fontSize: 16, color: colors.paper },
});
