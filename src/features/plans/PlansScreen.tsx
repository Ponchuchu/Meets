// «Планы» (FIX5, новый вид): «Дальше по плану» крупной карточкой с обратным отсчётом, лента дней с точками,
// «Зовут» с «Не смогу / Иду», расписание по дням на линии времени. Длинный список — порциями по 30.
// 26 окт.: любой план (и «Дальше по плану») смахивается влево и открывает меню по удержанию; «+» — встреча или своё дело
// («в 15:00 встретиться с Ерланом»); нижние плитки «Места города / Год в Алматы» убраны — они есть на карте.
import { routeParams } from '../../lib/routeParams';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { CalendarDays, Bell, BellOff, UserPlus, Trash2, Check, Hand, Navigation, X, Plus, Users, ListTodo } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabInset } from '../../components/TabBar';
import { data, eventsSnapshot, type EventItem, type Person } from '../../data';
import { almaty, dayIndex, now as clockNow } from '../../lib/clock';
import { config } from '../../lib/config';
import { toggleEventReminder, answerInvite, getEventsByIds, getInvites, type Invite } from '../../live/api';
import { myId } from '../../live/auth';
import { CAT_COLOR } from '../../map/icons';
import { EventCover } from '../../ui/EventCover';
import { plural } from '../../event/text';
import { usePlans } from '../../state/plans';
import { DayTimeWheel, MonthCalendar, wheelDayLabel } from '../../event/ui/pickers';
import { uid } from '../../lib/uid';
import { eventStatusLabel } from '../../event/availability';
import { Backdrop, BottomSheet } from '../../ui/sheet';
import { SwipeRow, type RowAction } from '../../ui/SwipeRow';
import { StateView } from '../../ui/StateView';
import { colors, fonts } from '../../theme';
import { Avatar } from '../../ui/Avatar';
import { plate } from '../../ui/glass';

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

