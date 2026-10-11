// Линзы карты — design/png/V6MapLens.png: Обычная, Пробки (TomTom), Где я был (открытые районы).
import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import { colors, fonts } from '../../theme';

export type Lens = 'normal' | 'traffic' | 'explore';

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

export function LensSheet({ lens, onPick }: { lens: Lens; onPick: (l: Lens) => void }) {
  return (
    <View style={{ gap: 14 }}>
      <Text style={styles.title} accessibilityRole="header">Линзы</Text>
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
  item: { flex: 1, alignItems: 'center', gap: 2 },
  thumb: { width: '100%', aspectRatio: 1, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#C8C2B2', marginBottom: 8 },
  thumbOn: { borderWidth: 3, borderColor: colors.accent },
  check: { position: 'absolute', right: 8, top: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.paper },
  name: { fontFamily: fonts.body700, fontSize: 14.5, color: colors.ink },
  sub: { fontFamily: fonts.body400, fontSize: 12.5, color: colors.muted, textAlign: 'center' },
});
