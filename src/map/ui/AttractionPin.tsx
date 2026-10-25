// Значки постоянных мест на карте: у каждого вида свой объёмный рисунок (свет сверху слева, блик, тень на земле).
// Боулинг — сам шар с тремя отверстиями; горы — вершина с подъёмником; каток — конёк; фотозона — камера.
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { KIND_COLOR, type Attraction, type AttractionKind } from '../../data/attractions';
import { colors, fonts } from '../../theme';

/** Белый рисунок вида на 24×24 (внутри цветной «таблетки»). */
function Glyph({ kind }: { kind: AttractionKind }) {
  const s = { stroke: '#FFFFFF', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  switch (kind) {
    case 'ski': return <G><Path d="M2.5 19.5L9 8.5l3.2 5 2.3-3.2 7 9.2z" fill="#FFFFFF" opacity={0.95} /><Path d="M9 8.5l1.6 2.6-1.6 1-1.4-1z" fill="#CFE3F5" /><Path d="M4 4.5l16 4" {...s} strokeWidth={1.4} /><Rect x={11} y={5.6} width={3.2} height={2.6} rx={0.7} fill="#FFFFFF" /></G>;
    case 'skate': return <G><Path d="M5 5h5.5v5.5c0 1 .8 1.5 2 1.5h3.5c1.6 0 3 1.1 3 2.8V16H5z" fill="#FFFFFF" /><Path d="M4 19.5h15.5c.8 0 1.5-.5 1.5-1.3" {...s} /><Path d="M7 16v3.5M15 16v3.5" {...s} strokeWidth={1.4} /></G>;
    case 'cable': return <G><Path d="M2.5 5.5l19 4" {...s} /><Path d="M12 7.6v2.4" {...s} /><Rect x={6.5} y={10} width={11} height={9} rx={2.5} fill="#FFFFFF" /><Rect x={8.3} y={11.8} width={3.2} height={3} rx={0.8} fill="#9ED7DE" /><Rect x={12.5} y={11.8} width={3.2} height={3} rx={0.8} fill="#9ED7DE" /></G>;
    case 'wheel': return <G><Circle cx={12} cy={10} r={7} {...s} /><Path d="M12 3v14M5 10h14M7 5l10 10M17 5L7 15" {...s} strokeWidth={1.2} /><Circle cx={12} cy={10} r={1.6} fill="#FFFFFF" /><Path d="M9 21l3-11 3 11" {...s} /></G>;
    case 'trampoline': return <G><Ellipse cx={12} cy={15} rx={9} ry={3} {...s} /><Path d="M5 16.5L4 20.5M19 16.5l1 4M12 18v2.5" {...s} /><Circle cx={12} cy={5} r={2} fill="#FFFFFF" /><Path d="M12 7.5v3.5M9.5 9l2.5 1.5 2.5-1.5" {...s} /></G>;
    case 'climb': return <G><Path d="M4 21L9 3h11l-3 18z" fill="#FFFFFF" opacity={0.25} /><Circle cx={10} cy={7} r={1.6} fill="#FFFFFF" /><Circle cx={15} cy={10} r={1.4} fill="#FFFFFF" /><Circle cx={11} cy={14} r={1.7} fill="#FFFFFF" /><Circle cx={14.5} cy={18} r={1.3} fill="#FFFFFF" /></G>;
    case 'quest': return <G><Circle cx={8} cy={12} r={4} {...s} /><Path d="M12 12h9M18 12v3M15.5 12v2" {...s} /></G>;
    case 'vr': return <G><Rect x={2.5} y={7} width={19} height={10} rx={3.5} fill="#FFFFFF" /><Circle cx={8} cy={12} r={2.2} fill={KIND_COLOR.vr} /><Circle cx={16} cy={12} r={2.2} fill={KIND_COLOR.vr} /><Path d="M10.5 17l1.5-2 1.5 2" stroke={KIND_COLOR.vr} strokeWidth={1.4} fill="none" /></G>;
    case 'golf': return <G><Path d="M8 21V3l9 3.5L8 10" fill="#FFFFFF" /><Ellipse cx={12} cy={20.5} rx={7} ry={1.5} fill="#FFFFFF" opacity={0.5} /><Circle cx={16} cy={18.5} r={1.4} fill="#FFFFFF" /></G>;
    case 'paintball': return <G><Path d="M12 3.5c1.2 2.4 3.6 1.2 4.3 3.3.6 1.8-1.5 2.5-.4 4.2 1 1.6 3.7.7 3.6 3-.1 2.2-2.8 1.6-3.4 3.5-.6 2 1.2 3.5-1 4-2.4.5-2.2-2.3-4.2-2.3s-2.4 2.6-4.3 1.6c-1.7-1-.2-3-1.3-4.3C4 15.1 1.7 15.5 2 13.4c.3-2 2.8-1.4 3.2-3.2.4-1.9-1.6-2.8-.4-4.4 1.2-1.5 3 .1 4.4-.9 1.3-1 1.4-3.2 2.8-1.4z" fill="#FFFFFF" /></G>;
    case 'aqua': return <G><Path d="M2.5 15c2 0 2-1.6 4-1.6S8.6 15 10.6 15s2-1.6 4-1.6 2.1 1.6 4.1 1.6 1.4-.8 2.8-1.2" {...s} /><Path d="M2.5 19.5c2 0 2-1.6 4-1.6s2.1 1.6 4.1 1.6 2-1.6 4-1.6 2.1 1.6 4.1 1.6 1.4-.8 2.8-1.2" {...s} /><Path d="M6 11V5a2 2 0 014 0" {...s} /><Path d="M14 11V5a2 2 0 014 0M6 8h8" {...s} strokeWidth={1.4} /></G>;
    case 'zipline': return <G><Path d="M2.5 4l19 7" {...s} /><Path d="M11 7.5v3" {...s} /><Circle cx={11} cy={12.5} r={1.8} fill="#FFFFFF" /><Path d="M11 14.5v3.5l-2.5 3M11 18l2.5 3M8 15.5l3-1 3 1" {...s} /></G>;
    case 'photo': return <G><Path d="M3 8.5A2.5 2.5 0 015.5 6h2l1.5-2h6l1.5 2h2A2.5 2.5 0 0121 8.5v8a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 16.5z" fill="#FFFFFF" /><Circle cx={12} cy={12.5} r={3.6} fill={KIND_COLOR.photo} /><Circle cx={12} cy={12.5} r={1.8} fill="#FFFFFF" opacity={0.6} /><Circle cx={17.6} cy={9} r={0.9} fill={KIND_COLOR.photo} /></G>;
    case 'park': return <G><Path d="M12 3c-3.6 0-6 2.6-6 5.6 0 1.4.5 2.5 1.3 3.4A3.6 3.6 0 0010 18h4a3.6 3.6 0 002.7-6c.8-.9 1.3-2 1.3-3.4C18 5.6 15.6 3 12 3z" fill="#FFFFFF" /><Path d="M12 11v10M9.5 14.5L12 16l2.5-2" stroke={KIND_COLOR.park} strokeWidth={1.6} strokeLinecap="round" fill="none" /><Path d="M5 21h14" {...s} /></G>;
    case 'garden': return <G><Circle cx={12} cy={9} r={2.4} fill={KIND_COLOR.garden} stroke="#FFFFFF" strokeWidth={1.6} />{[0, 72, 144, 216, 288].map((r) => <Ellipse key={r} cx={12} cy={4.6} rx={2.3} ry={3} fill="#FFFFFF" transform={`rotate(${r} 12 9)`} />)}<Path d="M12 13v8M12 18c-2.5 0-4-1.5-4.5-3.5 2.5 0 4 1.3 4.5 3.5zM12 17c2.5 0 4-1.5 4.5-3.5-2.5 0-4 1.3-4.5 3.5z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth={1.4} /></G>;
    case 'museum': return <G><Path d="M3 9.5L12 4l9 5.5z" fill="#FFFFFF" /><Path d="M6 11v7M10 11v7M14 11v7M18 11v7" {...s} strokeWidth={2.2} /><Rect x={3} y={18.5} width={18} height={2.5} rx={1} fill="#FFFFFF" /></G>;
    case 'zoo': return <G><Ellipse cx={12} cy={16} rx={4.6} ry={3.8} fill="#FFFFFF" /><Ellipse cx={6} cy={10.5} rx={1.9} ry={2.4} fill="#FFFFFF" /><Ellipse cx={18} cy={10.5} rx={1.9} ry={2.4} fill="#FFFFFF" /><Ellipse cx={9.3} cy={6.5} rx={1.9} ry={2.5} fill="#FFFFFF" /><Ellipse cx={14.7} cy={6.5} rx={1.9} ry={2.5} fill="#FFFFFF" /></G>;
    case 'view': return <G><Path d="M2.5 19l6-8 3.5 4.5 2.5-3 7 6.5z" fill="#FFFFFF" /><Circle cx={17} cy={6.5} r={2.6} fill="#FFFFFF" /><Path d="M17 1.8v1M21.7 6.5h-1M13.3 6.5h-1M20.3 3.2l-.7.7M13.7 3.2l.7.7" {...s} strokeWidth={1.4} /></G>;
    default: return null;
  }
}

/** Шар для боулинга: тёмная глянцевая сфера с тремя отверстиями. */
function BowlingBall({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Defs>
        <RadialGradient id="bb" cx="35%" cy="30%" r="75%"><Stop offset="0" stopColor="#8E7BB8" /><Stop offset="0.45" stopColor="#3A3046" /><Stop offset="1" stopColor="#16121F" /></RadialGradient>
        <RadialGradient id="bbh" cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.85} /><Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} /></RadialGradient>
      </Defs>
      <Circle cx={24} cy={24} r={21} fill="url(#bb)" stroke="#FFFFFF" strokeWidth={2.5} />
      <Circle cx={21} cy={17} r={2.7} fill="#0B0910" /><Circle cx={28.5} cy={16} r={2.7} fill="#0B0910" /><Circle cx={25} cy={24.5} r={3.3} fill="#0B0910" />
      <Ellipse cx={15} cy={13} rx={7} ry={4.5} fill="url(#bbh)" transform="rotate(-30 15 13)" />
    </Svg>
  );
}

