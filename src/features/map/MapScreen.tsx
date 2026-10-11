// Карта — вкладка по умолчанию (design/png/Main.png, MapCalendar.png, MapFilters.png).
import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { EventPage } from '../../event/EventPage';
import { useApp, useCoverTabBar } from '../../state/app';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { data, eventsSnapshot, type EventItem } from '../../data';
import {openDirectChat,sendMessage} from '../../data/remote';
import { useLiveFriends } from '../../data/realtime';
import { DEMO_FORECAST } from '../../data/weather';
import { almaty, dayIndex, now as clockNow } from '../../lib/clock';
import { rangeLabel } from '../../map/calendar';
import { activeCount, MAX_PRICE, occursOnDay, showLabel, visibleEvents, WEEK_TO } from '../../map/filters';
import { phaseOf, whenLabel } from '../../map/lifecycle';
import { MapCanvas } from '../../map/MapCanvas';
import { EventPin, FocusPin, FriendPin, MePin, type PinKind } from '../../map/pins';
import { FriendCard, InviteFriendSheet, STICKERS } from '../../map/ui/FriendCard';
import { StackSheet } from '../../map/ui/StackSheet';
import { fxFor, WeatherFx } from '../../map/ui/WeatherFx';
import { detailOf, focusZoom, groupByPoint, pinScale, pxToLat } from '../../map/zoom';
import { accusative } from '../../lib/names';
import { timeNow, useChat } from '../../state/chat';
import { uid } from '../../lib/uid';
import { Dismissible } from '../../ui/Dismissible';
import { ideasForTwo } from '../../people/inviteFor';
import { canSee } from '../../people/visibility';
import { tasteFrom } from '../../reco';
import { useFeed } from '../../state/feed';
import { useSession } from '../../state/session';
import { useSocial } from '../../state/social';
import { Toast, type ToastData } from '../../ui/Toast';
import { ALMATY_CAMERA, type Camera, type MapCanvasHandle, type MapMarker } from '../../map/types';
import { EventSheet } from '../../map/ui/EventSheet';
import { FiltersSheet } from '../../map/ui/FiltersSheet';
import { SearchOverlay } from '../../map/ui/SearchOverlay';
import { TopBar } from '../../map/ui/TopBar';
import { useMapState } from '../../state/map';
import { usePlans } from '../../state/plans';
import { useProfile } from '../../state/profile';
import { colors, fonts } from '../../theme';
import { useTabInset } from '../../components/TabBar';
import { Backdrop, BottomSheet } from '../../ui/sheet';
import { config } from '../../lib/config';
import { getMalls, getRoute, getTrafficScore, getTrail, pingDb, setSetting, getSettings, type Mall } from '../../live/api';
import { MallPin, VenueSheet } from '../../map/ui/VenueSheet';
import { distM, exploredPct, fogPolygon, trafficTiles, ALMATY_CELLS } from '../../live/geo';
import { startBackground, useMyFix } from '../../live/location';
import { startCamera } from '../../live/startPoint';
import { MeDot, useHeading } from '../../map/MeDot';
import { MapControls } from '../../map/ui/MapControls';
import { setMapTelemetry } from '../../map/telemetry';
import { useIntro } from '../auth/Splash';
import { useNet } from '../../live/net';
import { myId } from '../../live/auth';
import { supabase } from '../../data/client';
import { LensSheet } from '../../map/ui/LensSheet';
import { BackgroundAsk, ExploreBadge, NetPill, NoGeoCard, TrafficChip } from '../../map/ui/MapStates';
import { useSmoothSpots } from '../../map/useSmooth';
import { queryClient } from '../../live/query';

type Sheet = null | 'lens' | 'filters' | 'search' | 'stack' | 'venue';
const LIVE = config.dataMode !== 'demo';

function pinKind(e: EventItem, today: number, going: boolean): PinKind {
  const isToday = dayIndex(e.startsAt) === today;
  const mine = going || !!e.meetup;
  if ((e.friendsGoing.length || mine) && !e.isLong && isToday) return 'hot';
  if (e.goingCount >= 1000 && !e.isLong) return 'popular';
  if ((e.friendsGoing.length || mine) && !e.isLong) return 'labeled';
  return 'plain';
}

