// «Пойду» на событии, где нужно выбрать день (FIX5): вместо раскрытия всей карточки — шторка поверх ленты.
// Карточка остаётся в колоде: шторку можно смахнуть и листать дальше. Сеансы — лента дней и чипы времени,
// долгое событие (выставка, фестиваль) — день и время посещения.
import { useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { EventItem } from '../data/types';
import { ScheduleSheet } from '../event/ScheduleSheet';
import { occurrencesOf } from '../event/occurrences';
import { DayStrip, dayTitle } from '../event/ui/pickers';
import { config } from '../lib/config';
import { almaty, dayIndex } from '../lib/clock';
import { chooseEventVisit } from '../live/api';
import { useApp } from '../state/app';
import { usePlans } from '../state/plans';
import { colors, fonts } from '../theme';
import { EventCover } from '../ui/EventCover';
import { Backdrop, BottomSheet } from '../ui/sheet';

const hhmm = (iso: string) => { const a = almaty(iso); return `${String(a.getUTCHours()).padStart(2, '0')}:${String(a.getUTCMinutes()).padStart(2, '0')}`; };

/** Нужно ли выбрать день перед «Пойду»: сеансы или событие дольше суток. */
export function needsWhen(e: EventItem): boolean {
  if (e.spotId) return false;
  return !!e.sessions?.length || (!!e.isLong && !!e.endsAt && Date.parse(e.endsAt) - Date.parse(e.startsAt) > 24 * 3600e3);
}

export function WhenSheet({ e, events, now, onClose, onPlanned }: { e: EventItem; events: EventItem[]; now: Date; onClose: () => void; onPlanned: () => void }) {
  const qc = useQueryClient();
  const addPlan = useApp((s) => s.addPlan);
  const today = dayIndex(now);
  // Сеансы: из серии (e.sessions) или такие же события на той же площадке.
  const sessions = useMemo(() => {
    const list = e.sessions?.length
      ? e.sessions.filter((s) => Date.parse(s.startsAt) > now.getTime()).map((s) => ({ id: s.id, startsAt: s.startsAt, venue: null as string | null }))
      : occurrencesOf(e, events, now).filter((x) => !x.isLong).map((x) => ({ id: x.id, startsAt: x.startsAt, venue: e.category === 'movie' ? x.venueName ?? null : null }));
    return list.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  }, [e, events, now]);
  const bySession = sessions.length > 1 || !!e.sessions?.length;
  const days = useMemo(() => [...new Set(sessions.map((s) => dayIndex(s.startsAt)))], [sessions]);
  const marks = useMemo(() => sessions.reduce<Record<number, number>>((m, s) => { const d = dayIndex(s.startsAt); m[d] = (m[d] ?? 0) + 1; return m; }, {}), [sessions]);
  const [day, setDay] = useState(days[0] ?? today);
  const [pick, setPick] = useState<string | null>(null);
  const ofDay = sessions.filter((s) => dayIndex(s.startsAt) === day);
  const chosen = sessions.find((s) => s.id === pick);

  const planSession = () => {
    if (!chosen) return;
    usePlans.getState().go(chosen.id);
    addPlan();
    onPlanned();
  };

  return (
    <>
      <Backdrop label="Закрыть выбор дня" onPress={onClose} opacity={0.35} />
      <BottomSheet label="Когда пойдёшь" onClose={onClose} scroll>
        <View style={styles.head}>
          <EventCover cover={e.cover} category={e.category} color={e.coverColor} style={styles.thumb} iconSize={30} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.title} numberOfLines={2}>{e.title}</Text>
            <Text style={styles.venue} numberOfLines={1}>{e.venueName ?? e.address}</Text>
          </View>
          <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Закрыть" hitSlop={6}>
            <X size={18} color={colors.ink} strokeWidth={2.2} />
          </Pressable>
        </View>
        {bySession ? (
          sessions.length === 0 ? <Text style={styles.venue}>Ближайших сеансов нет</Text> : <>
            <View style={{ gap: 4 }}>
              <Text style={styles.h1}>Выбери день</Text>
              <Text style={styles.sub}>{sessions.length} {sessions.length % 10 === 1 && sessions.length % 100 !== 11 ? 'сеанс' : sessions.length % 10 >= 2 && sessions.length % 10 <= 4 && (sessions.length % 100 < 12 || sessions.length % 100 > 14) ? 'сеанса' : 'сеансов'} впереди</Text>
            </View>
            <DayStrip days={days} value={day} today={today} marks={marks} onChange={(d) => { setDay(d); setPick(null); }} />
            <Text style={styles.cap}>{dayTitle(day, today).toUpperCase()}</Text>
            <View style={styles.times}>
              {ofDay.map((s) => {
                const on = s.id === pick;
                return (
                  <Pressable key={s.id} onPress={() => setPick(s.id)} style={({ pressed }) => [styles.time, on && styles.timeOn, pressed && { transform: [{ scale: 0.96 }] }]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                    <Text style={[styles.timeText, on && { color: colors.paper }]}>{hhmm(s.startsAt)}</Text>
                    {!!s.venue && <Text style={[styles.timeVenue, on && { color: '#B9B3A6' }]} numberOfLines={1}>{s.venue}</Text>}
                  </Pressable>
                );
              })}
            </View>
            <Pressable disabled={!chosen} onPress={planSession} style={({ pressed }) => [styles.btn, !chosen && { backgroundColor: colors.sand }, pressed && { transform: [{ scale: 0.98 }] }]} accessibilityRole="button">
              <Text style={[styles.btnText, !chosen && { color: colors.muted }]}>Добавить в планы</Text>
              <Text style={[styles.btnSub, !chosen && { color: colors.muted }]}>{chosen ? `${dayTitle(day, today)} · ${hhmm(chosen.startsAt)}` : 'выбери время'}</Text>
            </Pressable>
          </>
        ) : (
          <ScheduleSheet e={e} now={now} reschedule={false} onSave={async (at) => {
            if (config.dataMode !== 'demo') await chooseEventVisit(e.id, at);
            usePlans.setState((s) => ({ visits: { ...s.visits, [e.id]: at }, going: { ...s.going, [e.id]: at } }));
            addPlan();
            void qc.invalidateQueries({ queryKey: ['me', 'attendance'] });
            onPlanned();
          }} />
        )}
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 56, height: 56, borderRadius: 16, overflow: 'hidden' },
  title: { fontFamily: fonts.display700, fontSize: 16.5, letterSpacing: -0.2, color: colors.ink },
  venue: { fontFamily: fonts.body400, fontSize: 13.5, color: colors.muted },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  h1: { fontFamily: fonts.display800, fontSize: 26, letterSpacing: -0.6, color: colors.ink },
  sub: { fontFamily: fonts.body400, fontSize: 14.5, color: colors.muted },
  cap: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.8, color: colors.muted },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  time: { minWidth: 84, minHeight: 52, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(23,22,26,0.06)' },
  timeOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  timeText: { fontFamily: fonts.display700, fontSize: 19, letterSpacing: -0.3, color: colors.ink },
  timeVenue: { fontFamily: fonts.body500, fontSize: 11, color: colors.muted, maxWidth: 140 },
  btn: { minHeight: 60, borderRadius: 18, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  btnText: { color: colors.paper, fontFamily: fonts.body700, fontSize: 16 },
  btnSub: { color: '#B9B3A6', fontFamily: fonts.body500, fontSize: 12.5, marginTop: 1 },
});
