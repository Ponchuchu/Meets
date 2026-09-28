// Единый шаблон события (design/screens/EventPage). Порядок полей строго по PRODUCT.md, раздел 4:
// Обложка → Название → Когда + погода → Адрес + «Маршрут» → Цена → Описание → Организатор → Кто идёт → Ищут компанию → Чат.
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { data } from '../data';
import { photo } from '../data/photos';
import type { EventItem, Person } from '../data/types';
import { dayIndex } from '../lib/clock';
import { formatPrice } from '../lib/format';
import { CAT_ICON, CAT_LABEL } from '../map/icons';
import { useApp } from '../state/app';
import { activeCompany, usePlans } from '../state/plans';
import { colors, fonts } from '../theme';
import { Avatar } from '../ui/Avatar';
import { Ic, IC } from '../ui/Ic';
import { Backdrop, BottomSheet } from '../ui/sheet';
import { Toast, type ToastData } from '../ui/Toast';
import { CompanySheet, InviteSheet, RouteSheet } from './sheets';
import { coverDate, coverLinesFor, coverTime, plural, priceTitle, whenSub, whenTitle } from './text';

const COVER: Partial<Record<EventItem['category'], string>> = {
  music: colors.accent, standup: colors.ink, art: colors.sand, hike: colors.ink, games: colors.softGreen, concert: colors.ink,
  food: colors.softYellow, sport: colors.softBlue, bike: colors.softBlue, theatre: colors.softPink, lecture: colors.softGreen, talks: colors.softGreen, party: colors.ink, meetup: colors.softYellow,
};

type Sheet = null | 'company' | 'invite' | 'route';

export function goingLine(e: EventItem, people: Person[], iAmGoing: boolean): { title: string; sub: string; faces: Person[] } | null {
  const friends = e.friendsGoing.map((id) => people.find((p) => p.id === id)).filter(Boolean) as Person[];
  const total = e.goingCount + (iAmGoing ? 1 : 0);
  // «Кто идёт» показываем от 3 человек.
  if (total < 3 && friends.length === 0) return null;
  const others = Math.max(0, e.goingCount - friends.length);
  if (!friends.length) return { title: 'Друзей пока нет', sub: `идут ${total.toLocaleString('ru-RU')} ${plural(total, 'человек', 'человека', 'человек')}`, faces: [] };
  const title = friends.length === 1 ? friends[0].name : friends.length === 2 ? `${friends[0].name} и ${friends[1].name}` : `${friends[0].name}, ${friends[1].name} и ещё ${friends.length - 2}`;
  return { title, sub: others ? `и ещё ${others} ${plural(others, 'человек', 'человека', 'человек')}` : 'из твоих друзей', faces: friends };
}

