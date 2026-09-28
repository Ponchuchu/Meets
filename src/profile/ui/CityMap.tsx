// Ночная мини-карта с «туманом»: светлое — соты, где ты уже был (Me → «Моя карта»).
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Mask, RadialGradient, Rect, Stop } from 'react-native-svg';
import { MapBase } from '../../components/MapBase';
import { project } from '../../map/projection';
import { colors, fonts } from '../../theme';
import { cellCenter } from '../city';

const CAM = { lat: 43.2465, lon: 76.928, zoom: 11.6 };

export function CityMap({ visited, hot }: { visited: string[]; hot: { lat: number; lon: number }[] }) {
  const [w, setW] = useState(326);
  const h = 230;
  const pts = visited.map((c) => project(cellCenter(c).lat, cellCenter(c).lon, CAM, w, h));
  return (
    <View style={styles.box} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <View style={{ position: 'absolute', left: (w - 390) / 2, top: -300 }}><MapBase theme="night" /></View>
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#E4E0D6" stopOpacity="0.28" />
            <Stop offset="1" stopColor="#E4E0D6" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="spot" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#000" stopOpacity="1" />
            <Stop offset="1" stopColor="#000" stopOpacity="0" />
          </RadialGradient>
          <Mask id="fog">
            <Rect x={0} y={0} width={w} height={h} fill="#fff" />
            {pts.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r={26} fill="url(#spot)" />)}
          </Mask>
        </Defs>
        <Rect x={0} y={0} width={w} height={h} fill="#0E0E11" opacity={0.78} mask="url(#fog)" />
        {pts.map((p, i) => <Circle key={`g${i}`} cx={p.x} cy={p.y} r={26} fill="url(#glow)" />)}
        {hot.map((p, i) => {
          const q = project(p.lat, p.lon, CAM, w, h);
          return <Circle key={`h${i}`} cx={q.x} cy={q.y} r={4} fill={colors.accent} />;
        })}
      </Svg>
      <View style={styles.label}><Text style={styles.labelText}>СВЕТЛОЕ — ГДЕ ТЫ УЖЕ БЫЛ</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { height: 230, borderRadius: 16, overflow: 'hidden', backgroundColor: '#1C1D21' },
  label: { position: 'absolute', left: 12, bottom: 12, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: colors.paper },
  labelText: { fontFamily: fonts.mono600, fontSize: 9.5, letterSpacing: 0.5, color: colors.ink },
});
