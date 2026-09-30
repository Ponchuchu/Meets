// Единый шаблон события (design/screens/EventPage). Порядок полей строго по PRODUCT.md, раздел 4:
// Обложка → Название → Когда + погода → Адрес + «Маршрут» → Цена → Описание → Организатор → Кто идёт → Ищут компанию → Чат.
import { track } from '../analytics';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Image, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { data } from '../data';
import { photo } from '../data/photos';
import type { EventItem, Person } from '../data/types';
import { dayIndex } from '../lib/clock';
import { formatPrice } from '../lib/format';
import { CAT_ICON, CAT_LABEL } from '../map/icons';
import { useApp } from '../state/app';
import { cellOf } from '../profile/city';
import { makeSignal } from '../reco';
import { useFeed } from '../state/feed';
import { activeCompany, usePlans } from '../state/plans';
import { useProfile } from '../state/profile';
import { colors, fonts } from '../theme';
import { Avatar } from '../ui/Avatar';
import { Ic, IC } from '../ui/Ic';
import { Backdrop, BottomSheet } from '../ui/sheet';
import { Toast, type ToastData } from '../ui/Toast';
import { CompanySheet, InviteSheet, RouteSheet } from './sheets';
import { eventLink, shareText, shareUrl, type ShareTarget } from './share';
import { coverDate, coverLinesFor, coverTime, plural, priceTitle, whenTitle } from './text';

const COVER: Partial<Record<EventItem['category'], string>> = {
  music: colors.accent, standup: colors.ink, art: colors.sand, hike: colors.ink, games: colors.softGreen, concert: colors.ink,
  food: colors.softYellow, sport: colors.softBlue, bike: colors.softBlue, theatre: colors.softPink, lecture: colors.softGreen, talks: colors.softGreen, party: colors.ink, meetup: colors.softYellow,
};

type Sheet = null | 'company' | 'invite' | 'route' | 'share' | 'going';

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

