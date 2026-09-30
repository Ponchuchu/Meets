// Чат: личный (DirectChat, ChatAttach, ChatSheets) и чат события (EventChat).
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { track } from '../../src/analytics';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { canWrite, eventChatOpen, startsIn, WRITE_REASONS } from '../../src/chat/rules';
import { Bubble } from '../../src/chat/ui/Bubble';
import { data, eventsSnapshot, type Message, type Person } from '../../src/data';
import { photo } from '../../src/data/photos';
import { isRemoteId, useLiveChat } from '../../src/data/realtime';
import { sendMessage, uploadMedia } from '../../src/data/remote';
import { dayIndex, now as clockNow } from '../../src/lib/clock';
import { accusative } from '../../src/lib/names';
import { canSee } from '../../src/people/visibility';
import { cellOf } from '../../src/profile/city';
import { useApp } from '../../src/state/app';
import { timeNow, useChat } from '../../src/state/chat';
import { uid } from '../../src/lib/uid';
import { useMapState } from '../../src/state/map';
import { usePlans } from '../../src/state/plans';
import { useProfile } from '../../src/state/profile';
import { isFriendNow, useSocial } from '../../src/state/social';
import { colors, fonts } from '../../src/theme';
import { Avatar } from '../../src/ui/Avatar';
import { Ic, IC } from '../../src/ui/Ic';
import { Backdrop, BottomSheet } from '../../src/ui/sheet';
import { Toast, type ToastData } from '../../src/ui/Toast';