function Faces({ ids, people }: { ids: string[]; people: Person[] }) {
  const ps = ids.map((id) => people.find((p) => p.id === id)).filter(Boolean) as Person[];
  if (!ps.length) return null;
  return (
    <View style={{ flexDirection: 'row' }}>
      {ps.slice(0, 4).map((p, i) => (
        <View key={p.id} style={{ marginLeft: i ? -6 : 0 }}>
          <Avatar p={p} size={24} style={{ borderWidth: 2, borderColor: '#FBFAF6' }} />
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
  const [pick, setPick] = useState<number[]>([]);
  const [calendar, setCalendar] = useState(false);
  const [calendarPick, setCalendarPick] = useState(false);
  const [actionError,setActionError]=useState('');
  const [menu, setMenu] = useState<EventItem | null>(null);
  const [adding, setAdding] = useState<null | 'choose' | 'task'>(null);
  const muted = usePlans((s) => s.muted);
  const toggleDay = (d: number) => setPick((p) => p.includes(d) ? p.filter((x) => x !== d) : [...p, d]);
  const [now,setNow] = useState(clockNow);
  useFocusEffect(useCallback(()=>{setNow(clockNow());const timer=setInterval(()=>setNow(clockNow()),60000);return()=>clearInterval(timer);},[]));
  const today = dayIndex(now);
  const me = myId();
  const going = usePlans((s) => s.going);
  const visits = usePlans(s => s.visits);
  const meetups = usePlans((s) => s.meetups);
  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: () => data.getEvents(), placeholderData: eventsSnapshot });
  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => data.getPeople() });
  const { data: invites = [] } = useQuery<Invite[]>({ queryKey: ['invites'], queryFn: getInvites, enabled: LIVE, staleTime: 30e3 });
  useFocusEffect(useCallback(() => { void qc.invalidateQueries({ queryKey: ['invites'] }); }, [qc]));

  const all = useMemo(() => [...meetups, ...events], [meetups, events]);
  const known = new Set(all.map((e) => e.id));
  const missing = [...new Set([...Object.keys(going), ...invites.map((i) => i.event_id ?? '')])].filter((id) => id && !known.has(id));
  const { data: extra = [] } = useQuery({ queryKey: ['eventsById', missing.sort().join(',')], queryFn: () => getEventsByIds(missing), enabled: LIVE && missing.length > 0 });
  const byId = (id: string) => { const e = all.find(e => e.id === id) ?? extra.find(e => e.id === id); return e && visits[id] ? { ...e, startsAt: visits[id] } : e; };

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
      key: 'bell', label: muted[e.id] ? 'Включить напоминание' : 'Выключить напоминание', color: '#8C8577',
      icon: muted[e.id] ? <Bell size={22} color="#FFFFFF" strokeWidth={1.9} /> : <BellOff size={22} color="#FFFFFF" strokeWidth={1.9} />,
      onPress: async () => {
        setActionError('');
        if (LIVE) { try { await toggleEventReminder(e.id); } catch { setActionError('Не удалось сохранить напоминание. Проверь связь'); } }
        else usePlans.getState().toggleReminder(e.id);
      },
    },
    { key: 'invite', label: 'Позвать', color: colors.friend, icon: <UserPlus size={22} color="#FFFFFF" strokeWidth={1.9} />, onPress: () => router.push({ pathname: '/event/[id]', params: { id: e.id, invite: '1' } }) },
    { key: 'del', label: 'Убрать', color: '#D8362A', icon: <Trash2 size={22} color="#FFFFFF" strokeWidth={1.9} />, onPress: () => usePlans.getState().ungo(e.id) },
  ].filter((a) => a.key !== 'invite' || !eventStatusLabel(e));
  const open = (e: EventItem) => router.push({ pathname: '/event/[id]', params: { id: e.id } });

  // Ближайший план — крупной карточкой сверху (FIX5, как «Next up» в календарях): обратный отсчёт и кто идёт.
  const next = !pick.length ? soon[0] : undefined;
  const rest = next ? groups.map((g) => ({ ...g, items: g.items.filter((e) => e.id !== next.id) })).filter((g) => g.items.length) : groups;
  // Очень длинный список не рисуем целиком: первые 30 планов, дальше — «Показать ещё».
  const [limit, setLimit] = useState(30);
  let shown = 0;
  const limited = rest.map((g) => { const items = g.items.slice(0, Math.max(0, limit - shown)); shown += items.length; return { ...g, items }; }).filter((g) => g.items.length);
  const hidden = rest.reduce((n, g) => n + g.items.length, 0) - shown;

  return (
    <View style={styles.root}><ScrollView style={styles.root} contentContainerStyle={{ paddingTop: Math.max(50, insets.top + 6), paddingBottom: pad + 20, paddingHorizontal: 16, gap: 16 }}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1} accessibilityRole="header">Планы</Text>
          <Text style={styles.headSub}>{soon.length ? `${soon.length} ${plural(soon.length, 'план', 'плана', 'планов')} впереди` : 'Пока ничего не запланировано'}</Text>
        </View>
        <Pressable onPress={() => setCalendar(true)} style={styles.headBtn} accessibilityRole="button" accessibilityLabel="Календарь планов"><CalendarDays size={21} color={colors.ink} strokeWidth={1.9} /></Pressable>
        <Pressable onPress={() => setAdding('choose')} style={[styles.headBtn, { backgroundColor: colors.ink }]} accessibilityRole="button" accessibilityLabel="Добавить в планы: встреча или своё дело"><Plus size={22} color={colors.paper} strokeWidth={2.2} /></Pressable>
      </View>

      {/* Неделя: дни с планами — с точками; можно выбрать несколько. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} style={{ marginHorizontal: -16 }}>
        {(calendarPick && pick.length ? [...new Set([...week, ...pick])].sort((a, b) => a - b) : week).map((d) => {
          const a = almaty(new Date(now.getTime() + (d - today) * 86400e3));
          const on = pick.includes(d);
          const n = soon.filter((e) => dayIndex(e.startsAt) === d).length;
          const weekend = a.getUTCDay() === 0 || a.getUTCDay() === 6;
          return (
            <Pressable key={d} onPress={() => toggleDay(d)} style={({ pressed }) => [styles.day, on && styles.dayOn, pressed && { transform: [{ scale: 0.95 }] }]} accessibilityRole="button" accessibilityState={{ selected: on }}
              accessibilityLabel={`${WD[a.getUTCDay()]} ${a.getUTCDate()}${has(d) ? ', есть планы' : ''}`}>
              <Text style={[styles.dayWd, weekend && { color: colors.accentText }, on && { color: '#FFD9C7' }]}>{d === today ? 'сегодня' : WD[a.getUTCDay()].toLowerCase()}</Text>
              <Text style={[styles.dayN, on && { color: colors.paper }]}>{a.getUTCDate()}</Text>
              <View style={styles.dots}>{Array.from({ length: Math.min(3, n) }, (_, i) => <View key={i} style={[styles.dayDot, on && { backgroundColor: colors.accent }]} />)}{!n && has(d) && <View style={styles.dayDot} />}</View>
            </Pressable>
          );
        })}
      </ScrollView>
      {pick.length > 0 && (
        <Pressable onPress={() => { setPick([]); setCalendarPick(false); }} style={styles.clear} accessibilityRole="button" accessibilityLabel="Показать все планы">
          <X size={14} color={colors.ink} strokeWidth={2.4} /><Text style={styles.clearText}>Выбрано дней: {pick.length} · показать все</Text>
        </Pressable>
      )}
      {!!actionError && <Text style={{ color: colors.accentText, fontFamily: fonts.body500 }}>{actionError}</Text>}

      {incoming.length > 0 && (
        <View style={{ gap: 10 }}>
          <View style={styles.secRow}><Text style={styles.sec}>Зовут</Text><View style={styles.count}><Text style={styles.countText}>{incoming.length}</Text></View></View>
          {incoming.map((inv) => {
            const e = byId(inv.event_id!)!;
            const from = people.find((p) => p.id === inv.from_id);
            const d = dayIndex(e.startsAt);
            return (
              <Animated.View key={inv.id} entering={FadeIn} exiting={FadeOut} layout={LinearTransition} style={styles.invite}>
                <Pressable onPress={() => open(e)} style={styles.rowMain} accessibilityRole="button">
                  <View>
                    <Cover e={e} size={54} />
                    {from && <Avatar p={from} size={26} style={styles.fromFace} />}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.inviteFrom} numberOfLines={1}>{from?.name ?? 'Друг'} зовёт</Text>
                    <Text style={styles.title} numberOfLines={1}>{e.title}</Text>
                    <Text style={styles.sub} numberOfLines={1}>{d === today ? 'сегодня' : d === today + 1 ? 'завтра' : WD[almaty(e.startsAt).getUTCDay()].toLowerCase()} · {hm(e.startsAt)}</Text>
                  </View>
                </Pressable>
                <View style={styles.inviteBtns}>
                  <Pressable onPress={() => void answer(inv, false)} style={[styles.answerBtn, { backgroundColor: 'rgba(23,22,26,0.07)' }]} accessibilityRole="button" accessibilityLabel={`Не смогу: ${e.title}`}>
                    <Text style={styles.answerText}>Не смогу</Text>
                  </Pressable>
                  <Pressable onPress={() => void answer(inv, true)} style={[styles.answerBtn, { backgroundColor: colors.ink }]} accessibilityRole="button" accessibilityLabel={`Иду: ${e.title}`}>
                    <Check size={16} color={colors.paper} strokeWidth={2.6} /><Text style={[styles.answerText, { color: colors.paper }]}>Иду</Text>
                  </Pressable>
                </View>
              </Animated.View>
            );
          })}
        </View>
      )}

      {next && <SwipeRow iconOnly actions={rowActions(next)} background="#EEE9DE" radius={26}><NextUp e={next} now={now} people={people} onOpen={() => open(next)} onMenu={() => setMenu(next)} /></SwipeRow>}

      {limited.map((g) => (
        <View key={g.day} style={{ gap: 2 }}>
          <View style={styles.dayHead}>
            <Text style={[styles.dayHeadText, g.day === today && { color: colors.accentText }]}>{dayTitle(g.day, today, g.items[0].startsAt)}</Text>
            <View style={styles.dayLine} />
          </View>
          {g.items.map((e, i) => {
            const sent = sentFor(e.id);
            const looking = Math.max(e.lookingCount, e.lookers?.length ?? 0);
            const status = eventStatusLabel(e);
            const live = Date.parse(e.startsAt) <= now.getTime() && endOf(e) > now.getTime();
            return (
              <View key={e.id} style={styles.slot}>
                {/* Линия времени: время слева, точка цвета события и тонкая линия к следующему плану. */}
                <View style={styles.rail}>
                  <Text style={[styles.railTime, live && { color: colors.accentText }]}>{e.isLong && !visits[e.id] ? 'весь\nдень' : hm(e.startsAt)}</Text>
                  <View style={[styles.railDot, { backgroundColor: CAT_COLOR[e.category] }, live && styles.railLive]} />
                  {i < g.items.length - 1 && <View style={styles.railLine} />}
                </View>
                <View style={{ flex: 1, paddingBottom: 10 }}>
                  <SwipeRow iconOnly actions={rowActions(e)} background="#EEE9DE" radius={20}>
                    <Pressable onPress={() => open(e)} onLongPress={() => setMenu(e)} delayLongPress={350} style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.985 }] }]} accessibilityRole="button" accessibilityLabel={`${e.title}, ${hm(e.startsAt)}`}>
                      <Cover e={e} size={56} />
                      <View style={{ flex: 1, gap: 4 }}>
                        <StartPill e={e} now={now} />
                        <Text style={styles.title} numberOfLines={2}>{e.title}</Text>
                        <Text style={styles.sub} numberOfLines={1}>{e.venueName ?? e.address.split(',')[0]}</Text>
                        {status && <Text style={[styles.sub, { color: colors.accentText }]}>{status}</Text>}
                        {(e.friendsGoing.length > 0 || looking > 0 || sent.length > 0 || muted[e.id]) && <View style={styles.meta}>
                          <Faces ids={e.friendsGoing} people={people} />
                          {looking > 0 && <View style={styles.look}><Hand size={12} color={colors.accentText} strokeWidth={2} /><Text style={styles.lookText}>{looking}</Text></View>}
                          {muted[e.id] && <BellOff size={14} color={colors.muted} strokeWidth={2} />}
                          {sent.slice(0, 2).map((x) => {
                            const p = people.find((y) => y.id === x.to_id);
                            return <Text key={x.id} style={styles.ans} numberOfLines={1}>{p?.name ?? 'Друг'}: {x.answer === 'yes' ? 'идёт' : x.answer === 'no' ? 'не сможет' : 'ждём'}</Text>;
                          })}
                        </View>}
                      </View>
                    </Pressable>
                  </SwipeRow>
                </View>
              </View>
            );
          })}
        </View>
      ))}
      {hidden > 0 && (
        <Pressable onPress={() => setLimit((l) => l + 30)} style={styles.more} accessibilityRole="button">
          <Text style={styles.moreText}>Показать ещё {hidden}</Text>
        </Pressable>
      )}

      {!groups.length && !incoming.length && (
        <StateView kind="empty" style={{ paddingTop: 24 }}
          title={!pick.length ? 'Пока пусто' : 'В этот день ничего'}
          text="Смахни карточку вправо в «Рекомендациях» — она прилетит сюда."
          action="Открыть рекомендации" onAction={() => router.navigate('/foryou')} />
      )}

    </ScrollView>
    {menu && <PlanMenu e={menu} muted={!!muted[menu.id]} onClose={() => setMenu(null)} actions={rowActions(menu)} />}
    {adding === 'choose' && <><Backdrop label="Закрыть" onPress={() => setAdding(null)} /><BottomSheet label="Добавить в планы" onClose={() => setAdding(null)}>
      <Text style={styles.sheetTitle}>Добавить в планы</Text>
      <Pressable onPress={() => { setAdding(null); router.push('/create'); }} style={({ pressed }) => [styles.addRow, pressed && { opacity: 0.8 }]} accessibilityRole="button">
        <View style={[styles.addIcon, { backgroundColor: colors.friend }]}><Users size={20} color="#FFFFFF" strokeWidth={2} /></View>
        <View style={{ flex: 1 }}><Text style={styles.title}>Встреча с друзьями</Text><Text style={styles.sub}>Место на карте, время, кого позвать</Text></View>
      </Pressable>
      <Pressable onPress={() => setAdding('task')} style={({ pressed }) => [styles.addRow, pressed && { opacity: 0.8 }]} accessibilityRole="button">
        <View style={[styles.addIcon, { backgroundColor: colors.accent }]}><ListTodo size={20} color="#FFFFFF" strokeWidth={2} /></View>
        <View style={{ flex: 1 }}><Text style={styles.title}>Своё дело</Text><Text style={styles.sub}>«В 15:00 встретиться с Ерланом» — напомню за час</Text></View>
      </Pressable>
    </BottomSheet></>}
    {adding === 'task' && <TaskSheet now={now} onClose={() => setAdding(null)} />}
    {calendar && <><Backdrop label="Закрыть календарь" onPress={() => setCalendar(false)} /><BottomSheet label="Календарь планов" onClose={() => setCalendar(false)}><MonthCalendar now={now} value={pick.length ? pick[0] - today : 0} selectedDays={pick} markedDays={soon.map((e) => dayIndex(e.startsAt))} onPick={(off) => toggleDay(today + off)} /><Pressable onPress={() => { setCalendarPick(pick.length > 0); setCalendar(false); }} style={styles.emptyBtn}><Text style={styles.emptyBtnText}>Показать планы</Text></Pressable></BottomSheet></>}
    </View>
  );
}

