// Сначала место на карте; маршрут рассчитывается после выбора способа передвижения.
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Bus, Car, ChevronLeft, Footprints, MapPin, Navigation } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { data, eventsSnapshot } from '../../data';
import { useTrip } from '../../event/v6/WhereSheet';
import { config } from '../../lib/config';
import { getEventsByIds } from '../../live/api';
import { useMyPos } from '../../live/location';
import { MapCanvas } from '../../map/MapCanvas';
import { useBackClose } from '../../state/app';
import { usePlans } from '../../state/plans';
import { colors, fonts } from '../../theme';

type Mode = 'walk' | 'car' | 'bus';
export default function RouteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode | null>(null);
  const [error, setError] = useState('');
  const me = useMyPos();
  const meetups = usePlans(s => s.meetups);
  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: () => data.getEvents(), placeholderData: eventsSnapshot });
  const known = [...meetups, ...events].find(e => e.id === id);
  const detail = useQuery({ queryKey: ['event', id], queryFn: () => getEventsByIds([id]), enabled: config.dataMode !== 'demo' && !known });
  const e = known ?? detail.data?.[0];
  const back = () => router.canGoBack() ? router.back() : router.replace('/');
  useBackClose(back);
  const trip = useTrip(e ?? ({ id: '', lat: 0, lon: 0, needsPin: true } as never), mode ? me : null, mode ?? 'walk');
  const camera = useMemo(() => ({ lat: e?.noPoint ? 43.2579 : e?.lat ?? 43.2579, lon: e?.noPoint ? 76.9458 : e?.lon ?? 76.9458, zoom: e?.needsPin ? 13 : 15 }), [e?.lat, e?.lon, e?.needsPin, e?.noPoint]);
  const leg = mode === 'car' ? trip.route?.car : mode === 'walk' ? trip.route?.walk : null;
  const line = mode === 'bus' ? trip.bus?.path : leg?.line;
  const markers = useMemo(() => e && !e.noPoint ? [{ id: 'destination', lat: e.lat, lon: e.lon, node: <View style={styles.pin}><MapPin size={24} color={colors.paper} /></View> }] : [], [e]);
  const openNavigation = async () => {
    if (!e) return;
    const profile = mode === 'walk' ? 'walking' : mode === 'bus' ? 'transit' : 'driving';
    const url = `https://www.google.com/maps/dir/?api=1&destination=${e.lat},${e.lon}&travelmode=${profile}${me ? `&origin=${me.lat},${me.lon}` : ''}`;
    try { await Linking.openURL(url); } catch { setError('Не получилось открыть навигацию. Попробуй ещё раз'); }
  };
  if (!e) return <View style={[styles.root, styles.empty]}><Text>{detail.isPending ? 'Загружаю место…' : 'Место недоступно'}</Text><Pressable style={styles.button} onPress={back}><Text style={styles.white}>Вернуться</Text></Pressable></View>;
  return <View style={styles.root}>
    <MapCanvas theme="paper" camera={camera} markers={markers} me={me} bottomInset={mode ? 270 : 200} lines={line && line.length >= 2 ? [{ id: 'route', coords: line, color: colors.friend, width: 5 }] : []} />
    <View style={[styles.header, { top: insets.top + 8 }]}>
      <Pressable style={styles.back} onPress={back} accessibilityLabel="Назад"><ChevronLeft size={24} color={colors.ink} /></Pressable>
      <View style={{ flex: 1 }}><Text style={styles.title} numberOfLines={2}>{e.venueName ?? e.title}</Text><Text style={styles.sub}>{e.address || 'Адрес уточняется'}</Text></View>
    </View>
    <View style={[styles.sheet, { paddingBottom: insets.bottom + 18 }]}>
      <Text style={styles.title}>{e.needsPin ? 'Примерное место' : 'Как добраться'}</Text>
      {e.needsPin && <Text style={styles.sub}>Точка ещё уточняется. Перед поездкой проверь адрес у организатора.</Text>}
      <View style={styles.modes}>{([{ key: 'walk', label: 'Пешком', Icon: Footprints }, { key: 'car', label: 'Машина', Icon: Car }, { key: 'bus', label: 'Автобус', Icon: Bus }] as const).map(x => <Pressable key={x.key} onPress={() => setMode(x.key)} style={[styles.mode, mode === x.key && styles.on]} accessibilityRole="tab" accessibilityState={{ selected: mode === x.key }}><x.Icon size={22} color={mode === x.key ? colors.paper : colors.ink} /><Text style={[styles.modeText, mode === x.key && styles.white]}>{x.label}</Text></Pressable>)}</View>
      {mode && <>
        <Text style={styles.sub}>{!me ? 'Включи геолокацию для расчёта от твоего места' : trip.loading ? 'Считаю маршрут…' : mode === 'bus' ? trip.bus ? `Автобус ${trip.bus.ref} · ~${trip.bus.total} мин · без расписания` : 'Подходящий автобус не найден. Можно посмотреть варианты в навигации' : `${trip.rough ? 'Примерно ' : ''}${mode === 'walk' ? trip.walkMin : trip.carMin} мин${leg ? ` · ${leg.km.toFixed(1)} км` : ''}`}</Text>
        <Pressable disabled={!!e.needsPin || !!e.noPoint} style={[styles.button, (e.needsPin || e.noPoint) && { opacity: 0.4 }]} onPress={() => void openNavigation()}><Navigation size={18} color={colors.paper} /><Text style={styles.white}>Открыть навигацию</Text></Pressable>
      </>}
      {!!error && <Text style={styles.sub}>{error}</Text>}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper }, empty: { alignItems: 'center', justifyContent: 'center', gap: 16 },
  header: { position: 'absolute', left: 12, right: 12, borderRadius: 24, backgroundColor: colors.paper, padding: 12, gap: 10, flexDirection: 'row', alignItems: 'center' },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 18, gap: 12, backgroundColor: colors.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  title: { fontFamily: fonts.display700, fontSize: 18, color: colors.ink }, sub: { fontFamily: fonts.body400, fontSize: 13, lineHeight: 19, color: colors.muted2 },
  modes: { flexDirection: 'row', gap: 8 }, mode: { flex: 1, minHeight: 70, borderRadius: 18, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', gap: 6 },
  modeText: { fontFamily: fonts.body600, fontSize: 13, color: colors.ink }, on: { backgroundColor: colors.ink },
  button: { minHeight: 50, borderRadius: 17, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 18 },
  white: { color: colors.paper, fontFamily: fonts.body600, fontSize: 14 }, pin: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.paper },
});