// Иконки в стиле lucide, 1.9: скрепка, микрофон-капсула, «кружок» (объектив в круге), самолётик.
const ATTACH_IC = 'M21 11.5l-8.6 8.6a5.5 5.5 0 01-7.8-7.8l8.6-8.6a3.7 3.7 0 015.2 5.2l-8.6 8.6a1.8 1.8 0 01-2.6-2.6l7.9-7.9';
const CIRCLE_IC = 'M12 2.8a9.2 9.2 0 100 18.4 9.2 9.2 0 000-18.4zM12 8.2a3.8 3.8 0 100 7.6 3.8 3.8 0 000-7.6zM17.2 6.8h.01';
const MIC_IC = 'M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3zM5.5 11a6.5 6.5 0 0013 0M12 17.5V21M9 21h6';
const SEND_IC = 'M21.5 2.5L10 14M21.5 2.5l-7 19-4.5-7.5L2.5 9.5z';
const POLL_IC = 'M5 20V10M12 20V4M19 20v-6';
const CAM_IC = 'M4 8.5A1.5 1.5 0 015.5 7h2.3l1.7-2.5h5l1.7 2.5h2.3A1.5 1.5 0 0120 8.5v9a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 17.5zM12 9.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z';
const ALBUMS = [['recent', 'Недавние'], ['photo', 'Фото'], ['video', 'Видео'], ['fav', 'Избранное']] as const;
type Album = (typeof ALBUMS)[number][0];
/** Время для длительности записи — вне рендера. */
const nowMs = () => Date.now();
const MEDIA = [
  { id: 'a', src: 'hike', video: true, dur: '0:21' }, { id: 'b', src: 'igor2', video: false }, { id: 'c', src: 'igor3', video: true, dur: '0:12' },
  { id: 'd', src: 'igor4', video: false }, { id: 'e', src: 'igor1', video: false }, { id: 'f', src: 'krug', video: true, dur: '0:07' },
];
// Демо-аккаунт Данила создан давно — правило «первые 24 часа не пишут первыми» на него не действует.
const MY_ACCOUNT_CREATED = '2026-09-01T00:00:00Z';

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { id, tray: trayParam, sheet: sheetParam } = useLocalSearchParams<{ id: string; tray?: string; sheet?: string }>();
  const now = clockNow();
  const isEvent = id.startsWith('ev-');
  const personId = isEvent ? null : id.replace(/^dm-/, '');
  const qc = useQueryClient();
  useLiveChat(id);
  const { data: base = [] } = useQuery({ queryKey: ['messages', id], queryFn: () => data.getMessages(id) });
  const { data: chats = [] } = useQuery({ queryKey: ['chats'], queryFn: () => data.getChats() });
  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => data.getPeople() });
  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: () => data.getEvents(), placeholderData: eventsSnapshot });
  const { data: details } = useQuery({ queryKey: ['person', personId], queryFn: () => data.getPersonDetails(personId!), enabled: !!personId });
  const chat = useChat();
  const social = useSocial();
  const plans = usePlans();
  const arrive = useProfile((s) => s.arrive);
  const arrived = useProfile((s) => s.arrivals);
  const addPlan = useApp((s) => s.addPlan);
  const focusFriend = useMapState((s) => s.focusFriend);
  const [text, setText] = useState('');
  const [tray, setTray] = useState(trayParam === '1');
  const [album, setAlbum] = useState<Album>('recent');
  const [albumsOpen, setAlbumsOpen] = useState(false);
  const [recMode, setRecMode] = useState<'voice' | 'circle'>('voice');
  const [recStart, setRecStart] = useState(0);
  const [inputH, setInputH] = useState(44);
  const [poll, setPoll] = useState<null | { q: string; options: string[] }>(null);
  const [picked, setPicked] = useState<string[]>(trayParam === '1' ? ['b', 'a'] : []);
  const [sheet, setSheet] = useState<null | 'person' | 'menu'>(sheetParam === '1' ? 'person' : null);
  const [recording, setRecording] = useState<null | 'voice' | 'circle'>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const scroll = useRef<ScrollView>(null);

  const person = personId ? people.find((p) => p.id === personId) : undefined;
  const chatMeta = chats.find((c) => c.id === id);
  const event = isEvent ? [...plans.meetups, ...events].find((e) => e.id === (chatMeta?.eventId ?? id.slice(3))) : undefined;
  const friend = person ? isFriendNow(person, social) : false;
  const messages = useMemo(() => [...base, ...chat.sent.filter((m) => m.chatId === id)], [base, chat.sent, id]);
  const byId = (pid: string) => people.find((p) => p.id === pid);
  const show = (t: ToastData) => { setToast(t); setTimeout(() => setToast((c) => (c === t ? null : c)), 3500); };

  useEffect(() => { chat.markRead(id, chatMeta?.unread ?? 0); }, [id, chatMeta?.unread]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setTimeout(() => scroll.current?.scrollToEnd({ animated: false }), 50); }, [messages.length, tray]);

  // Можно ли писать: друзья — всегда, незнакомые — только при общем событии и в пределах лимитов.
  const commonEvent = !!person && events.some((e) => (plans.going[e.id] || e.friendsGoing.length) && (e.lookers ?? []).some((l) => l.personId === person.id));
  const check = isEvent
    ? { ok: !!event && eventChatOpen(event.startsAt, event.endsAt, now), reason: 'closed' as const }
    : canWrite({
      friend, recipientAllows: 'common', commonEvent: commonEvent || !!details?.lookingFor, existing: messages.length > 0,
      myAccountCreatedAt: MY_ACCOUNT_CREATED, newChatsToday: plans.newChats.day === String(dayIndex(now)) ? plans.newChats.people.length : 0,
      blocked: !!(personId && chat.blocked[personId]), now,
    });

  const push = (m: Partial<Message> & Pick<Message, 'kind'>) => {
    if (!check.ok) return;
    if (personId && messages.length === 0 && !friend) plans.startChat(personId, String(dayIndex(now)));
    const msg: Message = { id: uid(`${id}-me`), chatId: id, authorId: 'me', text: '', time: timeNow(), ...m };
    chat.send(msg);
    track('chat_sent');
    // Чат из базы: пишем на сервер, Realtime принесёт сообщение обратно — тогда убираем локальную копию.
    if (isRemoteId(id)) {
      const media = msg.media && !/^https?:/.test(msg.media) && msg.media.includes(':') ? uploadMedia(id, msg.media) : Promise.resolve(msg.media ?? undefined);
      media
        .then((path) => sendMessage(id, msg.text, msg.kind, path))
        .then(() => qc.invalidateQueries({ queryKey: ['messages', id] }))
        .then(() => chat.unsend(msg.id))
        .catch(() => undefined);
    }
  };
  const sendText = () => { if (text.trim()) { push({ kind: 'text', text: text.trim() }); setText(''); setInputH(44); } };
  // Одна кнопка записи, как в Telegram: тап — голос ↔ кружок, удержание — запись, отпустил — отправилось.
  // Демо-запись: настоящий звук и видео — expo-audio / expo-camera в dev build.
  const startRec = () => { setRecording(recMode); setRecStart(nowMs()); };
  const stopRec = () => {
    if (!recording) return;
    const sec = Math.max(1, Math.round((nowMs() - recStart) / 1000));
    const dur = `0:${String(Math.min(59, sec)).padStart(2, '0')}`;
    if (recording === 'voice') push({ kind: 'voice', duration: dur });
    else push({ kind: 'circle', media: 'krug', duration: dur });
    setRecording(null);
  };
  const sendPoll = () => {
    if (!poll) return;
    const options = poll.options.map((o) => o.trim()).filter(Boolean);
    if (!poll.q.trim() || options.length < 2) return;
    push({ kind: 'poll', text: poll.q.trim(), poll: { question: poll.q.trim(), options: options.map((o) => ({ text: o, votes: 0 })) } });
    setPoll(null);
    setTray(false);
  };
  const sendPicked = () => {
    picked.forEach((pid) => {
      const md = MEDIA.find((x) => x.id === pid)!;
      push({ kind: md.video ? 'video' : 'photo', media: md.src, duration: md.dur, text: '' });
    });
    setPicked([]);
    setTray(false);
  };
  const camera = async () => {
    try {
      const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      if (!res.canceled && res.assets[0]) push({ kind: 'photo', media: res.assets[0].uri, text: '' });
    } catch { show({ text: 'Камера доступна в приложении на телефоне' }); }
  };

  const title = isEvent ? chatMeta?.title ?? event?.title ?? 'Чат события' : person?.name ?? 'Чат';
  const status = isEvent
    ? `${chatMeta?.members ?? 0} участников · ${event ? startsIn(event.startsAt, event.endsAt, now) : ''}`
    : friend ? 'в друзьях · онлайн' : `${details?.online ? 'онлайн' : details?.lastSeen?.toLowerCase() ?? ''} · не в друзьях`;
  const banner = isEvent ? null : friend
    ? (details && canSee('friend', 'location', details.privacy) && details.now ? `${person?.name.toUpperCase()} ДЕЛИТСЯ ГЕОЛОКАЦИЕЙ ДО ${details.now.sharingUntil}` : null)
    : `ВЫ ОБА ИДЁТЕ НА «${(events.find((e) => (e.lookers ?? []).some((l) => l.personId === personId) && e.id === 'jazz') ?? events.find((e) => e.id === details?.lookingFor?.eventId))?.title.toUpperCase() ?? 'ОДНО СОБЫТИЕ'}» — ПОЭТОМУ МОЖНО ПИСАТЬ`;
  const iArrived = event && arrived.some((a) => a.eventId === event.id);
  const shownMedia = MEDIA.filter((m) => album === 'recent' || album === 'fav' ? (album === 'recent' || ['b', 'e'].includes(m.id)) : (album === 'video') === m.video);

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: Math.max(50, insets.top + 6) }]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/chats'))} style={styles.round} accessibilityRole="button" accessibilityLabel="Назад">
          <Ic d={IC.back} size={20} color={colors.ink} w={2} />
        </Pressable>
        {person && (
          <Pressable onPress={() => setSheet('person')} accessibilityRole="button" accessibilityLabel={friend ? `${person.name}: профиль и где сейчас` : `${person.name}: профиль`}>
            <Avatar p={person} size={40} ring={friend ? colors.friend : undefined} />
          </Pressable>
        )}
        <Pressable onPress={() => (isEvent && event ? router.push({ pathname: '/event/[id]', params: { id: event.id } }) : setSheet('person'))} style={{ flex: 1, gap: 1 }} accessibilityRole="button">
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.status} numberOfLines={2}>{status}</Text>
        </Pressable>
        {isEvent ? (
          <View style={{ flexDirection: 'row' }}>
            {(chatMeta?.memberIds ?? []).slice(0, 2).map((pid) => byId(pid)).filter(Boolean).map((p) => <Avatar key={p!.id} p={p!} size={30} style={{ marginRight: -8, borderWidth: 2, borderColor: colors.paper }} />)}
            {(chatMeta?.members ?? 0) > 2 && <View style={styles.plus}><Text style={styles.plusText}>+{(chatMeta?.members ?? 0) - 3}</Text></View>}
          </View>
        ) : (
          <Pressable onPress={() => setSheet('menu')} style={styles.round} accessibilityRole="button" accessibilityLabel="Ещё: пожаловаться, заблокировать">
            <Ic d="M5 12h.01M12 12h.01M19 12h.01" size={22} color={colors.ink} w={3} />
          </Pressable>
        )}
      </View>

      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 16 }}>
        {banner && <View style={styles.banner}><Text style={styles.bannerText}>{banner}</Text></View>}
        {isEvent && chatMeta?.meetPoint && (
          <View style={styles.pin}>
            <View style={styles.pinIcon}><Ic d={IC.pin} c={[[12, 9, 2.5]]} size={18} color={colors.ink} w={2} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pinCap}>ТОЧКА СБОРА</Text>
              <Text style={styles.pinText}>{chatMeta.meetPoint}</Text>
            </View>
            <Pressable disabled={!!iArrived || !event} onPress={() => { if (event) { arrive(event.id, cellOf(event.lat, event.lon)); if (!plans.going[event.id]) { plans.go(event.id); addPlan(); } push({ kind: 'system', text: 'ДАНИЛ НА МЕСТЕ' }); show({ text: 'Отметил! +1 место на карте города' }); } }}
              style={[styles.here, iArrived && { backgroundColor: colors.sand }]} accessibilityRole="button">
              <Text style={[styles.hereText, iArrived && { color: colors.ink }]}>{iArrived ? 'Ты на месте' : 'Я на месте'}</Text>
            </Pressable>
          </View>
        )}
        {messages.map((m, i) => {
          const mine = m.authorId === 'me';
          const prev = messages[i - 1];
          return (
            <Bubble key={m.id} m={m} mine={mine} author={byId(m.authorId)} friendChat={friend || isEvent}
              showAuthor={isEvent && (!prev || prev.authorId !== m.authorId)}
              revealed={!!chat.revealed[m.id]} onReveal={() => chat.reveal(m.id)}
              voteState={chat.votes[m.id]} onVote={(k) => chat.vote(m.id, k)}
              onAvatar={() => router.push({ pathname: '/person/[id]', params: { id: m.authorId } })}
              onOpenEvent={() => m.eventId && router.push({ pathname: '/event/[id]', params: { id: m.eventId } })}
              onInvite={!mine ? (a) => { chat.answer(m.id, a); if (a === 'yes' && m.eventId) { plans.go(m.eventId); addPlan(); } } : undefined} />
          );
        })}
        {!check.ok && <View style={styles.closed}><Text style={styles.closedText}>{WRITE_REASONS[check.reason!]}</Text></View>}
      </ScrollView>

      {check.ok && (
        <View style={[styles.composer, { paddingBottom: tray ? 10 : 14 + insets.bottom }]}>
          <Pressable onPress={() => { setTray(!tray); setAlbumsOpen(false); }} style={[styles.iconBtn, tray && { backgroundColor: colors.ink, borderColor: colors.ink }]} accessibilityRole="button" accessibilityLabel="Вложения: фото, видео, опрос">
            <Ic d={ATTACH_IC} size={20} color={tray ? colors.paper : colors.ink} w={1.9} />
          </Pressable>
          {recording ? (
            <View style={[styles.input, styles.recBar]} accessibilityLiveRegion="polite">
              <View style={styles.recDot} />
              <Text style={styles.recText}>{recording === 'voice' ? 'Голосовое' : 'Кружок'} · отпусти, чтобы отправить</Text>
            </View>
          ) : (
            <TextInput value={text} onChangeText={setText} multiline
              onContentSizeChange={(ev) => setInputH(Math.max(44, Math.min(132, ev.nativeEvent.contentSize.height)))}
              onKeyPress={(ev) => { const ne = ev.nativeEvent as { key: string; shiftKey?: boolean }; if (Platform.OS === 'web' && ne.key === 'Enter' && !ne.shiftKey) { ev.preventDefault?.(); sendText(); } }}
              placeholder="Сообщение" placeholderTextColor={colors.muted3} style={[styles.input, { height: text ? inputH : 44 }]} accessibilityLabel="Сообщение" />
          )}
          {text.trim() && !recording ? (
            <Pressable onPress={sendText} style={[styles.iconBtn, { backgroundColor: colors.accent, borderColor: colors.accent }]} accessibilityRole="button" accessibilityLabel="Отправить">
              <Ic d={SEND_IC} size={19} color={colors.ink} w={2} />
            </Pressable>
          ) : (
            <Pressable onPress={() => setRecMode(recMode === 'voice' ? 'circle' : 'voice')} onLongPress={startRec} onPressOut={stopRec} delayLongPress={220}
              style={[styles.iconBtn, { backgroundColor: recording ? colors.accent : colors.ink, borderColor: recording ? colors.accent : colors.ink }, recording && { transform: [{ scale: 1.25 }] }]}
              accessibilityRole="button" accessibilityLabel={recMode === 'voice' ? 'Голосовое: удерживай, чтобы записать. Нажми — переключить на кружок' : 'Кружок: удерживай, чтобы записать. Нажми — переключить на голосовое'}>
              <Ic d={recMode === 'voice' ? MIC_IC : CIRCLE_IC} size={20} color={recording ? colors.ink : colors.paper} w={1.9} />
            </Pressable>
          )}
        </View>
      )}

      {tray && check.ok && !poll && (
        <View style={[styles.tray, { paddingBottom: 12 + insets.bottom }]}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Pressable onPress={() => setAlbumsOpen(!albumsOpen)} style={styles.album} accessibilityRole="button" accessibilityLabel="Выбрать альбом" accessibilityState={{ expanded: albumsOpen }}>
              <Text style={styles.albumText}>{ALBUMS.find(([k]) => k === album)?.[1]}</Text>
              <Ic d={albumsOpen ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} size={16} color={colors.ink} w={2.2} />
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable onPress={() => setPoll({ q: '', options: ['', ''] })} style={styles.trayBtn} accessibilityRole="button">
              <Ic d={POLL_IC} size={16} color={colors.ink} w={2.2} /><Text style={styles.trayBtnText}>Опрос</Text>
            </Pressable>
          </View>
          {albumsOpen && (
            <View style={styles.albums}>
              {ALBUMS.map(([k, label]) => (
                <Pressable key={k} onPress={() => { setAlbum(k); setAlbumsOpen(false); }} style={[styles.albumRow, album === k && { backgroundColor: colors.sand2 }]} accessibilityRole="menuitem">
                  <Text style={[styles.albumText, album === k && { fontFamily: fonts.body700 }]}>{label}</Text>
                  {album === k && <Ic d={IC.check} size={16} color={colors.ink} w={2.4} />}
                </Pressable>
              ))}
            </View>
          )}
          <View style={styles.grid}>
            <Pressable onPress={camera} style={[styles.thumb, styles.camTile]} accessibilityRole="button" accessibilityLabel="Камера">
              <View style={styles.camLens}><Ic d={CAM_IC} size={26} color={colors.paper} w={1.8} /></View>
              <Text style={styles.camText}>Камера</Text>
            </Pressable>
            {shownMedia.map((md) => {
              const pos = picked.indexOf(md.id);
              const on = pos >= 0;
              return (
                <Pressable key={md.id} onPress={() => setPicked(on ? picked.filter((x) => x !== md.id) : [...picked, md.id])} style={styles.thumb} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={md.video ? `Видео, ${md.dur}` : 'Фото'}>
                  <Image source={photo(md.src)} style={[styles.thumbImg, { opacity: on ? 0.82 : 1 }]} />
                  <View style={[styles.mark, on ? { backgroundColor: colors.accent } : { borderWidth: 2, borderColor: '#FFFFFF' }]}>{on && <Text style={styles.markText}>{pos + 1}</Text>}</View>
                  {md.video && <View style={styles.vdur}><Ic d="M3 7h12v10H3zM15 10l6-3v10l-6-3z" size={10} color="#FFFFFF" w={2} /><Text style={styles.vdurText}>{md.dur}</Text></View>}
                </Pressable>
              );
            })}
          </View>
          <Pressable disabled={!picked.length} onPress={sendPicked} style={[styles.sendAll, !picked.length && { backgroundColor: colors.sand }]} accessibilityRole="button">
            <Text style={[styles.sendAllText, !picked.length && { color: colors.muted3 }]}>{picked.length ? `Отправить · ${picked.length}` : 'Выбери фото или видео'}</Text>
          </Pressable>
        </View>
      )}

      {poll && (
        <View style={[styles.tray, { paddingBottom: 12 + insets.bottom }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.sheetTitle, { flex: 1, fontSize: 19 }]}>Опрос</Text>
            <Pressable onPress={() => setPoll(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Отменить опрос"><Ic d={IC.close} size={18} color={colors.ink} w={2.2} /></Pressable>
          </View>
          <TextInput value={poll.q} onChangeText={(q) => setPoll({ ...poll, q })} placeholder="Вопрос: куда после?" placeholderTextColor={colors.muted3} style={styles.pollInput} accessibilityLabel="Вопрос" maxLength={120} />
          {poll.options.map((o, i) => (
            <TextInput key={i} value={o} onChangeText={(t) => setPoll({ ...poll, options: poll.options.map((x, j) => (j === i ? t : x)) })} placeholder={`Вариант ${i + 1}`} placeholderTextColor={colors.muted3}
              style={styles.pollInput} accessibilityLabel={`Вариант ${i + 1}`} maxLength={60} />
          ))}
          {poll.options.length < 6 && (
            <Pressable onPress={() => setPoll({ ...poll, options: [...poll.options, ''] })} style={{ alignSelf: 'flex-start', paddingVertical: 4 }} accessibilityRole="button"><Text style={styles.addOption}>+ Вариант</Text></Pressable>
          )}
          <Pressable onPress={sendPoll} disabled={!poll.q.trim() || poll.options.filter((o) => o.trim()).length < 2}
            style={[styles.sendAll, (!poll.q.trim() || poll.options.filter((o) => o.trim()).length < 2) && { backgroundColor: colors.sand }]} accessibilityRole="button">
            <Text style={styles.sendAllText}>Отправить опрос</Text>
          </Pressable>
        </View>
      )}

      {toast && <Toast t={toast} style={{ position: 'absolute', left: 16, right: 16, bottom: 90 + insets.bottom }} />}

      {sheet && person && (
        <>
          <Backdrop onPress={() => setSheet(null)} opacity={0.35} label="Закрыть" />
          <BottomSheet label={sheet === 'menu' ? 'Действия' : person.name} style={{ paddingBottom: 30 + insets.bottom }}>
            {sheet === 'person' ? <PersonSheet p={person} friend={friend} details={details ?? undefined} requested={!!social.sent[person.id]}
              onClose={() => setSheet(null)} onProfile={() => router.push({ pathname: '/person/[id]', params: { id: person.id } })}
              onMap={() => { focusFriend(person.id); router.push('/'); }} onAdd={() => social.toggleRequest(person.id)} /> : (
              <>
                <Text style={styles.sheetTitle}>{person.name}</Text>
                <Pressable onPress={() => { chat.report(person.id); setSheet(null); show({ text: 'Жалоба отправлена. Команда проверит в течение суток' }); }} style={styles.menuRow} accessibilityRole="button">
                  <Text style={styles.menuText}>{chat.reported[person.id] ? 'Жалоба отправлена' : 'Пожаловаться'}</Text>
                </Pressable>
                <Pressable onPress={() => { chat.block(person.id); setSheet(null); show({ text: `${person.name} заблокирован(а): больше не сможет писать и видеть твои планы` }); }} style={[styles.menuRow, { borderBottomWidth: 0 }]} accessibilityRole="button">
                  <Text style={[styles.menuText, { color: colors.accentText }]}>{chat.blocked[person.id] ? 'Заблокирован(а)' : `Заблокировать ${accusative(person.name)}`}</Text>
                </Pressable>
              </>
            )}
          </BottomSheet>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

function PersonSheet({ p, friend, details, requested, onClose, onProfile, onMap, onAdd }: {
  p: Person; friend: boolean; details?: import('../../src/data/types').PersonDetails; requested: boolean;
  onClose: () => void; onProfile: () => void; onMap: () => void; onAdd: () => void;
}) {
  const sees = friend && details && canSee('friend', 'location', details.privacy) && details.now;
  const her = p.name.endsWith('а') ? 'её' : 'его';
  const she = p.name.endsWith('а') ? 'она' : 'он';
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Avatar p={p} size={60} radius={18} />
        <View style={{ flex: 1 }}>
          <Text style={styles.sheetTitle}>{p.name}{p.age ? `, ${p.age}` : ''}</Text>
          <Text style={styles.status}>{friend ? 'в друзьях · онлайн' : 'не в друзьях · общее событие'}</Text>
        </View>
        <Pressable onPress={onClose} style={styles.round} accessibilityRole="button" accessibilityLabel="Закрыть"><Ic d={IC.close} size={16} color={colors.ink} w={2.2} /></Pressable>
      </View>
      {sees ? (
        <View style={styles.nowCard}>
          <View style={styles.nowIcon}><Ic d={IC.pin} c={[[12, 9, 2.5]]} size={18} color="#FFFFFF" w={2} /></View>
          <View style={{ flex: 1 }}><Text style={styles.nowTitle}>Сейчас: {details!.now!.place}</Text><Text style={styles.status}>на месте · обновлено 2 мин назад · до {details!.now!.sharingUntil}</Text></View>
        </View>
      ) : (
        <View style={styles.hidden}>
          <View style={styles.lock}><Ic d={IC.lock} size={18} color={colors.ink} w={2} /></View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.nowTitle}>На карте {her} не видно</Text>
            <Text style={styles.status}>{friend ? `${p.name} сейчас не делится геолокацией.` : `${p.name} разрешил${she === 'она' ? 'а' : ''} писать тем, кто идёт на те же события. Где ${she} сейчас — видят только друзья, и только если ${she} сам${she === 'она' ? 'а' : ''} включит.`}</Text>
          </View>
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable onPress={onProfile} style={[styles.sheetBtn, { borderWidth: 1.5, borderColor: colors.ink }]} accessibilityRole="button"><Text style={styles.sheetBtnText}>Профиль</Text></Pressable>
        {sees ? (
          <Pressable onPress={onMap} style={[styles.sheetBtn, { backgroundColor: colors.ink }]} accessibilityRole="button"><Text style={[styles.sheetBtnText, { color: colors.paper }]}>Показать на карте</Text></Pressable>
        ) : !friend ? (
          <Pressable onPress={onAdd} style={[styles.sheetBtn, { backgroundColor: requested ? colors.sand : colors.ink }]} accessibilityRole="button"><Text style={[styles.sheetBtnText, { color: requested ? colors.ink : colors.paper }]}>{requested ? 'Заявка ушла' : 'Добавить в друзья'}</Text></Pressable>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  round: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.display700, fontSize: 17, color: colors.ink },
  status: { fontFamily: fonts.body400, fontSize: 12.5, color: colors.muted },
  plus: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.paper },
  plusText: { fontFamily: fonts.mono600, fontSize: 10, color: colors.ink },
  banner: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: colors.sand },
  bannerText: { textAlign: 'center', fontFamily: fonts.mono600, fontSize: 10, letterSpacing: 0.4, color: colors.muted },
  pin: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, borderWidth: 1.5, borderColor: colors.ink, backgroundColor: colors.card },
  pinIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  pinCap: { fontFamily: fonts.mono600, fontSize: 10, letterSpacing: 0.5, color: colors.muted },
  pinText: { fontFamily: fonts.body700, fontSize: 14.5, color: colors.ink },
  here: { height: 38, paddingHorizontal: 12, borderRadius: 19, backgroundColor: colors.ink, justifyContent: 'center' },
  hereText: { fontFamily: fonts.body600, fontSize: 13, color: colors.paper },
  closed: { padding: 12, borderRadius: 14, backgroundColor: colors.sand },
  closedText: { textAlign: 'center', fontFamily: fonts.body400, fontSize: 13, color: colors.muted2 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingTop: 10, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.paper },
  iconBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minWidth: 0, height: 44, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, borderRadius: 22, textAlignVertical: 'top', borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.card, fontFamily: fonts.body400, fontSize: 15, color: colors.ink },
  tray: { paddingHorizontal: 12, paddingTop: 10, gap: 10, backgroundColor: colors.paper },
  recBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 0, paddingBottom: 0 },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  recText: { fontFamily: fonts.body500, fontSize: 14, color: colors.accentText },
  album: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  albumText: { fontFamily: fonts.body600, fontSize: 14, color: colors.ink },
  albums: { borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  albumRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 44, paddingHorizontal: 14 },
  trayBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  trayBtnText: { fontFamily: fonts.body600, fontSize: 13.5, color: colors.ink },
  camTile: { backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', gap: 6 },
  camLens: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' },
  camText: { fontFamily: fonts.body600, fontSize: 12.5, color: colors.paper },
  pollInput: { height: 46, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.card, fontFamily: fonts.body400, fontSize: 15, color: colors.ink },
  addOption: { fontFamily: fonts.body600, fontSize: 14, color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  thumb: { width: '32.6%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden' },
  thumbImg: { width: '100%', height: '100%' },
  mark: { position: 'absolute', right: 6, top: 6, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  markText: { fontFamily: fonts.mono600, fontSize: 11, color: colors.ink },
  vdur: { position: 'absolute', left: 6, bottom: 6, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(23,22,26,0.7)' },
  vdurText: { fontFamily: fonts.mono600, fontSize: 10, color: '#FFFFFF' },
  sendAll: { height: 44, borderRadius: 14, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  sendAllText: { fontFamily: fonts.body600, fontSize: 15, color: colors.paper },
  sheetTitle: { fontFamily: fonts.display700, fontSize: 22, color: colors.ink },
  nowCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, borderWidth: 1.5, borderColor: colors.friend, backgroundColor: colors.card },
  nowIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.friend, alignItems: 'center', justifyContent: 'center' },
  nowTitle: { fontFamily: fonts.body700, fontSize: 15, color: colors.ink },
  hidden: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line2 },
  lock: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  sheetBtn: { flex: 1, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  sheetBtnText: { fontFamily: fonts.body600, fontSize: 15, color: colors.ink },
  menuRow: { height: 52, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: colors.line },
  menuText: { fontFamily: fonts.body600, fontSize: 16, color: colors.ink },
});
