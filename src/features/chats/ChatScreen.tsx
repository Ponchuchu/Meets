import { preparePhoto } from '../../chat/media';
import { useSocialActions } from '../../live/socialActions';
import { useOutbox } from '../../live/outbox';
import { myId } from '../../live/auth';
// Чат: личный (DirectChat, ChatAttach, ChatSheets) и чат события (EventChat).
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { track } from '../../analytics';
import * as ImagePicker from 'expo-image-picker';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { mergeChatMessages } from '../../chat/messages';
import { Camera } from 'expo-camera';
import { usePlayback } from '../../chat/playback';
import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { AttachmentsSheet } from '../../chat/ui/AttachmentsSheet';
import { CircleRecorder, type CircleRecorderHandle } from '../../chat/ui/CircleRecorder';
import { StickerPicker } from '../../stickers/StickerPicker';
import { SwipeReply } from '../../chat/ui/SwipeReply';
import * as Clipboard from 'expo-clipboard';
import { Sticker as StickerIcon } from 'lucide-react-native';
import { getMeStats, answerInvite, getInvites } from '../../live/api';
import { config } from '../../lib/config';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, type ListRenderItemInfo, Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { canWrite, eventChatOpen, startsIn, WRITE_REASONS } from '../../chat/rules';
import { Bubble } from '../../chat/ui/Bubble';
import { data, eventsSnapshot, type Message, type Person } from '../../data';
import { photo } from '../../data/photos';
import { isRemoteId, useLiveChat } from '../../data/realtime';
import { openDirectChat, markChatRead, getMessages } from '../../data/remote';
import { dayIndex, now as clockNow } from '../../lib/clock';
import { accusative } from '../../lib/names';
import { canSee } from '../../people/visibility';
import { cellOf } from '../../profile/city';
import { useApp, useBackClose } from '../../state/app';
import { timeNow, useChat } from '../../state/chat';
import { uid } from '../../lib/uid';
import { useMapState } from '../../state/map';
import { usePlans } from '../../state/plans';
import { useProfile } from '../../state/profile';
import { isFriendNow } from '../../state/social';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors, fonts } from '../../theme';
import { glass } from '../../ui/glass';
import { Avatar } from '../../ui/Avatar';
import { Ic, IC } from '../../ui/Ic';
import { Backdrop, BottomSheet, SwipeDown } from '../../ui/sheet';
import { StaticMap } from '../../map/StaticMap';
import { updatedText } from '../../map/ui/FriendCard';
import type { FriendSpot } from '../../data/types';
import { Toast, type ToastData } from '../../ui/Toast';

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
  const { height: winH } = useWindowDimensions();
  const { id, tray: trayParam, sheet: sheetParam } = useLocalSearchParams<{ id: string; tray?: string; sheet?: string }>();
  const now = clockNow();
  const [focused, setFocused] = useState(true);
  const stopOnBlur = useRef<() => void>(() => undefined);
  useFocusEffect(useCallback(() => { setFocused(true); usePlayback.getState().focus(true); return () => { setFocused(false); stopOnBlur.current(); usePlayback.getState().focus(false); }; }, []));
  const [atBottom, setAtBottom] = useState(true);
  const {data:stats}=useQuery({queryKey:['me','stats'],queryFn:getMeStats,enabled:config.dataMode!=='demo'});
  const { data: chats = [] } = useQuery({ queryKey: ['chats'], queryFn: () => data.getChats() });
  const localGroups = useChat(s => s.groups);
  const allChats = [...chats,...localGroups];
  const meta0 = allChats.find((c) => c.id === id);
  const isGroup = meta0?.kind === 'group';
  // Чат из базы (uuid): кто собеседник и событийный ли он — из списка чатов. «dm-<id>» — личный по человеку.
  const isEvent = id.startsWith('ev-') || meta0?.kind === 'event';
  const personId = isEvent ? null : meta0?.personId ?? (id.startsWith('dm-') ? id.slice(3) : null);
  const qc = useQueryClient();
  // Альфа: «dm-<uuid друга>» → настоящий личный чат в базе (сервер находит или создаёт), сообщения уходят туда.
  useEffect(() => {
    if (config.dataMode === 'demo' || !id.startsWith('dm-') || !isRemoteId(id.slice(3))) return;
    openDirectChat(id.slice(3)).then((cid) => {
      void qc.invalidateQueries({ queryKey: ['chats'] });
      router.replace({ pathname: '/chat/[id]', params: { id: cid } });
    }).catch(() => undefined);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useLiveChat(id, focused);
  const messagesQuery = useQuery({ queryKey: ['messages', id], queryFn: () => data.getMessages(id) });
  const base = useMemo(() => messagesQuery.data ?? [], [messagesQuery.data]);
  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => data.getPeople() });
  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: () => data.getEvents(), placeholderData: eventsSnapshot });
  const { data: details } = useQuery({ queryKey: ['person', personId], queryFn: () => data.getPersonDetails(personId!), enabled: !!personId });
  const { data: spots = [] } = useQuery({ queryKey: ['friendSpots'], queryFn: () => data.getFriendSpots() });
  const spot = spots.find((x) => x.personId === personId);
  const chat = useChat();
  const plans = usePlans();
  const arrive = useProfile((s) => s.arrive);
  const arrived = useProfile((s) => s.arrivals);
  const addPlan = useApp((s) => s.addPlan);
  const focusFriend = useMapState((s) => s.focusFriend);
  const [text, setText] = useState('');
  const [tray, setTray] = useState(trayParam === '1');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [menu, setMenu] = useState<Message | null>(null);
  const [album, setAlbum] = useState<Album>('recent');
  const [albumsOpen, setAlbumsOpen] = useState(false);
  const [recMode, setRecMode] = useState<'voice' | 'circle'>('voice');
  const [inputH, setInputH] = useState(44);
  // Плавающая капсула ввода лежит поверх ленты: лента получает отступ на её высоту. С клавиатурой — без отступа safe area.
  const [composerH, setComposerH] = useState(72);
  const [kb, setKb] = useState(false);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const a = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () => setKb(true));
    const b = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setKb(false));
    return () => { a.remove(); b.remove(); };
  }, []);
  const [poll, setPoll] = useState<null | { q: string; options: string[] }>(null);
  const [picked, setPicked] = useState<string[]>(trayParam === '1' ? ['b', 'a'] : []);
  const [sheet, setSheet] = useState<null | 'person' | 'menu' | 'attachments' | 'stickers' | 'events'>(sheetParam === '1' ? 'person' : null);
  const [recording, setRecording] = useState<null | 'voice' | 'circle'>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const social = useSocialActions(text => setToast({ text }));
  const scroll = useRef<FlatList<Message>>(null);
  const listMetrics = useRef({ height: 0, offset: 0 });
  const historyAnchor = useRef<{ height: number; offset: number } | null>(null);
  const initialScrollFor = useRef<string | null>(null);

  const person = personId ? people.find((p) => p.id === personId) : undefined;
  const chatMeta = allChats.find((c) => c.id === id);
  const event = isEvent ? [...plans.meetups, ...events].find((e) => e.id === (chatMeta?.eventId ?? id.slice(3))) : undefined;
  const friend = person ? isFriendNow(person, social) : false;
  const [older, setOlder] = useState<{ chatId: string; rows: Message[] }>({ chatId: id, rows: [] });
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [endOfHistory, setEndOfHistory] = useState<string | null>(null);
  const hasOlder = endOfHistory !== id;
  const messages = useMemo(() => mergeChatMessages([...(older.chatId === id ? older.rows : []), ...base], chat.sent.filter(m => m.chatId === id)), [base, chat.sent, id, older]);
  const loadOlder = async () => {
    const first = messages.find(m => m.createdAt && !m.delivery);
    if (loadingOlder || !hasOlder || !isRemoteId(id) || !first?.createdAt || base.length < 100 && older.rows.length === 0) return;
    setLoadingOlder(true);
    try {
      const rows = await getMessages(id, { at: first.createdAt, id: first.id });
      if (Platform.OS === 'web') historyAnchor.current = { ...listMetrics.current };
      setOlder(old => ({ chatId: id, rows: [...rows, ...(old.chatId === id ? old.rows : [])] }));
      if (rows.length < 100) setEndOfHistory(id);
    } catch { show({ text: 'Не получилось загрузить историю. Потяни список ещё раз' }); }
    finally { setLoadingOlder(false); }
  };
  const listData = useMemo(() => Platform.OS === 'web' ? messages : [...messages].reverse(), [messages]);
  const { data: invites = [] } = useQuery({ queryKey: ['invites'], queryFn: getInvites, enabled: config.dataMode !== 'demo' });
  const byId = (pid: string) => people.find((p) => p.id === pid);
  const show = (t: ToastData) => { setToast(t); setTimeout(() => setToast((c) => (c === t ? null : c)), 3500); };

  useEffect(() => {
    if (!focused || !atBottom || recording) return;
    chat.markRead(id, chatMeta?.unread ?? 0);
    const at = base[base.length - 1]?.createdAt;
    if (isRemoteId(id) && at) void markChatRead(id, at).then(() => {
      qc.setQueryData<import('../../data/types').Chat[]>(['chats'], old => old?.map(c => c.id === id ? { ...c, unread: 0 } : c));
    }).catch(() => undefined);
  }, [id, base, focused, atBottom, recording]); // eslint-disable-line react-hooks/exhaustive-deps

  // Можно ли писать: друзья — всегда, незнакомые — только при общем событии и в пределах лимитов.
  const commonEvent = !!person && events.some((e) => (plans.going[e.id] || e.friendsGoing.length) && (e.lookers ?? []).some((l) => l.personId === person.id));
  const check = isGroup ? {ok:true,reason:undefined} : isEvent
    ? { ok: !!event && eventChatOpen(event.startsAt, event.endsAt, now), reason: 'closed' as const }
    : canWrite({
      friend, recipientAllows: 'common', commonEvent: commonEvent || !!details?.lookingFor, existing: messages.length > 0,
      myAccountCreatedAt: MY_ACCOUNT_CREATED, newChatsToday: plans.newChats.day === String(dayIndex(now)) ? plans.newChats.people.length : 0,
      blocked: !!(personId && chat.blocked[personId]), now,
    });

  const sendPending = async (msg: Message) => {
    const ownerId = myId();
    if (!ownerId || msg.ownerId && msg.ownerId !== ownerId) { show({ text: 'Войди в аккаунт отправителя' }); return; }
    chat.updateMessage(msg.id, { delivery: 'sending' });
    const local = !msg.uploadedPath && msg.media && !/^https?:/.test(msg.media) && msg.media.includes(':');
    useOutbox.getState().add({ id: msg.id, kind: 'message', chatId: msg.chatId, ownerId, payload: {
      kind: msg.kind, body: msg.text, media_path: msg.uploadedPath ?? (local ? null : msg.media ?? null),
      ...(local ? { local_uri: msg.media } : {}), duration_s: msg.durationS ?? null, event_id: msg.eventId ?? null, ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
    } });
  };
  const push = (m: Partial<Message> & Pick<Message, 'kind'> & { durationS?: number }) => {
    if (!check.ok) return;
    if (isRemoteId(id) && !myId()) { show({ text: 'Войди снова, чтобы отправить сообщение' }); return; }
    if (personId && messages.length === 0 && !friend) plans.startChat(personId, String(dayIndex(now)));
    const msg: Message = { id: isRemoteId(id) ? randomUUID() : uid(`${id}-me`), chatId: id, ownerId: myId() ?? undefined, authorId: 'me', text: '', time: timeNow(), createdAt: new Date().toISOString(), ...(replyTo ? { replyTo: replyTo.id } : {}), ...m, ...(isRemoteId(id) ? { delivery: 'sending' as const } : {}) };
    setReplyTo(null);
    chat.send(msg);
    track('chat_sent');
    if (isRemoteId(id)) void sendPending(msg);
  };
  const sendText = () => { if (text.trim()) { push({ kind: 'text', text: text.trim() }); setText(''); setInputH(44); } };
  // Одна кнопка записи, как в Telegram: тап — голос ↔ кружок, удержание — запись, отпустил — отправилось.
  // Демо-запись: настоящий звук и видео — expo-audio / expo-camera в dev build.
  // Настоящая запись: голос — expo-audio, кружок — фронтальная камера (CircleRecorder). Влево — отмена.
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, sampleRate: 22050, numberOfChannels: 1, bitRate: 64000 });
  const circleRef = useRef<CircleRecorderHandle>(null);
  const [cancelling, setCancelling] = useState(false);
  const dur = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  const rec = useRef({ active:false, ready:false, mode:'voice' as 'voice'|'circle', started:0, locked:false });
  const [locked, setLocked] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setElapsed(rec.current.started ? Math.floor((nowMs()-rec.current.started)/1000) : 0),200);
    return () => clearInterval(timer);
  },[recording]);
  useEffect(() => () => { rec.current.active=false; circleRef.current?.stop(false); void recorder.stop().catch(()=>undefined); void setAudioModeAsync({allowsRecording:false}); },[recorder]);
  const switchRecMode = async () => {
    if (recMode === 'voice' && Platform.OS !== 'web') {
      try { await Camera.requestCameraPermissionsAsync(); await Camera.requestMicrophonePermissionsAsync(); } catch { show({ text: 'Разреши камеру и микрофон' }); }
    }
    setRecMode(m => m === 'voice' ? 'circle' : 'voice');
  };
  useEffect(() => { usePlayback.getState().record(!!recording); return () => usePlayback.getState().record(false); }, [recording]);
  const preparing = useRef(false);
  const stopping = useRef(false);
  const startRec = async () => {
    if(rec.current.active || preparing.current || stopping.current) return;
    usePlayback.getState().play(null);
    rec.current = {active:true,ready:false,mode:recMode,started:recMode === 'circle' ? 0 : nowMs(),locked:false};
    setLocked(false);setElapsed(0);setCancelling(false);
    if (recMode === 'circle') {
      if (Platform.OS === 'web') { rec.current.active=false; show({text:'Кружки записываются в приложении на телефоне'}); return; }
      usePlayback.getState().record(true); setRecording('circle'); return;
    }
    preparing.current = true;
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!rec.current.active) return;
      if (!perm.granted) {rec.current.active=false;show({text:'Разреши микрофон в настройках телефона'});return;}
      usePlayback.getState().record(true);
      await setAudioModeAsync({allowsRecording:true,playsInSilentMode:true});
      await recorder.prepareToRecordAsync();
      // Отпустил во время диалога разрешений — запись не начинается и ничего не отправляется.
      if (!rec.current.active) {await recorder.stop().catch(()=>undefined);await setAudioModeAsync({allowsRecording:false});return;}
      rec.current.started=nowMs();recorder.record();rec.current.ready=true;setRecording('voice');
    } catch {rec.current.active=false;setRecording(null);void setAudioModeAsync({allowsRecording:false});show({text:'Не получилось включить микрофон'});} finally { preparing.current = false; if (!rec.current.active) usePlayback.getState().record(false); }
  };
  const stopRec = async (send:boolean) => {
    if(!rec.current.active) return;
    const mode=rec.current.mode;
    const sec=Math.floor((nowMs()-rec.current.started)/1000);
    rec.current.active=false;rec.current.locked=false;setLocked(false);setCancelling(false);
    if(mode==='circle') {stopping.current = true;if(circleRef.current)circleRef.current.stop(send);else setRecording(null);return;}
    setRecording(null);
    if(!rec.current.ready)return;
    stopping.current = true;
    try {
      await recorder.stop();await setAudioModeAsync({allowsRecording:false});
      if(send && recorder.uri && sec>=1) push({kind:'voice',media:recorder.uri,duration:dur(sec),durationS:sec});
    } catch {if(send)show({text:'Запись не сохранилась. Попробуй ещё раз'});} finally { stopping.current = false; usePlayback.getState().record(false); }
  };
  useEffect(() => { stopOnBlur.current = () => { void stopRec(false); }; });
  // Эти обработчики читает Gesture Handler при касании; при рендере они не выполняются.
  /* eslint-disable react-hooks/refs */
  const recHandlers = useRef({ startRec, stopRec, switchRecMode });
  useEffect(() => { recHandlers.current = { startRec, stopRec, switchRecMode }; });
  const recGesture = useMemo(() => Gesture.Exclusive(
    Gesture.Pan().activateAfterLongPress(250).runOnJS(true)
      .onStart(()=>void recHandlers.current.startRec())
      .onUpdate(e=>{setCancelling(old => old === (e.translationX < -80) ? old : e.translationX < -80);if(e.translationY < -70 && !rec.current.locked){rec.current.locked=true;setLocked(true);}})
      .onEnd(e=>{if(!rec.current.locked)void recHandlers.current.stopRec(e.translationX>=-80);})
      .onFinalize((_e,ok)=>{if(!ok && !rec.current.locked)void recHandlers.current.stopRec(false);}),
    Gesture.Tap().runOnJS(true).onEnd(() => void recHandlers.current.switchRecMode()),
  ), []);
  /* eslint-enable react-hooks/refs */
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
  const library = async () => {
    const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
    if(!permission.granted){show({text:'Разреши доступ к фотографиям'});return;}
    try {
      const r=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images','videos'],allowsMultipleSelection:true,selectionLimit:10,quality:0.78,videoExportPreset:ImagePicker.VideoExportPreset.H264_1280x720});
      if(!r.canceled)for(const a of r.assets)push({kind:a.type==='video'?'video':'photo',media:a.type==='video'?a.uri:await preparePhoto(a.uri,a.width,a.height),durationS:a.duration?Math.round(a.duration/1000):undefined});
      setTray(false);
    }catch{show({text:'Не удалось открыть галерею'});}
  };
  const camera = async () => {
    try {
      const permission=await ImagePicker.requestCameraPermissionsAsync();
      if(!permission.granted){show({text:'Разреши доступ к камере'});return;}
      const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      if (!res.canceled && res.assets[0]) { const a = res.assets[0]; push({ kind: 'photo', media: await preparePhoto(a.uri, a.width, a.height), text: '' }); }
    } catch { show({ text: 'Камера доступна в приложении на телефоне' }); }
  };

  const title = isGroup ? chatMeta?.title ?? 'Группа' : isEvent ? chatMeta?.title ?? event?.title ?? 'Чат события' : person?.name ?? 'Чат';
  const status = isGroup ? `${chatMeta?.members ?? 0} участников` : isEvent
    ? `${chatMeta?.members ?? 0} участников · ${event ? startsIn(event.startsAt, event.endsAt, now) : ''}`
    : friend ? (details?.online ? 'в друзьях · онлайн' : 'в друзьях') : `${details?.online ? 'онлайн' : details?.lastSeen?.toLowerCase() ?? ''} · не в друзьях`;
  // Геолокация у друзей работает всегда (кроме невидимки) — плашка «делится до …» больше не нужна.
  const banner = isGroup || isEvent || friend ? null
    : `ВЫ ОБА ИДЁТЕ НА «${(events.find((e) => (e.lookers ?? []).some((l) => l.personId === personId) && e.id === 'jazz') ?? events.find((e) => e.id === details?.lookingFor?.eventId))?.title.toUpperCase() ?? 'ОДНО СОБЫТИЕ'}» — ПОЭТОМУ МОЖНО ПИСАТЬ`;
  const iArrived = event && arrived.some((a) => a.eventId === event.id);
  const shownMedia = MEDIA.filter((m) => album === 'recent' || album === 'fav' ? (album === 'recent' || ['b', 'e'].includes(m.id)) : (album === 'video') === m.video);

  const answering = useRef(new Set<string>());
  const answerMessage = async (m: Message, answer: 'yes' | 'no') => {
    if (answering.current.has(m.id)) return;
    const apply = (confirmed: 'yes' | 'no') => {
      useChat.getState().answer(m.id, confirmed);
      if (confirmed === 'yes' && m.eventId) { usePlans.getState().go(m.eventId); addPlan(); }
    };
    if (!isRemoteId(id)) { apply(answer); return; }
    const candidates = invites.filter(inv => inv.event_id === m.eventId && inv.from_id === m.authorId);
    const inv = candidates.find(inv => !inv.answer) ?? candidates[0];
    if (!inv) { show({ text: 'Приглашение ещё загружается. Попробуй ответить ещё раз' }); void qc.invalidateQueries({ queryKey: ['invites'] }); return; }
    answering.current.add(m.id);
    show({ text: 'Сохраняю ответ…' });
    try {
      if (!inv.answer) await answerInvite(inv, answer === 'yes');
      apply(inv.answer === 'yes' || inv.answer === 'no' ? inv.answer : answer);
      show({ text: 'Ответ сохранён' });
      void qc.invalidateQueries({ queryKey: ['invites'] });
    } catch {
      show({ text: 'Ответ не сохранился. Проверь связь и нажми ещё раз' });
      void qc.invalidateQueries({ queryKey: ['invites'] });
    } finally { answering.current.delete(m.id); }
  };

  const renderMessage = useCallback(({ item: m, index }: ListRenderItemInfo<Message>) => {
          const mine = m.authorId === 'me';
          const prev = listData[Platform.OS === 'web' ? index - 1 : index + 1];
          const quoted = m.replyTo ? listData.find(x => x.id === m.replyTo) : undefined;
          return (
            <SwipeReply enabled={check.ok && m.kind !== 'system'} onReply={() => setReplyTo(m)} onMenu={() => setMenu(m)}>
            {quoted && <View style={[styles.quote, mine ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start', marginLeft: (isEvent || isGroup) ? 38 : 0 }]}>
              <Text style={styles.quoteName} numberOfLines={1}>{quoted.authorId === 'me' ? 'Ты' : byId(quoted.authorId)?.name ?? 'Сообщение'}</Text>
              <Text style={styles.quoteText} numberOfLines={1}>{snippet(quoted)}</Text>
            </View>}
            <View><Bubble m={chat.answers[m.id] ? { ...m, answer: chat.answers[m.id] === 'yes' ? 'Иду' : 'Не смогу' } : m} mine={mine} author={byId(m.authorId)} friendChat={friend || isEvent || isGroup}
              showAuthor={(isEvent || isGroup) && (!prev || prev.authorId !== m.authorId)}
              revealed={!!chat.revealed[m.id]} onReveal={() => chat.reveal(m.id)}
              voteState={chat.votes[m.id]} onVote={(k) => chat.vote(m.id, k)}
              onAvatar={() => router.push({ pathname: '/person/[id]', params: { id: m.authorId } })}
              onOpenEvent={() => m.eventId && router.push({ pathname: '/event/[id]', params: { id: m.eventId } })}
              onInvite={!mine ? a => { void answerMessage(m, a); } : undefined} />
              {m.delivery && <Pressable disabled={m.delivery === 'sending'} onPress={() => void sendPending(m)} style={{ alignSelf: 'flex-end', minHeight: 36, paddingHorizontal: 8, justifyContent: 'center' }}><Text style={styles.status}>{m.delivery === 'sending' ? 'Отправляется…' : 'Не отправилось · Повторить'}</Text></Pressable>}
            </View>
            </SwipeReply>
          );
  }, [listData, people, friend, isEvent, isGroup, chat.revealed, chat.votes, chat.answers, invites, id]); // eslint-disable-line react-hooks/exhaustive-deps

  useBackClose(() => {
    if (recording) void stopRec(false);
    else if (sheet) setSheet(null);
    else if (poll) setPoll(null);
    else { setTray(false); setAlbumsOpen(false); }
  }, !!recording || !!sheet || !!poll || tray);

  return (
    <KeyboardAvoidingView style={styles.root} behavior="padding">
      <View style={[styles.header, { paddingTop: Math.max(50, insets.top + 6) }]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/chats'))} style={styles.round} accessibilityRole="button" accessibilityLabel="Назад">
          <Ic d={IC.back} size={20} color={colors.ink} w={2} />
        </Pressable>
        {person && (
          <Pressable onPress={() => setSheet('person')} accessibilityRole="button" accessibilityLabel={friend ? `${person.name}: профиль и где сейчас` : `${person.name}: профиль`}>
            <Avatar p={person} size={40} ring={friend ? colors.friend : undefined} />
          </Pressable>
        )}
        <Pressable onPress={() => setSheet('attachments')} style={{ flex: 1, gap: 1 }} accessibilityRole="button" accessibilityLabel={`${title}: участники и вложения`}>
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

      {/* Потянул ленту — клавиатура и вложения сворачиваются, как в Telegram. */}
      <View style={{ flex: 1 }}>
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
        <FlatList ref={scroll} data={listData} renderItem={renderMessage} keyExtractor={m => m.id} inverted={Platform.OS !== 'web'}
          style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12, ...(check.ok && !tray && !poll ? Platform.OS === 'web' ? { paddingBottom: composerH + 8 } : { paddingTop: composerH + 8 } : {}) }} initialNumToRender={12} maxToRenderPerBatch={8} windowSize={5} onRefresh={() => { void qc.invalidateQueries({ queryKey: ['messages', id] }); }} refreshing={messagesQuery.isRefetching} removeClippedSubviews={false} onEndReached={Platform.OS !== 'web' ? () => void loadOlder() : undefined} onEndReachedThreshold={0.3}
          onStartReached={Platform.OS === 'web' ? () => void loadOlder() : undefined} onStartReachedThreshold={0.3}
          onContentSizeChange={(_, height) => {
            listMetrics.current.height = height;
            if (Platform.OS !== 'web') return;
            const anchor = historyAnchor.current;
            if (anchor) {
              historyAnchor.current = null;
              scroll.current?.scrollToOffset({ offset: anchor.offset + height - anchor.height, animated: false });
            } else if (initialScrollFor.current !== id || atBottom) {
              initialScrollFor.current = id;
              requestAnimationFrame(() => scroll.current?.scrollToEnd({ animated: false }));
            }
          }}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} keyboardShouldPersistTaps="handled"
          onScroll={ev => {
            const { contentOffset, contentSize, layoutMeasurement } = ev.nativeEvent;
            listMetrics.current.offset = contentOffset.y;
            setAtBottom(Platform.OS === 'web' ? contentSize.height - layoutMeasurement.height - contentOffset.y < 80 : contentOffset.y < 80);
          }} scrollEventThrottle={100}
          onScrollBeginDrag={() => { Keyboard.dismiss(); if (tray) { setTray(false); setAlbumsOpen(false); } }} />
      {check.ok && !tray && !poll && (
        <View style={[styles.composer, { paddingBottom: kb ? 8 : Math.max(10, insets.bottom + 4) }]} onLayout={(ev) => setComposerH(ev.nativeEvent.layout.height)} pointerEvents="box-none">
          {/* Лента плавно уходит под капсулу: статичный градиент, без размытия. */}
          <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="composerFade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.paper} stopOpacity="0" />
                <Stop offset="0.45" stopColor={colors.paper} stopOpacity="0.92" />
                <Stop offset="1" stopColor={colors.paper} stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#composerFade)" />
          </Svg>
          {replyTo && (
            <View style={[styles.replyBar, glass]}>
              <View style={styles.replyLine} />
              <View style={{ flex: 1 }}>
                <Text style={styles.quoteName} numberOfLines={1}>Ответ {replyTo.authorId === 'me' ? 'себе' : byId(replyTo.authorId)?.name ?? ''}</Text>
                <Text style={styles.quoteText} numberOfLines={1}>{snippet(replyTo)}</Text>
              </View>
              <Pressable onPress={() => setReplyTo(null)} style={styles.replyClose} accessibilityRole="button" accessibilityLabel="Не отвечать"><Ic d={IC.close} size={15} color={colors.ink} w={2.3} /></Pressable>
            </View>
          )}
          <View style={[styles.capsule, glass]}>
          <Pressable onPress={() => { setTray(!tray); setAlbumsOpen(false); }} style={[styles.iconBtn, tray && { backgroundColor: colors.ink, borderColor: colors.ink }]} accessibilityRole="button" accessibilityLabel="Вложения: фото, видео, опрос">
            <Ic d={ATTACH_IC} size={20} color={tray ? colors.paper : colors.ink} w={1.9} />
          </Pressable>
          {recording ? (
            <View style={[styles.input, styles.recBar]} accessibilityLiveRegion="polite">
              <View style={styles.recDot} />
              <Text style={[styles.recText, cancelling && { color: colors.accentText }]}>{cancelling ? 'Отпусти — отменить' : `${dur(elapsed)} · ${locked ? 'Запись закреплена' : '← отменить · ↑ закрепить'}`}</Text>
            </View>
          ) : (
            <TextInput value={text} onChangeText={setText} multiline
              onContentSizeChange={(ev) => setInputH(Math.max(44, Math.min(132, ev.nativeEvent.contentSize.height)))}
              onKeyPress={(ev) => { const ne = ev.nativeEvent as { key: string; shiftKey?: boolean }; if (Platform.OS === 'web' && ne.key === 'Enter' && !ne.shiftKey) { ev.preventDefault?.(); sendText(); } }}
              placeholder="Сообщение" placeholderTextColor={colors.muted3} style={[styles.input, { height: text ? inputH : 44 }]} accessibilityLabel="Сообщение" />
          )}
          {/* Стикеры — отдельной кнопкой, как в Telegram (были спрятаны в конце вложений). */}
          {!recording && !locked && !text.trim() && (
            <Pressable onPress={() => { Keyboard.dismiss(); setSheet('stickers'); }} style={styles.stickerBtn} hitSlop={4} accessibilityRole="button" accessibilityLabel="Стикеры">
              <StickerIcon size={22} color={colors.muted2} strokeWidth={1.8} />
            </Pressable>
          )}
          {locked ? <View style={{flexDirection:'row',gap:6}}>
            <Pressable style={styles.iconBtn} onPress={()=>void stopRec(false)} accessibilityLabel="Отменить запись"><Ic d={IC.close} size={20} color={colors.ink}/></Pressable>
            <Pressable style={[styles.iconBtn,{backgroundColor:colors.accent}]} onPress={()=>void stopRec(true)} accessibilityLabel="Отправить запись"><Ic d={SEND_IC} size={20} color={colors.paper}/></Pressable>
          </View> : text.trim() && !recording ? (
            <Pressable onPress={sendText} style={[styles.iconBtn, { backgroundColor: colors.accent, borderColor: colors.accent }]} accessibilityRole="button" accessibilityLabel="Отправить">
              <Ic d={SEND_IC} size={19} color={colors.ink} w={2} />
            </Pressable>
          ) : (
            <GestureDetector gesture={recGesture}>
              <View collapsable={false} style={[styles.iconBtn, { backgroundColor: recording ? colors.accent : colors.ink, borderColor: recording ? colors.accent : colors.ink }, recording && { transform: [{ scale: 1.08 }] }]}
                accessible accessibilityRole="button" accessibilityLabel={recMode === 'voice' ? 'Голосовое: удерживай, чтобы записать. Нажми — переключить на кружок' : 'Кружок: удерживай, чтобы записать. Нажми — переключить на голосовое'}>
                <Ic d={recMode === 'voice' ? MIC_IC : CIRCLE_IC} size={20} color={recording ? colors.ink : colors.paper} w={1.9} />
              </View>
            </GestureDetector>
          )}
          </View>
        </View>
      )}
        {!check.ok && <View style={styles.closed}><Text style={styles.closedText}>{WRITE_REASONS[check.reason!]}</Text></View>}
      </View>

      {tray && check.ok && !poll && (
        <Animated.View entering={SlideInDown.duration(240)} exiting={SlideOutDown.duration(180)}>
        <View style={[styles.tray, { paddingBottom: 12 + insets.bottom }]}>
          <SwipeDown onClose={() => { setTray(false); setAlbumsOpen(false); }}><View style={styles.grab} /></SwipeDown>
          <ScrollView style={{ maxHeight: Math.max(96, winH - 240 - insets.bottom) }} contentContainerStyle={{ gap: 10 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, alignItems: 'center' }}>
            <Pressable onPress={() => setAlbumsOpen(!albumsOpen)} style={styles.album} accessibilityRole="button" accessibilityLabel="Выбрать альбом" accessibilityState={{ expanded: albumsOpen }}>
              <Text style={styles.albumText}>{ALBUMS.find(([k]) => k === album)?.[1]}</Text>
              <Ic d={albumsOpen ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} size={16} color={colors.ink} w={2.2} />
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable onPress={()=>{setTray(false);setSheet('stickers');}} style={styles.trayBtn}><Text style={styles.trayBtnText}>Стикеры</Text></Pressable>
            <Pressable onPress={()=>{setTray(false);setSheet('events');}} style={styles.trayBtn}><Text style={styles.trayBtnText}>Событие</Text></Pressable>
            <Pressable onPress={() => setPoll({ q: '', options: ['', ''] })} style={styles.trayBtn} accessibilityRole="button">
              <Ic d={POLL_IC} size={16} color={colors.ink} w={2.2} /><Text style={styles.trayBtnText}>Опрос</Text>
            </Pressable>
            <Pressable onPress={() => { setTray(false); setAlbumsOpen(false); }} style={styles.trayClose} hitSlop={6} accessibilityRole="button" accessibilityLabel="Закрыть вложения">
              <Ic d={IC.close} size={15} color={colors.ink} w={2.3} />
            </Pressable>
          </ScrollView>
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
          <Pressable onPress={()=>void library()} style={styles.sendAll} accessibilityRole="button" accessibilityLabel="Выбрать из галереи телефона"><Text style={styles.sendAllText}>Выбрать из галереи телефона</Text></Pressable>
          {config.dataMode!=='demo' && <Pressable onPress={()=>void camera()} style={styles.sendAll} accessibilityRole="button" accessibilityLabel="Камера"><Text style={styles.sendAllText}>Снять фото</Text></Pressable>}
          {config.dataMode==='demo' && <View style={styles.grid}>
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
          </View>}
          </ScrollView>
          {config.dataMode==='demo'&&<Pressable disabled={!picked.length} onPress={sendPicked} style={[styles.sendAll, !picked.length && { backgroundColor: colors.sand }]} accessibilityRole="button">
            <Text style={[styles.sendAllText, !picked.length && { color: colors.muted3 }]}>{picked.length ? `Отправить · ${picked.length}` : 'Выбери фото или видео'}</Text>
          </Pressable>}
        </View>
        </Animated.View>
      )}

      {poll && (
        <Animated.View entering={SlideInDown.duration(240)} exiting={SlideOutDown.duration(180)}>
        <View style={[styles.tray, { paddingBottom: 12 + insets.bottom }]}>
          <SwipeDown onClose={() => setPoll(null)}><View style={styles.grab} /></SwipeDown>
          <ScrollView style={{ maxHeight: Math.max(96, winH - 240 - insets.bottom) }} contentContainerStyle={{ gap: 10 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
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
          </ScrollView>
          <Pressable onPress={sendPoll} disabled={!poll.q.trim() || poll.options.filter((o) => o.trim()).length < 2}
            style={[styles.sendAll, (!poll.q.trim() || poll.options.filter((o) => o.trim()).length < 2) && { backgroundColor: colors.sand }]} accessibilityRole="button">
            <Text style={styles.sendAllText}>Отправить опрос</Text>
          </Pressable>
        </View>
        </Animated.View>
      )}

      {toast && <Toast t={toast} style={{ position: 'absolute', left: 16, right: 16, bottom: composerH + 12 }} />}

      {(sheet==='person'||sheet==='menu') && person && (
        <>
          <Backdrop label="Закрыть" onPress={() => setSheet(null)} opacity={0.35} />
          <BottomSheet onClose={() => setSheet(null)} label={sheet === 'menu' ? 'Действия' : person.name} style={{ paddingBottom: 30 + insets.bottom }}>
            {sheet === 'person' ? <PersonSheet p={person} friend={friend} details={details ?? undefined} spot={spot} requested={!!social.sent[person.id]}
              onClose={() => setSheet(null)} onProfile={() => router.push({ pathname: '/person/[id]', params: { id: person.id } })}
              onMap={() => { focusFriend(person.id); router.dismissTo('/'); }} onAdd={() => social.toggleRequest(person.id)} /> : (
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
      {sheet==='events'&&<><Backdrop label="Закрыть" onPress={()=>setSheet(null)}/><BottomSheet label="Поделиться событием" onClose={()=>setSheet(null)}><Text style={styles.sheetTitle}>Поделиться событием</Text><ScrollView style={{maxHeight:400}}>{[...plans.meetups,...events].filter((e,i,all)=>all.findIndex(a=>a.id===e.id)===i).map(e=><Pressable key={e.id} style={styles.menuRow} onPress={()=>{push({kind:'invite',eventId:e.id,text:e.title});setSheet(null);}}><Text style={styles.menuText}>{e.title}</Text></Pressable>)}</ScrollView></BottomSheet></>}
      {menu && <><Backdrop label="Закрыть" onPress={() => setMenu(null)} /><BottomSheet onClose={() => setMenu(null)} label="Сообщение">
        <Text style={styles.quoteText} numberOfLines={2}>{snippet(menu)}</Text>
        <Pressable onPress={() => { setReplyTo(menu); setMenu(null); }} style={styles.menuRow} accessibilityRole="button"><Text style={styles.menuText}>Ответить</Text></Pressable>
        {!!menu.text && menu.kind === 'text' && <Pressable onPress={() => { void Clipboard.setStringAsync(menu.text); setMenu(null); show({ text: 'Скопировано' }); }} style={styles.menuRow} accessibilityRole="button"><Text style={styles.menuText}>Скопировать</Text></Pressable>}
      </BottomSheet></>}
      {sheet==='stickers'&&<><Backdrop label="Закрыть" onPress={()=>setSheet(null)}/><BottomSheet onClose={()=>setSheet(null)} label="Стикеры"><StickerPicker level={stats?.level??1} onSelect={s=>{push({kind:'sticker',text:s.label});setSheet(null);}}/></BottomSheet></>}
      {sheet === 'attachments' && <AttachmentsSheet chatId={id} messages={messages} title={title} friend={friend || isGroup || isEvent} onClose={() => setSheet(null)} />}
      {recording === 'circle' && (
        <CircleRecorder ref={circleRef} cancelling={cancelling} onStart={() => { rec.current.started = nowMs(); rec.current.ready = true; }}
          onDone={(uri, sec) => { stopping.current = false; rec.current.active=false;rec.current.locked=false;setLocked(false);setRecording(null); push({ kind: 'circle', media: uri, duration: dur(sec), durationS: sec }); }}
          onCancel={() => {stopping.current = false; rec.current.active=false;rec.current.locked=false;setLocked(false);setRecording(null);}}
          onDenied={() => { stopping.current = false; rec.current.active=false;rec.current.locked=false;setLocked(false);setRecording(null); show({ text: 'Разреши камеру и микрофон в настройках телефона' }); }} />
      )}
    </KeyboardAvoidingView>
  );
}

function PersonSheet({ p, friend, details, spot, requested, onClose, onProfile, onMap, onAdd }: {
  p: Person; friend: boolean; details?: import('../../data/types').PersonDetails; spot?: FriendSpot; requested: boolean;
  onClose: () => void; onProfile: () => void; onMap: () => void; onAdd: () => void;
}) {
  const sees = friend && (config.dataMode === 'demo'
    ? !!details && canSee('friend', 'location', details.privacy) && !!(spot || details.now)
    : !!spot); // В live доступ уже проверен сервером friend_locations.
  // Где он — берём с карты (точка друга), а не из профиля.
  const place = spot?.place ?? details?.now?.place;
  const her = p.name.endsWith('а') ? 'её' : 'его';
  const she = p.name.endsWith('а') ? 'она' : 'он';
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Avatar p={p} size={60} radius={18} />
        <View style={{ flex: 1 }}>
          <Text style={styles.sheetTitle}>{p.name}{p.age ? `, ${p.age}` : ''}</Text>
          <Text style={styles.status}>{friend ? (details?.online ? 'в друзьях · онлайн' : 'в друзьях') : 'не в друзьях · общее событие'}</Text>
        </View>
        <Pressable onPress={onClose} style={styles.round} accessibilityRole="button" accessibilityLabel="Закрыть"><Ic d={IC.close} size={16} color={colors.ink} w={2.2} /></Pressable>
      </View>
      {sees ? (
        <Pressable onPress={onMap} style={({ pressed }) => [styles.nowCard, pressed && { opacity: 0.85 }]} accessibilityRole="button" accessibilityLabel={`${place ?? ''}. Открыть на карте`}>
          {spot && (
            <View style={styles.miniMap} pointerEvents="none">
              <StaticMap theme="paper" camera={{ lat: spot.lat, lon: spot.lon, zoom: 15 }} markers={[{ id: 'p', lat: spot.lat, lon: spot.lon, node: (
                <View style={{ marginLeft: -20, marginTop: -20 }}><Avatar p={p} size={40} ring={colors.friend} style={{ borderWidth: 3 }} /></View>
              ) }]} />
            </View>
          )}
          <View style={styles.nowRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.nowTitle} numberOfLines={1}>{place ?? 'На карте'}</Text>
              <Text style={styles.status}>{updatedText(spot?.minutesAgo ?? 2)}</Text>
            </View>
            <View style={styles.mapGo}><Ic d={IC.chevron} size={18} color={colors.paper} w={2.2} /></View>
          </View>
        </Pressable>
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
        {!friend ? (
          <Pressable onPress={onAdd} style={[styles.sheetBtn, { backgroundColor: requested ? colors.sand : colors.ink }]} accessibilityRole="button"><Text style={[styles.sheetBtnText, { color: requested ? colors.ink : colors.paper }]}>{requested ? 'Заявка ушла' : 'Добавить в друзья'}</Text></Pressable>
        ) : null}
      </View>
    </>
  );
}

/** Коротко о сообщении — для цитаты и плашки ответа. */
const SNIP: Partial<Record<Message['kind'], string>> = { photo: 'Фото', video: 'Видео', voice: 'Голосовое', circle: 'Кружок', invite: 'Приглашение', poll: 'Опрос' };
const snippet = (m: Message) => (m.kind === 'text' ? m.text : m.kind === 'sticker' ? `Стикер ${m.text}` : SNIP[m.kind] ?? m.text);

const styles = StyleSheet.create({
  quote: { maxWidth: '78%', marginBottom: 3, paddingVertical: 4, paddingHorizontal: 10, borderLeftWidth: 3, borderLeftColor: colors.accent, borderRadius: 8, backgroundColor: 'rgba(23,22,26,0.05)' },
  quoteName: { fontFamily: fonts.body700, fontSize: 12.5, color: colors.accentText },
  quoteText: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted2 },
  replyBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 12, marginBottom: 6, paddingVertical: 8, paddingLeft: 12, paddingRight: 4, borderRadius: 18 },
  replyLine: { width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: colors.accent },
  replyClose: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  stickerBtn: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
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
  composer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 18, paddingHorizontal: 10 },
  // Капсула ввода: стекло с тонкой границей, внутри «скрепка», поле и «отправить / запись».
  capsule: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, padding: 4, borderRadius: 26 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: 'transparent', backgroundColor: 'rgba(23,22,26,0.05)', alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minWidth: 0, height: 44, paddingHorizontal: 10, paddingTop: 11, paddingBottom: 11, borderRadius: 22, textAlignVertical: 'top', backgroundColor: 'transparent', fontFamily: fonts.body400, fontSize: 16, lineHeight: 21, color: colors.ink },
  tray: { paddingHorizontal: 12, paddingTop: 10, gap: 10, backgroundColor: colors.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: 'rgba(23,22,26,0.09)' },
  recBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 0, paddingBottom: 0 },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  recText: { fontFamily: fonts.body500, fontSize: 14, color: colors.accentText },
  album: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  albumText: { fontFamily: fonts.body600, fontSize: 14, color: colors.ink },
  albums: { borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  albumRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 44, paddingHorizontal: 14 },
  trayBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  trayClose: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.sand2, alignItems: 'center', justifyContent: 'center' },
  trayBtnText: { fontFamily: fonts.body600, fontSize: 13.5, color: colors.ink },
  camTile: { backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', gap: 6 },
  camLens: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' },
  camText: { fontFamily: fonts.body600, fontSize: 12.5, color: colors.paper },
  pollInput: { height: 46, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.card, fontFamily: fonts.body400, fontSize: 15, color: colors.ink },
  addOption: { fontFamily: fonts.body600, fontSize: 14, color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  thumb: { width: '32%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden' },
  thumbImg: { width: '100%', height: '100%' },
  mark: { position: 'absolute', right: 6, top: 6, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  markText: { fontFamily: fonts.mono600, fontSize: 11, color: colors.ink },
  vdur: { position: 'absolute', left: 6, bottom: 6, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(23,22,26,0.7)' },
  vdurText: { fontFamily: fonts.mono600, fontSize: 10, color: '#FFFFFF' },
  sendAll: { height: 44, minHeight: 44, flexShrink: 0, borderRadius: 14, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  sendAllText: { fontFamily: fonts.body600, fontSize: 15, color: colors.paper },
  sheetTitle: { fontFamily: fonts.display700, fontSize: 22, color: colors.ink },
  nowCard: { borderRadius: 20, overflow: 'hidden', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  miniMap: { height: 130, overflow: 'hidden' },
  nowRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  mapGo: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line2, marginBottom: 2 },
  nowTitle: { fontFamily: fonts.body700, fontSize: 15, color: colors.ink },
  hidden: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line2 },
  lock: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  sheetBtn: { flex: 1, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  sheetBtnText: { fontFamily: fonts.body600, fontSize: 15, color: colors.ink },
  menuRow: { height: 52, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: colors.line },
  menuText: { fontFamily: fonts.body600, fontSize: 16, color: colors.ink },
});
