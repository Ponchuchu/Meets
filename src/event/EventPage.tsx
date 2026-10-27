// Единый шаблон события (design/screens/EventPage). Порядок полей строго по PRODUCT.md, раздел 4:
// Обложка → Название → Когда + погода → Адрес + «Маршрут» → Цена → Описание → Организатор → Кто идёт → Ищут компанию → Чат.
import { routeParams } from '../lib/routeParams';
import { track } from '../analytics';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { config } from '../lib/config';
import { chooseEventVisit, rescheduleMeetup, sendInvite } from '../live/api';
import { router } from 'expo-router';
import { myId } from '../live/auth';
import { ScheduleSheet } from './ScheduleSheet';
import { useRef,useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Linking, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { AboutBlock, langOf } from './ui/AboutBlock';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { data } from '../data';
import type { EventItem, Person } from '../data/types';
import { almaty, dayIndex } from '../lib/clock';
import { formatPrice } from '../lib/format';
import { useApp, useBackClose } from '../state/app';
import { cellOf } from '../profile/city';
import { makeSignal } from '../reco';
import { useFeed } from '../state/feed';
import { WhenSheet } from '../feed/WhenSheet';
import { activeCompany, usePlans } from '../state/plans';
import { useProfile } from '../state/profile';
import { colors, fonts } from '../theme';
import { glass, plate } from '../ui/glass';
import { Avatar } from '../ui/Avatar';
import { EventCover, openCoverH } from '../ui/EventCover';
import { IC, Ic } from '../ui/Ic';
import { Backdrop, BottomSheet } from '../ui/sheet';
import { Toast, type ToastData } from '../ui/Toast';
import { InviteSheet } from './sheets';
import { CardPeople } from './v6/CardPeople';
import { ChevronDown, ChevronRight, Clock, Hand, ImagePlus, MapPin, Share2, Ticket, Users, X } from 'lucide-react-native';
import { PlaceBlock, SourceLink } from './ui/PlaceBlock';
import { TicketBlock } from './ui/TicketBlock';
import { ShareCardSheet } from './ui/ShareCard';
import * as WebBrowser from 'expo-web-browser';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useMyPos } from '../live/location';
import { distM } from '../live/geo';
import { kmText } from '../map/ui/EventSheet';
import { eventLink, shareText } from './share';
import { plural, whenTitle } from './text';
import { occurrencesOf } from './occurrences';
import { eventStatusLabel } from './availability';

const LIVE = config.dataMode !== 'demo';


type Sheet = 'visit' | 'reschedule' | null | 'company' | 'invite' | 'route' | 'share' | 'going' | 'dates';

