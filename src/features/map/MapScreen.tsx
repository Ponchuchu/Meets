// Карта — вкладка по умолчанию (design/png/Main.png, MapCalendar.png, MapFilters.png).
import { useEco } from '../../state/perf';
import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { LazyEventPage } from '../../event/LazyEventPage';
import { useApp, useBackClose, useCoverTabBar } from '../../state/app';
import { useShallow } from 'zustand/react/shallow';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { data, eventsSnapshot, type EventItem } from '../../data';
import {openDirectChat,sendMessage} from '../../data/remote';
import { useLiveFriends } from '../../data/realtime';
import { DEMO_FORECAST } from '../../data/weather';
import { almaty, dayIndex, now as clockNow } from '../../lib/clock';
import { rangeLabel } from '../../map/calendar';
import { activeCount, MAX_PRICE, occursOnDay, showLabel, visibleEvents, WEEK_TO } from '../../map/filters';
import { phaseOf, whenLabel } from '../../map/lifecycle';
import { MAP_FRAMES } from '../../map/MapAvatar';
import { closeGroups } from '../../map/proximity';
import { MapCanvas } from '../../map/MapCanvas';
import { CityPin, EventPin, FOCUS_FACE, MeetupPin, FocusPin, FriendPin, MePin, TogetherPin, type PinKind } from '../../map/pins';
import { FriendCard, InviteFriendSheet, STICKERS } from '../../map/ui/FriendCard';
import { StickerBlast } from '../../stickers/StickerBlast';
import { StackSheet } from '../../map/ui/StackSheet';
import { fxFor, WeatherFx } from '../../map/ui/WeatherFx';
import { detailOf, focusZoom, groupByPoint, pinBudget, pinScale, pxToLat } from '../../map/zoom';
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
import { useMapView } from '../../state/mapView';
import { usePlans } from '../../state/plans';
import { useProfile } from '../../state/profile';
import { colors, fonts } from '../../theme';
import { useTabInset } from '../../components/TabBar';
import { Backdrop, BottomSheet } from '../../ui/sheet';
import { config } from '../../lib/config';
import { getProfile, sendInvite, getMalls, getRoute, getTrafficScore, getTrail, pingDb, setSetting, getSettings, type Mall } from '../../live/api';
import { insideMall, PlaceCard } from '../../map/ui/VenueSheet';
import { eventSprite, mallSprite, spotSprite, type MapSymbol } from '../../map/symbols';
import { CAT_COLOR } from '../../map/icons';
import { PlacePin } from '../../map/ui/PlacePin';
import { ATTRACTIONS, topSpots, type Attraction } from '../../data/attractions';
import { getSpots } from '../../data/spots';
import { SpotSheet } from '../../map/ui/SpotSheet';
import { cityYear, CITY_YEAR, leftText } from '../../data/cityYear';
import { distM, exploredPct, fogShape, trafficTiles, ALMATY_CELLS } from '../../live/geo';
import { startBackground, useMyFix, usePreciseGps } from '../../live/location';
import { watchMapPosition } from '../../live/watchMapPosition';
import { startCamera } from '../../live/startPoint';
import { MeDot, useHeading } from '../../map/MeDot';
import { MapControls } from '../../map/ui/MapControls';
import { setMapTelemetry } from '../../map/telemetry';
import { useIntro } from '../auth/Splash';
import { useNet } from '../../live/net';
import { myId } from '../../live/auth';
import { supabase } from '../../data/client';
import { LensSheet } from '../../map/ui/LensSheet';
import { AccuracyAsk, BackgroundAsk, ExploreBadge, NetPill, NoGeoCard, TrafficChip } from '../../map/ui/MapStates';
import { useSmoothSpots } from '../../map/useSmooth';
import { queryClient } from '../../live/query';
import { improveAccuracy, mayAutoAsk, noDialog, precision, shouldExplain, useGeoAsk, type Precision } from '../../live/accuracy';

/** Демо (тесты и web-скриншоты): один настоящий ТРЦ в центре, чтобы видеть карточку места. */
const DEMO_MALLS: Mall[] = [{ id: 'demo-tsum', name: 'ЦУМ', address: 'пр. Абылай хана, 62', hours: '10:00–22:00', cover: null, lat: 43.2622, lon: 76.9447 }];

