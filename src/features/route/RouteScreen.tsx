// Маршрут в приложении — design/png/V6Route.png, V6RouteCar, V6RouteWalk (V6.md §4.5).
// Сверху «до места · адрес», «Событие · 20:00», снизу — три способа, шаги, «Поехали» и «В 2ГИС».
// Машина и пешком — функция route (TomTom с пробками), автобус — свой расчёт по остановкам OpenStreetMap.
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Bus, Car, ChevronLeft, Footprints } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { data, eventsSnapshot } from '../../data';
import { openDgis, useTrip } from '../../event/v6/WhereSheet';
import { almaty } from '../../lib/clock';
import { useMyFix, useMyPos } from '../../live/location';
import { MapCanvas } from '../../map/MapCanvas';
import { autoTheme } from '../../map/style';
import type { MapCanvasHandle, MapMarker } from '../../map/types';
import { colors, fonts } from '../../theme';
import { useBackClose } from '../../state/app';
import { Ic } from '../../ui/Ic';
import { CAT_COLOR, CAT_ICON, catFg } from '../../map/icons';

type Mode = 'walk' | 'car' | 'bus';
const hm = (iso: string) => { const d = almaty(iso); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };

export default function RouteScreen() {
  const insets = useSafeAreaInsets();
  const { id, mode: m0 } = useLocalSearchParams<{ id: string; mode?: Mode }>();
  const [mode, setMode] = useState<Mode>(m0 === 'car' || m0 === 'bus' ? m0 : 'walk');
  const [follow, setFollow] = useState(false);
  const mapRef = useRef<MapCanvasHandle>(null);
  const fix = useMyFix((s) => s.fix);
  const pos = useMyPos();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  useBackClose(back);
  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: () => data.getEvents(), placeholderData: eventsSnapshot });
  const e = events.find((x) => x.id === id);

  // «Поехали»: камера за мной, время пересчитывается раз в 30 с.
  useEffect(() => {
    if (!follow || !fix) return;
    mapRef.current?.flyTo(fix.lat, fix.lon, 16);
  }, [follow, fix]);

  const me = follow && fix ? fix : pos;
  const trip = useTrip(e ?? ({ id: '', lat: 0, lon: 0, needsPin: true } as never), e ? me : null);
  const lines = useMemo(() => {
    if (!e || !me) return [];
    const to: [number, number] = [e.lon, e.lat];
    const from: [number, number] = [me.lon, me.lat];
    if (mode === 'car') return [{ id: 'car', coords: trip.route?.car?.line ?? [from, to], color: trip.route?.car?.delayMin ? '#C83A26' : '#2F8F5B', width: 6 }];
    if (mode === 'walk') return [{ id: 'walk', coords: trip.route?.walk?.line ?? [from, to], color: colors.ink, width: 4, dash: true }];
    if (!trip.bus) return [];
    const p = trip.bus.path;
    return [
      { id: 'w1', coords: [from, p[0]], color: '#8C8577', width: 3, dash: true },
      { id: 'bus', coords: p, color: colors.friend, width: 6 },
      { id: 'w2', coords: [p[p.length - 1], to], color: '#8C8577', width: 3, dash: true },
    ];
  }, [e, me, mode, trip.route, trip.bus]);

  if (!e) return <View style={styles.root} />;
  const markers: MapMarker[] = [
    { id: 'to', lat: e.lat, lon: e.lon, z: 20, node: <View style={[styles.dest, { backgroundColor: CAT_COLOR[e.category] }]}><Ic d={CAT_ICON[e.category]} size={18} color={catFg(e.category)} w={2} /></View> },
    ...(me ? [{ id: 'me', lat: me.lat, lon: me.lon, z: 30, node: <View style={styles.me} /> }] : []),
    ...(mode === 'bus' && trip.bus ? trip.bus.path.map(([lon, lat], i) => ({ id: `s${i}`, lat, lon, z: 10, node: <View style={styles.stop} /> })) : []),
  ];
  const cam = me ? { lat: (me.lat + e.lat) / 2 - 0.004, lon: (me.lon + e.lon) / 2, zoom: 13 } : { lat: e.lat, lon: e.lon, zoom: 14 };
  const tiles: { m: Mode; Icon: typeof Bus; min: number | null }[] = [
    { m: 'walk', Icon: Footprints, min: trip.walkMin },
    { m: 'car', Icon: Car, min: trip.carMin },
    ...(trip.bus ? [{ m: 'bus' as const, Icon: Bus, min: trip.bus.total }] : []),
  ];
  const to = e.venueName ?? e.address.split(',')[0];
  const steps: { icon: React.ReactNode; title: string; sub: string; blue?: boolean }[] = mode === 'bus' && trip.bus ? [
    { icon: <Footprints size={16} color={colors.ink} strokeWidth={2} />, title: `${trip.bus.walkTo} мин пешком`, sub: `до остановки «${trip.bus.board.name}»` },
    { blue: true, icon: <Text style={styles.busRef}>{trip.bus.ref}</Text>, title: `Автобус ${trip.bus.ref} · ~${trip.bus.wait} мин ждать`, sub: `${trip.bus.stopsCount} остановок · примерно, без расписания` },
    { icon: <Footprints size={16} color={colors.ink} strokeWidth={2} />, title: `${trip.bus.walkFrom} мин пешком`, sub: `до ${to}` },
  ] : mode === 'car' ? [
    { icon: <Car size={16} color={colors.ink} strokeWidth={2} />, title: trip.route?.car ? `${trip.route.car.km.toString().replace('.', ',')} км · ${trip.route.car.min} мин` : trip.loading || !me ? 'Считаю маршрут…' : 'Примерно, без учёта пробок', sub: trip.route?.car?.delayMin ? `Пробки +${trip.route.car.delayMin} мин` : trip.route?.car ? 'Дороги свободны' : trip.loading || !me ? 'С учётом пробок' : 'Нет связи с сервисом пробок' },
  ] : [
    { icon: <Footprints size={16} color={colors.ink} strokeWidth={2} />, title: trip.route?.walk ? `${trip.route.walk.km.toString().replace('.', ',')} км · ${trip.route.walk.min} мин` : trip.walkMin != null && !trip.loading ? `~${trip.walkMin} мин по прямой` : me ? 'Считаю маршрут…' : 'Где ты? Включи геолокацию', sub: trip.route?.walk ? 'Пешком по улицам' : 'Примерно' },
  ];

  return (
    <View style={styles.root}>
      <MapCanvas ref={mapRef} theme={autoTheme(almaty(new Date()).getUTCHours())} camera={cam} markers={markers} lines={lines} showUser={!!fix} bottomInset={330} topInset={insets.top + 100} />
      <View style={[styles.top, { top: Math.max(14, insets.top + 6) }]}>
        <Pressable onPress={back} style={styles.back} accessibilityRole="button" accessibilityLabel="Назад"><ChevronLeft size={24} color={colors.ink} strokeWidth={2} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.topSub} numberOfLines={1}>до {to}{e.address ? ` · ${e.address.split(',').slice(0, 2).join(',')}` : ''}</Text>
          <Text style={styles.topTitle} numberOfLines={1}>{e.title} · {hm(e.startsAt)}</Text>
        </View>
      </View>
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 18 }]}>
        <View style={styles.tiles}>
          {tiles.map(({ m, Icon, min }) => (
            <Pressable key={m} onPress={() => setMode(m)} style={[styles.tile, mode === m && styles.tileOn]} accessibilityRole="tab" accessibilityState={{ selected: mode === m }}>
              <Icon size={18} color={mode === m ? '#FBFAF6' : colors.ink} strokeWidth={1.9} />
              <Text style={[styles.tileText, mode === m && { color: '#FBFAF6' }]}>{min != null ? `${min} мин` : '…'}</Text>
            </Pressable>
          ))}
        </View>
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
        <View style={styles.btns}>
          <Pressable onPress={() => setFollow(!follow)} style={[styles.go, follow && { backgroundColor: colors.accent }]} accessibilityRole="button">
            <Text style={[styles.goText, follow && { color: colors.ink }]}>{follow ? 'Едем · стоп' : 'Поехали'}</Text>
          </Pressable>
          <Pressable onPress={() => openDgis(e)} style={styles.dgis} accessibilityRole="button"><Text style={styles.dgisText}>В 2ГИС</Text></Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#EFEBE2' },
  top: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, paddingRight: 16, borderRadius: 24, backgroundColor: '#FBFAF6', shadowColor: colors.ink, shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  topSub: { fontFamily: fonts.body500, fontSize: 12.5, color: colors.muted2 },
  topTitle: { fontFamily: fonts.display700, fontSize: 17, color: colors.ink },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#FBFAF6', padding: 16, gap: 14 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, height: 60, borderRadius: 16, backgroundColor: '#ECE7DC', alignItems: 'center', justifyContent: 'center', gap: 3 },
  tileOn: { backgroundColor: colors.ink },
  tileText: { fontFamily: fonts.body700, fontSize: 16, color: colors.ink },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: '#ECE7DC', alignItems: 'center', justifyContent: 'center' },
  busRef: { fontFamily: fonts.mono600, fontSize: 12, color: '#FFFFFF' },
  stepTitle: { fontFamily: fonts.display700, fontSize: 15.5, color: colors.ink },
  stepSub: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted2 },
  osm: { fontFamily: fonts.body400, fontSize: 11, color: colors.muted },
  btns: { flexDirection: 'row', gap: 8 },
  go: { flex: 1, height: 54, borderRadius: 16, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  goText: { fontFamily: fonts.body700, fontSize: 16.5, color: colors.paper },
  dgis: { height: 54, paddingHorizontal: 18, borderRadius: 16, backgroundColor: '#ECE7DC', alignItems: 'center', justifyContent: 'center' },
  dgisText: { fontFamily: fonts.body700, fontSize: 15, color: colors.ink },
  dest: { width: 36, height: 36, borderRadius: 12, borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  me: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.accent, borderWidth: 4, borderColor: '#FFFFFF' },
  stop: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: colors.friend },
});
