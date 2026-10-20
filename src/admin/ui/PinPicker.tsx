// Точка события «как в доставке» (FIX3 Ф5): на весь экран, карту двигаешь под булавкой, адрес подтягивается сам.
// Раньше карта стояла в окне с прокруткой — прокрутка забирала жесты, и карта «зависала».
import { ChevronLeft, MapPin, Search } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { nearestAddress, searchAddresses, type AddressHit } from '../../live/addresses';
import { MapCanvas } from '../../map/MapCanvas';
import type { MapCanvasHandle } from '../../map/types';
import { colors, fonts } from '../../theme';
import { glass } from '../../ui/glass';

const CENTER = { lat: 43.2389, lon: 76.8897 };

export function PinPicker({ title, address, point, onClose, onPin }: {
  title: string; address: string | null; point: { lat: number; lon: number } | null;
  onClose: () => void; onPin: (p: { lat: number; lon: number }) => void;
}) {
  const insets = useSafeAreaInsets();
  const map = useRef<MapCanvasHandle>(null);
  const [camera] = useState(() => ({ ...(point ?? CENTER), zoom: point ? 16 : 12.5 }));
  const [center, setCenter] = useState(point ?? CENTER);
  const [label, setLabel] = useState<string | null>(null);
  const [q, setQ] = useState(address && address !== 'в центре' ? address : '');
  const [hits, setHits] = useState<AddressHit[]>([]);
  const [state, setState] = useState<'idle' | 'busy' | 'none' | 'error'>('idle');
  const [moved, setMoved] = useState(!!point);
  const rev = useRef(0);

  // Поиск по своему справочнику адресов, местам и запасным сервисам; последний запрос отменяет прежний.
  useEffect(() => {
    if (q.trim().length < 3) return;
    const ac = new AbortController();
    const t = setTimeout(() => {
      setState('busy');
      searchAddresses(q, ac.signal, center).then(r => { if (!ac.signal.aborted) { setHits(r); setState(r.length ? 'idle' : 'none'); } })
        .catch(() => { if (!ac.signal.aborted) setState('error'); });
    }, 350);
    return () => { clearTimeout(t); ac.abort(); };
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const onCenter = (lat: number, lon: number) => {
    const r = ++rev.current;
    setCenter({ lat, lon });
    if (Math.hypot(lat - camera.lat, lon - camera.lon) > 0.0002) setMoved(true);
    setTimeout(() => {
      if (r !== rev.current) return;
      nearestAddress(lat, lon).then(a => { if (r === rev.current) setLabel(a); }).catch(() => undefined);
    }, 400);
  };
  const choose = (h: AddressHit) => {
    setHits([]); setQ(h.label); setLabel(h.label);
    map.current?.flyTo(h.lat, h.lon, 17);
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <MapCanvas ref={map} theme="paper" threeD={false} camera={camera} markers={[]} onCenter={onCenter} />
        <View pointerEvents="none" style={styles.pin}>
          <View style={styles.pinHead}><MapPin size={20} color={colors.ink} strokeWidth={2.2} /></View>
          <View style={styles.pinLeg} />
          <View style={styles.pinDot} />
        </View>

        <View style={[styles.top, { top: insets.top + 8 }]}>
          <View style={[styles.searchRow, glass]}>
            <Pressable onPress={onClose} style={styles.back} accessibilityRole="button" accessibilityLabel="Назад"><ChevronLeft size={24} color={colors.ink} strokeWidth={2} /></Pressable>
            <Search size={17} color={colors.muted2} strokeWidth={2} />
            <TextInput value={q} onChangeText={t => { setQ(t); if (t.trim().length < 3) { setHits([]); setState('idle'); } }} placeholder="Адрес или место" placeholderTextColor={colors.muted3} style={styles.input}
              returnKeyType="search" onSubmitEditing={() => hits[0] && choose(hits[0])} accessibilityLabel="Адрес или место" />
            {state === 'busy' && <ActivityIndicator color={colors.muted2} />}
          </View>
          {hits.length > 0 && (
            <View style={[styles.hits, glass]}>
              {hits.slice(0, 5).map(h => (
                <Pressable key={h.id} onPress={() => choose(h)} style={styles.hit} accessibilityRole="button">
                  <MapPin size={16} color={colors.muted2} strokeWidth={1.9} />
                  <Text style={styles.hitText} numberOfLines={1}>{h.label}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {state === 'none' && <Text style={[styles.note, glass]}>Не нашёл такой адрес. Передвинь карту к входу</Text>}
          {state === 'error' && <Text style={[styles.note, glass]}>Нет связи с поиском. Передвинь карту вручную</Text>}
        </View>

        <View style={[styles.sheet, glass, { bottom: Math.max(12, insets.bottom + 8) }]}>
          <Text style={styles.cap} numberOfLines={1}>{title}</Text>
          <Text style={styles.addr} numberOfLines={2}>{label ?? (moved ? 'Адрес рядом не найден — проверь точку' : 'Передвинь карту: булавка — вход в площадку')}</Text>
          <Text style={styles.coords}>{center.lat.toFixed(5)}, {center.lon.toFixed(5)}</Text>
          <Pressable disabled={!moved} onPress={() => onPin(center)} style={[styles.go, !moved && { opacity: 0.4 }]} accessibilityRole="button">
            <Text style={styles.goText}>Опубликовать с этой точкой</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#DDD8CB' },
  pin: { position: 'absolute', left: '50%', top: '50%', marginLeft: -22, marginTop: -62, alignItems: 'center' },
  pinHead: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.accent, borderWidth: 3, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  pinLeg: { width: 3, height: 14, backgroundColor: colors.ink },
  pinDot: { width: 8, height: 4, borderRadius: 4, backgroundColor: 'rgba(23,22,26,0.35)' },
  top: { position: 'absolute', left: 12, right: 12, gap: 8 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 22, paddingRight: 14, minHeight: 56 },
  back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, height: 48, fontFamily: fonts.body500, fontSize: 15.5, color: colors.ink },
  hits: { borderRadius: 20, paddingVertical: 4 },
  hit: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 46, paddingHorizontal: 14 },
  hitText: { flex: 1, fontFamily: fonts.body500, fontSize: 15, color: colors.ink },
  note: { borderRadius: 16, padding: 12, fontFamily: fonts.body500, fontSize: 14, color: colors.accentText, overflow: 'hidden' },
  sheet: { position: 'absolute', left: 10, right: 10, borderRadius: 26, padding: 16, gap: 6 },
  cap: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.6, color: colors.muted2, textTransform: 'uppercase' },
  addr: { fontFamily: fonts.display700, fontSize: 19, lineHeight: 24, color: colors.ink },
  coords: { fontFamily: fonts.mono500, fontSize: 11.5, color: colors.muted2 },
  go: { marginTop: 8, height: 54, borderRadius: 17, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  goText: { fontFamily: fonts.body700, fontSize: 16, color: colors.paper },
});
