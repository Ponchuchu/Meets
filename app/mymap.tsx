// «Моя карта» на весь экран — как в Zenly: соты города, где ты уже был, подсвечены; где ночевал — луны.
// Видно только тебе. Соты пополняются отметками «Я на месте» (и фоновой геолокацией в приложении на телефоне).
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Polygon } from 'react-native-svg';
import { data } from '../src/data';
import { cellToBoundary } from '../src/lib/h3';
import { MapCanvas } from '../src/map/MapCanvas';
import { project } from '../src/map/projection';
import type { MapMarker } from '../src/map/types';
import { cellCenter, cityPercent, levelOf, nextLevelHint } from '../src/profile/city';
import { useProfile } from '../src/state/profile';
import { colors, fonts } from '../src/theme';
import { glass } from '../src/ui/glass';
import { Ic } from '../src/ui/Ic';

const CAM = { lat: 43.2465, lon: 76.928, zoom: 12.2 };
const MOON = 'M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z';

/** Шестиугольник соты в пикселях вокруг её центра при текущем масштабе. */
function Hex({ cell, zoom }: { cell: string; zoom: number }) {
  const c = cellCenter(cell);
  const pts = cellToBoundary(cell).map(([la, lo]) => project(la, lo, { ...c, zoom }, 0, 0));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const pad = 2;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const w = Math.max(...xs) - minX + pad;
  const h = Math.max(...ys) - minY + pad;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: minX, top: minY }}>
      <Svg width={w} height={h}>
        <Polygon points={pts.map((p) => `${p.x - minX},${p.y - minY}`).join(' ')} fill={colors.accent} fillOpacity={0.42} stroke={colors.accent} strokeOpacity={0.9} strokeWidth={1.2} />
      </Svg>
    </View>
  );
}

export default function MyMapScreen() {
  const insets = useSafeAreaInsets();
  const { data: me } = useQuery({ queryKey: ['myProfile'], queryFn: () => data.getMyProfile() });
  const arrivals = useProfile((s) => s.arrivals);
  const [zoom, setZoom] = useState(CAM.zoom);
  const [layer, setLayer] = useState({ been: true, nights: true });
  const visited = useMemo(() => [...new Set([...(me?.visitedCells ?? []), ...arrivals.map((a) => a.cell)])], [me, arrivals]);
  const eventCells = me?.eventCells ?? [];
  const pct = cityPercent(visited, eventCells);
  const level = levelOf(pct);
  const hint = nextLevelHint(visited.filter((c) => eventCells.includes(c)).length, eventCells.length || 1);
  const z = Math.round(zoom * 4) / 4; // пересчитываем соты не на каждый кадр, а шагами

  const markers: MapMarker[] = useMemo(() => {
    const list: MapMarker[] = [];
    if (layer.been) for (const cell of visited) { const c = cellCenter(cell); list.push({ id: `h-${cell}`, lat: c.lat, lon: c.lon, z: 1, node: <Hex cell={cell} zoom={z} /> }); }
    if (layer.nights) for (const n of me?.nights ?? []) {
      list.push({
        id: `n-${n.label}`, lat: n.lat, lon: n.lon, z: 10, node: (
          <View style={styles.nightAnchor}>
            <View style={styles.night}><Svg width={16} height={16} viewBox="0 0 24 24"><Path d={MOON} fill="#F2B632" /></Svg></View>
            <View style={styles.nightTag}><Text style={styles.nightText}>{n.label} · {n.count}</Text></View>
          </View>
        ),
      });
    }
    return list;
  }, [visited, me?.nights, layer, z]);

  return (
    <View style={styles.root}>
      <MapCanvas theme="night" camera={CAM} markers={markers} onZoom={setZoom} />

      <Animated.View entering={FadeInDown.duration(260)} style={[styles.top, { top: Math.max(50, insets.top + 6) }]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/me'))} style={[styles.round, glass]} accessibilityRole="button" accessibilityLabel="Назад">
          <Ic d="M15 6l-6 6 6 6" size={20} color={colors.ink} w={2.2} />
        </Pressable>
        <View style={[styles.title, glass]}><Text style={styles.titleText}>Мой Алматы</Text></View>
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(300)} style={[styles.card, { bottom: 16 + insets.bottom }]}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View>
            <Text style={styles.cap}>ОТКРЫТО</Text>
            <Text style={styles.pct}>{pct}%</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 2, paddingBottom: 8 }}>
            <Text style={styles.meta}>{visited.length} мест</Text>
            <Text style={styles.meta}>Уровень {level.n} · {level.name}</Text>
          </View>
        </View>
        {hint && <Text style={styles.hint}>{hint}</Text>}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {([['been', 'Где был'], ['nights', 'Где ночевал']] as const).map(([k, label]) => {
            const on = layer[k];
            return (
              <Pressable key={k} onPress={() => setLayer({ ...layer, [k]: !on })} style={[styles.chip, on && styles.chipOn]} accessibilityRole="switch" accessibilityState={{ checked: on }}>
                {k === 'been' ? <View style={[styles.hexDot, !on && { opacity: 0.4 }]} /> : <Svg width={14} height={14} viewBox="0 0 24 24"><Path d={MOON} fill={on ? '#F2B632' : '#8C8577'} /></Svg>}
                <Text style={[styles.chipText, on && { color: colors.ink }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.private}>Видишь только ты. Город открывается там, где ты бываешь.</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1C1D21', overflow: 'hidden' },
  top: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  round: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  title: { height: 48, paddingHorizontal: 18, borderRadius: 24, justifyContent: 'center' },
  titleText: { fontFamily: fonts.display700, fontSize: 17, color: colors.ink },
  card: { position: 'absolute', left: 12, right: 12, padding: 16, borderRadius: 26, backgroundColor: 'rgba(23,22,26,0.92)', gap: 10 },
  cap: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.8, color: '#BDB8AD' },
  pct: { fontFamily: fonts.display800, fontSize: 56, lineHeight: 58, letterSpacing: -2, color: colors.paper },
  meta: { fontFamily: fonts.body500, fontSize: 13, color: '#E4E0D6' },
  hint: { fontFamily: fonts.body400, fontSize: 13, color: '#BDB8AD' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 38, paddingHorizontal: 14, borderRadius: 19, borderWidth: 1, borderColor: '#3A3A40' },
  chipOn: { backgroundColor: colors.paper, borderColor: colors.paper },
  chipText: { fontFamily: fonts.body600, fontSize: 13.5, color: '#E4E0D6' },
  hexDot: { width: 12, height: 12, borderRadius: 3, backgroundColor: colors.accent, transform: [{ rotate: '45deg' }] },
  private: { fontFamily: fonts.body400, fontSize: 12, color: '#8C8577' },
  nightAnchor: { width: 0, height: 0, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  night: { position: 'absolute', width: 30, height: 30, borderRadius: 15, backgroundColor: '#17161A', borderWidth: 2, borderColor: '#F2B632', alignItems: 'center', justifyContent: 'center' },
  nightTag: { position: 'absolute', top: 18, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(23,22,26,0.85)' },
  nightText: { fontFamily: fonts.mono600, fontSize: 10, color: '#F2E9CF', width: 110, textAlign: 'center' },
});
