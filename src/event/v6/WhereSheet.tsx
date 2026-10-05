// «Где строить маршрут» — design/png/V6CardOpenWhere.png (V6.md §4.4): маршрут здесь (пешком / машина / автобус),
// «В 2ГИС», «В Яндекс», «Скопировать адрес». Последний выбор запоминаем и ставим первым.
import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Bus, Car, Copy, Footprints, Navigation } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { EventItem } from '../../data/types';
import { getRoute } from '../../live/api';
import { distM } from '../../live/geo';
import { kmText } from '../../map/ui/EventSheet';
import { busFor } from '../../transit/almaty';
import { colors, fonts } from '../../theme';

let lastPick: 'dgis' | 'yandex' | null = null;

export function openDgis(e: Pick<EventItem, 'lat' | 'lon'>) {
  lastPick = 'dgis';
  Linking.openURL(`dgis://2gis.ru/routeSearch/rsType/car/to/${e.lon},${e.lat}`).catch(() => Linking.openURL(`https://2gis.kz/almaty/directions/points/%7C${e.lon}%2C${e.lat}`).catch(() => undefined));
}
export function openYandex(e: Pick<EventItem, 'lat' | 'lon'>) {
  lastPick = 'yandex';
  Linking.openURL(`yandexmaps://maps.yandex.ru/?rtext=~${e.lat},${e.lon}`).catch(() => Linking.openURL(`https://yandex.kz/maps/?rtext=~${e.lat},${e.lon}`).catch(() => undefined));
}

export function useTrip(e: EventItem, me: { lat: number; lon: number } | null) {
  // Место «примерно» (needsPin) — точного маршрута не строим, только оценка по прямой.
  const enabled = !!me && !e.needsPin;
  const q = useQuery({ queryKey: ['route', e.id, me ? `${me.lat.toFixed(3)},${me.lon.toFixed(3)}` : ''], queryFn: () => getRoute(me!, e), enabled, staleTime: 10 * 60e3, retry: 0 });
  const loading = enabled && q.isPending;
  const bus = me ? busFor(me, e, new Date()) : null;
  // Без сети или без ответа — по прямой × 1,3, с пометкой «примерно».
  const straight = me ? distM(me, e) * 1.3 : 0;
  const walkMin = q.data?.walk?.min ?? (me && !loading ? Math.round(straight / 75) : null);
  const carMin = q.data?.car?.min ?? (me && !loading ? Math.max(3, Math.round(straight / 400)) : null);
  return { route: q.data ?? null, bus, walkMin, carMin, rough: !q.data && !loading, loading };
}

export function WhereSheet({ e, me, onCopied }: { e: EventItem; me: { lat: number; lon: number } | null; onCopied: () => void }) {
  const [, force] = useState(0);
  const t = useTrip(e, me);
  const go = (mode: 'walk' | 'car' | 'bus') => router.push({ pathname: '/route', params: { id: e.id, mode } });
  const tiles = [
    { mode: 'walk' as const, Icon: Footprints, min: t.walkMin, label: 'Пешком' },
    { mode: 'car' as const, Icon: Car, min: t.carMin, label: 'На машине' },
    ...(t.bus ? [{ mode: 'bus' as const, Icon: Bus, min: t.bus.total, label: `Автобус ${t.bus.ref}` }] : []),
  ];
  const apps = [
    { k: 'dgis' as const, label: 'В 2ГИС', mark: '2', bg: '#2F8F5B', on: () => { openDgis(e); force((x) => x + 1); } },
    { k: 'yandex' as const, label: 'В Яндекс', mark: 'Я', bg: '#D23C2A', on: () => { openYandex(e); force((x) => x + 1); } },
  ].sort((a, b) => (a.k === lastPick ? -1 : b.k === lastPick ? 1 : 0));
  return (
    <View style={{ gap: 12 }}>
      <View>
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>{e.venueName ?? e.title}</Text>
        <Text style={styles.sub}>{[e.address, me && !e.needsPin ? `${kmText(distM(me, e))} от тебя` : null].filter(Boolean).join(' · ')}</Text>
      </View>
      {!e.needsPin && (
        <View style={styles.here}>
          <View style={styles.hereHead}><Navigation size={18} color={colors.accent} strokeWidth={2} /><Text style={styles.hereTitle}>Маршрут здесь, в «рядом.»</Text></View>
          {me ? (
            <View style={styles.tiles}>
              {tiles.map(({ mode, Icon, min, label }) => (
                <Pressable key={mode} onPress={() => go(mode)} style={({ pressed }) => [styles.tile, pressed && { opacity: 0.8 }]} accessibilityRole="button" accessibilityLabel={`${label}: ${min ?? '…'} минут`}>
                  <Icon size={18} color="#FBFAF6" strokeWidth={1.9} />
                  <Text style={styles.tileText}>{min != null ? `${t.rough && mode !== 'bus' ? '~' : ''}${min} мин` : '…'}</Text>
                </Pressable>
              ))}
            </View>
          ) : <Text style={styles.hereSub}>Включи геолокацию — посчитаем время пешком, на машине и на автобусе.</Text>}
        </View>
      )}
      <View style={styles.apps}>
        {apps.map((a) => (
          <Pressable key={a.k} onPress={a.on} style={({ pressed }) => [styles.app, pressed && { opacity: 0.85 }]} accessibilityRole="button">
            <View style={[styles.mark, { backgroundColor: a.bg }]}><Text style={styles.markText}>{a.mark}</Text></View>
            <Text style={styles.appText}>{a.label}</Text>
          </Pressable>
        ))}
      </View>
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
  hereTitle: { fontFamily: fonts.body700, fontSize: 16, color: '#FBFAF6' },
  hereSub: { fontFamily: fonts.body400, fontSize: 14, color: '#BDB8AD' },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, height: 50, borderRadius: 13, backgroundColor: '#2A292E', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  tileText: { fontFamily: fonts.body700, fontSize: 15.5, color: '#FBFAF6' },
  apps: { flexDirection: 'row', gap: 8 },
  app: { flex: 1, height: 54, borderRadius: 16, backgroundColor: '#ECE7DC', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  mark: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  markText: { fontFamily: fonts.display800, fontSize: 13, color: '#FFFFFF' },
  appText: { fontFamily: fonts.body700, fontSize: 15.5, color: colors.ink },
  copy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44 },
  copyText: { fontFamily: fonts.body700, fontSize: 15, color: colors.muted2 },
});
