// «Планы» — design/png/V3Plans.png (V6.md §5): «Скоро | Были», неделя с точками, «Зовут» с ✕ / ✓,
// дальше по дням — куда я иду: время, кто из друзей тоже, сколько ищут компанию. Тап — событие.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { CalendarDays, Bell, BellOff, UserPlus, Trash2, Check, ChevronRight, Hand, X } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabInset } from '../../components/TabBar';
import { data, eventsSnapshot, type EventItem, type Person } from '../../data';
import { almaty, dayIndex, now as clockNow } from '../../lib/clock';
import { config } from '../../lib/config';
import { toggleEventReminder, answerInvite, getEventsByIds, getInvites, type Invite } from '../../live/api';
import { myId } from '../../live/auth';
import { CAT_COLOR, CAT_ICON, catFg } from '../../map/icons';
import { usePlans } from '../../state/plans';
import { MonthCalendar } from '../../event/ui/pickers';
import { Backdrop, BottomSheet } from '../../ui/sheet';
import { SwipeRow, type RowAction } from '../../ui/SwipeRow';
import { colors, fonts } from '../../theme';
import { Avatar } from '../../ui/Avatar';
import { Ic } from '../../ui/Ic';

const LIVE = config.dataMode !== 'demo';
const WD = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const WD_FULL = ['ВОСКРЕСЕНЬЕ', 'ПОНЕДЕЛЬНИК', 'ВТОРНИК', 'СРЕДА', 'ЧЕТВЕРГ', 'ПЯТНИЦА', 'СУББОТА'];
const MON = ['ЯНВ', 'ФЕВ', 'МАР', 'АПР', 'МАЯ', 'ИЮН', 'ИЮЛ', 'АВГ', 'СЕН', 'ОКТ', 'НОЯ', 'ДЕК'];
const hm = (iso: string) => { const d = almaty(iso); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };
const endOf = (e: EventItem) => new Date(e.endsAt ?? new Date(new Date(e.startsAt).getTime() + 2 * 3600e3).toISOString()).getTime();

function dayTitle(d: number, today: number, iso: string): string {
  if (d === today) return 'СЕГОДНЯ';
  if (d === today + 1) return 'ЗАВТРА';
  const a = almaty(iso);
  return d - today < 7 && d > today ? WD_FULL[a.getUTCDay()] : `${a.getUTCDate()} ${MON[a.getUTCMonth()]}`;
}

function Tile({ e }: { e: EventItem }) {
  return (
    <View style={[styles.tile, { backgroundColor: CAT_COLOR[e.category] }]}>
      <Ic d={CAT_ICON[e.category]} size={24} color={catFg(e.category)} w={1.9} />
    </View>
  );
}

function Faces({ ids, people }: { ids: string[]; people: Person[] }) {
  const ps = ids.map((id) => people.find((p) => p.id === id)).filter(Boolean) as Person[];
  if (!ps.length) return null;
  return (
    <View style={{ flexDirection: 'row' }}>
      {ps.slice(0, 4).map((p, i) => (
        <View key={p.id} style={{ marginLeft: i ? -6 : 0 }}>
          <Avatar p={p} size={28} style={{ borderWidth: 2, borderColor: '#FBFAF6' }} />
          <View style={styles.ok}><Check size={8} color="#FFFFFF" strokeWidth={3.5} /></View>
        </View>
      ))}
    </View>
  );
}