/** Обложка плана: фото события, иначе плитка цвета раздела с иконкой. */
function Cover({ e, size }: { e: EventItem; size: number }) {
  return <EventCover cover={e.cover} category={e.category} color={e.coverColor} style={{ width: size, height: size, borderRadius: 16 }} iconSize={Math.round(size * 0.46)} />;
}

/**
 * Плашка «идёт сейчас» / «через 25 мин» (26 октября: с карты это убрано — видно здесь).
 * Идёт — зелёная с мягко пульсирующей точкой; до начала меньше двух часов — оранжевая с обратным отсчётом.
 */
function StartPill({ e, now }: { e: EventItem; now: Date }) {
  const start = Date.parse(e.startsAt);
  const left = start - now.getTime();
  const live = left <= 0 && endOf(e) > now.getTime() && !e.isLong;
  const soon = left > 0 && left < 2 * 3600e3;
  if (!live && !soon) return null;
  const text = live ? 'идёт сейчас' : left < 3600e3 ? `через ${Math.max(1, Math.round(left / 60000))} мин` : `через ${Math.floor(left / 3600e3)} ч ${Math.round((left % 3600e3) / 60000)} мин`;
  return (
    <Animated.View entering={FadeIn.duration(220)} style={[styles.pill, live ? styles.pillLive : styles.pillSoon]}>
      <PulseDot color={live ? '#2FA35A' : colors.accent} />
      <Text style={[styles.pillText, { color: live ? '#1E7A43' : colors.accentText }]}>{text}</Text>
    </Animated.View>
  );
}

