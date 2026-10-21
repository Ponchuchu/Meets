// Линзы карты — design/png/V6MapLens.png: Обычная, Пробки (TomTom), Где я был (открытые районы).
import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';
import type { MapView } from '../../state/mapView';
import { colors, fonts } from '../../theme';

export type Lens = 'normal' | 'traffic' | 'explore';

/** Мини-картинка вида: объёмные коробки или плоские квадраты. */
function ViewThumb({ id }: { id: MapView }) {
  return (
    <Svg width={44} height={44} viewBox="0 0 44 44">
      <Rect x={0} y={0} width={44} height={44} rx={12} fill="#DDD8CB" />
      {id === '3d' ? <>
        <Path d="M9 30L9 18L16 14L23 18L23 30L16 34Z" fill="#EBE4D6" stroke="#B9B2A3" strokeWidth={1} />
        <Path d="M9 18L16 22L23 18M16 22V34" fill="none" stroke="#B9B2A3" strokeWidth={1} />
        <Path d="M24 32L24 12L30 9L36 12L36 32L30 35Z" fill="#F3E7D2" stroke="#B9B2A3" strokeWidth={1} />
        <Path d="M24 12L30 15L36 12M30 15V35" fill="none" stroke="#B9B2A3" strokeWidth={1} />
      </> : <>
        <Rect x={8} y={10} width={12} height={10} rx={2} fill="#D0D4D9" /><Rect x={24} y={10} width={12} height={14} rx={2} fill="#D0D4D9" />
        <Rect x={8} y={24} width={12} height={10} rx={2} fill="#D0D4D9" /><Rect x={24} y={28} width={12} height={6} rx={2} fill="#D0D4D9" />
      </>}
    </Svg>
  );
}

const LENSES: { id: Lens; title: string; sub: string }[] = [
  { id: 'normal', title: 'Обычная', sub: 'события и друзья' },
  { id: 'traffic', title: 'Пробки', sub: 'зелёный — свободно' },
  { id: 'explore', title: 'Где я был', sub: 'открытые районы' },
];

function Thumb({ id }: { id: Lens }) {
  const grid = [22, 52, 82].map((v) => (
    <Line key={`h${v}`} x1={0} y1={v} x2={120} y2={v} stroke="#FFFFFF" strokeWidth={5} />
  ));
  const cols = [30, 70, 100].map((v) => <Line key={`v${v}`} x1={v} y1={0} x2={v} y2={120} stroke="#FFFFFF" strokeWidth={5} />);
  return (
    <Svg width="100%" height="100%" viewBox="0 0 120 92" preserveAspectRatio="xMidYMid slice">
      <Rect x={0} y={0} width={120} height={92} fill={id === 'explore' ? '#E4DFD3' : '#DDD8CB'} />
      {grid}{cols}
      {id === 'normal' && <><Rect x={52} y={44} width={8} height={8} fill={colors.accent} /><Rect x={20} y={70} width={8} height={8} fill={colors.accent} /></>}
      {id === 'traffic' && <><Line x1={0} y1={30} x2={120} y2={30} stroke="#C83A26" strokeWidth={5} /><Line x1={64} y1={0} x2={64} y2={92} stroke="#C83A26" strokeWidth={5} /><Line x1={0} y1={74} x2={120} y2={74} stroke="#C83A26" strokeWidth={5} /></>}
    </Svg>
  );
}

const VIEWS: { id: MapView; title: string; sub: string }[] = [
  { id: '3d', title: 'Объёмная', sub: 'дома в 3D и горы' },
  { id: 'flat', title: 'Простая', sub: 'легче для телефона' },
];

export function LensSheet({ lens, onPick, view, onView, canThreeD = true }: { lens: Lens; onPick: (l: Lens) => void; view: MapView; onView: (v: MapView) => void; canThreeD?: boolean }) {
  return (
    <View style={{ gap: 14 }}>
      <Text style={styles.title} accessibilityRole="header">Линзы</Text>
      <Text style={styles.cap}>ВИД КАРТЫ</Text>
      <View style={styles.row}>
        {VIEWS.map((v) => {
          const on = v.id === view;
          const off = v.id === '3d' && !canThreeD;
          return (
            <Pressable key={v.id} disabled={off} onPress={() => onView(v.id)} style={[styles.view, on && styles.viewOn, off && { opacity: 0.45 }]} accessibilityRole="radio" accessibilityState={{ selected: on, disabled: off }} accessibilityLabel={`${v.title}: ${v.sub}`}>
              <ViewThumb id={v.id} />
              <Text style={styles.name}>{v.title}</Text>
              <Text style={[styles.sub, { textAlign: 'left' }]}>{off ? 'нужна карта Mapbox' : v.sub}</Text>
              {on && <View style={styles.check}><Check size={14} color={colors.paper} strokeWidth={3} /></View>}
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.cap}>ЧТО ПОКАЗАТЬ</Text>
      <View style={styles.row}>
        {LENSES.map((l) => {
          const on = l.id === lens;
          return (
            <Pressable key={l.id} onPress={() => onPick(l.id)} style={styles.item} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${l.title}: ${l.sub}`}>
              <View style={[styles.thumb, on && styles.thumbOn]}>
                <Thumb id={l.id} />
                {on && <View style={styles.check}><Check size={14} color={colors.paper} strokeWidth={3} /></View>}
              </View>
              <Text style={styles.name}>{l.title}</Text>
              <Text style={styles.sub}>{l.sub}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display800, fontSize: 24, letterSpacing: -0.6, color: colors.ink },
  row: { flexDirection: 'row', gap: 8 },
  cap: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.8, color: colors.muted },
  view: { flex: 1, alignItems: 'flex-start', gap: 4, padding: 12, borderRadius: 18, borderWidth: 1, borderColor: '#C8C2B2', backgroundColor: '#F1ECE2' },
  viewOn: { borderWidth: 2, borderColor: colors.accent },
  item: { flex: 1, alignItems: 'center', gap: 2 },
  thumb: { width: '100%', aspectRatio: 1, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#C8C2B2', marginBottom: 8 },
  thumbOn: { borderWidth: 3, borderColor: colors.accent },
  check: { position: 'absolute', right: 8, top: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.paper },
  name: { fontFamily: fonts.body700, fontSize: 14.5, color: colors.ink },
  sub: { fontFamily: fonts.body400, fontSize: 12.5, color: colors.muted, textAlign: 'center' },
});