export default function PlansTab() {
  const insets = useSafeAreaInsets();
  const pad = useTabInset();
  const qc = useQueryClient();
  const tab = 'soon';
  const [pick, setPick] = useState<number[]>([]);
  const [calendar, setCalendar] = useState(false);
  const [actionError,setActionError]=useState('');
  const muted = usePlans((s) => s.muted);
  const toggleDay = (d: number) => setPick((p) => p.includes(d) ? p.filter((x) => x !== d) : [...p, d]);
  const [now,setNow] = useState(clockNow);
  useFocusEffect(useCallback(()=>{setNow(clockNow());const timer=setInterval(()=>setNow(clockNow()),60000);return()=>clearInterval(timer);},[]));
  const today = dayIndex(now);
  const me = myId();
  const going = usePlans((s) => s.going);
  const meetups = usePlans((s) => s.meetups);
  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: () => data.getEvents(), placeholderData: eventsSnapshot });
  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => data.getPeople() });
  const { data: invites = [] } = useQuery<Invite[]>({ queryKey: ['invites'], queryFn: getInvites, enabled: LIVE, staleTime: 30e3 });
  useFocusEffect(useCallback(() => { void qc.invalidateQueries({ queryKey: ['invites'] }); }, [qc]));

  const all = useMemo(() => [...meetups, ...events], [meetups, events]);
  const known = new Set(all.map((e) => e.id));
  const missing = [...new Set([...Object.keys(going), ...invites.map((i) => i.event_id ?? '')])].filter((id) => id && !known.has(id));
  const { data: extra = [] } = useQuery({ queryKey: ['eventsById', missing.sort().join(',')], queryFn: () => getEventsByIds(missing), enabled: LIVE && missing.length > 0 });
  const byId = (id: string) => all.find((e) => e.id === id) ?? extra.find((e) => e.id === id);

  const incoming = invites.filter((i) => (!pick.length || (i.event_id && byId(i.event_id) && pick.includes(dayIndex(byId(i.event_id)!.startsAt)))) && i.to_id === me && !i.answer && i.event_id && byId(i.event_id) && endOf(byId(i.event_id)!) > now.getTime());
  const mine = Object.keys(going).map(byId).filter((e): e is EventItem => !!e);
  const soon = mine.filter((e) => endOf(e) > now.getTime()).sort((a, b) => Date.parse(a.startsAt)-Date.parse(b.startsAt));
  const list = soon.filter((e) => !pick.length || pick.includes(dayIndex(e.startsAt)));
  const sentFor = (eventId: string) => invites.filter((i) => i.from_id === me && i.event_id === eventId);

  const answer = async (inv: Invite, yes: boolean) => {
    qc.setQueryData<Invite[]>(['invites'], (old = []) => old.map((x) => (x.id === inv.id ? { ...x, answer: yes ? 'yes' : 'no' } : x)));
    if (yes && inv.event_id) usePlans.getState().go(inv.event_id);
    await answerInvite(inv, yes).catch(() => void qc.invalidateQueries({ queryKey: ['invites'] }));
  };

  const groups: { day: number; items: EventItem[] }[] = [];
  for (const e of list) {
    const d = dayIndex(e.startsAt);
    const g = groups.find((x) => x.day === d);
    if (g) g.items.push(e); else groups.push({ day: d, items: [e] });
  }
  const week = Array.from({ length: 7 }, (_, i) => today + i);
  const has = (d: number) => soon.some((e) => dayIndex(e.startsAt) === d) || incoming.some((i) => dayIndex(byId(i.event_id!)!.startsAt) === d);
  // Действия строки — значки под ней при смахивании влево (как в Telegram), без окон.
  const rowActions = (e: EventItem): RowAction[] => [
    {
      key: 'bell', label: muted[e.id] ? 'Включить' : 'Тише', color: '#8C8577',
      icon: muted[e.id] ? <Bell size={22} color="#FFFFFF" strokeWidth={1.9} /> : <BellOff size={22} color="#FFFFFF" strokeWidth={1.9} />,
      onPress: async () => {
        setActionError('');
        if (LIVE) { try { await toggleEventReminder(e.id); } catch { setActionError('Не удалось сохранить напоминание. Проверь связь'); } }
        else usePlans.getState().toggleReminder(e.id);
      },
    },
    { key: 'invite', label: 'Позвать', color: colors.friend, icon: <UserPlus size={22} color="#FFFFFF" strokeWidth={1.9} />, onPress: () => router.push({ pathname: '/event/[id]', params: { id: e.id, invite: '1' } }) },
    { key: 'del', label: 'Убрать', color: '#D8362A', icon: <Trash2 size={22} color="#FFFFFF" strokeWidth={1.9} />, onPress: () => usePlans.getState().ungo(e.id) },
  ];
  const open = (e: EventItem) => router.push({ pathname: '/event/[id]', params: { id: e.id } });

  return (
    <View style={styles.root}><ScrollView style={styles.root} contentContainerStyle={{ paddingTop: Math.max(50, insets.top + 6), paddingBottom: pad + 20, paddingHorizontal: 16, gap: 14 }}>
      <View style={styles.head}>
        <Text style={styles.h1} accessibilityRole="header">Планы</Text>

      </View>

      {tab === 'soon' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.week}>
          {week.map((d) => {
            const a = almaty(new Date(now.getTime() + (d - today) * 86400e3));
            const on = pick.includes(d);
            return (
              <Pressable key={d} onPress={() => toggleDay(d)} style={[styles.day, on && styles.dayOn]} accessibilityRole="button" accessibilityState={{ selected: pick.includes(d) }}
                accessibilityLabel={`${WD[a.getUTCDay()]} ${a.getUTCDate()}${has(d) ? ', есть планы' : ''}`}>
                <Text style={[styles.dayWd, on && { color: '#BDB8AD' }]}>{WD[a.getUTCDay()]}</Text>
                <Text style={[styles.dayN, on && { color: colors.paper }]}>{a.getUTCDate()}</Text>
                <View style={[styles.dayDot, { opacity: has(d) ? 1 : 0 }]} />
              </Pressable>
            );
          })}
          <Pressable onPress={() => setCalendar(true)} style={styles.day} accessibilityRole="button" accessibilityLabel="Календарь планов"><CalendarDays size={22} color={colors.ink} /><Text style={styles.dayWd}>Месяц</Text></Pressable>
        </ScrollView>
      )}
      <Pressable onPress={() => setPick([])} accessibilityRole="button" accessibilityLabel="Показать все планы"><Text style={styles.sub}>{pick.length ? `Выбрано дат: ${pick.length} · показать все` : 'Все предстоящие планы'}</Text></Pressable>
      {!!actionError && <Text style={{ color: colors.accentText, fontFamily: fonts.body500 }}>{actionError}</Text>}

      {tab === 'soon' && incoming.length > 0 && (
        <View style={{ gap: 8 }}>
          <View style={styles.secRow}><Text style={styles.sec}>Зовут</Text><View style={styles.count}><Text style={styles.countText}>{incoming.length}</Text></View></View>
          {incoming.map((inv) => {
            const e = byId(inv.event_id!)!;
            const from = people.find((p) => p.id === inv.from_id);
            const d = dayIndex(e.startsAt);
            return (
              <Animated.View key={inv.id} entering={FadeIn} exiting={FadeOut} layout={LinearTransition} style={[styles.row, styles.inviteRow]}>
                <Pressable onPress={() => open(e)} style={styles.rowMain} accessibilityRole="button">
                  <View>
                    <Tile e={e} />
                    {from && <Avatar p={from} size={24} style={styles.fromFace} />}
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={styles.title} numberOfLines={1}>{e.title}</Text>
                    <Text style={styles.sub} numberOfLines={1}>{from?.name ?? 'Друг'} · {d === today ? 'сегодня' : d === today + 1 ? 'завтра' : WD[almaty(e.startsAt).getUTCDay()]} {hm(e.startsAt)}</Text>
                  </View>
                </Pressable>
                <Pressable onPress={() => void answer(inv, false)} style={[styles.round, { backgroundColor: '#E7E2D6' }]} accessibilityRole="button" accessibilityLabel={`Не смогу: ${e.title}`}>
                  <X size={20} color={colors.ink} strokeWidth={2.2} />
                </Pressable>
                <Pressable onPress={() => void answer(inv, true)} style={[styles.round, { backgroundColor: colors.accent }]} accessibilityRole="button" accessibilityLabel={`Иду: ${e.title}`}>
                  <Check size={20} color={colors.ink} strokeWidth={2.6} />
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      )}

      {groups.map((g) => (
        <View key={g.day} style={{ gap: 8 }}>
          <Text style={styles.cap}>{dayTitle(g.day, today, g.items[0].startsAt)}</Text>
          {g.items.map((e) => {
            const sent = sentFor(e.id);
            const looking = Math.max(e.lookingCount, e.lookers?.length ?? 0);
            return (
              <SwipeRow key={e.id} actions={rowActions(e)} background="#FBFAF6" radius={20}><Pressable onPress={() => open(e)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]} accessibilityRole="button">
                <Tile e={e} />
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.title, { flex: 1 }]} numberOfLines={1}>{e.title}</Text>
                    <Text style={styles.time}>{hm(e.startsAt)}</Text>
                  </View>
                  <View style={styles.meta}>
                    <Faces ids={e.friendsGoing} people={people} />
                    {looking > 0 && <View style={styles.look}><Hand size={13} color={colors.accentText} strokeWidth={2} /><Text style={styles.lookText}>{looking}</Text></View>}
                    {sent.map((i) => {
                      const p = people.find((x) => x.id === i.to_id);
                      return <Text key={i.id} style={styles.ans} numberOfLines={1}>{p?.name ?? 'Друг'}: {i.answer === 'yes' ? 'идёт ✓' : i.answer === 'no' ? 'не сможет' : 'ждём ответ'}</Text>;
                    })}
                  </View>
                </View>
                <ChevronRight size={20} color={colors.muted} strokeWidth={2} />
              </Pressable></SwipeRow>
            );
          })}
        </View>
      ))}

      {!groups.length && !(tab === 'soon' && incoming.length) && (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{tab === 'soon' ? (!pick.length ? 'Пока пусто' : 'В этот день ничего') : 'Пока нигде не был'}</Text>
          <Text style={styles.emptySub}>{tab === 'soon' ? 'Смахни карточку вправо в «Рекомендациях» — она прилетит сюда.' : 'Здесь появятся события, на которых ты был.'}</Text>
          {tab === 'soon' && (
            <Pressable onPress={() => router.navigate('/foryou')} style={styles.emptyBtn} accessibilityRole="button"><Text style={styles.emptyBtnText}>Открыть рекомендации</Text></Pressable>
          )}
        </View>
      )}
    </ScrollView>
    {calendar && <><Backdrop label="Закрыть календарь" onPress={() => setCalendar(false)} /><BottomSheet label="Календарь планов" onClose={() => setCalendar(false)}><MonthCalendar now={now} value={pick.length ? pick[0] - today : 0} selectedDays={pick} markedDays={soon.map((e) => dayIndex(e.startsAt))} onPick={(off) => toggleDay(today + off)} /><Pressable onPress={() => setCalendar(false)} style={styles.emptyBtn}><Text style={styles.emptyBtnText}>Показать планы</Text></Pressable></BottomSheet></>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { fontFamily: fonts.display800, fontSize: 30, letterSpacing: -0.9, color: colors.ink },
  seg: { flexDirection: 'row', padding: 4, borderRadius: 22, backgroundColor: '#E7E2D6' },
  segBtn: { height: 36, paddingHorizontal: 18, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: colors.ink },
  segText: { fontFamily: fonts.body700, fontSize: 14.5, color: colors.ink },
  week: { flexDirection: 'row', gap: 6 },
  day: { width:48, height: 64, borderRadius: 14, backgroundColor: '#FBFAF6', alignItems: 'center', justifyContent: 'center', gap: 1 },
  dayOn: { backgroundColor: colors.ink },
  dayWd: { fontFamily: fonts.body500, fontSize: 11.5, color: colors.muted },
  dayN: { fontFamily: fonts.body600, fontSize: 19, color: colors.ink },
  dayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent },
  secRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sec: { fontFamily: fonts.display700, fontSize: 19, color: colors.ink },
  count: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  countText: { fontFamily: fonts.mono600, fontSize: 11.5, color: colors.ink },
  cap: { fontFamily: fonts.mono600, fontSize: 11, letterSpacing: 0.9, color: colors.muted, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20, backgroundColor: '#FBFAF6', borderWidth: 1, borderColor: '#E5E0D4' },
  inviteRow: { borderColor: colors.accent, gap: 8 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  tile: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  fromFace: { position: 'absolute', right: -6, bottom: -6, borderWidth: 2, borderColor: '#FBFAF6' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: fonts.display700, fontSize: 16, color: colors.ink },
  time: { fontFamily: fonts.mono600, fontSize: 13.5, color: colors.ink },
  sub: { fontFamily: fonts.mono500, fontSize: 12.5, color: colors.muted2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', minHeight: 24 },
  ok: { position: 'absolute', right: -2, bottom: -2, width: 13, height: 13, borderRadius: 7, backgroundColor: colors.ok, borderWidth: 1.5, borderColor: '#FBFAF6', alignItems: 'center', justifyContent: 'center' },
  look: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 24, paddingHorizontal: 8, borderRadius: 12, backgroundColor: '#FBDCCB' },
  lookText: { fontFamily: fonts.body700, fontSize: 12.5, color: colors.accentText },
  ans: { fontFamily: fonts.body500, fontSize: 12.5, color: colors.muted2 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 8, paddingTop: 60, paddingHorizontal: 20 },
  emptyTitle: { fontFamily: fonts.display700, fontSize: 22, color: colors.ink },
  emptySub: { fontFamily: fonts.body400, fontSize: 15, lineHeight: 21, color: colors.muted, textAlign: 'center' },
  emptyBtn: { marginTop: 8, height: 48, paddingHorizontal: 22, borderRadius: 15, backgroundColor: colors.ink, justifyContent: 'center' },
  emptyBtnText: { fontFamily: fonts.body700, fontSize: 15, color: colors.paper },
});