function PulseDot({ color }: { color: string }) {
  const t = useSharedValue(0);
  useEffect(() => { t.set(withRepeat(withTiming(1, { duration: 1400 }), -1, false)); }, [t]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.5 * (1 - t.get()), transform: [{ scale: 1 + t.get() * 1.6 }] }));
  return (
    <View style={styles.pulse}>
      <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 4, backgroundColor: color }, ring]} />
      <View style={[styles.pulseCore, { backgroundColor: color }]} />
    </View>
  );
}

/** «Дальше по плану»: фото, обратный отсчёт, место и кто идёт; кнопки «Маршрут» и «Позвать». */
function NextUp({ e, now, people, onOpen, onMenu }: { e: EventItem; now: Date; people: Person[]; onOpen: () => void; onMenu: () => void }) {
  const start = Date.parse(e.startsAt);
  const left = start - now.getTime();
  const when = left <= 0 ? 'идёт сейчас' : left < 3600e3 ? `через ${Math.max(1, Math.round(left / 60000))} мин` : left < 24 * 3600e3 ? `через ${Math.floor(left / 3600e3)} ч ${Math.round((left % 3600e3) / 60000)} мин` : `через ${Math.round(left / 86400e3)} ${plural(Math.round(left / 86400e3), 'день', 'дня', 'дней')}`;
  const friends = e.friendsGoing.map((id) => people.find((p) => p.id === id)).filter(Boolean) as Person[];
  return (
    <Pressable onPress={onOpen} onLongPress={onMenu} delayLongPress={350} style={({ pressed }) => [styles.next, pressed && { transform: [{ scale: 0.99 }] }]} accessibilityRole="button" accessibilityLabel={`Дальше по плану: ${e.title}, ${when}`}>
      <EventCover cover={e.cover} category={e.category} color={e.coverColor} style={styles.nextCover} iconSize={44} />
      <View style={styles.nextBody}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={[styles.nextDot, left <= 0 && { backgroundColor: colors.ok }]} />
          <Text style={styles.nextCap} numberOfLines={1}>{when.toUpperCase()}</Text>
        </View>
        <Text style={styles.nextTitle} numberOfLines={2}>{e.title}</Text>
        <Text style={styles.sub} numberOfLines={1}>{hm(e.startsAt)} · {e.venueName ?? e.address.split(',')[0]}</Text>
        <View style={styles.nextRow}>
          {friends.length > 0 ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
            <View style={{ flexDirection: 'row' }}>{friends.slice(0, 3).map((p, i) => <Avatar key={p.id} p={p} size={22} style={{ marginLeft: i ? -7 : 0, borderWidth: 2, borderColor: '#FBFAF6' }} />)}</View>
            <Text style={styles.sub} numberOfLines={1}>{friends.length === 1 ? `${friends[0].name} тоже идёт` : `${friends.length} друга идут`}</Text>
          </View> : <View style={{ flex: 1 }} />}
          <Pressable onPress={() => router.push({ pathname: '/route', params: routeParams(e) })} style={styles.nextBtn} accessibilityRole="button" accessibilityLabel="Маршрут">
            <Navigation size={14} color={colors.paper} strokeWidth={2.2} /><Text style={styles.nextBtnText}>Маршрут</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

/** Меню плана по удержанию: те же действия, что под смахиванием, крупными строками. */
function PlanMenu({ e, actions, onClose }: { e: EventItem; muted: boolean; actions: RowAction[]; onClose: () => void }) {
  return (
    <>
      <Backdrop label="Закрыть меню" onPress={onClose} />
      <BottomSheet label={e.title} onClose={onClose}>
        <View style={styles.menuHead}><Cover e={e} size={48} /><View style={{ flex: 1 }}><Text style={styles.title} numberOfLines={2}>{e.title}</Text><Text style={styles.sub}>{hm(e.startsAt)} · {e.venueName ?? (e.address.split(',')[0] || 'без места')}</Text></View></View>
        {!e.noPoint && <Pressable onPress={() => { onClose(); router.push({ pathname: '/route', params: routeParams(e) }); }} style={styles.menuRow} accessibilityRole="button"><Navigation size={20} color={colors.ink} strokeWidth={1.9} /><Text style={styles.menuText}>Маршрут</Text></Pressable>}
        {actions.map((a) => (
          <Pressable key={a.key} onPress={() => { onClose(); void a.onPress(); }} style={styles.menuRow} accessibilityRole="button">
            {a.key === 'del' ? <Trash2 size={20} color="#D8362A" strokeWidth={1.9} /> : a.key === 'invite' ? <UserPlus size={20} color={colors.ink} strokeWidth={1.9} /> : <Bell size={20} color={colors.ink} strokeWidth={1.9} />}
            <Text style={[styles.menuText, a.key === 'del' && { color: '#D8362A' }]}>{a.key === 'del' ? 'Убрать из планов' : a.label}</Text>
          </Pressable>
        ))}
      </BottomSheet>
    </>
  );
}

/** Своё дело (26 окт.): название, где (необязательно), день и время барабаном. Живёт в «Планах» с напоминанием за час. */
function TaskSheet({ now, onClose }: { now: Date; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [place, setPlace] = useState('');
  const today = dayIndex(now);
  const nowMin = (almaty(now).getUTCHours() * 60 + almaty(now).getUTCMinutes());
  const days = useMemo(() => Array.from({ length: 30 }, (_, k) => ({ key: today + k, label: wheelDayLabel(today + k, today),
    times: Array.from({ length: 96 }, (_, i) => i * 15).filter((m) => k > 0 || m > nowMin + 10).map((m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`) }))
    .filter((d) => d.times.length), [today, nowMin]);
  const [day, setDay] = useState(days[0]?.key ?? today);
  const [time, setTime] = useState<string | null>(null);
  const cur = days.find((d) => d.key === day) ?? days[0];
  const t = time && cur?.times.includes(time) ? time : (cur?.times.find((x) => x >= '18:00') ?? cur?.times[0]);
  const add = () => {
    if (!title.trim() || !cur || !t) return;
    const ymd = new Date(Date.UTC(1970, 0, 1) + cur.key * 86400e3).toISOString().slice(0, 10);
    const startsAt = new Date(`${ymd}T${t}:00+05:00`).toISOString();
    const e = {
      id: `task-${uid()}`, title: title.trim(), category: 'meetup', tags: ['дело'], startsAt, endsAt: new Date(Date.parse(startsAt) + 3600e3).toISOString(), isLong: false,
      venueName: place.trim() || null, address: place.trim(), lat: 43.2389, lon: 76.8897, needsPin: true, noPoint: true,
      priceMin: null, priceMax: null, isFree: true, about: '', organizer: 'Ты', sourceUrl: null, cover: null, visibility: 'friends', origin: 'demo',
      friendsGoing: [], lookingCount: 0, goingCount: 1, meetup: { kind: 'task', plusOne: false, invited: [], items: [] },
    } as EventItem;
    usePlans.getState().addMeetup(e);
    onClose();
  };
  return (
    <>
      <Backdrop label="Закрыть" onPress={onClose} />
      <BottomSheet label="Своё дело" onClose={onClose} scroll>
        <Text style={styles.sheetTitle}>Своё дело</Text>
        <TextInput value={title} onChangeText={setTitle} placeholder="Встретиться с Ерланом" placeholderTextColor={colors.muted3} style={styles.input} accessibilityLabel="Что за дело" autoFocus maxLength={80} />
        <TextInput value={place} onChangeText={setPlace} placeholder="Где (необязательно)" placeholderTextColor={colors.muted3} style={styles.input} accessibilityLabel="Где" maxLength={80} />
        {cur && <View style={styles.wheelBox}><DayTimeWheel days={days} day={cur.key} time={t ?? null} onChange={(d, x) => { setDay(d); setTime(x); }} /></View>}
        <Pressable disabled={!title.trim()} onPress={add} style={({ pressed }) => [styles.emptyBtn, !title.trim() && { opacity: 0.4 }, pressed && { transform: [{ scale: 0.98 }] }]} accessibilityRole="button">
          <Text style={styles.emptyBtnText}>{cur && t ? `Добавить · ${cur.label.toLowerCase()} ${t}` : 'Добавить'}</Text>
        </Pressable>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  sheetTitle: { fontFamily: fonts.display800, fontSize: 24, letterSpacing: -0.5, color: colors.ink },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, padding: 12, borderRadius: 18, backgroundColor: colors.card },
  addIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  menuHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 6 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 52, paddingHorizontal: 6, borderTopWidth: 1, borderTopColor: 'rgba(23,22,26,0.07)' },
  menuText: { fontFamily: fonts.body600, fontSize: 16, color: colors.ink },
  input: { minHeight: 50, borderRadius: 16, backgroundColor: colors.card, paddingHorizontal: 14, fontFamily: fonts.body500, fontSize: 16, color: colors.ink },
  wheelBox: { borderRadius: 20, backgroundColor: colors.card, overflow: 'hidden' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', height: 22, paddingHorizontal: 9, borderRadius: 11 },
  pillLive: { backgroundColor: 'rgba(47,163,90,0.14)' },
  pillSoon: { backgroundColor: 'rgba(240,82,31,0.12)' },
  pillText: { fontFamily: fonts.body700, fontSize: 12 },
  pulse: { width: 8, height: 8, alignItems: 'center', justifyContent: 'center' },
  pulseCore: { width: 8, height: 8, borderRadius: 4 },
  root: { flex: 1, backgroundColor: colors.paper },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  h1: { fontFamily: fonts.display800, fontSize: 30, letterSpacing: -0.9, color: colors.ink },
  headSub: { fontFamily: fonts.body500, fontSize: 13.5, color: colors.muted, marginTop: 1 },
  headBtn: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', ...plate },
  day: { width: 54, height: 74, borderRadius: 18, backgroundColor: '#EEE9DE', alignItems: 'center', justifyContent: 'center', gap: 1, borderWidth: 1, borderColor: 'rgba(23,22,26,0.05)' },
  dayOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  dayWd: { fontFamily: fonts.mono600, fontSize: 9, letterSpacing: 0.3, color: colors.muted, textTransform: 'uppercase' },
  dayN: { fontFamily: fonts.display800, fontSize: 22, letterSpacing: -0.5, color: colors.ink, lineHeight: 27 },
  dots: { flexDirection: 'row', gap: 3, height: 5 },
  dayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent },
  clear: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: 'rgba(23,22,26,0.07)', marginTop: -6 },
  clearText: { fontFamily: fonts.body600, fontSize: 13, color: colors.ink },
  secRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sec: { fontFamily: fonts.display700, fontSize: 19, color: colors.ink },
  count: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  countText: { fontFamily: fonts.mono600, fontSize: 11.5, color: colors.ink },
  invite: { padding: 12, gap: 12, borderRadius: 22, backgroundColor: '#FBFAF6', borderWidth: 1.5, borderColor: 'rgba(240,82,31,0.45)', boxShadow: '0 8px 20px -12px rgba(240,82,31,0.5)' },
  inviteFrom: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.5, color: colors.accentText, textTransform: 'uppercase' },
  inviteBtns: { flexDirection: 'row', gap: 8 },
  answerBtn: { flex: 1, height: 44, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  answerText: { fontFamily: fonts.body700, fontSize: 14.5, color: colors.ink },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fromFace: { position: 'absolute', right: -6, bottom: -6, borderWidth: 2, borderColor: '#FBFAF6' },
  next: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 22, overflow: 'hidden', backgroundColor: '#FBFAF6', boxShadow: '0 16px 32px -18px rgba(23,22,26,0.45), 0 2px 6px rgba(23,22,26,0.06)' },
  nextCover: { width: 84, height: 84, borderRadius: 16 },
  nextShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(23,22,26,0.12)' },
  nextBadge: { position: 'absolute', left: 12, top: 12, flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: 'rgba(23,22,26,0.72)' },
  nextDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  nextBadgeText: { fontFamily: fonts.mono600, fontSize: 11, letterSpacing: 0.6, color: '#FFFFFF' },
  nextBody: { flex: 1, minWidth: 0, gap: 2 },
  nextCap: { fontFamily: fonts.mono600, fontSize: 10, letterSpacing: 0.8, color: colors.muted },
  nextTitle: { fontFamily: fonts.display800, fontSize: 17, letterSpacing: -0.3, lineHeight: 21, color: colors.ink },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  nextBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: colors.ink },
  nextBtnText: { fontFamily: fonts.body700, fontSize: 13.5, color: colors.paper },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, marginBottom: 8 },
  dayHeadText: { fontFamily: fonts.mono600, fontSize: 11, letterSpacing: 0.9, color: colors.muted },
  dayLine: { flex: 1, height: 1, backgroundColor: 'rgba(23,22,26,0.08)' },
  slot: { flexDirection: 'row', gap: 10 },
  rail: { width: 46, alignItems: 'center' },
  railTime: { fontFamily: fonts.mono600, fontSize: 12.5, color: colors.ink, textAlign: 'center', marginTop: 4 },
  railDot: { width: 11, height: 11, borderRadius: 6, marginTop: 7, borderWidth: 2, borderColor: colors.paper, boxShadow: '0 0 0 1px rgba(23,22,26,0.12)' },
  railLive: { width: 13, height: 13, borderRadius: 7, boxShadow: '0 0 0 4px rgba(240,82,31,0.22)' },
  railLine: { flex: 1, width: 2, borderRadius: 1, backgroundColor: 'rgba(23,22,26,0.1)', marginTop: 4 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 20, backgroundColor: '#FBFAF6', boxShadow: '0 1px 2px rgba(23,22,26,0.06), 0 6px 16px -12px rgba(23,22,26,0.35)' },
  title: { fontFamily: fonts.display700, fontSize: 15.5, lineHeight: 19, color: colors.ink },
  sub: { fontFamily: fonts.body500, fontSize: 13, color: colors.muted2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 },
  ok: { position: 'absolute', right: -2, bottom: -2, width: 13, height: 13, borderRadius: 7, backgroundColor: colors.ok, borderWidth: 1.5, borderColor: '#FBFAF6', alignItems: 'center', justifyContent: 'center' },
  look: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 22, paddingHorizontal: 7, borderRadius: 11, backgroundColor: '#F6D5C3' },
  lookText: { fontFamily: fonts.body700, fontSize: 12, color: colors.accentText },
  ans: { fontFamily: fonts.body500, fontSize: 12, color: colors.muted2 },
  more: { alignSelf: 'center', height: 44, paddingHorizontal: 18, borderRadius: 22, justifyContent: 'center', backgroundColor: 'rgba(23,22,26,0.07)' },
  moreText: { fontFamily: fonts.body700, fontSize: 14, color: colors.ink },
  emptyBtn: { marginTop: 8, height: 48, paddingHorizontal: 22, borderRadius: 15, backgroundColor: colors.ink, justifyContent: 'center' },
  emptyBtnText: { fontFamily: fonts.body700, fontSize: 15, color: colors.paper, textAlign: 'center' },
});
