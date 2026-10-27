// Маршрут в приложении (переделан 11 октября). Два состояния:
// 1) выбор — карточка с адресом сверху, справа кнопки карты (компас, +/−, «ко мне»), снизу способы: пешком / машина / автобус
//    с временем и километрами, подсказка «что лучше» и кнопка «В путь»;
// 2) навигация — сверху крупная инструкция (стрелка, расстояние до манёвра, улица), снизу остаток пути и «Завершить»,
//    в режиме «машина» ещё скорость. Всё, что не нужно в пути, прячется, поэтому блоки не накладываются.
// Машина и пешком — функция route (TomTom с пробками), автобус — свой расчёт по остановкам OpenStreetMap.
import { useQueries, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowUp, ArrowUpLeft, ArrowUpRight, Bus, Car, ChevronLeft, ChevronRight, CornerUpLeft, CornerUpRight, Flag, Footprints, Moon, Undo2, type LucideIcon } from 'lucide-react-native';
import { busService } from '../../transit/bus';
import { useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { data, eventsSnapshot } from '../../data';
import { bestMode, closestInstruction, maneuverKind, routeProgress, snapToLine, type Mode } from '../../event/navigation';
import { useTrip } from '../../event/v6/WhereSheet';
import { almaty, now as clockNow } from '../../lib/clock';
import { config } from '../../lib/config';
import { getEventsByIds } from '../../live/api';
import { useMyFix, useMyPos, usePreciseGps } from '../../live/location';
import { streetPath } from '../../live/osrm';
import { CAT_COLOR, CAT_ICON, catFg } from '../../map/icons';
import { MapCanvas } from '../../map/MapCanvas';
import { MeArrow, MeDot, useHeading } from '../../map/MeDot';
import type { MapCanvasHandle, MapMarker } from '../../map/types';
import { MapControls } from '../../map/ui/MapControls';
import { useBackClose } from '../../state/app';
import { useMapView } from '../../state/mapView';
import { useEco } from '../../state/perf';
import { usePlans } from '../../state/plans';
import { colors, fonts } from '../../theme';
import { Ic } from '../../ui/Ic';
import { glass } from '../../ui/glass';

const hm = (iso: string) => { const d = almaty(iso); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };
const km1 = (v: number) => v.toFixed(1).replace('.', ',');
const metres = (m: number) => (m >= 1000 ? `${km1(m / 1000)} км` : `${Math.max(10, Math.round(m / 10) * 10)} м`);

function Maneuver({ message, size, color }: { message: string; size: number; color: string }) {
  const p = { size, color, strokeWidth: 2.4 };
  switch (maneuverKind(message)) {
    case 'flag': return <Flag {...p} />;
    case 'uturn': return <Undo2 {...p} />;
    case 'left': return <CornerUpLeft {...p} />;
    case 'right': return <CornerUpRight {...p} />;
    case 'soft-left': return <ArrowUpLeft {...p} />;
    case 'soft-right': return <ArrowUpRight {...p} />;
    default: return <ArrowUp {...p} />;
  }
}

const METRO_RED = '#D9312B';
const OPT_TAG = { fast: 'БЫСТРЕЕ', simple: 'МЕНЬШЕ ПЕРЕСАДОК', walk: 'МЕНЬШЕ ИДТИ' } as const;


export default function RouteScreen() {
  const insets = useSafeAreaInsets();
  const { id, mode: m0, lat: pLat, lon: pLon, title: pTitle, address: pAddr } = useLocalSearchParams<{ id: string; mode?: Mode; lat?: string; lon?: string; title?: string; address?: string }>();
  const [mode, setMode] = useState<Mode>(m0 === 'car' || m0 === 'bus' ? m0 : 'walk');
  const [follow, setFollow] = useState(false);
  const [optIdx, setOptIdx] = useState(0);
  const [origin, setOrigin] = useState<{ lat: number; lon: number } | null>(null);
  const [size, setSize] = useState({ h: 0, sheet: 0 });
  const { width: screenW } = useWindowDimensions();
  const [mapReady, setMapReady] = useState(false);
  const [mapMode, setMapMode] = useState<'mapbox' | 'static' | null>(null);
  // Карту создаём после анимации перехода: на Android одновременный разбор старой карты и запуск новой ронял приложение.
  const [mountMap, setMountMap] = useState(Platform.OS === 'web');
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setTimeout(() => setMountMap(true), 120));
    return () => task.cancel();
  }, []);
  // Навигатор объёмный, как и главная карта (просьба владельца 21 окт.); в «Простой» карте и экономии — плоский.
  const view3d = useMapView((v) => v.view) === '3d';
  const eco = useEco();
  const threeD = view3d && !eco;
  const fitted = useRef('');
  const mapRef = useRef<MapCanvasHandle>(null);
  usePreciseGps(true);
  const fix = useMyFix((s) => s.fix);
  const pos = useMyPos();
  const heading = useHeading();
  const bearing = useSharedValue(0);
  const meetups = usePlans((s) => s.meetups);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  useBackClose(back);
  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: () => data.getEvents(), placeholderData: eventsSnapshot });
  const known = [...meetups, ...events].find((x) => x.id === id);
  const detail = useQuery({ queryKey: ['event', id], queryFn: () => getEventsByIds([id]), enabled: config.dataMode !== 'demo' && !known && !pLat, retry: 1 });
  // Маршрут к постоянному месту (Шымбулак, боулинг…): точка из параметров, не событие из базы.
  const spot = useMemo(() => {
    const la = Number(pLat), lo = Number(pLon);
    if (!pLat || !Number.isFinite(la) || !Number.isFinite(lo)) return undefined;
    return { id, title: pTitle ?? 'Место', lat: la, lon: lo, address: pAddr ?? '', venueName: pTitle ?? null, category: 'hike', startsAt: new Date().toISOString(), endsAt: null } as unknown as NonNullable<typeof known>;
  }, [id, pLat, pLon, pTitle, pAddr]);
  const e = spot ?? known ?? detail.data?.[0];

  // «В путь»: камера за мной. Маршрут считаем один раз от точки старта, а не заново на каждом шаге.
  useEffect(() => {
    if (!follow || !fix) return;
    // Камера сама: пешком — близко и круто сверху, в машине — дальше и положе, чтобы видеть поворот заранее.
    // Направление — по движению (GPS-курс) на скорости, стоя — по компасу.
    const v = fix.speed != null && fix.speed >= 0 ? fix.speed : 0;
    const zoom = v > 16 ? 15.2 : v > 8 ? 15.8 : v > 3 ? 16.6 : 17.4;
    const pitch = v > 8 ? 62 : 52;
    const dir = v > 1.5 && fix.heading != null && fix.heading >= 0 ? fix.heading : heading.get();
    mapRef.current?.navigateTo(fix.lat, fix.lon, Number.isFinite(dir) ? dir : 0, zoom, pitch);
  }, [follow, fix, heading]);

  const trip = useTrip(e ?? ({ id: '', lat: 0, lon: 0, needsPin: true } as never), e ? (origin ?? pos) : null);
  const opt = trip.transit[Math.min(optIdx, Math.max(0, trip.transit.length - 1))];
  // Пешие участки и автобус — по улицам (открытый маршрутизатор OSM); метро — по прямой между станциями.
  const legQs = useQueries({ queries: (mode === 'bus' && opt ? opt.legs : []).map((l) => {
    const profile = l.kind === 'walk' ? 'foot' as const : 'car' as const;
    const pts = l.kind === 'walk' ? [l.path[0], l.path[l.path.length - 1]] : l.path;
    return { queryKey: ['street', profile, l.mode ?? 'walk', pts.map((p) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`).join(';')], queryFn: () => (l.mode === 'metro' ? Promise.resolve(null) : streetPath(profile, pts)), staleTime: 6 * 3600e3, retry: 0 };
  }) });
  // Пешком без ответа TomTom — тоже по улицам, а не по прямой.
  const walkFallback = useQuery({ queryKey: ['street', 'foot', 'walk', e && pos ? `${pos.lon.toFixed(3)},${pos.lat.toFixed(3)};${e.lon},${e.lat}` : ''],
    queryFn: () => streetPath('foot', [[pos!.lon, pos!.lat], [e!.lon, e!.lat]]), enabled: !!e && !!pos && mode === 'walk' && !trip.loading && !trip.route?.walk?.line?.length, staleTime: 6 * 3600e3, retry: 0 });
  const legPaths = legQs.map((q) => q.data ?? null);
  const legKey = legPaths.map((x) => x?.length ?? 0).join(',');
  const navLine: [number, number][] = mode === 'car' ? trip.route?.car?.line ?? [] : mode === 'walk' ? trip.route?.walk?.line ?? walkFallback.data ?? [] : (opt?.legs ?? []).flatMap((l, i) => legPaths[i] ?? l.path);
  // «В путь»: моя точка прилипает к линии маршрута (до 35 м) — не прыгает по дворам.
  const me = follow && fix ? snapToLine(fix, navLine) : pos;
  const lines = useMemo(() => {
    if (!e || !me) return [];
    const to: [number, number] = [e.lon, e.lat];
    const from: [number, number] = [me.lon, me.lat];
    if (mode === 'car') return [{ id: 'car', coords: trip.route?.car?.line ?? [], color: trip.route?.car?.delayMin ? '#C83A26' : '#2F8F5B', width: 6 }];
    if (mode === 'walk') return [{ id: 'walk', coords: trip.route?.walk?.line ?? walkFallback.data ?? [], color: colors.ink, width: 4, dash: true }];
    const opt = trip.transit[Math.min(optIdx, trip.transit.length - 1)];
    if (!opt) return [];
    void from; void to;
    // Пешком — пунктир, автобус — синий, метро — красный (как на схеме метро Алматы).
    return opt.legs.map((l, i) => ({ id: `t${i}`, coords: legPaths[i] ?? l.path, color: l.kind === 'walk' ? '#8C8577' : l.mode === 'metro' ? METRO_RED : colors.friend, width: l.kind === 'walk' ? 3 : 6, dash: l.kind === 'walk' }));
  }, [e, me, mode, trip.route, trip.transit, optIdx, walkFallback.data, legKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (follow) { fitted.current = ''; return; }
    if (!mapReady || !e || !size.h || !size.sheet) return;
    const coords: [number, number][] = [...lines.flatMap(l => l.coords), [e.lon, e.lat], ...(me ? [[me.lon, me.lat] as [number, number]] : [])];
    const key = `${e.id}:${mode}:${size.h}:${size.sheet}:${screenW}:${lines.map(l => `${l.id}:${l.coords.length}:${l.coords[0]}:${l.coords.at(-1)}`).join('|')}:${!!me}`;
    if (fitted.current === key) return;
    fitted.current = key;
    mapRef.current?.fitBounds?.(coords, { top: Math.max(insets.top, 42) + 100, right: 72, bottom: size.sheet + 36, left: 36 });
  }, [mapReady, follow, e, mode, size, screenW, lines, me, insets.top]);

  const leg = mode === 'car' ? trip.route?.car : trip.route?.walk;
  const progress = follow && me && leg?.line ? routeProgress(me, leg.line) : null;
  const instruction = follow && me ? closestInstruction(me, leg?.instructions ?? [], leg?.line ?? []) : null;

  if (!e) return <View style={[styles.root, { justifyContent: 'center', alignItems: 'center', gap: 20 }]}><Text>{config.dataMode !== 'demo' && detail.isPending ? 'Загружаю событие…' : 'Маршрут недоступен'}</Text><Pressable onPress={back} accessibilityRole="button"><Text>Вернуться</Text></Pressable></View>;

  const markers: MapMarker[] = [
    { id: 'to', lat: e.lat, lon: e.lon, z: 20, node: <View style={[styles.dest, { backgroundColor: CAT_COLOR[e.category] }]}><Ic d={CAT_ICON[e.category]} size={18} color={catFg(e.category)} w={2} /></View> },
    // На телефоне моя точка — слои карты (prop me); маркер нужен только в web.
    ...(me && Platform.OS === 'web' ? [{ id: 'me', lat: me.lat, lon: me.lon, z: 30, node: follow ? <MeArrow heading={heading} bearing={bearing} /> : <MeDot heading={heading} bearing={bearing} /> }] : []),
    // Все остановки на линии: видно, где можно выйти раньше (пробка). Посадка и высадка — крупнее.
    ...(mode === 'bus' && opt ? opt.legs.filter(l => l.kind === 'ride').flatMap((l, i) => l.path.slice(0, 40).map(([lon, lat], k, all) => {
      const end = k === 0 || k === all.length - 1;
      return { id: `s${i}-${k}`, lat, lon, z: end ? 11 : 9, node: <View style={[end ? styles.stop : styles.stopSmall, l.mode === 'metro' && { borderColor: METRO_RED }]} /> };
    })) : []),
  ];
  const cam = me ? { lat: (me.lat + e.lat) / 2 - 0.004, lon: (me.lon + e.lon) / 2, zoom: Math.max(9, Math.min(15, Math.log2(360 / (Math.max(Math.abs(e.lon - me.lon), Math.abs(e.lat - me.lat) * 1.8, 0.005) * 2.6)))) } : { lat: e.lat, lon: e.lon, zoom: 14 };

  const svc = busService(new Date());
  const busMin = opt ? opt.total : null;
  const best = bestMode(trip.walkMin, trip.carMin, busMin);
  const tiles: { m: Mode; Icon: LucideIcon; min: number | null; km: string | null; label: string }[] = [
    { m: 'walk', Icon: Footprints, min: trip.walkMin, km: trip.route?.walk ? km1(trip.route.walk.km) : null, label: 'Пешком' },
    { m: 'car', Icon: Car, min: trip.carMin, km: trip.route?.car ? km1(trip.route.car.km) : null, label: 'Машина' },
    { m: 'bus' as const, Icon: Bus, min: busMin, km: null, label: opt ? (opt.transfers ? `${opt.transfers} ${opt.transfers === 1 ? 'пересадка' : 'пересадки'}` : 'без пересадок') : svc.running ? 'нет рейсов' : `с ${svc.startsAt}` },
  ];
  const canNavigate = mapMode === 'mapbox' && !!me && !e.needsPin && !e.noPoint && (mode === 'bus' ? !!opt : (leg?.line?.length ?? 0) >= 2);
  const to = e.venueName ?? e.address.split(',')[0];

  // Остаток пути по маршруту: пропорционально пройденному.
  const total = leg ? leg.km * 1000 : 0;
  const left = progress && total ? Math.max(0, total - progress.metres) : null;
  const leftMin = left != null && leg ? Math.max(1, Math.round((leg.min * left) / total)) : null;
  const arrive = leftMin != null ? hm(new Date(clockNow().getTime() + leftMin * 60000).toISOString()) : null;
  const toTurn = instruction && progress ? Math.max(0, instruction.distance - progress.metres) : null;
  const arrived = left != null && left < 30;
  const speed = fix?.speed != null && fix.speed >= 0 ? Math.round(fix.speed * 3.6) : null;

  const steps: { icon: React.ReactNode; title: string; sub: string; blue?: boolean; red?: boolean }[] = mode === 'bus' && opt ? [
    ...opt.legs.map((l, i) => {
      const next = opt.legs[i + 1];
      if (l.kind === 'walk') return { icon: <Footprints size={16} color={colors.ink} strokeWidth={2} />, title: `${l.minutes} мин пешком`, sub: next?.from ? `до ${next.mode === 'metro' ? 'станции' : 'остановки'} «${next.from.name}»` : `до ${to}` };
      return { blue: l.mode === 'bus', red: l.mode === 'metro', icon: <Text style={styles.busRef}>{l.mode === 'metro' ? 'М' : l.ref}</Text>,
        title: `${l.mode === 'metro' ? 'Метро' : `Автобус ${l.ref}`} · ~${l.wait} мин ждать`, sub: `${l.stops} ост. · ${l.minutes} мин · выйти на «${l.to?.name}»` };
    }),
  ] : mode === 'car' ? [
    { icon: <Car size={16} color={colors.ink} strokeWidth={2} />, title: trip.route?.car ? `${km1(trip.route.car.km)} км · ${trip.route.car.min} мин` : trip.loading || !me ? 'Считаю маршрут…' : 'Примерно, без учёта пробок', sub: trip.route?.car?.delayMin ? `Пробки +${trip.route.car.delayMin} мин` : trip.route?.car ? 'Дороги свободны' : trip.loading || !me ? 'С учётом пробок' : 'Нет связи с сервисом пробок' },
  ] : [
    { icon: <Footprints size={16} color={colors.ink} strokeWidth={2} />, title: trip.route?.walk ? `${km1(trip.route.walk.km)} км · ${trip.route.walk.min} мин` : trip.walkMin != null && !trip.loading ? `~${trip.walkMin} мин по прямой` : me ? 'Считаю маршрут…' : 'Где ты? Включи геолокацию', sub: trip.route?.walk ? 'Пешком по улицам' : 'Примерно' },
  ];

  const start = () => {
    if (follow) { setFollow(false); setOrigin(null); return; }
    if (me) { setOrigin(pos); mapRef.current?.navigateTo(me.lat, me.lon, heading.get()); }
    setFollow(true);
  };
  const firstRide = opt?.legs.find(l => l.kind === 'ride');
  const ModeIcon = mode === 'car' ? Car : mode === 'bus' ? Bus : Footprints;
  const headTop = Math.max(14, insets.top + 6);
  // Кнопки карты стоят над нижней панелью; сверху не заходят под карточку адреса / инструкцию.
  const controlsTop = Math.max(headTop + 84, size.h - size.sheet - 218);

  return (
    <View style={styles.root} onLayout={(ev) => { const h = ev.nativeEvent.layout.height; setSize((s) => (s.h === h ? s : { ...s, h })); }}>
      {mountMap && <MapCanvas ref={mapRef} threeD={threeD} onMode={mode => { setMapMode(mode); setMapReady(true); }} theme="paper" onBearing={(d) => bearing.set(d)} camera={cam} markers={markers} lines={lines} showUser={!!fix}
        me={me} meHeading={heading} meArrow={follow} bottomInset={size.sheet + 8} topInset={headTop + 80} />}

      {!follow ? (
        <View style={[styles.top, glass, { top: headTop }]}>
          <Pressable onPress={back} style={styles.back} accessibilityRole="button" accessibilityLabel="Назад"><ChevronLeft size={24} color={colors.ink} strokeWidth={2} /></Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.topSub} numberOfLines={1}>до {to}{e.address ? ` · ${e.address.split(',').slice(0, 2).join(',')}` : ''}</Text>
            <Text style={styles.topTitle} numberOfLines={1}>{e.title}{spot ? '' : ` · ${hm(e.startsAt)}`}</Text>
          </View>
        </View>
      ) : (
        <View style={[styles.nav, { top: headTop }]} accessibilityLiveRegion="polite">
          {mode === 'bus' ? (
            <>
              <View style={styles.navIcon}><Bus size={30} color={colors.paper} strokeWidth={2} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.navMsg} numberOfLines={2}>{firstRide ? (firstRide.mode === 'metro' ? 'Метро' : `Автобус ${firstRide.ref}`) : 'Транспорт'}</Text>
                <Text style={styles.navSub} numberOfLines={2}>{firstRide ? `Дойди до ${firstRide.mode === 'metro' ? 'станции' : 'остановки'} «${firstRide.from?.name}»` : 'Маршрут недоступен'}</Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.navIcon}>{arrived ? <Flag size={32} color={colors.paper} strokeWidth={2.2} /> : <Maneuver message={instruction?.message ?? ''} size={34} color={colors.paper} />}</View>
              <View style={{ flex: 1 }}>
                {toTurn != null && !arrived && <Text style={styles.navDist}>{metres(toTurn)}</Text>}
                <Text style={styles.navMsg} numberOfLines={2}>{arrived ? 'Ты на месте' : instruction?.message ?? (me ? 'Иди по линии маршрута' : 'Ищу тебя на карте…')}</Text>
              </View>
            </>
          )}
        </View>
      )}

      {!follow && (
        <MapControls top={controlsTop} bearing={bearing} follow={false}
          onCompass={() => mapRef.current?.north()}
          onZoom={(d) => mapRef.current?.zoomBy(d)}
          onMe={() => { if (me) mapRef.current?.flyTo(me.lat, me.lon, 15); }} />
      )}

      {follow && mode === 'car' && speed != null && (
        <View style={[styles.speed, glass, { bottom: size.sheet + Math.max(10, insets.bottom) + 12 }]} accessibilityLabel={`Скорость ${speed} километров в час`}>
          <Text style={styles.speedN}>{speed}</Text>
          <Text style={styles.speedU}>км/ч</Text>
        </View>
      )}

      <View style={[styles.sheet, glass, { bottom: Math.max(10, insets.bottom) }]} onLayout={(ev) => { const sheet = ev.nativeEvent.layout.height; setSize((s) => (s.sheet === sheet ? s : { ...s, sheet })); }}>
        {follow ? (
          <View style={styles.navBar}>
            <View style={styles.navStat}>
              <View style={styles.modeDot}><ModeIcon size={18} color={colors.ink} strokeWidth={2} /></View>
              <View>
                <Text style={styles.navMin}>{leftMin != null ? `${leftMin} мин` : mode === 'bus' && opt ? `${opt.total} мин` : '…'}</Text>
                <Text style={styles.navSub2}>{left != null ? `${metres(left)}${arrive ? ` · прибытие ${arrive}` : ''}` : 'считаю остаток'}</Text>
              </View>
            </View>
            <Pressable onPress={start} style={styles.finish} accessibilityRole="button" accessibilityLabel="Завершить навигацию"><Text style={styles.finishText}>Завершить</Text></Pressable>
          </View>
        ) : (
          <>
            <View style={styles.tiles}>
              {tiles.map(({ m, Icon, min, km, label }) => (
                <Pressable key={m} onPress={() => setMode(m)} style={[styles.tile, mode === m && styles.tileOn]} accessibilityRole="tab" accessibilityState={{ selected: mode === m }} accessibilityLabel={`${label}, ${min != null ? `${min} минут` : 'считаю'}${best === m ? ', лучший вариант' : ''}`}>
                  {best === m && <View style={styles.best}><Text style={styles.bestText}>ЛУЧШЕ</Text></View>}
                  <Icon size={19} color={mode === m ? '#EEE9DE' : colors.ink} strokeWidth={1.9} />
                  <Text style={[styles.tileText, mode === m && { color: '#EEE9DE' }]}>{min != null ? `${min} мин` : '…'}</Text>
                  <Text style={[styles.tileSub, mode === m && { color: '#BDB8AD' }]} numberOfLines={1}>{km ? `${km} км` : label}</Text>
                </Pressable>
              ))}
            </View>
            {mode === 'bus' && trip.transit.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {trip.transit.map((o, i) => (
                  <Pressable key={i} onPress={() => setOptIdx(i)} style={[styles.opt, optIdx === i && styles.optOn]} accessibilityRole="tab" accessibilityState={{ selected: optIdx === i }}>
                    <Text style={[styles.optTag, optIdx === i && { color: '#F7A47E' }]}>{OPT_TAG[o.tag ?? 'fast']}</Text>
                    <Text style={[styles.optMin, optIdx === i && { color: colors.paper }]}>{o.total} мин</Text>
                    <View style={{ flexDirection: 'row', gap: 3 }}>{o.legs.filter(l => l.kind === 'ride').map((l, k) => <View key={k} style={[styles.optRef, { backgroundColor: l.mode === 'metro' ? METRO_RED : colors.friend }]}><Text style={styles.optRefText}>{l.mode === 'metro' ? 'М' : l.ref}</Text></View>)}</View>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            {mode === 'bus' && opt ? (
              // Автобус проще (21 окт.): одна строка «пешком → № 63 → пешком» и где сесть / выйти.
              <View style={{ gap: 6 }}>
                <View style={styles.chain}>
                  {opt.legs.map((l, i) => (
                    <View key={i} style={styles.chainItem}>
                      {i > 0 && <ChevronRight size={14} color={colors.muted} strokeWidth={2.2} />}
                      {l.kind === 'walk'
                        ? <View style={styles.chainWalk}><Footprints size={14} color={colors.ink} strokeWidth={2} /><Text style={styles.chainText}>{l.minutes}</Text></View>
                        : <View style={[styles.optRef, styles.chainRide, { backgroundColor: l.mode === 'metro' ? METRO_RED : colors.friend }]}><Text style={[styles.optRefText, { fontSize: 12 }]}>{l.mode === 'metro' ? 'М' : l.ref}</Text><Text style={styles.chainRideMin}>{l.minutes}</Text></View>}
                    </View>
                  ))}
                </View>
                {firstRide && <Text style={styles.stepSub} numberOfLines={2}>Сесть на «{firstRide.from?.name}», выйти на «{opt.legs.filter(l => l.kind === 'ride').at(-1)?.to?.name}» · ждать ~{firstRide.wait} мин</Text>}
              </View>
            ) : mode === 'bus' ? (
              <View style={styles.night}>
                <Moon size={18} color={colors.ink} strokeWidth={2} />
                <Text style={styles.nightText}>{svc.running ? 'Рядом нет подходящего автобуса. Попробуй машину или пешком.' : `Сейчас автобусы не ходят — начнут ездить в ${svc.startsAt}. Маршрут появится утром.`}</Text>
              </View>
            ) : (
            <View style={{ gap: 10 }}>
              {steps.map((s, i) => (
                <View key={i} style={styles.step}>
                  <View style={[styles.stepIcon, s.blue && { backgroundColor: colors.friend }, s.red && { backgroundColor: METRO_RED }]}>{s.icon}</View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stepTitle}>{s.title}</Text>
                    <Text style={styles.stepSub}>{s.sub}</Text>
                  </View>
                </View>
              ))}
            </View>
            )}
            {mode === 'bus' && <Text style={styles.osm}>Примерно · © участники OpenStreetMap</Text>}
            <Pressable disabled={!canNavigate} onPress={start} style={[styles.go, !canNavigate && { opacity: 0.5 }]} accessibilityRole="button">
              <Text style={styles.goText}>{canNavigate ? (mode === 'car' ? 'Поехали' : 'В путь') : mapMode === 'static' ? 'Карта недоступна' : trip.loading ? 'Строю маршрут…' : 'Маршрут недоступен'}</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#DDD8CB' },
  top: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, paddingRight: 16, borderRadius: 24 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  topSub: { fontFamily: fonts.body500, fontSize: 12.5, color: colors.muted2 },
  topTitle: { fontFamily: fonts.display700, fontSize: 17, color: colors.ink },
  // Подсказка манёвра: тёмная плашка с тонкой светлой кромкой, крупная стрелка на оранжевом — читается на ходу.
  nav: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 26, backgroundColor: colors.ink, borderWidth: 1, borderTopColor: 'rgba(255,255,255,0.16)', borderLeftColor: 'rgba(255,255,255,0.06)', borderRightColor: 'rgba(255,255,255,0.06)', borderBottomColor: 'rgba(0,0,0,0.5)', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.12), 0 14px 30px -10px rgba(23,22,26,0.55)' },
  navIcon: { width: 62, height: 62, borderRadius: 20, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  navDist: { fontFamily: fonts.display800, fontSize: 28, lineHeight: 32, color: colors.paper },
  navMsg: { fontFamily: fonts.body600, fontSize: 15.5, lineHeight: 20, color: '#E8E4DA' },
  navSub: { fontFamily: fonts.body400, fontSize: 13.5, color: '#BDB8AD' },
  navBar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  navStat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  modeDot: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#D9D3C5', alignItems: 'center', justifyContent: 'center' },
  navMin: { fontFamily: fonts.display800, fontSize: 24, color: colors.ink },
  navSub2: { fontFamily: fonts.body500, fontSize: 13, color: colors.muted2 },
  finish: { height: 52, paddingHorizontal: 20, borderRadius: 16, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  finishText: { fontFamily: fonts.body700, fontSize: 15.5, color: colors.ink },
  speed: { position: 'absolute', left: 14, width: 66, height: 66, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  speedN: { fontFamily: fonts.display800, fontSize: 22, lineHeight: 24, color: colors.ink },
  speedU: { fontFamily: fonts.mono600, fontSize: 9, color: colors.muted2 },
  // Плавающая шторка маршрута над краем экрана (как нижняя панель).
  sheet: { position: 'absolute', left: 10, right: 10, borderRadius: 28, padding: 16, gap: 12 },
  night: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, backgroundColor: '#EDE8DD' },
  nightText: { flex: 1, fontFamily: fonts.body500, fontSize: 13.5, lineHeight: 18, color: colors.ink },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, minHeight: 78, borderRadius: 18, backgroundColor: '#EDE8DD', borderWidth: 1, borderColor: 'rgba(23,22,26,0.08)', alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 8, paddingHorizontal: 4 },
  tileOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  tileText: { fontFamily: fonts.body700, fontSize: 16, color: colors.ink },
  tileSub: { fontFamily: fonts.body500, fontSize: 11.5, color: colors.muted2 },
  best: { position: 'absolute', top: -8, paddingHorizontal: 7, height: 16, borderRadius: 8, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  bestText: { fontFamily: fonts.mono600, fontSize: 8.5, letterSpacing: 0.6, color: colors.ink },
  advice: { fontFamily: fonts.body500, fontSize: 13, lineHeight: 18, color: colors.muted2 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: '#D9D3C5', alignItems: 'center', justifyContent: 'center' },
  busRef: { fontFamily: fonts.mono600, fontSize: 12, color: '#FFFFFF' },
  stepTitle: { fontFamily: fonts.display700, fontSize: 15.5, color: colors.ink },
  stepSub: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted2 },
  osm: { fontFamily: fonts.body400, fontSize: 11, color: colors.muted },
  go: { height: 56, borderRadius: 18, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.35), 0 10px 22px -10px rgba(240,82,31,0.7)' },
  goText: { fontFamily: fonts.body700, fontSize: 17, color: colors.ink },
  dest: { width: 36, height: 36, borderRadius: 12, borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  opt: { minWidth: 112, padding: 10, borderRadius: 16, backgroundColor: '#EDE8DD', borderWidth: 1, borderColor: 'rgba(23,22,26,0.08)', gap: 4 },
  optOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  optTag: { fontFamily: fonts.mono600, fontSize: 9, letterSpacing: 0.5, color: colors.muted2 },
  optMin: { fontFamily: fonts.display700, fontSize: 17, color: colors.ink },
  optRef: { minWidth: 22, height: 18, borderRadius: 6, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  optRefText: { fontFamily: fonts.mono600, fontSize: 10, color: '#FFFFFF' },
  chain: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', rowGap: 6 },
  chainItem: { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 4 },
  chainWalk: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 26, paddingHorizontal: 8, borderRadius: 8, backgroundColor: '#E4DED2' },
  chainText: { fontFamily: fonts.body700, fontSize: 13, color: colors.ink },
  chainRide: { flexDirection: 'row', gap: 5, height: 26, paddingHorizontal: 8 },
  chainRideMin: { fontFamily: fonts.body700, fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  stop: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#FFFFFF', borderWidth: 3.5, borderColor: colors.friend },
  stopSmall: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: colors.friend },
});
