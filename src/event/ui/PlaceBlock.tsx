// Карточка события: «Где» — мини-карта места (Mapbox Static Images), название и адрес, кнопки «Маршрут» и «Скопировать»;
// «Откуда событие» — сайт-источник с цветной плашкой, доменом и кнопкой «Открыть».
import { ArrowUpRight, Copy, Navigation } from 'lucide-react-native';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { config } from '../../lib/config';
import { colors, fonts } from '../../theme';
import { plate } from '../../ui/glass';

/** Картинка карты с оранжевой меткой. Без токена или координат — null (блок покажет только адрес). */
export function staticMapUrl(lat: number, lon: number, w = 640, h = 260): string | null {
  if (!config.mapboxToken || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const pin = `pin-l+F0521F(${lon.toFixed(5)},${lat.toFixed(5)})`;
  return `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/${pin}/${lon.toFixed(5)},${lat.toFixed(5)},15.2,0/${w}x${h}@2x?logo=false&attribution=false&access_token=${config.mapboxToken}`;
}

export function PlaceBlock({ lat, lon, title, address, dist, exact, onRoute, onCopy }: {
  lat: number; lon: number; title: string; address: string; dist?: string | null; exact: boolean; onRoute: () => void; onCopy: () => void;
}) {
  const [broken, setBroken] = useState(false);
  const url = exact && !broken ? staticMapUrl(lat, lon) : null;
  return (
    <View style={styles.card}>
      {url && (
        <Pressable onPress={onRoute} accessibilityRole="button" accessibilityLabel={`Карта: ${title}. Маршрут`}>
          <Image source={{ uri: url }} style={styles.map} resizeMethod="resize" onError={() => setBroken(true)} />
          {dist && <View style={styles.dist}><Text style={styles.distText}>{dist}</Text></View>}
        </Pressable>
      )}
      <View style={styles.body}>
        <Text style={styles.cap}>ГДЕ</Text>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        {!!address && address !== title && <Text style={styles.address} numberOfLines={2}>{address}</Text>}
        {!exact && <Text style={styles.warn}>Точный вход уточни у организаторов</Text>}
        <View style={styles.actions}>
          <Pressable onPress={onRoute} style={({ pressed }) => [styles.route, pressed && styles.pressed]} accessibilityRole="button">
            <Navigation size={17} color={colors.ink} strokeWidth={2.1} />
            <Text style={styles.routeText}>Маршрут{!url && dist ? ` · ${dist}` : ''}</Text>
          </Pressable>
          <Pressable onPress={onCopy} style={({ pressed }) => [styles.copy, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Скопировать адрес">
            <Copy size={17} color={colors.ink} strokeWidth={1.9} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/** Узнаваемые источники афиши — своим цветом и буквой. */
const SOURCES: [RegExp, string, string, string][] = [
  [/sxodim/, 'S', '#FF5A36', 'Sxodim'],
  [/ticketon/, 'T', '#1D6FE8', 'Ticketon'],
  [/afisha\.yandex|yandex/, 'Я', '#FC3F1D', 'Яндекс Афиша'],
  [/kino\.kz/, 'K', '#E2A21B', 'Kino.kz'],
  [/instagram/, 'I', '#C13584', 'Instagram'],
  [/t\.me|telegram/, 'T', '#2AA5E0', 'Telegram'],
  [/threads/, '@', '#17161A', 'Threads'],
  [/kassir/, 'K', '#7E5BD6', 'Kassir'],
];
export const sourceLook = (site: string) => {
  const hit = SOURCES.find(([re]) => re.test(site));
  return hit ? { letter: hit[1], color: hit[2], name: hit[3] } : { letter: (site[0] ?? '·').toUpperCase(), color: colors.ink, name: site };
};

export function SourceLink({ site, onOpen, onCopy }: { site: string; onOpen: () => void; onCopy: () => void }) {
  const look = sourceLook(site);
  return (
    <Pressable onPress={onOpen} onLongPress={onCopy} style={({ pressed }) => [styles.source, pressed && styles.pressed]} accessibilityRole="link" accessibilityLabel={`Билеты и подробности на ${site}`}>
      <View style={[styles.logo, { backgroundColor: look.color }]}><Text style={styles.logoText}>{look.letter}</Text></View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.sourceTitle} numberOfLines={1}>{look.name === site ? 'Билеты и подробности' : `Билеты на ${look.name}`}</Text>
        <Text style={styles.sourceSub} numberOfLines={1}>{site} · откуда событие</Text>
      </View>
      <View style={styles.open}><Text style={styles.openText}>Открыть</Text><ArrowUpRight size={15} color={colors.paper} strokeWidth={2.2} /></View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, overflow: 'hidden', ...plate },
  map: { width: '100%', height: 150, backgroundColor: '#D9D3C5' },
  dist: { position: 'absolute', right: 10, top: 10, paddingHorizontal: 10, height: 28, borderRadius: 14, backgroundColor: 'rgba(23,22,26,0.78)', justifyContent: 'center' },
  distText: { fontFamily: fonts.mono600, fontSize: 12, color: '#FFFFFF' },
  body: { padding: 16, gap: 4 },
  cap: { fontFamily: fonts.mono600, fontSize: 11, letterSpacing: 1, color: colors.muted },
  title: { fontFamily: fonts.display700, fontSize: 18, lineHeight: 23, color: colors.ink },
  address: { fontFamily: fonts.body400, fontSize: 14, lineHeight: 20, color: colors.muted2 },
  warn: { fontFamily: fonts.body600, fontSize: 13, color: colors.accentText, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  route: { flex: 1, minHeight: 46, borderRadius: 15, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  routeText: { fontFamily: fonts.body700, fontSize: 15, color: colors.ink },
  copy: { width: 46, minHeight: 46, borderRadius: 15, backgroundColor: 'rgba(23,22,26,0.07)', alignItems: 'center', justifyContent: 'center' },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
  source: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingRight: 10, borderRadius: 20, ...plate },
  logo: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontFamily: fonts.display800, fontSize: 19, color: '#FFFFFF' },
  sourceTitle: { fontFamily: fonts.body700, fontSize: 15, color: colors.ink },
  sourceSub: { fontFamily: fonts.body400, fontSize: 12.5, color: colors.muted },
  open: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 36, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.ink },
  openText: { fontFamily: fonts.body700, fontSize: 13.5, color: colors.paper },
});