export function EventPage({ e, now, onClose, closeLabel = 'Назад к карте', onGo }: {
  e: EventItem; now: Date; onClose: () => void; closeLabel?: string;
  /** Из ленты «Я иду» работает как свайп вправо. */
  onGo?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => data.getPeople() });
  const going = usePlans((s) => !!s.going[e.id]);
  const saved = usePlans((s) => !!s.saved[e.id]);
  const company = usePlans((s) => s.company[e.id]);
  const { go, ungo, toggleSave, invite, startChat } = usePlans.getState();
  const addPlan = useApp((s) => s.addPlan);
  const arrived = useProfile((s) => s.arrivals.some((a) => a.eventId === e.id));
  const arrive = useProfile((s) => s.arrive);
  const addSignal = useFeed((s) => s.addSignal);
  // «Я на месте»: доступно тем, кто идёт, с 30 минут до начала и до конца события.
  const startMs = new Date(e.startsAt).getTime();
  const endMs = e.endsAt ? new Date(e.endsAt).getTime() : startMs + 2 * 3600e3;
  const canArrive = going && now.getTime() >= startMs - 30 * 60000 && now.getTime() <= endMs;
  // Прошедшее (открыли из хроники): вместо кнопок — «Было · с кем».
  const past = endMs < now.getTime();
  const was = e.friendsGoing.map((id) => people.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p);
  const removePlan = useApp((s) => s.removePlan);

  const show = (t: ToastData | null, ms = 4000) => {
    setToast(t);
    if (t) setTimeout(() => setToast((cur) => (cur === t ? null : cur)), ms);
  };

  const toggleGo = () => {
    if (onGo && !going) { onGo(); return; }
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

  const link = eventLink(e.id);
  const text = shareText(e.title, whenTitle(e, now).toLowerCase());
  const shareTo = async (t: ShareTarget | 'copy' | 'more') => {
    setSheet(null);
    if (t === 'more') { Share.share({ message: `${text} ${link}` }).catch(() => {}); return; }
    if (t === 'copy' || t === 'instagram') {
      await Clipboard.setStringAsync(`${text} ${link}`).catch(() => {});
      show({ text: t === 'copy' ? 'Ссылка скопирована' : 'Ссылка скопирована — вставь её в директ' }, 2500);
      if (t === 'copy') return;
    }
    Linking.openURL(shareUrl(t, text, link)).catch(() => {});
  };
  // Жест «назад»: ведёшь пальцем от левого края вправо — возвращаешься (iOS и Android, на web — мышью).
  const back = Gesture.Pan()
    .activeOffsetX(20)
    .failOffsetY([-14, 14])
    .onEnd((ev) => { if (ev.translationX > 90 && ev.absoluteX - ev.translationX < 48) scheduleOnRN(onClose); });

  return (
    <GestureDetector gesture={back}>
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingTop: Math.max(50, insets.top + 6), paddingBottom: 120 + insets.bottom }}>
        <View style={styles.topRow}>
          <Pressable onPress={onClose} style={styles.round} accessibilityRole="button" accessibilityLabel={closeLabel}>
            <Ic d={IC.back} size={20} color={colors.ink} w={2} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => setSheet('share')} style={styles.round} accessibilityRole="button" accessibilityLabel="Поделиться">
            <Ic d={IC.share} size={20} color={colors.ink} />
          </Pressable>
          <Pressable onPress={() => toggleSave(e.id)} style={[styles.round, saved && { backgroundColor: '#F2B632', borderColor: '#F2B632' }]}
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
            <Row icon={<Ic d={IC.clock} c={[[12, 12, 9]]} size={18} color={colors.ink} />} title={whenTitle(e, now)} />
            <Row icon={<Ic d={IC.pin} c={[[12, 9, 2.5]]} size={18} color={colors.ink} />} title={e.address} sub={e.addressNote}
              action={<Pressable onPress={() => setSheet('route')} hitSlop={10} accessibilityRole="button"><Text style={styles.link}>Маршрут</Text></Pressable>} />
            <Row icon={<Ic d={IC.tag} c={[[7.5, 8.5, 1.2]]} size={18} color={colors.ink} />} title={priceShort(e) || priceTitle(e)} />
          </View>

          {!!e.about && (
            <View style={{ gap: 8 }}>
              <Text style={styles.h2}>Описание</Text>
              <Text style={styles.about}>{e.about}</Text>
            </View>
          )}

          {(e.organizer || e.source || e.sourceUrl) && (
            <Pressable disabled={!e.sourceUrl} onPress={() => e.sourceUrl && Linking.openURL(e.sourceUrl).catch(() => {})} style={styles.org} accessibilityRole="link"
              accessibilityLabel={`${e.organizer ?? e.venueName ?? 'Организатор'}. ${e.isFree ? 'Подробнее' : 'Билеты'}`}>
              <View style={[styles.orgMark, { backgroundColor: cover === colors.accent ? colors.softYellow : cover }]}>
                <Text style={[styles.orgLetter, { color: dark ? colors.paper : colors.ink }]}>{(e.organizer ?? e.source ?? '?').replace(/[«»"]/g, '')[0]}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.name} numberOfLines={1}>{e.organizer ?? e.venueName ?? 'Организатор'}</Text>
                {!!e.source && <Text style={styles.small}>{e.source}</Text>}
              </View>
              {!!e.sourceUrl && (
                <View style={styles.ticket}>
                  <Text style={styles.ticketText}>{e.isFree ? 'Подробнее' : 'Билеты'}</Text>
                  <Ic d={IC.chevron} size={14} color={colors.paper} w={2.4} />
                </View>
              )}
            </Pressable>
          )}

          <View style={styles.hr} />

          {goingInfo && (
            <View style={{ gap: 12 }}>
              <Text style={styles.h2}>Кто идёт</Text>
              <View style={styles.goingRow}>
                {goingInfo.faces.length > 0 && (
                  <View style={{ flexDirection: 'row', paddingRight: 10 }}>
                    {goingInfo.faces.slice(0, 3).map((p) => (
                      <Pressable key={p.id} onPress={() => router.push({ pathname: '/person/[id]', params: { id: p.id } })} accessibilityRole="link" accessibilityLabel={`Профиль: ${p.name}`} style={{ marginRight: -10 }}>
                        <Avatar p={p} size={40} ring={colors.friend} />
                      </Pressable>
                    ))}
                  </View>
                )}
                <View style={{ gap: 1, flex: 1 }}>
                  <Text style={styles.name}>{goingInfo.title}</Text>
                  <Text style={styles.small}>{goingInfo.sub}</Text>
                </View>
                <Pressable onPress={() => setSheet('going')} style={styles.allBtn} accessibilityRole="button">
                  <Text style={styles.allText}>Все</Text>
                </Pressable>
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

          {canArrive && (
            <Pressable disabled={arrived} onPress={() => {
              arrive(e.id, cellOf(e.lat, e.lon));
              addSignal(makeSignal(e, 'arrived', now));
              track('arrived', e.id);
              show({ text: 'Отметил! +1 место на карте города. Статус «На событии» — пока ты здесь' });
            }} style={[styles.arrive, arrived && { backgroundColor: colors.sand }]} accessibilityRole="button">
              <Ic d={arrived ? IC.check : IC.pin} c={arrived ? [] : [[12, 9, 2.5]]} size={20} color={colors.ink} w={2} />
              <Text style={styles.arriveText}>{arrived ? 'Ты на месте' : 'Я на месте'}</Text>
            </Pressable>
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

      {past ? (
        <View style={[styles.bar, { paddingBottom: 28 + Math.max(0, insets.bottom - 20) }]}>
          {was.length > 0 && <View style={{ flexDirection: 'row' }}>{was.slice(0, 4).map((p, i) => <Avatar key={p.id} p={p} size={36} ring={colors.friend} style={{ marginLeft: i ? -10 : 0 }} />)}</View>}
          <View style={{ flex: 1 }}>
            <Text style={styles.actionText}>{e.meetup ? `${e.meetup.kind} · было` : 'Ты был здесь'}</Text>
            <Text style={styles.pastSub} numberOfLines={1}>{was.length ? `с ${was.map((p) => p.withName ?? p.name).join(', ')}` : 'один — и это тоже было круто'}</Text>
          </View>
        </View>
      ) : (
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
      )}

      {sheet && (
        <>
          <Backdrop onPress={() => setSheet(null)} opacity={sheet === 'company' ? 0.5 : 0.45} label="Закрыть" />
          <BottomSheet onClose={() => setSheet(null)} label={sheet === 'company' ? 'Ищу компанию' : sheet === 'invite' ? 'Позвать друга' : sheet === 'share' ? 'Поделиться' : sheet === 'going' ? 'Кто идёт' : 'Маршрут'} style={{ gap: sheet === 'company' ? 18 : 14, paddingBottom: 30 + insets.bottom }}>
            {sheet === 'company' && <CompanySheet e={e} when={whenTitle(e, now).toLowerCase()} now={now} people={people} onClose={() => setSheet(null)} onWrite={write} />}
            {sheet === 'invite' && (
              <InviteSheet e={e} friends={friends} goingIds={e.friendsGoing} onSend={(ids) => {
                invite(e.id, ids);
                setSheet(null);
                show({ text: ids.length > 1 ? 'Позвал. Ответы придут в чат' : 'Позвал. Ответ придёт в чат', cta: 'Чаты', onCta: () => router.push('/chats') });
              }} />
            )}
            {sheet === 'route' && <RouteSheet e={e} />}
            {sheet === 'share' && <ShareSheet onPick={shareTo} />}
            {sheet === 'going' && goingInfo && (
              <GoingSheet friends={goingInfo.faces} others={Math.max(0, e.goingCount - goingInfo.faces.length) + (going ? 1 : 0)}
                onPerson={(id) => { setSheet(null); router.push({ pathname: '/person/[id]', params: { id } }); }} />
            )}
          </BottomSheet>
        </>
      )}
    </View>
    </GestureDetector>
  );
}

/** Цена одной строкой: «2 500 ₸», «от 3 000 ₸» (если есть диапазон), «Бесплатно». */
function priceShort(e: EventItem): string {
  if (e.isFree || e.priceMin === 0) return 'Бесплатно';
  if (e.priceMin == null) return '';
  const n = (v: number) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return e.priceMax && e.priceMax !== e.priceMin ? `от ${n(e.priceMin)} ₸` : `${n(e.priceMin)} ₸`;
}

const SHARE_TARGETS: [ShareTarget | 'copy' | 'more', string, string, string][] = [
  ['telegram', 'Telegram', '#2AABEE', 'M21 4L3 11l6 2 2 6 3-4 5 4z'],
  ['whatsapp', 'WhatsApp', '#25D366', 'M4 20l1.3-4A8 8 0 1112 20a8 8 0 01-3.9-1z'],
  ['instagram', 'Instagram', '#E1306C', 'M7 3h10a4 4 0 014 4v10a4 4 0 01-4 4H7a4 4 0 01-4-4V7a4 4 0 014-4zM12 8a4 4 0 100 8 4 4 0 000-8z'],
  ['threads', 'Threads', '#17161A', 'M15.5 11.5c-.5-2.5-2-3.5-3.8-3.5-2.3 0-3.7 1.6-3.7 4s1.5 4 4 4c2 0 3.5-1 3.5-3 0-2-1.8-2.8-4-2.3M12 21a9 9 0 119-9c0 3-1.5 5-4 5'],
  ['copy', 'Ссылка', '#6B675F', 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1'],
  ['more', 'Ещё', '#E7E2D6', 'M5 12h.01M12 12h.01M19 12h.01'],
];

function ShareSheet({ onPick }: { onPick: (t: ShareTarget | 'copy' | 'more') => void }) {
  return (
    <>
      <Text style={styles.sheetTitle} accessibilityRole="header">Поделиться</Text>
      <View style={styles.shareGrid}>
        {SHARE_TARGETS.map(([k, label, bg, d]) => (
          <Pressable key={k} onPress={() => onPick(k)} style={styles.shareItem} accessibilityRole="button" accessibilityLabel={`Отправить в ${label}`}>
            <View style={[styles.shareIcon, { backgroundColor: bg }]}><Ic d={d} size={24} color={k === 'more' ? colors.ink : '#FFFFFF'} w={k === 'more' ? 3 : 1.9} /></View>
            <Text style={styles.shareLabel}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}

function GoingSheet({ friends, others, onPerson }: { friends: Person[]; others: number; onPerson: (id: string) => void }) {
  return (
    <>
      <Text style={styles.sheetTitle} accessibilityRole="header">Кто идёт</Text>
      {friends.map((p) => (
        <Pressable key={p.id} onPress={() => onPerson(p.id)} style={styles.goingItem} accessibilityRole="link">
          <Avatar p={p} size={44} ring={colors.friend} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{p.name}</Text>
            <Text style={styles.small}>друг</Text>
          </View>
          <Ic d={IC.chevron} size={18} color={colors.muted} w={2} />
        </Pressable>
      ))}
      {others > 0 && <Text style={styles.small}>и ещё {others.toLocaleString('ru-RU')} {plural(others, 'человек', 'человека', 'человек')}</Text>}
    </>
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
  pastSub: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted2 },
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
  arrive: { height: 54, borderRadius: 16, backgroundColor: colors.accent, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  arriveText: { fontFamily: fonts.body600, fontSize: 16, color: colors.ink },
  chat: { padding: 16, gap: 10, backgroundColor: colors.ink, borderRadius: 20 },
  chatHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chatTitle: { fontFamily: fonts.display600, fontSize: 17, color: colors.paper },
  chatCount: { fontFamily: fonts.mono500, fontSize: 11, letterSpacing: 0.55, color: '#BDB8AD' },
  chatText: { fontFamily: fonts.body400, fontSize: 14, lineHeight: 20.3, color: '#E4E0D6' },
  ticket: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: colors.ink },
  ticketText: { fontFamily: fonts.body600, fontSize: 13.5, color: colors.paper },
  allBtn: { height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.line2, justifyContent: 'center' },
  allText: { fontFamily: fonts.body600, fontSize: 13.5, color: colors.ink },
  sheetTitle: { fontFamily: fonts.display700, fontSize: 22, color: colors.ink },
  shareGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 },
  shareItem: { width: '33.3%', alignItems: 'center', gap: 6 },
  shareIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  shareLabel: { fontFamily: fonts.body500, fontSize: 12.5, color: colors.ink },
  goingItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 12, paddingHorizontal: 16, backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row', gap: 8 },
  inviteBtn: { width: 54, height: 54, borderRadius: 16, borderWidth: 1.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  action: { flex: 1, height: 54, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionText: { fontFamily: fonts.body600, fontSize: 15, color: colors.ink },
});