/** Подпись только у выбранной точки: короткое название, без даты — дата есть в карточке. */
function pinLabel(e: EventItem): string {
  return (e.short ?? e.title.split(/[:«(]/)[0].trim()).toUpperCase().slice(0, 28);
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const [focused, setFocused] = useState(true);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  const tabPad = useTabInset();
  const { width: W, height: winH } = useWindowDimensions();
  const [H, setH] = useState(0);
  // Раскрытие события из мини-карточки: прямоугольник карточки растёт до всего экрана (~360 мс).
  const [open, setOpen] = useState<EventItem | null>(null);
  const [openSheet, setOpenSheet] = useState<'invite' | null>(null);
  const [cardRect, setCardRect] = useState({ x: 12, y: 600, w: 366, h: 150 });
  const ex = useSharedValue(0);
  useCoverTabBar(!!open);
  const mapRef = useRef<MapCanvasHandle>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [clock, setClock] = useState(clockNow);
  const { filters, setFilters, resetFilters, selectedId, select, focusId, focusFriend, inviteOpen, setInviteOpen } = useMapState();
  const [toast, setToast] = useState<ToastData | null>(null);
  const [bubble, setBubble] = useState<{ id: string; label: string; bg: string; fg: string } | null>(null);
  const [fly, setFly] = useState<{ label: string; bg: string; fg: string; x: number } | null>(null);
  const [zoom, setZoom] = useState(ALMATY_CAMERA.zoom);
  // Первый кадр карты — сразу на мне (или центр Алматы), а не пустое поле: MapView ждёт точку ≤ 1 с.
  const [startCam, setStartCam] = useState<Camera | null>(null);
  // Компас: поворот карты (для стрелки и конуса моей точки) и режим «следовать за мной».
  const bearing = useSharedValue(0);
  const heading = useHeading();
  const [follow, setFollow] = useState(false);
  useEffect(() => { void startCamera().then(setStartCam); }, []);
  // Заставка закончилась — камера приближает в 1,22 раза (V6.md §2.1), если я на карте.
  const settled = useIntro((s) => s.settled);
  const settledOnce = useRef(false);
  useEffect(() => {
    if (!settled || !startCam || settledOnce.current) return;
    settledOnce.current = true;
    // Заставка закончилась: карта плавно приближается к тебе (центр экрана — это ты).
    if (startCam !== ALMATY_CAMERA) mapRef.current?.flyTo(startCam.lat, startCam.lon, 15.2, 1500);
  }, [settled, startCam]);
  // Карточку события можно смахнуть: тогда внизу пусто, пока не нажмёшь на точку.
  const [cardHidden, setCardHidden] = useState(false);
  const [stack, setStack] = useState<EventItem[]>([]);
  const flyY = useSharedValue(0);
  const flyStyle = useAnimatedStyle(() => ({ transform: [{ translateY: flyY.value }, { scale: 1 - 0.15 * Math.min(1, -flyY.value / 300) }] }));
  const social = useSocial();
  const draft = useSession((s) => s.draft);
  const signals = useFeed((s) => s.signals);
  const showToast = (t: ToastData, ms = 3500) => { setToast(t); setTimeout(() => setToast((c) => (c === t ? null : c)), ms); };

  // Моя точка: разрешение спрашиваем при первом открытии карты, а не только в регистрации.
  const [myPos, setMyPos] = useState<{ lat: number; lon: number } | null>(null);
  const [geo, setGeo] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [askBg, setAskBg] = useState(false);
  const requestedLens = useMapState((s) => s.lens);
  const setRequestedLens = useMapState((s) => s.setLens);
  const lens = requestedLens;
  const setLens = setRequestedLens;
  const net = useNet();
  const fix = useMyFix((s) => s.fix);
  const ensureGeo = useCallback(async (ask: boolean) => {
    const perm = await Location.getForegroundPermissionsAsync();
    const ok = perm.granted || (ask && perm.canAskAgain && (await Location.requestForegroundPermissionsAsync()).granted);
    setGeo(ok ? 'granted' : 'denied');
    if (ok && !perm.granted) void queryClient.invalidateQueries({ queryKey: ['me', 'visibility'] });
    if (!ok && ask && !perm.canAskAgain) void Linking.openSettings();
    return ok;
  }, []);
  // Фон «Всё время»: спрашиваем один раз, карточкой с объяснением (Android откроет настройки).
  useEffect(() => {
    if (!LIVE || geo !== 'granted') return;
    (async () => {
      const bg = await Location.getBackgroundPermissionsAsync();
      if (bg.granted) return;
      const st = await getSettings().catch(() => ({} as Record<string, unknown>));
      if (!st.bg_asked) setAskBg(true);
    })().catch(() => undefined);
  }, [geo]);
  // Телеметрия Mapbox — как выбрал человек в «О карте и данных» (по умолчанию выключена).
  useEffect(() => {
    if (!LIVE) return;
    void getSettings().then((st) => { if (st.mapbox_telemetry === true) setMapTelemetry(true); }).catch(() => undefined);
  }, []);
  const allowBg = async () => {
    setAskBg(false);
    void setSetting('bg_asked', true).catch(() => undefined);
    const r = await Location.requestBackgroundPermissionsAsync().catch(() => null);
    if (r?.granted) void startBackground();
  };
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await ensureGeo(true);
      if (!ok || cancelled) return;
      const p = await Location.getLastKnownPositionAsync() ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (p && !cancelled) setMyPos({ lat: p.coords.latitude, lon: p.coords.longitude });
    })().catch(() => undefined);
    return () => { cancelled = true; };
  }, [ensureGeo]);
  const goToMe = async () => {
    try {
      const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setMyPos({ lat: p.coords.latitude, lon: p.coords.longitude });
      mapRef.current?.flyTo(p.coords.latitude, p.coords.longitude, 15);
    } catch {
      const at = myPos ?? me;
      if (at) mapRef.current?.flyTo(at.lat, at.lon, 15);
    }
  };

  // Первый запуск: разрешения не было, камера стояла на центре города. Как только появилась моя точка — плавно переезжаем к ней.
  const centeredOnMe = useRef(false);
  useEffect(() => {
    if (!settled || !startCam || centeredOnMe.current || !myPos || startCam !== ALMATY_CAMERA) return;
    centeredOnMe.current = true;
    mapRef.current?.flyTo(myPos.lat, myPos.lon, 15, 1400);
  }, [settled, startCam, myPos]);
  // Время идёт — точки живут: обновляем раз в минуту.
  useEffect(() => {
    const t = setInterval(() => setClock(clockNow()), 60000);
    return () => clearInterval(t);
  }, []);

  const { data: loaded = [] } = useQuery({ queryKey: ['events'], queryFn: () => data.getEvents(), placeholderData: eventsSnapshot });
  const meetups = usePlans((s) => s.meetups);
  const goingMap = usePlans((s) => s.going);
  const events = useMemo(() => [...meetups, ...loaded], [meetups, loaded]);
  const going = useMemo(() => new Set(Object.keys(goingMap)), [goingMap]);
  const { data: people = [] } = useQuery({ queryKey: ['people'], queryFn: () => data.getPeople() });
  const { data: rawSpots = [] } = useQuery({ queryKey: ['friendSpots'], queryFn: () => data.getFriendSpots() });
  const spots = useSmoothSpots(rawSpots);
  useLiveFriends(useMemo(() => people.filter((x) => x.isFriend).map((x) => x.id), [people]));
  const { data: me } = useQuery({ queryKey: ['mySpot'], queryFn: () => data.getMySpot() });
  const { data: details = [] } = useQuery({
    queryKey: ['spotDetails', spots.map((x) => x.personId).join(',')],
    queryFn: () => Promise.all(spots.map((x) => data.getPersonDetails(x.personId))),
    enabled: spots.length > 0,
  });
  const detailsOf = (id: string) => details.find((d) => d?.id === id) ?? undefined;
  const focusSpot = spots.find((x) => x.personId === focusId);
  const focusPerson = people.find((x) => x.id === focusId);
  // Хвост друга: последние 4 точки за 10 минут (только у выбранного).
  const { data: trail = [] } = useQuery({ queryKey: ['trail', focusId], queryFn: () => getTrail(focusId!), enabled: LIVE && !!focusId, refetchInterval: 20000 });
  // «Где я был»: открытые клетки.
  const { data: cells = [] } = useQuery({
    queryKey: ['me', 'cells'], enabled: LIVE && lens === 'explore',
    queryFn: async () => ((await supabase().from('explore_cells').select('h3').eq('user_id', myId() ?? '')).data ?? []).map((r: { h3: string }) => r.h3),
  });
  const { data: malls = [] } = useQuery({ queryKey: ['malls'], queryFn: getMalls, enabled: LIVE, staleTime: 3600e3 });
  const [mall, setMall] = useState<Mall | null>(null);
  const fog = useMemo(() => (lens === 'explore' ? fogPolygon(cells) : null), [lens, cells]);
  const traffic = lens === 'traffic' ? trafficTiles(config.tomtomKey) : null;

  // Тап по другу: карта приближается к нему (он выше карточки), остальное бледнеет.
  useEffect(() => {
    if (!focusSpot) return;
    const z = focusZoom(zoom);
    mapRef.current?.flyTo(focusSpot.lat - pxToLat(110, z, focusSpot.lat), focusSpot.lon, z);
  }, [focusSpot]); // eslint-disable-line react-hooks/exhaustive-deps
  // Выключили «Друзья» в фильтрах — карточка друга закрывается вместе с точками.
  useEffect(() => {
    if (!filters.friends && focusId) focusFriend(null);
  }, [filters.friends, focusId, focusFriend]);


  const today = dayIndex(clock);
  const popularBigger = useProfile((s) => s.settings.popularBigger);
  const theme = 'paper' as const;
  const dark = false;
  const visible = useMemo(() => visibleEvents(events, filters, clock, going), [events, filters, clock, going]);
  const upcoming = useMemo(() => events.filter((e) => phaseOf(e, clock, going.has(e.id)) !== 'hidden'), [events, clock, going]);

  // В линзах «Пробки» и «Где я был» карточки события нет — видно саму карту (V6MapLens*).
  // Линза «Пробки»: балл города (traffic-score, раз в 10 мин) и время на машине до ближайшего проспекта.
  const trafficOn = LIVE && lens === 'traffic';
  const tscore = useQuery({ queryKey: ['traffic', 'score'], queryFn: getTrafficScore, enabled: trafficOn, staleTime: 5 * 60e3, refetchInterval: trafficOn ? 10 * 60e3 : false });
  const meAt = fix ?? myPos;
  const nearAve = useMemo(() => {
    if (!meAt || !tscore.data?.points.length) return null;
    return tscore.data.points.filter((p) => distM(meAt, p) > 300).sort((a, b) => distM(meAt, a) - distM(meAt, b))[0] ?? null;
  }, [meAt, tscore.data]);
  const toAve = useQuery({
    queryKey: ['traffic', 'to', nearAve?.name, meAt && Math.round(meAt.lat * 500), meAt && Math.round(meAt.lon * 500)],
    queryFn: async () => (meAt && nearAve ? (await getRoute(meAt, nearAve)).car?.min ?? null : null),
    enabled: trafficOn && !!nearAve && !!meAt, staleTime: 10 * 60e3,
  });

  // Шторка события — только по тапу на точку (FIX1 И2 п.9): сама не открывается, при входе на карту ничего не выбрано.
  const selected = cardHidden || lens !== 'normal' || !selectedId ? undefined : visible.find((e) => e.id === selectedId);
  useEffect(() => { select(null); }, [select]);

  const detail = detailOf(zoom);
  const scale = pinScale(zoom);
  // Тап по точке: приближаемся к ней, карточка снизу — точка остаётся видна над ней.
  const openPin = useCallback((e: EventItem, group: EventItem[]) => {
    const z = focusZoom(zoom);
    mapRef.current?.flyTo(e.lat - pxToLat(190, z, e.lat), e.lon, z);
    setCardHidden(false);
    if (group.length > 1) { setStack(group); setSheet('stack'); return; }
    select(e.id);
    setSheet(null);
  }, [zoom, select]);

  const markers: MapMarker[] = useMemo(() => {
    const list: MapMarker[] = groupByPoint(visible).map((group) => {
      // В группе главной показываем выбранное событие, иначе самое «горячее», иначе ближайшее.
      const e = group.find((x) => x.id === selected?.id)
        ?? group.find((x) => x.id === selectedId)
        ?? group.find((x) => pinKind(x, today, going.has(x.id)) === 'hot')
        ?? group[0];
      const k0 = pinKind(e, today, going.has(e.id));
      const kind = k0 === 'popular' && !popularBigger ? 'plain' : k0;
      const isSel = e.id === selected?.id;
      return {
        id: `e-${e.id}`, lat: e.lat, lon: e.lon, z: isSel ? 34 : kind === 'hot' ? 30 : kind === 'plain' ? 10 : 20,
        node: (
          <View style={{ opacity: focusId ? 0.35 : 1 }} pointerEvents={focusId ? 'none' : 'auto'}>
          <EventPin e={e} kind={kind} phase={phaseOf(e, clock, going.has(e.id))} label={isSel ? pinLabel(e) : undefined} selected={isSel}
            showCompany={filters.company && detail !== 'far'} dark={dark} scale={scale} count={group.length} onPress={() => openPin(e, group)} />
          </View>
        ),
      };
    });
    if (detail !== 'far') for (const m of malls) list.push({ id: `v-${m.id}`, lat: m.lat, lon: m.lon, z: 8, node: <MallPin m={m} onPress={() => { setMall(m); setSheet('venue'); }} /> });
    if (filters.friends) {
      for (const s of spots) {
        const p = people.find((x) => x.id === s.personId);
        const d = detailsOf(s.personId);
        // Только друзья, которые сами включили геолокацию, и не в зоне дома (правила «Кто что видит»).
        // Альфа: кому видна точка, решает сервер (can_see_location) — здесь только убранные из друзей.
        if (!p || social.removed[p.id] || (!LIVE && (!d || !canSee('friend', 'location', d.privacy)))) continue;
        if (focusId === p.id) {
          list.push({ id: `f-${p.id}`, lat: s.lat, lon: s.lon, z: 60, node: <FocusPin person={p} ring={s.state === 'paused' ? '#8C8577' : colors.friend} bubble={bubble && bubble.id === p.id ? bubble : null} speed={s.state === 'moving' && (LIVE || (d && canSee('friend', 'speedStatus', d.privacy))) ? `${s.speedKmh} КМ/Ч` : undefined} /> });
          trail.slice(1).forEach((t, i) => list.push({ id: `t-${i}`, lat: t.lat, lon: t.lon, z: 5, node: <View style={{ width: 8 - i * 2, height: 8 - i * 2, borderRadius: 4, backgroundColor: colors.friend, opacity: 0.55 - i * 0.15 }} /> }));
        } else {
          list.push({ id: `f-${p.id}`, lat: s.lat, lon: s.lon, z: 40, node: <FriendPin person={p} spot={s} dim={!!focusId} onPress={() => { focusFriend(p.id); setSheet(null); }} /> });
        }
      }
    }
    // Моя точка: оранжевая с конусом и спокойным пульсом.
    if (LIVE) {
      // На телефоне моя точка — слои самой карты (MapCanvas, prop me); маркер нужен только в web.
      const at = fix ?? myPos;
      if (at && Platform.OS === 'web') list.push({ id: 'me', lat: at.lat, lon: at.lon, z: 35, node: <MeDot heading={heading} bearing={bearing} dim={!!focusId} /> });

    } else if (me) list.push({ id: 'me', lat: me.lat, lon: me.lon, z: 35, node: <View style={{ opacity: focusId ? 0.35 : 1 }}><MePin /></View> });
    return list;
  }, [visible, spots, people, me, filters.friends, filters.company, clock, today, dark, going, popularBigger, focusId, bubble, details, social.removed, detail, scale, openPin, selectedId, selected?.id, trail, fix, myPos, zoom, malls]); // eslint-disable-line react-hooks/exhaustive-deps

  const count = visible.length;
  const dateText = rangeLabel(filters.from, filters.to, clock);
  const showText = showLabel(count) + (filters.soon || count === 0 ? '' : ` · ${dateText}`);
  const { data: forecast = DEMO_FORECAST } = useQuery({ queryKey: ['forecast'], queryFn: () => data.getForecast(), staleTime: 30 * 60e3 });
  const { data: nowWx } = useQuery({ queryKey: ['weatherNow'], queryFn: () => data.getWeatherNow(), staleTime: 15 * 60e3, refetchInterval: 15 * 60e3 });
  // Погода по дате в фильтре: сегодня — «сейчас», другой день — прогноз на него.
  const weatherNow = filters.soon || filters.from === 0;
  const weather = (weatherNow ? nowWx ?? forecast[0] : forecast[filters.from]) ?? null;

  const openEvent = (e: EventItem, sheetFirst: 'invite' | null = null, interactive = false) => {
    setOpenSheet(sheetFirst);
    setOpen(e);
    if (interactive) return;
    ex.set(0);
    ex.set(withTiming(1, { duration: 360, easing: Easing.bezier(0.2, 0.8, 0.3, 1) }));
  };
  const closeEvent = () => {
    ex.set(withTiming(0, { duration: 240, easing: Easing.in(Easing.quad) }, (done) => { if (done) scheduleOnRN(setOpen, null); }));
  };
  const fullH = H || winH;
  const clip = useAnimatedStyle(() => {
    const p = ex.get();
    return {
      left: cardRect.x * (1 - p), top: cardRect.y * (1 - p),
      width: cardRect.w + (W - cardRect.w) * p, height: cardRect.h + (fullH - cardRect.h) * p,
      borderRadius: 26 * (1 - p), opacity: 1,
    };
  });
  const clipInner = useAnimatedStyle(() => ({ left: -cardRect.x * (1 - ex.get()), top: -cardRect.y * (1 - ex.get()) }));

  const pickFromSearch = (e: EventItem) => {
    // Событие может быть не в выбранных датах — переключаем дату на его день.
    let d = Math.max(0, dayIndex(e.startsAt) - today);
    if (e.isLong && occursOnDay(e, today)) d = 0;
    // В пределах недели оставляем неделю, дальше — только его день.
    setFilters(d <= WEEK_TO ? { soon: false, from: 0, to: WEEK_TO, cats: [], free: false, max: MAX_PRICE } : { soon: false, from: d, to: d, cats: [], free: false, max: MAX_PRICE });
    select(e.id);
    setCardHidden(false);
    setSheet(null);
    const z = focusZoom(zoom);
    mapRef.current?.flyTo(e.lat - pxToLat(190, z, e.lat), e.lon, z);
  };

  // Стикер другу: облачко долетает до его точки, висит ~3 с и падает в личный чат. Без лимита — у друга придёт пуш.
  const sendSticker = async (i: number) => {
    if (!focusPerson || fly) return;
    const st = STICKERS[i];
    try{
      if(LIVE){const chatId=await openDirectChat(focusPerson.id);await sendMessage(chatId,st.label,'sticker');void queryClient.invalidateQueries({queryKey:['chats']});}
      else useChat.getState().send({ id: uid(`dm-${focusPerson.id}-st`), chatId: `dm-${focusPerson.id}`, authorId: 'me', kind: 'sticker', text: st.label, time: timeNow() });
    }catch{showToast({text:'Не удалось отправить стикер. Проверь связь'});return;}
    social.sticker(focusPerson.id);
    setFly({ ...st, x: 40 });
    flyY.set(0);
    flyY.set(withTiming(-300, { duration: 650, easing: Easing.bezier(0.2, 0.9, 0.4, 1) }));
    setTimeout(() => {
      setFly(null);
      setBubble({ ...st, id: focusPerson.id });
    }, 700);
    setTimeout(() => setBubble((b) => (b && b.label === st.label ? null : b)), 3400);
  };

  const topY = Math.max(50, insets.top + 6);

  return (
    <View style={[styles.root, { backgroundColor: dark ? '#1C1D21' : '#EFEBE2' }]} onLayout={(ev) => setH(ev.nativeEvent.layout.height)}>
      {focused && startCam && <MapCanvas ref={mapRef} theme={theme} camera={startCam} markers={markers} bottomInset={tabPad + (selected ? 330 : lens !== 'normal' ? 76 : 0)} topInset={topY + 104} showUser={!!myPos} me={LIVE ? (fix ?? myPos) : null} meHeading={heading} onZoom={setZoom} traffic={traffic} fog={fog}
        onPress={() => { if (selectedId) select(null); }} onBearing={(d) => bearing.set(d)} follow={follow} onFollowEnd={() => setFollow(false)} />}
      <WeatherFx fx={fxFor(weather, almaty(clock).getUTCMonth())} />

      <View style={[styles.top, { top: topY }]}>
        <TopBar
          weather={weather}
          weatherNow={weatherNow}
          dark={dark}
          lensOn={lens !== 'normal'}
          onCreate={() => router.push('/create')}
          active={activeCount(filters)}
          onSearch={() => setSheet('search')}
          onLens={() => setSheet('lens')}
          onFilters={() => setSheet('filters')}
        />
        {LIVE && (!net.online || net.serverDown) && (
          <View style={{ marginTop: 6 }}>
            <NetPill kind={net.online ? 'server' : 'offline'} onRetry={() => { void pingDb().then((ok) => { if (ok) void queryClient.invalidateQueries(); }); }} />
          </View>
        )}
      </View>


      {!focusId && sheet === null && (
        <MapControls top={Math.max(topY + 64, (H || winH) / 2 - 105)} bearing={bearing} follow={follow}
          onCompass={() => {
            if (follow) { setFollow(false); return; }
            if (Math.abs(((bearing.get() % 360) + 360) % 360) > 1) mapRef.current?.north();
            else if (myPos || fix) setFollow(true);
          }}
          onZoom={(d) => mapRef.current?.zoomBy(d)}
          onMe={() => { setFollow(false); void goToMe(); }} />
      )}

      {focusId && focusPerson && focusSpot && !inviteOpen && sheet === null && filters.friends && (
        <View style={[styles.card, { bottom: tabPad }]}>
          <Dismissible key={focusPerson.id} closeButton={false} label={focusPerson.name} onDismiss={() => focusFriend(null)}>
            <FriendCard p={focusPerson} spot={focusSpot} ring={focusSpot.state === 'paused' ? '#8C8577' : colors.friend}
              onProfile={() => router.push({ pathname: '/person/[id]', params: { id: focusPerson.id } })}
              onSticker={(i) => sendSticker(i)}
              onWrite={() => router.push({ pathname: '/chat/[id]', params: { id: `dm-${focusPerson.id}` } })}
              onInvite={() => setInviteOpen(true)} />
          </Dismissible>
        </View>
      )}

      {fly && (
        <Animated.View exiting={FadeOut.duration(120)} pointerEvents="none" style={[styles.fly, { left: fly.x, bottom: tabPad + 150, backgroundColor: fly.bg }, flyStyle]}>
          <Text style={[styles.flyText, { color: fly.fg }]}>{fly.label}</Text>
        </Animated.View>
      )}

      {selected && sheet === null && !focusId && (
        <View style={[styles.card, { bottom: tabPad }]} onLayout={(ev) => { const l = ev.nativeEvent.layout; setCardRect({ x: l.x, y: l.y, w: l.width, h: l.height }); }}>
          <EventSheet key={selected.id} e={selected} now={clock} people={people} going={going.has(selected.id)}
            expand={ex} onReveal={() => openEvent(selected, null, true)}
            onRevealEnd={(commit) => { if (commit) ex.set(withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) })); else closeEvent(); }}
            me={fix ?? myPos} onOpen={() => openEvent(selected)} onInvite={() => openEvent(selected, 'invite')} onHide={() => select(null)}
            onGo={() => {
              const p = usePlans.getState();
              if (going.has(selected.id)) { p.ungo(selected.id); useApp.getState().removePlan(); }
              else { p.go(selected.id); useApp.getState().addPlan(); showToast({ text: 'Добавил в «Планы». Напомню за час', cta: 'Планы', onCta: () => router.navigate('/plans') }); }
            }} />
        </View>
      )}

      {sheet === 'stack' && stack.length > 0 && (
        <>
          <Backdrop onPress={() => setSheet(null)} label="Закрыть список" />
          <BottomSheet onClose={() => setSheet(null)} label="События в этом месте">
            <StackSheet events={stack} now={clock} onPick={(e) => { select(e.id); setCardHidden(false); setSheet(null); openEvent(e); }} />
          </BottomSheet>
        </>
      )}

      {sheet === 'filters' && (
        <>
          <Backdrop onPress={() => setSheet(null)} label="Закрыть фильтры" />
          <BottomSheet onClose={() => setSheet(null)} label="Фильтры">
            <FiltersSheet f={filters} set={setFilters} reset={resetFilters} onShow={() => setSheet(null)} showText={showText} now={clock} events={upcoming} />
          </BottomSheet>
        </>
      )}

      {sheet === 'venue' && mall && (
        <>
          <Backdrop onPress={() => setSheet(null)} label="Закрыть" />
          <BottomSheet onClose={() => setSheet(null)} label={mall.name}>
            <VenueSheet m={mall} events={upcoming} onEvent={(e) => { setSheet(null); openEvent(e); }} />
          </BottomSheet>
        </>
      )}

      {sheet === 'lens' && (
        <>
          <Backdrop onPress={() => setSheet(null)} label="Закрыть линзы" />
          <BottomSheet onClose={() => setSheet(null)} label="Линзы">
            <LensSheet lens={lens} onPick={(l) => { setLens(l); setSheet(null); }} />
          </BottomSheet>
        </>
      )}

      {sheet === null && lens !== 'normal' && !focusId && (
        <View style={[styles.lensInfo, { bottom: tabPad + 12 }]} pointerEvents="none">
          {lens === 'explore' ? <ExploreBadge pct={exploredPct(cells)} value={cells.length / ALMATY_CELLS} /> : <TrafficChip hasKey={!!config.tomtomKey} score={tscore.data?.score} toName={nearAve?.name} toMin={toAve.data ?? null} />}
        </View>
      )}

      {LIVE && askBg && geo === 'granted' && sheet === null && !focusId && !selected && (
        <View style={[styles.card, { bottom: tabPad }]}>
          <BackgroundAsk onAllow={() => void allowBg()} onLater={() => { setAskBg(false); void setSetting('bg_asked', true).catch(() => undefined); }} />
        </View>
      )}

      {LIVE && geo === 'denied' && <NoGeoCard onEnable={() => void ensureGeo(true)} />}

      {inviteOpen && focusPerson && (
        <>
          <Backdrop onPress={() => setInviteOpen(false)} label="Закрыть" />
          <BottomSheet onClose={() => setInviteOpen(false)} label={`Позвать ${accusative(focusPerson.name)}`} style={{ gap: 14 }}>
            <InviteFriendSheet
              p={focusPerson}
              title={`Позвать ${accusative(focusPerson.name)}`}
              now={clock}
              ideas={detailsOf(focusPerson.id) ? ideasForTwo(tasteFrom({ interests: draft.interests, times: draft.times, withWho: draft.withWho, budget: draft.budget }, signals, clock), focusPerson.id, focusPerson.name, detailsOf(focusPerson.id)!, events, { now: clock, going, savedByFriend: focusPerson.id === 'igor' ? new Set(['standup']) : undefined }) : []}
              onOwn={() => { setInviteOpen(false); router.push('/create'); }}
              onSend={(eventId) => {
                social.invite(focusPerson.id, eventId);
                usePlans.getState().invite(eventId, [focusPerson.id]);
                setInviteOpen(false);
                const ev = events.find((x) => x.id === eventId);
                showToast({ text: `Позвал ${accusative(focusPerson.name)} на «${ev?.title ?? 'встречу'}». Ответ придёт в чат`, cta: 'Чат', onCta: () => router.push({ pathname: '/chat/[id]', params: { id: `dm-${focusPerson.id}` } }) });
              }}
            />
          </BottomSheet>
        </>
      )}

      {toast && <Toast t={toast} style={{ position: 'absolute', left: 16, right: 16, top: topY + 112 }} />}

      {open && (
        <Animated.View style={[styles.clip, clip]}>
          <Animated.View style={[{ position: 'absolute', width: W, height: fullH, flex: 1 }, clipInner]}>
            <EventPage e={open} now={clock} onClose={closeEvent} initialSheet={openSheet} />
          </Animated.View>
        </Animated.View>
      )}

      {sheet === 'search' && (
        <SearchOverlay events={upcoming} whenOf={(e) => whenLabel(e, clock)} onPick={pickFromSearch} onClose={() => setSheet(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  top: { position: 'absolute', left: 16, right: 16 },
  calendar: { position: 'absolute', left: 12, right: 12 },
  card: { position: 'absolute', left: 12, right: 12, bottom: 12 },
  lensInfo: { position: 'absolute', left: 16 },
  clip: { position: 'absolute', overflow: 'hidden', zIndex: 90 },
  fly: { position: 'absolute', height: 36, paddingHorizontal: 12, borderRadius: 12, borderWidth: 2, borderColor: '#FFFFFF', justifyContent: 'center', zIndex: 80 },
  flyText: { fontFamily: fonts.display800, fontSize: 13 },
});