type Sheet = null | 'lens' | 'filters' | 'search' | 'stack' | 'venue' | 'spot';
const LIVE = config.dataMode !== 'demo';

function pinKind(e: EventItem, today: number, going: boolean): PinKind {
  const isToday = dayIndex(e.startsAt) === today;
  const mine = going || !!e.meetup;
  if ((e.friendsGoing.length || mine) && !e.isLong && isToday) return 'hot';
  if (e.goingCount >= 1000 && !e.isLong) return 'popular';
  if ((e.friendsGoing.length || mine) && !e.isLong) return 'labeled';
  return 'plain';
}


export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const [focused, setFocused] = useState(true);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  useEffect(() => { useIntro.getState().map(focused); return () => useIntro.getState().map(false); }, [focused]);
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
  const { filters, setFilters, resetFilters, selectedId, select, focusId, focusFriend, inviteOpen, setInviteOpen } = useMapState(useShallow((s) => ({
    filters: s.filters, setFilters: s.setFilters, resetFilters: s.resetFilters, selectedId: s.selectedId, select: s.select, focusId: s.focusId,
    focusFriend: s.focusFriend, inviteOpen: s.inviteOpen, setInviteOpen: s.setInviteOpen })));
  const inviteSending = useRef(false);
  const [mapInviting, setMapInviting] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [bubble, setBubble] = useState<{ id: string; label: string; bg: string; fg: string } | null>(null);
  // Стикер, который сейчас «долетел» до друга: перчатки, сердце, мем… (FIX5).
  const [blast, setBlast] = useState<{ key: number; st: (typeof STICKERS)[number] } | null>(null);
  const [zoom, setZoom] = useState(ALMATY_CAMERA.zoom);
  // 2D/3D — в «Линзах» (FIX3): кнопка на карте убрана.
  const view = useMapView((s) => s.view);
  const setView = useMapView((s) => s.setView);
  // Экономия заряда: карта всегда плоская и точек меньше.
  const eco = useEco();
  const threeD = view === '3d' && !eco;
  const [mapMode, setMapMode] = useState<'loading' | 'static' | 'mapbox'>('loading');
  const [mapAttempt, setMapAttempt] = useState(0);
  // Первый кадр карты — сразу на мне (или центр Алматы), а не пустое поле: MapView ждёт точку ≤ 1 с.
  const [startCam, setStartCam] = useState<Camera | null>(null);
  // Компас: поворот карты (для стрелки и конуса моей точки) и режим «следовать за мной».
  const bearing = useSharedValue(0);
  const heading = useHeading(focused);
  usePreciseGps(focused);
  const [follow, setFollow] = useState(false);
  useEffect(() => { void startCamera().then(setStartCam); }, []);
  // Заставка закончилась — камера приближает в 1,22 раза (V6.md §2.1), если я на карте.
  const settled = useIntro((s) => s.settled);
  const settledOnce = useRef(false);
  useEffect(() => {
    if (!settled || !startCam || settledOnce.current) return;
    settledOnce.current = true;
    // Заставка закончилась: карта плавно приближается к тебе (центр экрана — это ты).
    if (startCam !== ALMATY_CAMERA) mapRef.current?.flyTo(startCam.lat, startCam.lon, startCam.zoom, 0);
  }, [settled, startCam]);
  // Карточку события можно смахнуть: тогда внизу пусто, пока не нажмёшь на точку.
  const [cardHidden, setCardHidden] = useState(false);
  const [stack, setStack] = useState<EventItem[]>([]);
  const social = useSocial();
  const draft = useSession((s) => s.draft);
  const signals = useFeed((s) => s.signals);
  const showToast = (t: ToastData, ms = 3500) => { setToast(t); setTimeout(() => setToast((c) => (c === t ? null : c)), ms); };

  // Моя точка: разрешение спрашиваем при первом открытии карты, а не только в регистрации.
  const [myPos, setMyPos] = useState<{ lat: number; lon: number } | null>(null);
  const [geo, setGeo] = useState<'unknown' | 'granted' | 'denied' | 'off'>('unknown');
  const [askBg, setAskBg] = useState(false);
  const [prec, setPrec] = useState<Precision>('precise');
  const laterAt = useGeoAsk((s) => s.laterAt);
  const requestedLens = useMapState((s) => s.lens);
  const setRequestedLens = useMapState((s) => s.setLens);
  const lens = requestedLens;
  const setLens = setRequestedLens;
  const net = useNet();
  const fix = useMyFix((s) => s.fix);
  const ensureGeo = useCallback(async (button: boolean) => {
    // Системное окно — сам один раз за установку, дальше только по кнопке «Включить» (button = true).
    // «Нет» уважаем: карта работает без моей точки, настройки сами не открываем.
    const perm = await Location.getForegroundPermissionsAsync();
    const may = button || mayAutoAsk(useGeoAsk.getState().permAskedAt);
    let ok = perm.granted;
    if (!ok && may && perm.canAskAgain) {
      useGeoAsk.getState().markPermAsked();
      ok = (await Location.requestForegroundPermissionsAsync()).granted;
    } else if (!ok && button) void Linking.openSettings();
    setGeo(ok ? 'granted' : 'denied');
    if (ok && !perm.granted) void queryClient.invalidateQueries({ queryKey: ['me', 'visibility'] });
    if (ok) void precision().then(setPrec);
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
  // Своя точка: сразу последняя известная, дальше — живая подписка на телефон (не зависит от отправки точки на сервер).
  useEffect(() => {
    if (!focused) return;
    let cancelled = false;
    let stop: (() => void) | undefined;
    (async () => {
      const ok = await ensureGeo(false);
      if (!ok || cancelled) return;
      stop = watchMapPosition(setMyPos, () => setGeo('off'));
    })().catch(() => undefined);
    return () => { cancelled = true; stop?.(); };
  }, [ensureGeo, focused]);
  const goToMe = async () => {
    try {
      const at0 = fix ?? myPos;
      if (at0) mapRef.current?.flyTo(at0.lat, at0.lon, 15.5);
      const p = await Location.getCurrentPositionAsync(noDialog({ accuracy: Location.Accuracy.Balanced }));
      setMyPos({ lat: p.coords.latitude, lon: p.coords.longitude });
      mapRef.current?.flyTo(p.coords.latitude, p.coords.longitude, 15.5);
    } catch {
      const at = fix ?? myPos ?? me;
      if (at) mapRef.current?.flyTo(at.lat, at.lon, 15.5);
    }
  };

  // Первый запуск: разрешения не было, камера стояла на центре города. Как только появилась моя точка — плавно переезжаем к ней.
  const centeredOnMe = useRef(false);
  useEffect(() => {
    const at = fix ?? myPos;
    if (!settled || !startCam || centeredOnMe.current || !at || distM(startCam, at) < 800) return;
    centeredOnMe.current = true;
    mapRef.current?.flyTo(at.lat, at.lon, 15, 250);
  }, [settled, startCam, fix, myPos]);
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
  const { data: myProfile } = useQuery({ queryKey: ['me', 'profile'], queryFn: () => getProfile(), enabled: LIVE });
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
  // «Назад» на Android закрывает карточку друга или события, а не выходит из приложения.
  useBackClose(() => { if (focusId) focusFriend(null); else select(null); }, sheet === null && (!!focusId || !!selectedId));
  const focusSpot = spots.find((x) => x.personId === focusId);
  const focusPerson = people.find((x) => x.id === focusId);
  // Хвост друга: последние 4 точки за 10 минут (только у выбранного).
  const { data: trail = [] } = useQuery({ queryKey: ['trail', focusId], queryFn: () => getTrail(focusId!), enabled: LIVE && !!focusId, refetchInterval: 20000 });
  const friendLines = useMemo(() => focusSpot && filters.friends && focusPerson?.mapTrail === 'comet' && trail.length > 1 ? [{ id: 'friend-trail', coords: trail.map(t => [t.lon,t.lat] as [number,number]), color: MAP_FRAMES.find(f => f.id === focusPerson.mapFrame)?.color ?? colors.friend, width: 3 }] : [], [focusSpot, focusPerson, filters.friends, trail]);
  // «Где я был»: открытые клетки.
  const { data: cells = [] } = useQuery({
    queryKey: ['me', 'cells'], enabled: LIVE && lens === 'explore',
    queryFn: async () => ((await supabase().from('explore_cells').select('h3').eq('user_id', myId() ?? '')).data ?? []).map((r: { h3: string }) => r.h3),
  });
  const mallsQ = useQuery({ queryKey: ['malls'], queryFn: getMalls, enabled: LIVE, staleTime: 3600e3 });
  // Мои места (дом, работа…) — тот же запрос, что в «Профиль → Мои места».
  const placesQ = useQuery({ queryKey: ['me', 'places', 'list'], enabled: LIVE && !!myId(), staleTime: 10 * 60e3, queryFn: async () => {
    const r = await supabase().from('user_places_points').select('*').eq('user_id', myId()!);
    if (r.error) throw r.error;
    return (r.data ?? []) as { id: string; kind: string; title: string; lat: number; lon: number; icon?: string | null }[];
  } });
  const myPlaces = placesQ.data ?? [];
  // Постоянные места: из базы (часы и цены от сборщика), без неё — встроенный список.
  const spotsQ = useQuery({ queryKey: ['spots'], queryFn: getSpots, staleTime: 3600e3, placeholderData: ATTRACTIONS });
  const places = spotsQ.data ?? ATTRACTIONS;
  const malls = LIVE ? mallsQ.data ?? [] : DEMO_MALLS;
  // Точки зданий убраны (FIX3 Ф3): нажимаются только торговые центры — у них почти всегда есть события.
  const [mall, setMall] = useState<Mall | null>(null);
  const [spotPlace, setSpotPlace] = useState<Attraction | null>(null);
  const fog = useMemo(() => (lens === 'explore' ? fogShape(cells) : null), [lens, cells]);
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
  // Старше 40 минут — не показываем: раньше застывший ночной балл «1» висел неделю.
  const trafficFresh = !!tscore.data && clock.getTime() - Date.parse(tscore.data.at) < 40 * 60e3;
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

  // Из «Года в Алматы» нажали на событие с местом — подлетаем к нему (когда карта уже готова).
  const cityFocus = useMapState((s) => s.cityFocus);
  useEffect(() => {
    if (!cityFocus || mapMode !== 'mapbox') return;
    const c = CITY_YEAR.find((x) => x.id === cityFocus);
    if (c?.point) mapRef.current?.flyTo(c.point.lat, c.point.lon, 14.5);
    useMapState.getState().setCityFocus(null);
  }, [cityFocus, mapMode]);

  const { markers, symbols, taps } = useMemo(() => {
    const groups = groupByPoint(visible);
    const list: MapMarker[] = [];
    // Объёмные значки (FIX5) — слой самой карты; маркером остаётся только выбранное событие и встречи.
    const syms: (MapSymbol & { z: number })[] = [];
    const taps = new Map<string, () => void>();
    for (const group of groups) {
      // В группе главной показываем выбранное событие, иначе самое «горячее», иначе ближайшее.
      const e = group.find((x) => x.id === selected?.id)
        ?? group.find((x) => x.id === selectedId)
        ?? group.find((x) => pinKind(x, today, going.has(x.id)) === 'hot')
        ?? group[0];
      const k0 = pinKind(e, today, going.has(e.id));
      const kind = k0 === 'popular' && !popularBigger ? 'plain' : k0;
      const isSel = e.id === selected?.id;
      const z = isSel ? 34 : kind === 'hot' ? 30 : kind === 'plain' ? 10 : 20;
      if (isSel || e.meetup) {
        list.push({
          id: `e-${e.id}`, lat: e.lat, lon: e.lon, z,
          node: (
            <View style={{ opacity: focusId ? 0.35 : 1 }} pointerEvents={focusId ? 'none' : 'auto'}>
            {e.meetup ? <MeetupPin e={e} people={people} selected={isSel} onPress={() => openPin(e, group)} /> : <EventPin e={e} kind={kind} phase={phaseOf(e, clock, going.has(e.id))} label={e.title} selected
              showCompany={false} dark={dark} scale={scale} count={group.length} onPress={() => openPin(e, group)}
              />}
            </View>
          ),
        });
        continue;
      }
      const compact = (kind === 'plain' && detail !== 'near') || (detail === 'far' && kind !== 'hot');
      // Только значок (26 октября, решение владельца): без времени, даты и цифр — всё видно по нажатию.
      const id = `e-${e.id}`;
      // eslint-disable-next-line react-hooks/refs -- вызывается только по тапу, не при отрисовке
      taps.set(id, () => openPin(e, group));
      syms.push({
        id, lat: e.lat, lon: e.lon, z, sort: z, icon: eventSprite(e), faded: !!focusId,
        size: Math.round((kind === 'hot' ? 54 : kind === 'popular' ? 50 : kind === 'labeled' ? 46 : 42) * scale),
        dot: compact ? CAT_COLOR[e.category] : undefined,
      });
    }
    // Вдали — только самые важные точки, с каждым шагом приближения — больше (выбранная остаётся всегда).
    const budget = eco ? Math.max(6, Math.round(pinBudget(zoom) / 2)) : pinBudget(zoom);
    if (syms.length > budget) {
      const keep = [...syms].sort((a, b) => b.z - a.z).slice(0, budget);
      syms.splice(0, syms.length, ...keep);
    }
    // «Год в Алматы»: большое событие с известным местом — на карте, когда оно идёт или до него меньше двух недель.
    for (const c of cityYear(clock)) {
      if (!c.e.point || (c.status !== 'now' && c.status !== 'soon')) continue;
      list.push({ id: `city-${c.e.id}`, lat: c.e.point.lat, lon: c.e.point.lon, z: 25, node: <CityPin title={c.e.title} when={leftText(c)} color={c.e.color} Icon={c.e.Icon} onPress={() => router.push('/city-year')} /> });
    }
    for (const pl of myPlaces) if (Number.isFinite(pl.lat) && Number.isFinite(pl.lon)) list.push({ id: `p-${pl.id}`, lat: pl.lat, lon: pl.lon, z: 6, node: <PlacePin kind={pl.kind} title={pl.title} icon={pl.icon} label={zoom >= 14.5} /> });
    // Постоянные места: горы и катки видно издалека, остальное — с района, бесплатные фотозоны — вблизи.
    // Каждый значок — отдельный слой поверх карты, а их перерисовка при движении дорогая на слабых телефонах:
    // издалека — только горы и канатки, с района — ещё парки и музеи, всё остальное — вблизи; в экономии — вдвое меньше.
    for (const a of topSpots(places)) {
      const big = a.kind === 'ski' || a.kind === 'skate' || a.kind === 'cable';
      const mid = big || a.kind === 'park' || a.kind === 'garden' || a.kind === 'museum' || a.kind === 'zoo';
      if (detail === 'far' && !big) continue;
      if (detail === 'mid' && (!mid || (eco && !big))) continue;
      if (detail === 'near' && eco && !mid) continue;
      const id = `a-${a.id}`;
      taps.set(id, () => { setSpotPlace(a); setSheet('spot'); });
      syms.push({ id, lat: a.lat, lon: a.lon, z: 9, sort: 9, icon: spotSprite(a), size: Math.round((big ? 50 : 44) * scale), faded: !!focusId });
    }
    if (detail !== 'far') for (const m of malls) {
      const id = `v-${m.id}`;
      taps.set(id, () => { setMall(m); setSheet('venue'); });
      syms.push({ id, lat: m.lat, lon: m.lon, z: 8, sort: 8, icon: mallSprite(m.name), size: Math.round(58 * scale), faded: !!focusId });
    }
    if (filters.friends) {
      const grouped = new Set<string>();
      const own = fix ?? myPos;
      const mePerson = { id: 'map-self', name: draft.name || 'Ты', photo: myProfile?.photo_url ?? draft.photo, mapFrame: myProfile?.map_frame, mapShape: myProfile?.map_shape, initial: draft.name?.[0] ?? 'Я', tint: '#DDE8D9', isFriend: true };
      const ownSpot = own ? { ...own, personId: 'map-self', place: 'Сейчас', state: 'here' as const, minutesAgo: 0 } : null;
      if (!focusId && detail !== 'far') for (const group of closeGroups([...spots.filter(s => { const p = people.find(p => p.id === s.personId); return p && !social.removed[p.id] && (LIVE || !!detailsOf(p.id) && canSee('friend', 'location', detailsOf(p.id)!.privacy)); }), ...(ownSpot ? [ownSpot] : [])])) {
        if (group.length < 2) continue;
        group.forEach(s => grouped.add(s.personId));
        const ps = group.map(s => s.personId === 'map-self' ? mePerson : people.find(p => p.id === s.personId)!);
        list.push({ id: `together-${ps.map(p => p.id).sort().join('-')}`, lat: group.reduce((a,s) => a+s.lat,0)/group.length, lon: group.reduce((a,s) => a+s.lon,0)/group.length, z: 45, node: <TogetherPin people={ps} onPress={id => { focusFriend(id === 'map-self' ? ps.find(p => p.id !== 'map-self')!.id : id); setSheet(null); }} /> });
      }
      for (const s of spots) {
        if (grouped.has(s.personId)) continue;
        const p = people.find((x) => x.id === s.personId);
        const d = detailsOf(s.personId);
        // Только друзья, которые сами включили геолокацию, и не в зоне дома (правила «Кто что видит»).
        // Альфа: кому видна точка, решает сервер (can_see_location) — здесь только убранные из друзей.
        if (!p || social.removed[p.id] || (!LIVE && (!d || !canSee('friend', 'location', d.privacy)))) continue;
        if (focusId === p.id) {
          list.push({ id: `f-${p.id}`, lat: s.lat, lon: s.lon, z: 60, node: <FocusPin person={p} ring={s.state === 'paused' ? '#8C8577' : colors.friend} bubble={bubble && bubble.id === p.id ? bubble : null} speed={s.state === 'moving' && (LIVE || (d && canSee('friend', 'speedStatus', d.privacy))) ? `${s.speedKmh} КМ/Ч` : undefined} heading={s.heading} /> });
          if (p.mapTrail !== 'none' && p.mapTrail !== 'comet') trail.slice(1).forEach((t, i) => list.push({ id: `t-${i}`, lat: t.lat, lon: t.lon, z: 5, node: <View style={{ width: 8 - i * 2, height: 8 - i * 2, borderRadius: 4, backgroundColor: colors.friend, opacity: 0.55 - i * 0.15 }} /> }));
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
    return { markers: list, symbols: syms as MapSymbol[], taps };
  }, [visible, spots, people, me, filters.friends, filters.company, clock, today, dark, going, popularBigger, focusId, bubble, details, social.removed, detail, scale, openPin, selectedId, selected?.id, trail, fix, myPos, zoom, malls, myPlaces, places, myProfile, draft.name, draft.photo]); // eslint-disable-line react-hooks/exhaustive-deps
  // Тап по значку слоя карты: обработчики меняются вместе со значками, сама функция — одна.
  const tapsRef = useRef(taps);
  useEffect(() => { tapsRef.current = taps; }, [taps]);
  const onSymbol = useCallback((id: string) => tapsRef.current.get(id)?.(), []);

  const count = visible.length;
  const dateText = rangeLabel(filters.from, filters.to, clock);
  const showText = showLabel(count) + (count === 0 ? '' : filters.soon ? ' · на неделю' : ` · ${dateText}`);
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
    ex.set(withTiming(1, { duration: 260, easing: Easing.out(Easing.poly(4)) }));
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
    setFilters(d <= WEEK_TO ? { soon: true, from: 0, to: WEEK_TO, cats: [], free: false, max: MAX_PRICE } : { soon: false, from: d, to: d, cats: [], free: false, max: MAX_PRICE });
    select(e.id);
    setCardHidden(false);
    setSheet(null);
    const z = focusZoom(zoom);
    mapRef.current?.flyTo(e.lat - pxToLat(190, z, e.lat), e.lon, z);
  };

  // Стикер другу: облачко долетает до его точки, висит ~3 с и падает в личный чат. Без лимита — у друга придёт пуш.
  const sendSticker = (i: number) => {
    if (!focusPerson || blast) return;
    const st = STICKERS[i];
    const to = focusPerson.id;
    // Сразу показываем действие (FIX5): раньше анимация ждала ответа сервера — на медленной сети это секунды тишины.
    // Отправка идёт фоном; не дошло — скажем об этом.
    social.sticker(to);
    setBlast({ key: Date.now(), st });
    if (LIVE) void openDirectChat(to).then((chatId) => sendMessage(chatId, st.label, 'sticker')).then(() => void queryClient.invalidateQueries({ queryKey: ['chats'] }))
      .catch(() => showToast({ text: 'Не удалось отправить стикер. Проверь связь' }));
    else useChat.getState().send({ id: uid(`dm-${to}-st`), chatId: `dm-${to}`, authorId: 'me', kind: 'sticker', text: st.label, time: timeNow() });
  };

  const topY = Math.max(50, insets.top + 6);

  return (
    <View style={[styles.root, { backgroundColor: dark ? '#1C1D21' : '#DDD8CB' }]} onLayout={(ev) => setH(ev.nativeEvent.layout.height)}>
      {focused && startCam && <MapCanvas key={mapAttempt} remember threeD={threeD} ref={mapRef} theme={theme} camera={startCam} markers={markers} symbols={symbols} onSymbol={onSymbol} bottomInset={tabPad + (selected ? 330 : 0)} topInset={topY + 104} onMode={mode => { setMapMode(mode); useIntro.getState().ready(); }} showUser={!!(fix ?? myPos)} me={fix ?? myPos} meHeading={heading} onZoom={setZoom} traffic={traffic} fog={fog} lines={friendLines}
        onPress={() => { if (selectedId) select(null); }} onBearing={(d) => bearing.set(d)} follow={follow} onFollowEnd={() => setFollow(false)} />}
      {/* Дождь и снег — только когда карта на экране и без экономии: частицы крутятся на UI-потоке. */}
      {focused && !eco && <WeatherFx fx={fxFor(weather, almaty(clock).getUTCMonth())} />}

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
        {geo === 'granted' && !(fix ?? myPos) && (
          <View style={styles.finding} accessibilityLiveRegion="polite"><Text style={styles.findingText}>Ищу тебя на карте…</Text></View>
        )}
        {mapMode === 'static' && <Pressable onPress={() => { setMapMode('loading'); setMapAttempt(n => n + 1); }} accessibilityRole="button" style={{ marginTop: 6, padding: 10, borderRadius: 14, backgroundColor: colors.paper }}>
          <Text style={{ fontFamily: fonts.body500, color: colors.ink }}>Показана схема · 3D недоступно · Повторить</Text>
        </Pressable>}
        {LIVE && (!net.online || net.serverDown) && (
          <View style={{ marginTop: 6 }}>
            <NetPill kind={net.online ? 'server' : 'offline'} onRetry={() => { void pingDb().then((ok) => { if (ok) void queryClient.invalidateQueries(); }); }} />
          </View>
        )}
      </View>


      {!focusId && sheet === null && (
        <MapControls top={Math.max(topY + 64, (H || winH) / 2 - 125)} bearing={bearing} follow={follow}
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

      {blast && <StickerBlast key={blast.key} st={blast.st} x={W / 2} y={(H || winH) / 2 - 110 - FOCUS_FACE} onDone={() => setBlast(null)} />}

      {selected && sheet === null && !focusId && (
        <View style={[styles.card, { bottom: tabPad }]} onLayout={(ev) => { const l = ev.nativeEvent.layout; setCardRect({ x: l.x, y: l.y, w: l.width, h: l.height }); }}>
          <EventSheet key={selected.id} e={selected} now={clock} people={people} going={going.has(selected.id)}
            expand={ex} onReveal={() => openEvent(selected, null, true)}
            onRevealEnd={(commit) => { if (commit) ex.set(withTiming(1, { duration: 260, easing: Easing.out(Easing.poly(4)) })); else closeEvent(); }}
            me={myPos ?? fix} onOpen={() => openEvent(selected)} onInvite={() => openEvent(selected, 'invite')} onHide={() => select(null)}
            onGo={() => {
              const p = usePlans.getState();
              if (going.has(selected.id)) { p.ungo(selected.id); useApp.getState().removePlan(); }
              else { p.go(selected.id); useApp.getState().addPlan(); showToast({ text: selected.category === 'movie' ? 'Сеанс в «Планах». Напомню о билетах за 3 часа' : 'Добавил в «Планы». Напомню за час', cta: 'Планы', onCta: () => router.navigate('/plans') }); }
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

      {sheet === 'spot' && spotPlace && <SpotSheet key={spotPlace.id} a={spotPlace} all={places} onClose={() => setSheet(null)} onOpen={setSpotPlace} />}

      {sheet === 'venue' && mall && (
        <View style={[styles.card, { bottom: tabPad }]}>
          <PlaceCard key={mall.id} m={mall} events={upcoming} onClose={() => setSheet(null)} onEvent={(e) => { setSheet(null); openEvent(e); }} />
        </View>
      )}

      {sheet === 'lens' && (
        <>
          <Backdrop onPress={() => setSheet(null)} label="Закрыть линзы" />
          <BottomSheet onClose={() => setSheet(null)} label="Линзы">
            <LensSheet lens={lens} onPick={(l) => { setLens(l); setSheet(null); }} view={view} onView={(v) => { setView(v); setSheet(null); }} canThreeD={mapMode === 'mapbox'} />
          </BottomSheet>
        </>
      )}

      {sheet === null && lens !== 'normal' && !focusId && (
        <View style={[styles.lensInfo, { top: topY + 112, bottom: undefined }]} pointerEvents="box-none">
          {lens === 'explore' ? <Pressable onPress={() => router.navigate('/me')} accessibilityLabel="Открытые места, уровень и значки"><ExploreBadge pct={exploredPct(cells)} value={cells.length / ALMATY_CELLS} cells={cells.length} /></Pressable> : <TrafficChip hasKey={!!config.tomtomKey} score={trafficFresh ? tscore.data?.score : null} rough={trafficFresh && !tscore.data?.points.length} toName={nearAve?.name} toMin={toAve.data ?? null} />}
        </View>
      )}

      {LIVE && askBg && geo === 'granted' && sheet === null && !focusId && !selected && (
        <View style={[styles.card, { bottom: tabPad }]}>
          <BackgroundAsk onAllow={() => void allowBg()} onLater={() => { setAskBg(false); void setSetting('bg_asked', true).catch(() => undefined); }} />
        </View>
      )}

      {LIVE && geo === 'granted' && !askBg && shouldExplain(prec, laterAt) && sheet === null && !focusId && !selected && (
        <View style={[styles.card, { bottom: tabPad }]}>
          <AccuracyAsk onAllow={() => void improveAccuracy().then(setPrec)} onLater={() => useGeoAsk.getState().later()} />
        </View>
      )}

      {LIVE && (geo === 'denied' || geo === 'off') && <NoGeoCard off={geo === 'off'} onEnable={() => (geo === 'off' ? void Linking.openSettings() : void ensureGeo(true))} />}

      {inviteOpen && focusPerson && (
        <>
          <Backdrop onPress={() => setInviteOpen(false)} label="Закрыть" />
          <BottomSheet onClose={() => setInviteOpen(false)} label={`Позвать ${accusative(focusPerson.name)}`} style={{ gap: 14 }}>
            <InviteFriendSheet
              p={focusPerson}
              busy={mapInviting}
              title={`Позвать ${accusative(focusPerson.name)}`}
              now={clock}
              ideas={detailsOf(focusPerson.id) ? ideasForTwo(tasteFrom({ interests: draft.interests, times: draft.times, withWho: draft.withWho, budget: draft.budget }, signals, clock), focusPerson.id, focusPerson.name, detailsOf(focusPerson.id)!, events, { now: clock, going, savedByFriend: focusPerson.id === 'igor' ? new Set(['standup']) : undefined }) : []}
              onOwn={() => { setInviteOpen(false); router.push('/create'); }}
              onSend={async (eventId) => {
                if (inviteSending.current) return;
                inviteSending.current = true; setMapInviting(true);
                const person = focusPerson;
                try {
                  if (LIVE) await sendInvite(eventId, events.find(e => e.id === eventId)?.title ?? 'Встреча', [person.id]);
                  social.invite(person.id, eventId);
                  usePlans.getState().invite(eventId, [person.id]);
                  setInviteOpen(false);
                  const ev = events.find((x) => x.id === eventId);
                  showToast({ text: `Позвал ${accusative(person.name)} на «${ev?.title ?? 'встречу'}». Ответ придёт в чат`, cta: 'Чат', onCta: () => router.push({ pathname: '/chat/[id]', params: { id: `dm-${person.id}` } }) });
                } catch { showToast({ text: 'Не удалось отправить приглашение. Проверь связь' }); }
                finally { inviteSending.current = false; setMapInviting(false); }

              }}
            />
          </BottomSheet>
        </>
      )}

      {toast && <Toast t={toast} style={{ position: 'absolute', left: 16, right: 16, top: topY + 112 }} />}

      {open && (
        <Animated.View style={[styles.clip, clip]}>
          <Animated.View style={[{ position: 'absolute', width: W, height: fullH, flex: 1 }, clipInner]}>
            <LazyEventPage progress={ex} e={open} now={clock} onClose={closeEvent} initialSheet={openSheet} />
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
  finding: { alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 12, height: 30, borderRadius: 15, backgroundColor: colors.ink, justifyContent: 'center' },
  findingText: { fontFamily: fonts.body600, fontSize: 12.5, color: colors.paper },
  clip: { position: 'absolute', overflow: 'hidden', zIndex: 90 },
});