export function EventPage({ e: initialEvent, now, onClose, closeLabel = 'Свернуть', onGo, onSkip, onPlanned, initialSheet = null }: {
  /** Событие попало в планы изнутри карточки (дата, сеанс): лента сворачивает её как «Пойду». */
  onPlanned?: () => void;
  initialSheet?: Sheet;
  /** «✕» на открытой карточке: в Рекомендациях — «Мимо», на карте — просто закрыть. */
  onSkip?: () => void;
  e: EventItem; now: Date; onClose: () => void; closeLabel?: string;
  /** Из ленты «Я иду» работает как свайп вправо. */
  onGo?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  // Фото — в тех же пропорциях, что на карточке ленты (FIX5): не растягивается и не режется сильнее, чем снаружи.
  const coverH = openCoverH(winW, insets.top);
  const qc = useQueryClient();
  const [selectedSession, setSelectedSession] = useState<{ initialId: string; event: EventItem } | null>(null);
  const [updatedEvent, setUpdatedEvent] = useState<EventItem | null>(null);
  const base = selectedSession?.initialId === initialEvent.id ? selectedSession.event : initialEvent;
  const e = updatedEvent?.id === base.id ? updatedEvent : base;
  const visitAt = usePlans(s => s.visits[e.id]);
  const multiDay = !!e.endsAt && dayIndex(e.endsAt) > dayIndex(e.startsAt) && e.isLong;
  const mine = LIVE ? e.createdBy === myId() : !!e.meetup;
  const [sheet, setSheet] = useState<Sheet>(initialSheet);
  const sendingInvite=useRef(false);
  const [inviting,setInviting]=useState(false);
  // Обложка: при прокрутке уезжает медленнее текста, при оттягивании вниз — растёт (параллакс, FIX3).
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler(ev => { scrollY.set(ev.contentOffset.y); });
  const parallax = useAnimatedStyle(() => {
    const y = scrollY.get();
    return y < 0 ? { transform: [{ translateY: y / 2 }, { scale: 1 + -y / coverH }] } : { transform: [{ translateY: y * 0.35 }] };
  });
  // Название на обложке тает, пока лист с подробностями наезжает на фото, — текст не налезает на плашки.
  const titleFade = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - Math.max(0, scrollY.get()) / 170) }));
  // «Назад» на Android: сначала закрывает шторку (её слушатель новее), потом событие.
  useBackClose(onClose, sheet === null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => data.getPeople() });
  const going = usePlans((s) => !!s.going[e.id]);
  const company = usePlans((s) => s.company[e.id]);
  const { go, ungo, invite, startChat } = usePlans.getState();
  const addPlan = useApp((s) => s.addPlan);
  const arrived = useProfile((s) => s.arrivals.some((a) => a.eventId === e.id));
  const arrive = useProfile((s) => s.arrive);
  const addSignal = useFeed((s) => s.addSignal);
  const me = useMyPos();
  const { data: sameVenue = [] } = useQuery({ queryKey: ['events'], queryFn: () => data.getEvents(), enabled: false });
  // «Я на месте»: доступно тем, кто идёт, с 30 минут до начала и до конца события.
  const startMs = new Date(e.startsAt).getTime();
  const endMs = e.endsAt ? new Date(e.endsAt).getTime() : startMs + 2 * 3600e3;
  const statusLabel = eventStatusLabel(e);
  const canArrive = !statusLabel && going && now.getTime() >= startMs - 30 * 60000 && now.getTime() <= endMs;
  // Прошедшее (открыли из хроники): вместо кнопок — «Было · с кем».
  const past = endMs < now.getTime();
  const was = e.friendsGoing.map((id) => people.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p);
  const removePlan = useApp((s) => s.removePlan);

  const show = (t: ToastData | null, ms = 4000) => {
    setToast(t);
    if (t) setTimeout(() => setToast((cur) => (cur === t ? null : cur)), ms);
  };

  const toggleGo = () => {
    if (statusLabel && !going) return;
    if (e.sessions?.length) { show({ text: 'Выбери дату в карточке события' }); return; }
    // Несколько дат у одной карточки — сначала какая (решение владельца 26 окт.).
    if ((e.dates?.length ?? 0) > 1 && !going) { setSheet('dates'); return; }
    if (multiDay && !going && !visitAt) { setSheet('visit'); return; }
    if (onGo && !going && e.id === initialEvent.id) { onGo(); return; }
    if (going) { ungo(e.id); removePlan(); show(null); return; }
    go(e.id);
    addPlan();
    if (onPlanned) { onPlanned(); return; }
    show({ text: e.category === 'movie' ? 'Сеанс в «Планах». Напомню о билетах за 3 часа' : 'Добавил в «Планы». Напомню за час', cta: 'Отменить', onCta: () => { ungo(e.id); removePlan(); setToast(null); } });
  };

  const lookers = e.lookers ?? [];
  const lookCount = Math.max(e.lookingCount, lookers.length) + (activeCompany(company, e, now) ? 1 : 0);
  const lookFaces = lookers.map((l) => people.find((p) => p.id === l.personId)).filter((p): p is Person => !!p).slice(0, 2);
  const lookText = lookCount > 0 ? `${lookCount} ${plural(lookCount, 'ищет', 'ищут', 'ищут')} компанию` : 'Пока никто не ищет';
  const friends = people.filter((p) => p.isFriend);
  const todayKey = String(dayIndex(now));

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
  const site = e.sourceUrl ? e.sourceUrl.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] : null;
  const dist = me && !e.needsPin ? kmText(distM(me, e)) : null;
  const priceText = formatPrice(e.priceMin, e.priceMax, e.isFree);
  // Обратный отсчёт до начала (в пределах суток) — «через 2 ч 15 мин», идёт сейчас — «уже идёт».
  const toStart = startMs - now.getTime();
  const soon = toStart > 0 && toStart < 24 * 3600e3 ? `через ${toStart >= 3600e3 ? `${Math.floor(toStart / 3600e3)} ч ` : ''}${Math.max(1, Math.round((toStart % 3600e3) / 60000))} мин`
    : toStart <= 0 && now.getTime() < endMs ? 'уже идёт' : null;
  const sessions = occurrencesOf(e, sameVenue, now);
  const sessionTime = (x: EventItem) => { const at = almaty(x.startsAt); return `${at.getUTCDate()}.${String(at.getUTCMonth() + 1).padStart(2, '0')} · ${String(at.getUTCHours()).padStart(2, '0')}:${String(at.getUTCMinutes()).padStart(2, '0')}`; };
  const friendsGoing = e.friendsGoing.map((id) => people.find((p) => p.id === id)).filter((p): p is Person => !!p && p.isFriend);
  const goingText = friendsGoing.length === 1 ? `${friendsGoing[0].name} идёт` : friendsGoing.length === 2 ? `${friendsGoing[0].name} и ${friendsGoing[1].name} идут`
    : friendsGoing.length > 2 ? `${friendsGoing[0].name}, ${friendsGoing[1].name} и ещё ${friendsGoing.length - 2} идут` : e.goingCount >= 3 ? `Идут ${e.goingCount}` : 'Пока никто из друзей';

  return (
    <View style={styles.root}>
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} style={{ flex: 1, minHeight: 0 }} nestedScrollEnabled contentContainerStyle={{ paddingBottom: 120 + insets.bottom }} showsVerticalScrollIndicator={false}>
        {/* V6CardOpen: фото как на карточке, плашка «СЕГОДНЯ · 20:00», название поверх. */}
        <Animated.View style={[{ zIndex: -1 }, parallax]}>
        <EventCover cover={e.cover} category={e.category} color={e.coverColor} style={[styles.cover, { height: coverH }]} iconSize={Math.round(coverH * 0.5)}>
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" pointerEvents="none">
            <Defs>
              <LinearGradient id="openShade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#17161A" stopOpacity="0.25" />
                <Stop offset="0.45" stopColor="#17161A" stopOpacity="0" />
                <Stop offset="1" stopColor="#17161A" stopOpacity="0.8" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#openShade)" />
          </Svg>
          <View style={[styles.topRow, { top: Math.max(14, insets.top + 6) }]}>
            <Pressable onPress={onClose} style={styles.round} accessibilityRole="button" accessibilityLabel={closeLabel}>
              <ChevronDown size={24} color="#FFFFFF" strokeWidth={2} />
            </Pressable>
            <Pressable onPress={() => setSheet('share')} style={styles.round} accessibilityRole="button" accessibilityLabel="Поделиться">
              <Share2 size={20} color="#FFFFFF" strokeWidth={1.9} />
            </Pressable>
          </View>
          <Animated.View style={[styles.coverText, titleFade]}>
            <Text style={styles.h1} accessibilityRole="header">{e.title}</Text>
          </Animated.View>
        </EventCover>
        </Animated.View>

        <View style={styles.body}>
          <View style={styles.chips}>
            <View style={styles.chip}><Clock size={16} color={colors.ink} strokeWidth={1.9} /><Text style={styles.chipText}>{whenTitle(e, now)}</Text></View>
            {soon && <View style={[styles.chip, styles.soon]} accessibilityLabel={`Начало ${soon}`}><View style={styles.soonDot} /><Text style={[styles.chipText, { color: colors.accentText }]}>{soon}</Text></View>}
            {multiDay && !e.sessions && <Pressable onPress={() => setSheet('visit')} style={styles.chip} accessibilityRole="button"><Clock size={16} color={colors.accent} /><Text style={styles.chipText}>{visitAt ? `Ты идёшь ${new Date(visitAt).toLocaleString('ru-RU', { timeZone: 'Asia/Almaty', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'Выбрать день и время'}</Text></Pressable>}
            {e.sessions && <View style={{ gap: 8, width: '100%' }}><Text style={styles.chipText}>Выбери дату</Text>{e.sessions.map(s => <Pressable key={s.id} onPress={() => router.push({ pathname: '/event/[id]', params: { id: s.id } })} accessibilityRole="button" style={styles.chip}><Clock size={16} color={colors.accent} /><Text style={styles.chipText}>{whenTitle({ ...e, ...s, isLong: false }, now)}</Text><ChevronRight size={16} color={colors.ink} /></Pressable>)}</View>}
            {(e.dates?.length ?? 0) > 1 && <Pressable onPress={() => setSheet('dates')} style={styles.chip} accessibilityRole="button" accessibilityLabel="Даты события"><Clock size={16} color={colors.accent} /><Text style={styles.chipText}>{visitAt ? `Ты идёшь ${new Date(visitAt).toLocaleString('ru-RU', { timeZone: 'Asia/Almaty', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : `${e.dates!.length} ${e.dates!.length < 5 ? 'даты' : 'дат'}: ${e.dates!.slice(0, 3).map((d) => new Date(d).toLocaleDateString('ru-RU', { timeZone: 'Asia/Almaty', day: 'numeric', month: 'short' })).join(', ')}${e.dates!.length > 3 ? '…' : ''}`}</Text></Pressable>}
            {mine && !past && <Pressable onPress={() => setSheet('reschedule')} style={styles.chip} accessibilityRole="button"><Clock size={16} color={colors.accent} /><Text style={styles.chipText}>Перенести встречу</Text></Pressable>}
            {e.lang === 'kk' && <View style={styles.chip} accessibilityLabel="Событие на казахском языке"><Text style={[styles.chipText, { color: '#1E7BB8' }]}>Қазақша</Text></View>}
            {!!priceText && <View style={styles.chip}><Ticket size={16} color={colors.ink} strokeWidth={1.9} /><Text style={styles.chipText}>{priceText}</Text></View>}
            {dist && <View style={styles.chip}><MapPin size={16} color={colors.ink} strokeWidth={1.9} /><Text style={styles.chipText}>{dist}</Text></View>}
          </View>

          {/* «Компания» (26 окт.): кто из друзей идёт и кто ищет компанию — одним блоком, по нажатию шторка. */}
          <Pressable onPress={() => setSheet('going')} style={({ pressed }) => [styles.company, pressed && { transform: [{ scale: 0.99 }] }]} accessibilityRole="button" accessibilityLabel={`${goingText}. ${lookText}. Компания`}>
            <View style={styles.companyRow}>
              <View style={{ flexDirection: 'row', minWidth: 34 }}>
                {friendsGoing.length > 0 ? friendsGoing.slice(0, 3).map((p, i) => <Avatar key={p.id} p={p} size={34} style={{ marginLeft: i ? -10 : 0, borderWidth: 2, borderColor: '#FBFAF6' }} />)
                  : <View style={styles.hand}><Users size={17} color={colors.ink} strokeWidth={2} /></View>}
              </View>
              <Text style={styles.lineText} numberOfLines={1}>{goingText}</Text>
              <ChevronRight size={18} color={colors.muted} strokeWidth={2} />
            </View>
            <View style={styles.companyLine} />
            <View style={styles.companyRow}>
              <View style={{ flexDirection: 'row', minWidth: 34 }}>
                {lookFaces.length > 0 ? lookFaces.map((p, i) => <Avatar key={p.id} p={p} size={34} style={{ marginLeft: i ? -10 : 0, borderWidth: 2, borderColor: '#FBFAF6' }} />)
                  : <View style={[styles.hand, { backgroundColor: '#F6D5C3' }]}><Hand size={17} color={colors.accentText} strokeWidth={2} /></View>}
              </View>
              <Text style={styles.lineText} numberOfLines={1}>{lookText}</Text>
              {!past && <View style={[styles.lookPill, activeCompany(company, e, now) && styles.lookPillOn]}><Text style={[styles.lookPillText, activeCompany(company, e, now) && { color: colors.ink }]}>{activeCompany(company, e, now) ? 'Ты ищешь' : lookCount > 0 ? 'Я тоже' : 'Ищу компанию'}</Text></View>}
            </View>
          </Pressable>

          {sessions.length > 1 && <View style={{ gap: 8 }}>
            <Text style={styles.itemTitle}>{e.category === 'movie' ? 'Выбери кинотеатр и сеанс' : 'Другие даты и время'}</Text>
            <Text style={styles.itemSub}>В планы попадёт выбранное время</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{sessions.map(x => <Pressable key={x.id} onPress={() => setSelectedSession({ initialId: initialEvent.id, event: x })} style={{ minHeight: 44, padding: 10, borderRadius: 13, backgroundColor: x.id === e.id ? colors.ink : colors.card }} accessibilityState={{ selected: x.id === e.id }}><Text style={{ fontFamily: fonts.body600, fontSize: 12, color: x.id === e.id ? colors.paper : colors.ink }}>{sessionTime(x)}{e.category === 'movie' ? ` · ${x.venueName ?? x.address}` : ''}</Text></Pressable>)}</View>
          </View>}
          {!!e.about && <AboutBlock text={e.about} lang={e.lang === 'kk' ? 'на казахском' : langOf(e.tags)} original={e.origAbout != null ? { title: e.origTitle, about: e.origAbout } : undefined} />}

          {/* Где и откуда: мини-карта с маршрутом и аккуратная ссылка на источник (21 октября, просьба владельца). */}
          <PlaceBlock lat={e.lat} lon={e.lon} exact={!e.needsPin} dist={dist} category={e.category}
            title={e.venueName || e.address.split(',').slice(0, 2).join(',')} address={e.venueName ? e.address : e.address.split(',').slice(2).join(',').trim()}
            onRoute={() => router.push({ pathname: '/route', params: routeParams(e) })} onCopy={() => { void Clipboard.setStringAsync(e.address); show({ text: 'Адрес скопирован' }, 2000); }} />
          {going && !past && <TicketBlock eventId={e.id} />}
          {site && <SourceLink site={site}
            onOpen={() => { if (e.sourceUrl) WebBrowser.openBrowserAsync(e.sourceUrl).catch(() => Linking.openURL(e.sourceUrl!).catch(() => undefined)); }}
            onCopy={() => { void Clipboard.setStringAsync(e.sourceUrl!); show({ text: 'Ссылка скопирована' }, 2000); }} />}

          {canArrive && (
            <Pressable disabled={arrived} onPress={() => {
              arrive(e.id, cellOf(e.lat, e.lon));
              addSignal(makeSignal(e, 'arrived', now));
              track('arrived', e.id);
              show({ text: 'Отметил! +1 место на карте города' });
            }} style={[styles.arrive, arrived && { backgroundColor: colors.sand }]} accessibilityRole="button">
              <Ic d={arrived ? IC.check : IC.pin} c={arrived ? [] : [[12, 9, 2.5]]} size={20} color={colors.ink} w={2} />
              <Text style={styles.arriveText}>{arrived ? 'Ты на месте' : 'Я на месте'}</Text>
            </Pressable>
          )}
        </View>
      </Animated.ScrollView>

      {toast && <Toast t={toast} style={{ position: 'absolute', left: 16, right: 16, bottom: 100 + insets.bottom }} />}

      {statusLabel ? (
        <View style={[styles.bar, { paddingBottom: 18 + insets.bottom }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pastTitle}>{statusLabel}</Text>
            <Text style={styles.pastSub}>Твой план и переписка сохранены</Text>
          </View>
          <Pressable onPress={going ? toggleGo : onClose} style={styles.inviteBtn} accessibilityRole="button">
            <Text style={styles.inviteText}>{going ? 'Убрать' : 'Закрыть'}</Text>
          </Pressable>
        </View>
      ) : past ? (
        <View style={[styles.bar, { paddingBottom: 18 + insets.bottom }]}>
          {was.length > 0 && <View style={{ flexDirection: 'row' }}>{was.slice(0, 4).map((p, i) => <Avatar key={p.id} p={p} size={36} ring={colors.friend} style={{ marginLeft: i ? -10 : 0 }} />)}</View>}
          <View style={{ flex: 1 }}>
            <Text style={styles.pastTitle}>{e.meetup ? `${e.meetup.kind} · было` : 'Ты был здесь'}</Text>
            <Text style={styles.pastSub} numberOfLines={1}>{was.length ? `с ${was.map((p) => p.withName ?? p.name).join(', ')}` : 'один — и это тоже было круто'}</Text>
          </View>
          <Pressable onPress={() => router.push({ pathname: '/post/new', params: { event: e.id } })} style={({ pressed }) => [styles.postBtn, pressed && { transform: [{ scale: 0.97 }] }]} accessibilityRole="button" accessibilityLabel="Выложить фото с события">
            <ImagePlus size={18} color="#FFFFFF" strokeWidth={2.1} /><Text style={styles.postBtnText}>Фото</Text>
          </Pressable>
        </View>
      ) : (
        <View style={[styles.bar, { paddingBottom: 18 + insets.bottom }]}>
          <Pressable onPress={e.id === initialEvent.id ? onSkip ?? onClose : onClose} style={styles.skip} accessibilityRole="button" accessibilityLabel="Мимо">
            <X size={22} color={colors.ink} strokeWidth={2.2} />
          </Pressable>
          <Pressable onPress={toggleGo} style={({ pressed }) => [styles.goBtn, going && { backgroundColor: colors.ink }, pressed && { transform: [{ scale: 0.98 }] }]} accessibilityRole="button" accessibilityState={{ selected: going }}>
            <Text style={[styles.goText, going && { color: colors.paper }]}>{going ? 'В планах' : 'Пойду'}</Text>
          </Pressable>
          <Pressable onPress={() => setSheet('invite')} style={({ pressed }) => [styles.inviteBtn, pressed && { transform: [{ scale: 0.98 }] }]} accessibilityRole="button">
            <Text style={styles.inviteText}>Позвать</Text>
          </Pressable>
        </View>
      )}

      {sheet === 'dates' && <WhenSheet e={e} events={[]} now={now} onClose={() => setSheet(null)} onPlanned={() => { setSheet(null); if (onPlanned) onPlanned(); else show({ text: 'Добавил в «Планы» на выбранную дату. Напомню за час' }); }} />}
      {(sheet === 'visit' || sheet === 'reschedule') && <><Backdrop label="Закрыть выбор времени" onPress={() => setSheet(null)} /><BottomSheet label={sheet === 'visit' ? 'Когда пойти' : 'Перенести встречу'} onClose={() => setSheet(null)} scroll>
        <ScheduleSheet e={e} now={now} reschedule={sheet === 'reschedule'} initial={visitAt} onSave={async at => {
          if (sheet === 'reschedule') {
            if (LIVE) await rescheduleMeetup(e.id, at);
            const shift = Date.parse(at) - Date.parse(e.startsAt);
            const changed = { ...e, startsAt: at, endsAt: e.endsAt ? new Date(Date.parse(e.endsAt) + shift).toISOString() : null };
            setUpdatedEvent(changed);
            usePlans.setState(s => ({ meetups: s.meetups.map(m => m.id === e.id ? changed : m), visits: s.visits[e.id] ? { ...s.visits, [e.id]: at } : s.visits }));
            qc.setQueryData<EventItem[]>(['events'], old => old?.map(x => x.id === e.id ? changed : x));
            void qc.invalidateQueries({ queryKey: ['events'] });
            void qc.invalidateQueries({ queryKey: ['invites'] });
            void qc.invalidateQueries({ queryKey: ['messages'] });
            show({ text: 'Встреча перенесена. Друзья увидят новое время' });
          } else {
            if (LIVE) await chooseEventVisit(e.id, at);
            usePlans.setState(s => ({ visits: { ...s.visits, [e.id]: at }, going: { ...s.going, [e.id]: at } }));
            if (!going) addPlan();
            void qc.invalidateQueries({ queryKey: ['me', 'attendance'] });
            show({ text: 'Дата посещения сохранена в планах' });
          }
          setSheet(null);
          if (sheet === 'visit' && onPlanned) setTimeout(onPlanned, 450);
        }} />
      </BottomSheet></>}
      {sheet && sheet !== 'visit' && sheet !== 'reschedule' && (
        <>
          <Backdrop onPress={() => setSheet(null)} opacity={sheet === 'company' ? 0.5 : 0.45} label="Закрыть" />
          <BottomSheet onClose={() => setSheet(null)} label={sheet === 'invite' ? 'Позвать друга' : sheet === 'share' ? 'Поделиться' : sheet === 'going' ? 'Компания' : 'Маршрут'} style={{ gap: sheet === 'company' ? 18 : 14, paddingBottom: 30 + insets.bottom }}>
            {sheet === 'invite' && (
              <InviteSheet e={e} friends={friends} goingIds={e.friendsGoing} busy={inviting} onSend={async(ids) => {
                if (statusLabel) { setSheet(null); show({ text: statusLabel }); return; }
                if(sendingInvite.current)return;
                sendingInvite.current=true;setInviting(true);
                try{
                  if (LIVE) await sendInvite(e.id, e.title, ids);
                  invite(e.id, ids);setSheet(null);
                  show({ text: ids.length > 1 ? 'Позвал. Ответы придут в чат' : 'Позвал. Ответ придёт в чат', cta: 'Чаты', onCta: () => router.push('/chats') });
                }catch{setSheet(null);show({text:'Не получилось позвать. Проверь связь'});}
                finally{sendingInvite.current=false;setInviting(false);}
              }} />
            )}
            {sheet === 'share' && <ShareCardSheet e={e} now={now} link={link} text={text} onDone={(msg) => { setSheet(null); if (msg) show({ text: msg }, 2000); }} />}
            {sheet === 'going' && <CardPeople e={e} now={now} when={whenTitle(e, now).toLowerCase()} going={going} onGo={() => { if (!going) toggleGo(); }} onInvite={() => setSheet('invite')} onError={(t) => show({ text: t })} onWrite={LIVE ? undefined : write} />}
          </BottomSheet>
        </>
      )}
    </View>
  );
}





const styles = StyleSheet.create({
  company: { borderRadius: 22, backgroundColor: '#FBFAF6', paddingHorizontal: 14, paddingVertical: 4, boxShadow: '0 10px 22px -18px rgba(23,22,26,0.6)' },
  companyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  companyLine: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line2, marginLeft: 46 },
  lookPill: { height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.accent, justifyContent: 'center' },
  lookPillOn: { backgroundColor: '#F6D5C3' },
  lookPillText: { fontFamily: fonts.body700, fontSize: 13, color: '#FFFFFF' },
  postBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 46, paddingHorizontal: 16, borderRadius: 23, backgroundColor: colors.accent },
  postBtnText: { fontFamily: fonts.body700, fontSize: 15, color: '#FFFFFF' },
  pastSub: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted2 },
  root: { flex: 1, backgroundColor: colors.paper },
  topRow: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(23,22,26,0.35)', alignItems: 'center', justifyContent: 'center' },
  cover: { height: 470, overflow: 'hidden', justifyContent: 'flex-end' },
  coverText: { padding: 18, paddingBottom: 38, gap: 10 },
  stamp: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(23,22,26,0.55)' },
  stampText: { fontFamily: fonts.mono600, fontSize: 11.5, letterSpacing: 0.9, color: '#EEE9DE' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  soon: { backgroundColor: '#F6DCCD', borderColor: 'rgba(240,82,31,0.25)' },
  soonDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 36, paddingHorizontal: 12, borderRadius: 12, ...plate },
  chipText: { fontFamily: fonts.body700, fontSize: 14, color: colors.ink },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  lineText: { flex: 1, fontFamily: fonts.body700, fontSize: 15, color: colors.ink },
  hand: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  list: { borderRadius: 20, backgroundColor: '#D9D3C5', overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: 64 },
  itemSep: { borderTopWidth: 1, borderTopColor: '#C8C2B2' },
  itemIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  itemLetter: { fontFamily: fonts.display700, fontSize: 17, color: colors.ink },
  itemTitle: { fontFamily: fonts.display700, fontSize: 15.5, color: colors.ink },
  itemSub: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted2 },
  skip: { width: 56, height: 56, borderRadius: 18, backgroundColor: '#D9D3C5', alignItems: 'center', justifyContent: 'center' },
  goBtn: { flex: 1, height: 56, borderRadius: 18, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  goText: { fontFamily: fonts.body700, fontSize: 17, color: colors.ink },
  inviteText: { fontFamily: fonts.body700, fontSize: 17, color: colors.paper },
  pastTitle: { fontFamily: fonts.body700, fontSize: 15, color: colors.ink },
  coverIcon: { position: 'absolute', right: -40, top: 26, opacity: 0.22 },
  coverTop: { position: 'absolute', left: 20, right: 20, top: 20, flexDirection: 'row', justifyContent: 'space-between' },
  coverMeta: { fontFamily: fonts.mono600, fontSize: 11, letterSpacing: 0.88 },
  coverBig: { position: 'absolute', left: 20, right: 20, bottom: 50 },
  bigText: { fontFamily: fonts.display800, letterSpacing: -1.9 },
  strip: { position: 'absolute', left: 20, right: 20, bottom: 14, borderTopWidth: 1.5, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  stripText: { fontFamily: fonts.mono600, fontSize: 11, letterSpacing: 0.44, flexShrink: 1 },
  body: { marginTop: -24, paddingTop: 20, paddingHorizontal: 18, gap: 14, backgroundColor: colors.paper, borderTopLeftRadius: 26, borderTopRightRadius: 26 },
  h1: { fontFamily: fonts.display800, fontSize: 30, letterSpacing: -0.9, lineHeight: 33, color: '#FFFFFF' },
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
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8, ...glass, borderTopLeftRadius: 26, borderTopRightRadius: 26 },
  inviteBtn: { height: 56, paddingHorizontal: 22, borderRadius: 18, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  action: { flex: 1, height: 54, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionText: { fontFamily: fonts.body600, fontSize: 15, color: colors.ink },
});