export const AttractionPin = memo(function AttractionPin({ a, label, onPress }: { a: Attraction; label: boolean; onPress: () => void }) {
  const color = KIND_COLOR[a.kind];
  const photo = a.kind === 'photo';
  return (
    <Pressable onPress={onPress} style={styles.hit} accessibilityRole="button" accessibilityLabel={`${a.name}${a.free ? ', бесплатно' : ''}`} hitSlop={4}>
      <View style={styles.anchor} pointerEvents="none">
        {a.kind === 'bowling' ? <BowlingBall size={36} /> : (
          <View style={[photo ? styles.photo : styles.badge, { backgroundColor: color }]}>
            <Svg width={photo ? 17 : 20} height={photo ? 17 : 20} viewBox="0 0 24 24"><Glyph kind={a.kind} /></Svg>
          </View>
        )}
        {label && <Text style={styles.label} numberOfLines={2}>{a.name}</Text>}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  hit: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  anchor: { width: 0, height: 0, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  // Места — скруглённые квадраты (события — круги): та же кромка, тень и подпись с белым ореолом (docs/MAP-ICONS.md).
  badge: { width: 34, height: 34, borderRadius: 11, borderWidth: 2.5, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 8px -1px rgba(23,22,26,0.42)' },
  photo: { width: 28, height: 28, borderRadius: 14, borderWidth: 2.5, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 8px -1px rgba(23,22,26,0.42)' },
  label: { position: 'absolute', left: 21, top: -14, width: 118, fontFamily: fonts.body700, fontSize: 11, lineHeight: 13.5, color: colors.ink,
    textShadowColor: 'rgba(252,251,248,0.95)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 0 } },
});
