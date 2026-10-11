// Маршрут в приложении (переделан 11 октября). Два состояния:
// 1) выбор — карточка с адресом сверху, справа кнопки карты (компас, +/−, «ко мне»), снизу способы: пешком / машина / автобус
//    с временем и километрами, подсказка «что лучше» и кнопка «В путь»;
// 2) навигация — сверху крупная инструкция (стрелка, расстояние до манёвра, улица), снизу остаток пути и «Завершить»,
//    в режиме «машина» ещё скорость. Всё, что не нужно в пути, прячется, поэтому блоки не накладываются.
// Машина и пешком — функция route (TomTom с пробками), автобус — свой расчёт по остановкам OpenStreetMap.
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowUp, ArrowUpLeft, ArrowUpRight, Bus, Car, ChevronLeft, CornerUpLeft, CornerUpRight, Flag, Footprints, Undo2, type LucideIcon } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { data, eventsSnapshot } from '../../data';
import { bestMode, closestInstruction, maneuverKind, routeProgress, type Mode } from '../../event/navigation';
import { useTrip } from '../../event/v6/WhereSheet';
import { almaty, now as clockNow } from '../../lib/clock';
import { config } from '../../lib/config';
import { getEventsByIds } from '../../live/api';
import { useMyFix, useMyPos } from '../../live/location';
import { CAT_COLOR, CAT_ICON, catFg } from '../../map/icons';
import { MapCanvas } from '../../map/MapCanvas';
import { MeDot, useHeading } from '../../map/MeDot';
import type { MapCanvasHandle, MapMarker } from '../../map/types';
import { MapControls } from '../../map/ui/MapControls';
import { useBackClose } from '../../state/app';
import { usePlans } from '../../state/plans';
import { colors, fonts } from '../../theme';
import { Ic } from '../../ui/Ic';

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

const ADVICE: Record<Mode, string> = {
  walk: 'Близко — пешком быстрее всего',
  car: 'Быстрее на машине, но оставь 5–10 минут на парковку и дорогу пешком до входа',
  bus: 'Удобнее автобус: часть пути пешком, часть — на остановке',
};

