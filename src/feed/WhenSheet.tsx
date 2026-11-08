// «Пойду» на событии, где нужно выбрать день (FIX5): вместо раскрытия всей карточки — шторка поверх ленты.
// Карточка остаётся в колоде: шторку можно смахнуть и листать дальше. Сеансы — лента дней и чипы времени,
// долгое событие (выставка, фестиваль) — день и время посещения.
import { useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { EventItem } from '../data/types';
import { ScheduleSheet } from '../event/ScheduleSheet';
import { occurrencesOf } from '../event/occurrences';
import { DayTimeWheel, dayTitle, wheelDayLabel } from '../event/ui/pickers';
import { config } from '../lib/config';
import { almaty, dayIndex } from '../lib/clock';
import { chooseEventVisit } from '../live/api';
import { useApp } from '../state/app';
import { usePlans } from '../state/plans';
import { colors, fonts } from '../theme';
import { EventCover } from '../ui/EventCover';
import { Backdrop, BottomSheet } from '../ui/sheet';

const plural = (n: number, [one, few, many]: [string, string, string]) => (n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many);
const hhmm = (iso: string) => { const a = almaty(iso); return `${String(a.getUTCHours()).padStart(2, '0')}:${String(a.getUTCMinutes()).padStart(2, '0')}`; };

/** Нужно ли выбрать день перед «Пойду»: сеансы или событие дольше суток. */
export function needsWhen(e: EventItem): boolean {
  if (e.spotId) return false;
  return !!e.sessions?.length || (e.dates?.length ?? 0) > 1 || (!!e.isLong && !!e.endsAt && Date.parse(e.endsAt) - Date.parse(e.startsAt) > 24 * 3600e3);
}

export function WhenSheet({ e, events, now, onClose, onPlanned }: { e: EventItem; events: EventItem[]; now: Date; onClose: () => void; onPlanned: () => void }) {
  const qc = useQueryClient();
  const addPlan = useApp((s) => s.addPlan);
  const today = dayIndex(now);
  // Сеансы: из серии (e.sessions) или такие же события на той же площадке.
  // Даты одной карточки (спектакль в два дня) — выбор даты; id даты — «событие@время».
  const own = (e.dates?.length ?? 0) > 1;
  const sessions = useMemo(() => {
    const list = own
      ? e.dates!.filter((s) => Date.parse(s) > now.getTime() - 3 * 3600e3).map((s) => ({ id: `${e.id}@${s}`, startsAt: s, venue: null as string | null }))
      : e.sessions?.length
      ? e.sessions.filter((s) => Date.parse(s.startsAt) > now.getTime()).map((s) => ({ id: s.id, startsAt: s.startsAt, venue: null as string | null }))
      : occurrencesOf(e, events, now).filter((x) => !x.isLong).map((x) => ({ id: x.id, startsAt: x.startsAt, venue: e.category === 'movie' ? x.venueName ?? null : null }));
    return list.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  }, [e, events, now, own]);
  const bySession = own || sessions.length > 1 || !!e.sessions?.length;
  const days = useMemo(() => [...new Set(sessions.map((s) => dayIndex(s.startsAt)))], [sessions]);
  const [day, setDay] = useState(days[0] ?? today);
  const [pick, setPick] = useState<string | null>(null);
  // Подпись времени в барабане: «19:00», у кино — с кинотеатром. Одинаковые подписи в один день не склеиваются.
  const label = (x: { startsAt: string; venue: string | null }) => (x.venue ? `${hhmm(x.startsAt)} · ${x.venue}` : hhmm(x.startsAt));
  const wheelDays = useMemo(() => days.map((d) => ({ key: d, label: wheelDayLabel(d, today), times: [...new Set(sessions.filter((x) => dayIndex(x.startsAt) === d).map(label))] })), [days, sessions, today]);
  // Выбор по умолчанию — первый сеанс в барабане: «Добавить в планы» сразу активна.
  const chosen = sessions.find((s) => s.id === pick) ?? sessions.find((x) => dayIndex(x.startsAt) === day) ?? sessions[0];

  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const planSession = async () => {
    if (!chosen || savingRef.current) return;
    savingRef.current = true;
    setSaving(true); setError('');
    try {
      if (own) {
        // Сначала подтверждаем выбранную дату на сервере, затем показываем успех.
        if (config.dataMode !== 'demo') await chooseEventVisit(e.id, chosen.startsAt);
        usePlans.setState((s) => ({ visits: { ...s.visits, [e.id]: chosen.startsAt }, going: { ...s.going, [e.id]: chosen.startsAt } }));
        void qc.invalidateQueries({ queryKey: ['me', 'attendance'] });
      } else usePlans.getState().go(chosen.id);
      addPlan();
      onPlanned();
    } catch {
      setError('Не удалось сохранить дату. Проверь связь и повтори');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
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
              <Text style={styles.sub}>{sessions.length} {plural(sessions.length, own ? ['дата', 'даты', 'дат'] : ['сеанс', 'сеанса', 'сеансов'])} впереди</Text>
            </View>
            {/* День и время барабаном, как в iPhone (26 окт.): только настоящие сеансы. */}
            <View style={styles.wheelBox}>
              <DayTimeWheel days={wheelDays} day={day} time={chosen ? hhmm(chosen.startsAt) : null}
                onChange={(d, t) => { setDay(d); setPick(sessions.find((x) => dayIndex(x.startsAt) === d && label(x) === t)?.id ?? null); }} />
            </View>
            {!!error && <Text accessibilityRole="alert" style={{ color: colors.accentText, fontFamily: fonts.body500 }}>{error}</Text>}
            <Pressable disabled={!chosen || saving} onPress={() => void planSession()} style={({ pressed }) => [styles.btn, !chosen && { backgroundColor: colors.sand }, pressed && { transform: [{ scale: 0.98 }] }]} accessibilityRole="button">
              {saving ? <ActivityIndicator color={colors.paper} /> : <Text style={[styles.btnText, !chosen && { color: colors.muted }]}>Добавить в планы</Text>}
              <Text style={[styles.btnSub, !chosen && { color: colors.muted }]}>{chosen ? `${dayTitle(dayIndex(chosen.startsAt), today)} · ${hhmm(chosen.startsAt)}` : 'выбери время'}</Text>
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
  wheelBox: { borderRadius: 20, backgroundColor: colors.card, overflow: 'hidden' },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  time: { minWidth: 84, minHeight: 52, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(23,22,26,0.06)' },
  timeOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  timeText: { fontFamily: fonts.display700, fontSize: 19, letterSpacing: -0.3, color: colors.ink },
  timeVenue: { fontFamily: fonts.body500, fontSize: 11, color: colors.muted, maxWidth: 140 },
  btn: { minHeight: 60, borderRadius: 18, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  btnText: { color: colors.paper, fontFamily: fonts.body700, fontSize: 16 },
  btnSub: { color: '#B9B3A6', fontFamily: fonts.body500, fontSize: 12.5, marginTop: 1 },
});