export function EventPage({ e, now, onClose, closeLabel = 'Назад к карте' }: { e: EventItem; now: Date; onClose: () => void; closeLabel?: string }) {
  const insets = useSafeAreaInsets();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => data.getPeople() });
  const going = usePlans((s) => !!s.going[e.id]);
  const saved = usePlans((s) => !!s.saved[e.id]);
  const company = usePlans((s) => s.company[e.id]);
  const { go, ungo, toggleSave, invite, startChat } = usePlans.getState();
  const addPlan = useApp((s) => s.addPlan);
  const removePlan = useApp((s) => s.removePlan);

  const show = (t: ToastData | null, ms = 4000) => {
    setToast(t);
    if (t) setTimeout(() => setToast((cur) => (cur === t ? null : cur)), ms);
  };

  const toggleGo = () => {
    if (going) { ungo(e.id); removePlan(); show(null); return; }
    go(e.id);
    addPlan();
    show({ text: 'Добавил в «Мои планы». Напомню за 2 часа', cta: 'Отменить', onCta: () => { ungo(e.id); removePlan(); setToast(null); } });
  };

  const cover = e.coverColor ?? COVER[e.category] ?? colors.sand;
  const hasPhoto = !!e.cover;
  const dark = hasPhoto || cover === colors.ink;
  const fg = dark ? colors.paper : colors.ink;
  const lineColor = (c: 'ink' | 'paper' | 'accent') => (c === 'accent' ? colors.accent : c === 'paper' ? colors.paper : colors.ink);
  const big = e.coverLines ?? coverLinesFor(e.title).map((t) => [t, dark ? 'paper' : 'ink'] as [string, 'ink' | 'paper']);
  const bigSize = big.length > 2 ? 46 : 56;
  const strip = [coverTime(e), (e.whereShort ?? e.address.split(',').slice(0, 2).join(' ')).toUpperCase(), formatPrice(e.priceMin, e.priceMax, e.isFree)];
  const goingInfo = goingLine(e, people, going);
  const lookers = e.lookers ?? [];
  const lookCount = Math.max(e.lookingCount, lookers.length) + (activeCompany(company, e, now) ? 1 : 0);
  const friends = people.filter((p) => p.isFriend);
  const todayKey = String(dayIndex(now));
  const chat = e.chat;

  const write = (personId: string) => {
    if (!startChat(personId, todayKey)) {
      show({ text: 'На сегодня хватит новых разговоров: не больше 10 в день. Продолжим завтра' });
      return;
    }
    setSheet(null);
    router.push({ pathname: '/chat/[id]', params: { id: `dm-${personId}` } });
  };

  const share = () => Share.share({ message: `${e.title} — ${whenTitle(e, now)}, ${e.address}. Пойдём? рядом.` }).catch(() => {});

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingTop: Math.max(50, insets.top + 6), paddingBottom: 120 + insets.bottom }}>
        <View style={styles.topRow}>
          <Pressable onPress={onClose} style={styles.round} accessibilityRole="button" accessibilityLabel={closeLabel}>
            <Ic d={IC.back} size={20} color={colors.ink} w={2} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable onPress={share} style={styles.round} accessibilityRole="button" accessibilityLabel="Поделиться">
            <Ic d={IC.share} size={20} color={colors.ink} />
          </Pressable>
          <Pressable onPress={() => toggleSave(e.id)} style={[styles.round, saved && { backgroundColor: colors.accent, borderColor: colors.accent }]}
            accessibilityRole="button" accessibilityState={{ selected: saved }} accessibilityLabel={saved ? 'Убрать из сохранённых' : 'Сохранить на потом'}>
            <Ic d={IC.bookmark} size={20} color={colors.ink} fill={saved ? colors.ink : 'none'} />
          </Pressable>
        </View>

        <View style={[styles.cover, { backgroundColor: cover }]}>
          {hasPhoto && (
            <>
              <Image source={photo(e.cover)} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityLabel={e.title} />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(23,22,26,0.42)' }]} />
            </>
          )}
          {!hasPhoto && (
            <View style={styles.coverIcon} pointerEvents="none">
              <Ic d={CAT_ICON[e.category]} size={230} color={fg} w={0.6} />
            </View>
          )}
          <View style={styles.coverTop}>
            <Text style={[styles.coverMeta, { color: fg }]}>{e.catLabel ?? CAT_LABEL[e.category]}</Text>
            <Text style={[styles.coverMeta, { color: fg }]}>{coverDate(e.startsAt)}</Text>
          </View>
          <View style={styles.coverBig}>
            {big.map(([t, c]) => (
              <Text key={t} style={[styles.bigText, { fontSize: bigSize, lineHeight: bigSize * 0.92, color: lineColor(c) }]} numberOfLines={1} adjustsFontSizeToFit>{t}</Text>
            ))}
          </View>
          <View style={[styles.strip, { borderTopColor: fg }]}>
            {strip.map((t, i) => <Text key={i} style={[styles.stripText, { color: fg }]} numberOfLines={1}>{t}</Text>)}
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.h1} accessibilityRole="header">{e.title}</Text>
          <View style={{ gap: 14 }}>
            <Row icon={<Ic d={IC.clock} c={[[12, 12, 9]]} size={18} color={colors.ink} />} title={whenTitle(e, now)} sub={whenSub(e, now)} />
            <Row icon={<Ic d={IC.pin} c={[[12, 9, 2.5]]} size={18} color={colors.ink} />} title={e.address} sub={e.addressNote}
              action={<Pressable onPress={() => setSheet('route')} hitSlop={10} accessibilityRole="button"><Text style={styles.link}>Маршрут</Text></Pressable>} />
            <Row icon={<Ic d={IC.tag} c={[[7.5, 8.5, 1.2]]} size={18} color={colors.ink} />} title={priceTitle(e)} sub={e.priceNote} />
          </View>

          {!!e.about && (
            <View style={{ gap: 8 }}>
              <Text style={styles.h2}>Описание</Text>
              <Text style={styles.about}>{e.about}</Text>
            </View>
          )}

          {(e.organizer || e.source) && (
            <View style={styles.org}>
              <View style={[styles.orgMark, { backgroundColor: cover === colors.accent ? colors.softYellow : cover }]}>
                <Text style={[styles.orgLetter, { color: dark ? colors.paper : colors.ink }]}>{(e.organizer ?? e.source ?? '?').replace(/[«»"]/g, '')[0]}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.name}>{e.organizer ?? e.venueName ?? 'Организатор'}</Text>
                <Text style={styles.small}>организатор{e.source ? ` · источник: ${e.source}` : ''}</Text>
              </View>
            </View>
          )}

          <View style={styles.hr} />

          {goingInfo && (
            <View style={{ gap: 12 }}>
              <Text style={styles.h2}>Кто идёт</Text>
              <View style={styles.goingRow}>
                {goingInfo.faces.length > 0 && (
                  <View style={{ flexDirection: 'row', paddingRight: 10 }}>
                    {goingInfo.faces.slice(0, 3).map((p) => <Avatar key={p.id} p={p} size={40} ring={colors.friend} style={{ marginRight: -10 }} />)}
                  </View>
                )}
                <View style={{ gap: 1 }}>
                  <Text style={styles.name}>{goingInfo.title}</Text>
                  <Text style={styles.small}>{goingInfo.sub}</Text>
                </View>
              </View>
            </View>
          )}

          {lookCount >= 3 && lookers.length > 0 && (
            <View style={{ gap: 10 }}>
              <View style={styles.lookHead}>
                <Text style={styles.h2}>Ищут компанию</Text>
                <View style={styles.count}><Text style={styles.countText}>{lookCount}</Text></View>
              </View>
              {lookers.map((l) => {
                const p = people.find((x) => x.id === l.personId);
                if (!p) return null;
                return (
                  <Pressable key={l.personId} onPress={() => router.push({ pathname: '/person/[id]', params: { id: p.id } })} style={styles.looker} accessibilityRole="button">
                    <Avatar p={p} size={46} radius={16} />
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={styles.name}>{p.name}{p.age ? `, ${p.age}` : ''}</Text>
                      <Text style={styles.small}>{l.note}</Text>
                      <Text style={styles.common}>{l.common}</Text>
                    </View>
                    <Ic d={IC.chevron} size={18} color={colors.muted} w={2} />
                  </Pressable>
                );
              })}
            </View>
          )}

          <Pressable onPress={() => router.push({ pathname: '/chat/[id]', params: { id: `ev-${e.id}` } })} style={styles.chat} accessibilityRole="button">
            <View style={styles.chatHead}>
              <Text style={styles.chatTitle}>{chat?.title ?? 'Чат события'}</Text>
              <Text style={styles.chatCount}>{chat ? `${chat.members.toLocaleString('ru-RU')} ${plural(chat.members, 'УЧАСТНИК', 'УЧАСТНИКА', 'УЧАСТНИКОВ')}` : 'ОТКРОЕТСЯ, КОГДА ПОЙДЁШЬ'}</Text>
            </View>
            <Text style={styles.chatText}>
              {chat ? (<><Text style={{ fontFamily: fonts.body600, color: colors.paper }}>{chat.who}:</Text> {chat.text}</>) : 'Здесь договариваются о встрече у входа и делятся фото после.'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {toast && <Toast t={toast} style={{ position: 'absolute', left: 16, right: 16, bottom: 108 + insets.bottom }} />}

      <View style={[styles.bar, { paddingBottom: 28 + Math.max(0, insets.bottom - 20) }]}>
        <Pressable onPress={() => setSheet('invite')} style={styles.inviteBtn} accessibilityRole="button" accessibilityLabel="Позвать друга">
          <Ic d={IC.userPlus} c={[[9, 8, 3.5]]} size={22} color={colors.ink} />
        </Pressable>
        <Pressable onPress={() => setSheet('company')} style={[styles.action, { borderWidth: 1.5, borderColor: colors.ink }, activeCompany(company, e, now) && { backgroundColor: colors.sand }]} accessibilityRole="button">
          <Text style={styles.actionText}>Ищу компанию</Text>
        </Pressable>
        <Pressable onPress={toggleGo} style={[styles.action, { backgroundColor: going ? colors.accent : colors.ink }]} accessibilityRole="button" accessibilityState={{ selected: going }}>
          <Ic d={IC.check} size={20} color={going ? colors.ink : colors.paper} w={2.2} />
          <Text style={[styles.actionText, { color: going ? colors.ink : colors.paper }]}>{going ? 'Ты идёшь' : 'Я иду'}</Text>
        </Pressable>
      </View>

      {sheet && (
        <>
          <Backdrop onPress={() => setSheet(null)} opacity={sheet === 'company' ? 0.5 : 0.45} label="Закрыть" />
          <BottomSheet label={sheet === 'company' ? 'Ищу компанию' : sheet === 'invite' ? 'Позвать друга' : 'Маршрут'} style={{ gap: sheet === 'company' ? 18 : 14, paddingBottom: 30 + insets.bottom }}>
            {sheet === 'company' && <CompanySheet e={e} when={whenTitle(e, now).toLowerCase()} now={now} people={people} onClose={() => setSheet(null)} onWrite={write} />}
            {sheet === 'invite' && (
              <InviteSheet e={e} friends={friends} goingIds={e.friendsGoing} onSend={(ids) => {
                invite(e.id, ids);
                setSheet(null);
                const names = friends.filter((f) => ids.includes(f.id)).map((f) => f.name).join(', ');
                show({ text: `Позвал: ${names}. Ответ придёт в чат`, cta: 'Чаты', onCta: () => router.push('/chats') });
              }} />
            )}
            {sheet === 'route' && <RouteSheet e={e} />}
          </BottomSheet>
        </>
      )}
    </View>
  );
}

function Row({ icon, title, sub, action }: { icon: ReactNode; title: string; sub?: string; action?: ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>{icon}</View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.name}>{title}</Text>
        {!!sub && <Text style={styles.small}>{sub}</Text>}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  round: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  cover: { marginTop: 14, marginHorizontal: 16, height: 300, borderRadius: 24, overflow: 'hidden' },
  coverIcon: { position: 'absolute', right: -40, top: 26, opacity: 0.22 },
  coverTop: { position: 'absolute', left: 20, right: 20, top: 20, flexDirection: 'row', justifyContent: 'space-between' },
  coverMeta: { fontFamily: fonts.mono600, fontSize: 11, letterSpacing: 0.88 },
  coverBig: { position: 'absolute', left: 20, right: 20, bottom: 50 },
  bigText: { fontFamily: fonts.display800, letterSpacing: -1.9 },
  strip: { position: 'absolute', left: 20, right: 20, bottom: 14, borderTopWidth: 1.5, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  stripText: { fontFamily: fonts.mono600, fontSize: 11, letterSpacing: 0.44, flexShrink: 1 },
  body: { paddingTop: 20, paddingHorizontal: 16, gap: 18 },
  h1: { fontFamily: fonts.display700, fontSize: 30, letterSpacing: -0.6, lineHeight: 32, color: colors.ink },
  h2: { fontFamily: fonts.display600, fontSize: 19, color: colors.ink },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  rowIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fonts.body600, fontSize: 15, color: colors.ink },
  small: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted },
  link: { fontFamily: fonts.body600, fontSize: 13, color: colors.ink, textDecorationLine: 'underline', paddingTop: 2 },
  about: { fontFamily: fonts.body400, fontSize: 15, lineHeight: 23.25, color: colors.muted2 },
  org: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  orgMark: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  orgLetter: { fontFamily: fonts.display700, fontSize: 16 },
  hr: { height: 1, backgroundColor: colors.line },
  goingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lookHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  count: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  countText: { fontFamily: fonts.mono600, fontSize: 11, color: colors.ink },
  looker: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 18 },
  common: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.4, color: colors.ink },
  chat: { padding: 16, gap: 10, backgroundColor: colors.ink, borderRadius: 20 },
  chatHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chatTitle: { fontFamily: fonts.display600, fontSize: 17, color: colors.paper },
  chatCount: { fontFamily: fonts.mono500, fontSize: 11, letterSpacing: 0.55, color: '#BDB8AD' },
  chatText: { fontFamily: fonts.body400, fontSize: 14, lineHeight: 20.3, color: '#E4E0D6' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 12, paddingHorizontal: 16, backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row', gap: 8 },
  inviteBtn: { width: 54, height: 54, borderRadius: 16, borderWidth: 1.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  action: { flex: 1, height: 54, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionText: { fontFamily: fonts.body600, fontSize: 15, color: colors.ink },
});
