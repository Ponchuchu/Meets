// «Где строить маршрут» — design/png/V6CardOpenWhere.png (V6.md §4.4): маршрут здесь (пешком / машина / автобус),
// «В 2ГИС», «В Яндекс», «Скопировать адрес». Последний выбор запоминаем и ставим первым.
import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Copy, MapPin } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { InteractionManager, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { EventItem } from '../../data/types';
import { getRoute } from '../../live/api';
import { distM } from '../../live/geo';
import { kmText } from '../../map/ui/EventSheet';
import { busFor, transitFor } from '../../transit/almaty';
import type { TransitOption } from '../../transit/router';
import { colors, fonts } from '../../theme';

export function useTrip(e: EventItem, me: { lat: number; lon: number } | null, mode: 'walk' | 'car' | 'bus' = 'walk') {
  // Место «примерно» (needsPin) — точного маршрута не строим, только оценка по прямой.
  const enabled = mode !== 'bus' && !!me && !e.needsPin && !e.noPoint;
  const q = useQuery({ queryKey: ['route', e.id, me ? `${me.lat.toFixed(3)},${me.lon.toFixed(3)}` : ''], queryFn: () => getRoute(me!, e), enabled, staleTime: 10 * 60e3, retry: 0, placeholderData:(previous,query)=>query?.queryKey[1]===e.id?previous:undefined });
  const loading = enabled && q.isPending;
  const bus = useMemo(() => mode === 'bus' && me && !e.needsPin && !e.noPoint ? busFor(me, e, new Date()) : null, [e, me?.lat, me?.lon, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  // Автобусы и метро с пересадками — считаем всегда (раньше только в режиме «автобус», которого экран не передавал).
  const meKey = me ? `${me.lat.toFixed(3)},${me.lon.toFixed(3)}` : '';
  // Расчёт ~0,3 с — после анимации перехода, чтобы экран не подтормаживал.
  const [transit, setTransit] = useState<TransitOption[]>([]);
  useEffect(() => {
    if (!me || e.noPoint) return;
    const task = InteractionManager.runAfterInteractions(() => { setTransit(transitFor(me, e, new Date())); });
    return () => task.cancel();
  }, [e.id, e.lat, e.lon, meKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // Без сети или без ответа — по прямой × 1,3, с пометкой «примерно».
  const straight = me ? distM(me, e) * 1.3 : 0;
  const walkMin = q.data?.walk?.min ?? (me && !e.noPoint && !loading ? Math.round(straight / 75) : null);
  const carMin = q.data?.car?.min ?? (me && !e.noPoint && !loading ? Math.max(3, Math.round(straight / 400)) : null);
  return { route: q.data ?? null, bus, transit, walkMin, carMin, rough: !q.data && !loading, loading };
}

type Point = { lat: number; lon: number };
/** Запасной путь: свой навигатор недоступен — открываем привычное приложение, а без него сайт. */
const OUTSIDE = [
  { name: '2ГИС', letter: '2', color: '#2FA84F', app: (p: Point) => `dgis://2gis.ru/routeSearch/rsType/car/to/${p.lon},${p.lat}`, web: (p: Point) => `https://2gis.kz/almaty/directions/points/%7C${p.lon}%2C${p.lat}` },
  { name: 'Яндекс', letter: 'Я', color: '#E5372B', app: (p: Point) => `yandexmaps://maps.yandex.ru/?rtext=~${p.lat},${p.lon}&rtt=auto`, web: (p: Point) => `https://yandex.kz/maps/?rtext=~${p.lat},${p.lon}&rtt=auto` },
];

export function WhereSheet({ e, me, onCopied }: { e: EventItem; me: { lat: number; lon: number } | null; onCopied: () => void }) {
  return (
    <View style={{ gap: 12 }}>
      <View>
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>{e.venueName ?? e.title}</Text>
        <Text style={styles.sub}>{[e.address, me && !e.needsPin ? `${kmText(distM(me, e))} от тебя` : null].filter(Boolean).join(' · ')}</Text>
      </View>
      <Pressable onPress={() => router.push({ pathname: '/route', params: { id: e.id } })} style={styles.here} accessibilityRole="button" accessibilityLabel="Показать место на карте">
        <View style={styles.hereHead}><MapPin size={20} color={colors.accent} /><Text style={styles.hereTitle}>Показать на карте</Text></View>
        <Text style={styles.hereSub}>Сначала место, затем пешком, на машине или автобусе</Text>
      </Pressable>
      {!e.noPoint && (
        <View style={styles.apps}>
          {OUTSIDE.map(a => (
            <Pressable key={a.name} onPress={() => { void Linking.openURL(a.app(e)).catch(() => Linking.openURL(a.web(e)).catch(() => undefined)); }} style={styles.app} accessibilityRole="button" accessibilityLabel={`Маршрут в ${a.name}`}>
              <View style={[styles.mark, { backgroundColor: a.color }]}><Text style={styles.markText}>{a.letter}</Text></View>
              <Text style={styles.appText}>{a.name}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <Pressable onPress={() => { void Clipboard.setStringAsync(e.address || e.title).then(onCopied); }} style={styles.copy} accessibilityRole="button">
        <Copy size={17} color={colors.muted2} strokeWidth={1.9} />
        <Text style={styles.copyText}>Скопировать адрес</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display800, fontSize: 23, letterSpacing: -0.6, color: colors.ink },
  sub: { fontFamily: fonts.body400, fontSize: 14, color: colors.muted2 },
  here: { borderRadius: 20, backgroundColor: colors.ink, padding: 14, gap: 12 },
  hereHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hereTitle: { fontFamily: fonts.body700, fontSize: 16, color: '#EEE9DE' },
  hereSub: { fontFamily: fonts.body400, fontSize: 14, color: '#BDB8AD' },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, height: 50, borderRadius: 13, backgroundColor: '#2A292E', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  tileText: { fontFamily: fonts.body700, fontSize: 15.5, color: '#EEE9DE' },
  apps: { flexDirection: 'row', gap: 8 },
  app: { flex: 1, height: 54, borderRadius: 16, backgroundColor: '#D9D3C5', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  mark: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  markText: { fontFamily: fonts.display800, fontSize: 13, color: '#FFFFFF' },
  appText: { fontFamily: fonts.body700, fontSize: 15.5, color: colors.ink },
  copy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44 },
  copyText: { fontFamily: fonts.body700, fontSize: 15, color: colors.muted2 },
});