export default function RouteScreen() {
  const insets = useSafeAreaInsets();
  const { id, mode: m0 } = useLocalSearchParams<{ id: string; mode?: Mode }>();
  const [mode, setMode] = useState<Mode>(m0 === 'car' || m0 === 'bus' ? m0 : 'walk');
  const [follow, setFollow] = useState(false);
  const [origin, setOrigin] = useState<{ lat: number; lon: number } | null>(null);
  const [size, setSize] = useState({ h: 0, sheet: 0 });
  const mapRef = useRef<MapCanvasHandle>(null);
  const fix = useMyFix((s) => s.fix);
  const pos = useMyPos();
  const heading = useHeading();
  const bearing = useSharedValue(0);
  const meetups = usePlans((s) => s.meetups);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  useBackClose(back);
  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: () => data.getEvents(), placeholderData: eventsSnapshot });
  const known = [...meetups, ...events].find((x) => x.id === id);
  const detail = useQuery({ queryKey: ['event', id], queryFn: () => getEventsByIds([id]), enabled: config.dataMode !== 'demo' && !known, retry: 1 });
  const e = known ?? detail.data?.[0];

  // «В путь»: камера за мной. Маршрут считаем один раз от точки старта, а не заново на каждом шаге.
  useEffect(() => {
    if (!follow || !fix) return;
    mapRef.current?.navigateTo(fix.lat, fix.lon, fix.heading ?? heading.get());
  }, [follow, fix, heading]);

  const me = follow && fix ? fix : pos;
  const trip = useTrip(e ?? ({ id: '', lat: 0, lon: 0, needsPin: true } as never), e ? (origin ?? pos) : null);
  const lines = useMemo(() => {
    if (!e || !me) return [];
    const to: [number, number] = [e.lon, e.lat];
    const from: [number, number] = [me.lon, me.lat];
    if (mode === 'car') return [{ id: 'car', coords: trip.route?.car?.line ?? [], color: trip.route?.car?.delayMin ? '#C83A26' : '#2F8F5B', width: 6 }];
    if (mode === 'walk') return [{ id: 'walk', coords: trip.route?.walk?.line ?? [], color: colors.ink, width: 4, dash: true }];
    if (!trip.bus) return [];
    const p = trip.bus.path;
    return [
      { id: 'w1', coords: [from, p[0]], color: '#8C8577', width: 3, dash: true },
      { id: 'bus', coords: p, color: colors.friend, width: 6 },
      { id: 'w2', coords: [p[p.length - 1], to], color: '#8C8577', width: 3, dash: true },
    ];
  }, [e, me, mode, trip.route, trip.bus]);

  const leg = mode === 'car' ? trip.route?.car : trip.route?.walk;
  const progress = follow && me && leg?.line ? routeProgress(me, leg.line) : null;
  const instruction = follow && me ? closestInstruction(me, leg?.instructions ?? [], leg?.line ?? []) : null;

  if (!e) return <View style={[styles.root, { justifyContent: 'center', alignItems: 'center', gap: 20 }]}><Text>{config.dataMode !== 'demo' && detail.isPending ? 'Загружаю событие…' : 'Маршрут недоступен'}</Text><Pressable onPress={back} accessibilityRole="button"><Text>Вернуться</Text></Pressable></View>;

  const markers: MapMarker[] = [
    { id: 'to', lat: e.lat, lon: e.lon, z: 20, node: <View style={[styles.dest, { backgroundColor: CAT_COLOR[e.category] }]}><Ic d={CAT_ICON[e.category]} size={18} color={catFg(e.category)} w={2} /></View> },
    // На телефоне моя точка — слои карты (prop me); маркер нужен только в web.
    ...(me && Platform.OS === 'web' ? [{ id: 'me', lat: me.lat, lon: me.lon, z: 30, node: <MeDot heading={heading} bearing={bearing} /> }] : []),
    ...(mode === 'bus' && trip.bus ? trip.bus.path.map(([lon, lat], i) => ({ id: `s${i}`, lat, lon, z: 10, node: <View style={styles.stop} /> })) : []),
  ];
  const cam = me ? { lat: (me.lat + e.lat) / 2 - 0.004, lon: (me.lon + e.lon) / 2, zoom: Math.max(9, Math.min(15, Math.log2(360 / (Math.max(Math.abs(e.lon - me.lon), Math.abs(e.lat - me.lat) * 1.8, 0.005) * 2.6)))) } : { lat: e.lat, lon: e.lon, zoom: 14 };

  const busMin = trip.bus ? trip.bus.total : null;
  const best = bestMode(trip.walkMin, trip.carMin, busMin);
  const tiles: { m: Mode; Icon: LucideIcon; min: number | null; km: string | null; label: string }[] = [
    { m: 'walk', Icon: Footprints, min: trip.walkMin, km: trip.route?.walk ? km1(trip.route.walk.km) : null, label: 'Пешком' },
    { m: 'car', Icon: Car, min: trip.carMin, km: trip.route?.car ? km1(trip.route.car.km) : null, label: 'Машина' },
    ...(trip.bus ? [{ m: 'bus' as const, Icon: Bus, min: busMin, km: null, label: `Автобус ${trip.bus.ref}` }] : []),
  ];
  const canNavigate = !!me && !e.needsPin && !e.noPoint && (mode === 'bus' ? !!trip.bus : (leg?.line?.length ?? 0) >= 2);
  const to = e.venueName ?? e.address.split(',')[0];

  // Остаток пути по маршруту: пропорционально пройденному.
  const total = leg ? leg.km * 1000 : 0;
  const left = progress && total ? Math.max(0, total - progress.metres) : null;
  const leftMin = left != null && leg ? Math.max(1, Math.round((leg.min * left) / total)) : null;
  const arrive = leftMin != null ? hm(new Date(clockNow().getTime() + leftMin * 60000).toISOString()) : null;
  const toTurn = instruction && progress ? Math.max(0, instruction.distance - progress.metres) : null;
  const arrived = left != null && left < 30;
  const speed = fix?.speed != null && fix.speed >= 0 ? Math.round(fix.speed * 3.6) : null;

  const steps: { icon: React.ReactNode; title: string; sub: string; blue?: boolean }[] = mode === 'bus' && trip.bus ? [
    { icon: <Footprints size={16} color={colors.ink} strokeWidth={2} />, title: `${trip.bus.walkTo} мин пешком`, sub: `до остановки «${trip.bus.board.name}»` },
    { blue: true, icon: <Text style={styles.busRef}>{trip.bus.ref}</Text>, title: `Автобус ${trip.bus.ref} · ~${trip.bus.wait} мин ждать`, sub: `${trip.bus.stopsCount} остановок · примерно, без расписания` },
    { icon: <Footprints size={16} color={colors.ink} strokeWidth={2} />, title: `${trip.bus.walkFrom} мин пешком`, sub: `до ${to}` },
  ] : mode === 'car' ? [
    { icon: <Car size={16} color={colors.ink} strokeWidth={2} />, title: trip.route?.car ? `${km1(trip.route.car.km)} км · ${trip.route.car.min} мин` : trip.loading || !me ? 'Считаю маршрут…' : 'Примерно, без учёта пробок', sub: trip.route?.car?.delayMin ? `Пробки +${trip.route.car.delayMin} мин` : trip.route?.car ? 'Дороги свободны' : trip.loading || !me ? 'С учётом пробок' : 'Нет связи с сервисом пробок' },
    { icon: <Footprints size={16} color={colors.ink} strokeWidth={2} />, title: '+5–10 мин на парковку', sub: `и пешком до ${to}` },
  ] : [
    { icon: <Footprints size={16} color={colors.ink} strokeWidth={2} />, title: trip.route?.walk ? `${km1(trip.route.walk.km)} км · ${trip.route.walk.min} мин` : trip.walkMin != null && !trip.loading ? `~${trip.walkMin} мин по прямой` : me ? 'Считаю маршрут…' : 'Где ты? Включи геолокацию', sub: trip.route?.walk ? 'Пешком по улицам' : 'Примерно' },
  ];

  const start = () => {
    if (follow) { setFollow(false); setOrigin(null); return; }
    if (me) { setOrigin(pos); mapRef.current?.navigateTo(me.lat, me.lon, heading.get()); }
    setFollow(true);
  };
  const ModeIcon = mode === 'car' ? Car : mode === 'bus' ? Bus : Footprints;
  const headTop = Math.max(14, insets.top + 6);
  // Кнопки карты стоят над нижней панелью; сверху не заходят под карточку адреса / инструкцию.
  const controlsTop = Math.max(headTop + 84, size.h - size.sheet - 218);

  return (
    <View style={styles.root} onLayout={(ev) => setSize((s) => ({ ...s, h: ev.nativeEvent.layout.height }))}>
      <MapCanvas ref={mapRef} theme="paper" onBearing={(d) => bearing.set(d)} camera={cam} markers={markers} lines={lines} showUser={!!fix}
        me={me} meHeading={heading} bottomInset={size.sheet + 8} topInset={headTop + 80} />

      {!follow ? (
        <View style={[styles.top, { top: headTop }]}>
          <Pressable onPress={back} style={styles.back} accessibilityRole="button" accessibilityLabel="Назад"><ChevronLeft size={24} color={colors.ink} strokeWidth={2} /></Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.topSub} numberOfLines={1}>до {to}{e.address ? ` · ${e.address.split(',').slice(0, 2).join(',')}` : ''}</Text>
            <Text style={styles.topTitle} numberOfLines={1}>{e.title} · {hm(e.startsAt)}</Text>
          </View>
        </View>
      ) : (
        <View style={[styles.nav, { top: headTop }]} accessibilityLiveRegion="polite">
          {mode === 'bus' ? (
            <>
              <View style={styles.navIcon}><Bus size={30} color={colors.paper} strokeWidth={2} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.navMsg} numberOfLines={2}>{trip.bus ? `Автобус ${trip.bus.ref}` : 'Автобус'}</Text>
                <Text style={styles.navSub} numberOfLines={2}>{trip.bus ? `Дойди до остановки «${trip.bus.board.name}»` : 'Маршрут недоступен'}</Text>
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
        <View style={[styles.speed, { bottom: size.sheet + 14 }]} accessibilityLabel={`Скорость ${speed} километров в час`}>
          <Text style={styles.speedN}>{speed}</Text>
          <Text style={styles.speedU}>км/ч</Text>
        </View>
      )}

      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]} onLayout={(ev) => setSize((s) => ({ ...s, sheet: ev.nativeEvent.layout.height }))}>
        {follow ? (
          <View style={styles.navBar}>
            <View style={styles.navStat}>
              <View style={styles.modeDot}><ModeIcon size={18} color={colors.ink} strokeWidth={2} /></View>
              <View>
                <Text style={styles.navMin}>{leftMin != null ? `${leftMin} мин` : mode === 'bus' && trip.bus ? `${trip.bus.total} мин` : '…'}</Text>
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
            {best && <Text style={styles.advice}>{ADVICE[best]}</Text>}
            <View style={{ gap: 10 }}>
              {steps.map((s, i) => (
                <View key={i} style={styles.step}>
                  <View style={[styles.stepIcon, s.blue && { backgroundColor: colors.friend }]}>{s.icon}</View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stepTitle}>{s.title}</Text>
                    <Text style={styles.stepSub}>{s.sub}</Text>
                  </View>
                </View>
              ))}
            </View>
            {mode === 'bus' && <Text style={styles.osm}>Остановки © участники OpenStreetMap</Text>}
            <Pressable disabled={!canNavigate} onPress={start} style={[styles.go, !canNavigate && { opacity: 0.5 }]} accessibilityRole="button">
              <Text style={styles.goText}>{canNavigate ? (mode === 'car' ? 'Поехали' : 'В путь') : trip.loading ? 'Строю маршрут…' : 'Маршрут недоступен'}</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#DDD8CB' },
  top: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, paddingRight: 16, borderRadius: 24, backgroundColor: '#EEE9DE', shadowColor: colors.ink, shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  topSub: { fontFamily: fonts.body500, fontSize: 12.5, color: colors.muted2 },
  topTitle: { fontFamily: fonts.display700, fontSize: 17, color: colors.ink },
  nav: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 24, backgroundColor: colors.ink, shadowColor: colors.ink, shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  navIcon: { width: 58, height: 58, borderRadius: 18, backgroundColor: '#2A292E', alignItems: 'center', justifyContent: 'center' },
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
  speed: { position: 'absolute', left: 14, width: 64, height: 64, borderRadius: 32, backgroundColor: '#EEE9DE', borderWidth: 3, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', shadowColor: colors.ink, shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  speedN: { fontFamily: fonts.display800, fontSize: 22, lineHeight: 24, color: colors.ink },
  speedU: { fontFamily: fonts.mono600, fontSize: 9, color: colors.muted2 },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#EEE9DE', padding: 16, gap: 12, shadowColor: colors.ink, shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: -4 }, elevation: 10 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, minHeight: 78, borderRadius: 16, backgroundColor: '#D9D3C5', alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 8, paddingHorizontal: 4 },
  tileOn: { backgroundColor: colors.ink },
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
  go: { height: 54, borderRadius: 16, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  goText: { fontFamily: fonts.body700, fontSize: 16.5, color: colors.paper },
  dest: { width: 36, height: 36, borderRadius: 12, borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  stop: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: colors.friend },
});
