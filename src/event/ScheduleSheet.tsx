// «Когда пойти»: день и время одним барабаном, как в iPhone (26 окт.) — только времена внутри события, шаг 30 минут; внизу — итог.
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { EventItem } from '../data/types';
import { almaty, dayIndex, dayStart } from '../lib/clock';
import { colors, fonts } from '../theme';
import { DayTimeWheel, dayTitle, wheelDayLabel } from './ui/pickers';

export function ScheduleSheet({ e, now, reschedule, initial, onSave }: { e: EventItem; now: Date; reschedule: boolean; initial?: string; onSave: (at: string) => Promise<void> }) {
  const earliest = Math.max(now.getTime() + 60000, reschedule ? 0 : Date.parse(e.startsAt));
  const endMs = reschedule ? Infinity : Date.parse(e.endsAt ?? e.startsAt);
  const first = new Date(Math.ceil(Math.max(earliest, Date.parse(initial ?? e.startsAt)) / 1800000) * 1800000);
  const today = dayIndex(now);
  const [day, setDay] = useState(dayIndex(first));
  const a = almaty(first);
  const [time, setTime] = useState(`${String(a.getUTCHours()).padStart(2, '0')}:${String(a.getUTCMinutes()).padStart(2, '0')}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const last = reschedule ? today + 91 : dayIndex(e.endsAt ?? e.startsAt);
  const days = useMemo(() => {
    const from = dayIndex(new Date(earliest));
    return Array.from({ length: Math.max(1, Math.min(92, last - from + 1)) }, (_, i) => from + i);
  }, [earliest, last]);
  const atOf = (d: number, t: string) => { const [h, m] = t.split(':').map(Number); return dayStart(d).getTime() + (h * 60 + m) * 60000; };
  const ok = (d: number, t: string) => { const at = atOf(d, t); return at >= earliest && at < endMs; };
  // Для каждого дня — времена с шагом 30 минут, которые попадают в событие (выставка 10–20 → 10:00…19:30).
  const wheel = useMemo(() => days.map((d) => ({ key: d, label: wheelDayLabel(d, today),
    times: Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`).filter((t) => ok(d, t)) }))
    .filter((d) => d.times.length), [days, today]); // eslint-disable-line react-hooks/exhaustive-deps
  // Выбранное могло не попасть в список (первый день уже закончился) — берём то, что стоит в барабане.
  const cur = wheel.find((w) => w.key === day) ?? wheel[0];
  const effDay = cur?.key ?? day;
  const effTime = cur && cur.times.includes(time) ? time : cur?.times[0] ?? time;
  const valid = ok(effDay, effTime);
  const save = async () => {
    if (busy) return;
    if (!valid) { setError('Выбери время в пределах события, позже текущего'); return; }
    setBusy(true); setError('');
    try { await onSave(new Date(atOf(effDay, effTime)).toISOString()); } catch { setError('Не удалось сохранить время. Проверь связь и повтори'); } finally { setBusy(false); }
  };
  return <>
    <View style={{ gap: 4 }}>
      <Text style={styles.h1}>{reschedule ? 'Перенести встречу' : 'Когда пойдёшь?'}</Text>
      <Text style={styles.sub}>{reschedule ? 'Новое время увидят приглашённые друзья' : 'Выбери день и время — напомню заранее'}</Text>
    </View>
    <View style={styles.wheelBox}><DayTimeWheel days={wheel} day={effDay} time={effTime} onChange={(d, t) => { setDay(d); setTime(t); setError(''); }} /></View>
    {!!error && <Text accessibilityRole="alert" style={{ color: colors.accentText, fontFamily: fonts.body500 }}>{error}</Text>}
    <Pressable onPress={() => void save()} disabled={busy} accessibilityRole="button" style={({ pressed }) => [styles.btn, !valid && { backgroundColor: colors.sand }, pressed && { transform: [{ scale: 0.98 }] }]}>
      {busy ? <ActivityIndicator color={colors.paper} /> : <>
        <Text style={[styles.btnText, !valid && { color: colors.muted }]}>{reschedule ? 'Перенести' : 'Добавить в планы'}</Text>
        <Text style={[styles.btnSub, !valid && { color: colors.muted }]}>{valid ? `${dayTitle(effDay, today)} · ${effTime}` : 'это время недоступно'}</Text>
      </>}
    </Pressable>
  </>;
}

const styles = StyleSheet.create({
  h1: { fontFamily: fonts.display800, fontSize: 26, letterSpacing: -0.6, color: colors.ink },
  sub: { fontFamily: fonts.body400, fontSize: 14.5, color: colors.muted },
  wheelBox: { borderRadius: 20, backgroundColor: colors.card, overflow: 'hidden' },
  btn: { minHeight: 60, borderRadius: 18, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  btnText: { color: colors.paper, fontFamily: fonts.body700, fontSize: 16 },
  btnSub: { color: '#B9B3A6', fontFamily: fonts.body500, fontSize: 12.5, marginTop: 1 },
});
