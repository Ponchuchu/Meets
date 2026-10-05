// Состояния карты v6: «Нет интернета» (V6Offline), «Нет связи с сервером», нет геолокации (V6OfflineNoGeo),
// неточно — круг точности (V6OfflineGps), «Где я был» — процент (V6MapLensExplore), пробки — подпись, фон — «Всё время».
import { Navigation, WifiOff } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOut } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { colors, fonts } from '../../theme';

export function NetPill({ kind, onRetry }: { kind: 'offline' | 'server'; onRetry?: () => void }) {
  return (
    <Animated.View entering={FadeInUp.duration(220)} exiting={FadeOut} style={styles.pillWrap} pointerEvents="box-none">
      <Pressable onPress={kind === 'server' ? onRetry : undefined} style={styles.pill} accessibilityRole={kind === 'server' ? 'button' : 'text'} accessibilityLiveRegion="polite">
        <WifiOff size={18} color={colors.accent} strokeWidth={1.8} />
        <Text style={styles.pillText}>{kind === 'offline' ? 'Нет интернета' : 'Нет связи с сервером · Повторить'}</Text>
      </Pressable>
    </Animated.View>
  );
}

export function NoGeoCard({ onEnable }: { onEnable: () => void }) {
  return (
    <View style={styles.veil}>
      <View style={styles.card}>
        <View style={styles.icon}><Navigation size={26} color={colors.ink} strokeWidth={1.9} /></View>
        <Text style={styles.cardTitle}>Включи геолокацию</Text>
        <Pressable onPress={onEnable} style={({ pressed }) => [styles.btn, pressed && { transform: [{ scale: 0.98 }] }]} accessibilityRole="button">
          <Text style={styles.btnText}>Включить</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Круг точности вокруг моей точки, когда GPS неточный. size — диаметр в пикселях. */
export function AccuracyRing({ size }: { size: number }) {
  return (
    <View pointerEvents="none" style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: 'rgba(240,82,31,0.16)', borderWidth: 1, borderColor: 'rgba(240,82,31,0.35)' }} />
      <View style={styles.meDot} />
    </View>
  );
}

export function ExploreBadge({ pct, value }: { pct: string; value: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <View style={styles.explore} accessibilityLabel={`Открыто ${pct} города`}>
      <Svg width={50} height={50} viewBox="0 0 50 50">
        <Circle cx={25} cy={25} r={r} stroke="#E6E0D4" strokeWidth={5} fill="none" />
        <Circle cx={25} cy={25} r={r} stroke={colors.accent} strokeWidth={5} fill="none" strokeLinecap="round"
          strokeDasharray={`${Math.max(2, c * Math.min(1, value))} ${c}`} transform="rotate(-90 25 25)" />
      </Svg>
      <View>
        <Text style={styles.pct}>{pct.replace(' ', '')}</Text>
        <Text style={styles.pctSub}>открыто</Text>
      </View>
    </View>
  );
}

export function TrafficChip({ hasKey }: { hasKey: boolean }) {
  return (
    <View style={styles.chip}>
      <View style={styles.legend}>
        {['#2F8F5B', '#E2A21B', '#C83A26'].map((c) => <View key={c} style={[styles.legendDot, { backgroundColor: c }]} />)}
      </View>
      <Text style={styles.chipText}>{hasKey ? 'Пробки сейчас · зелёный — свободно' : 'Пробки появятся в сборке для телефона'}</Text>
    </View>
  );
}

export function BackgroundAsk({ onAllow, onLater }: { onAllow: () => void; onLater: () => void }) {
  return (
    <View style={styles.ask}>
      <Text style={styles.askTitle}>Друзья видят тебя, даже когда приложение закрыто</Text>
      <Text style={styles.askText}>Разреши геолокацию «Всё время». Выключить — «Невидимка» в профиле.</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
        <Pressable onPress={onAllow} style={[styles.askBtn, { backgroundColor: colors.ink }]} accessibilityRole="button"><Text style={[styles.askBtnText, { color: colors.paper }]}>Разрешить</Text></Pressable>
        <Pressable onPress={onLater} style={[styles.askBtn, { backgroundColor: colors.sand }]} accessibilityRole="button"><Text style={styles.askBtnText}>Позже</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pillWrap: { alignItems: 'center' },
  pill: { height: 40, paddingHorizontal: 18, borderRadius: 20, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pillText: { fontFamily: fonts.body700, fontSize: 15, color: colors.paper },
  veil: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(243,240,232,0.72)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  card: { width: '100%', maxWidth: 340, borderRadius: 26, backgroundColor: '#FBFAF6', padding: 22, alignItems: 'center', gap: 18, shadowColor: colors.ink, shadowOpacity: 0.16, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  icon: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: fonts.display800, fontSize: 23, letterSpacing: -0.5, color: colors.ink, textAlign: 'center' },
  btn: { alignSelf: 'stretch', height: 54, borderRadius: 16, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: fonts.body700, fontSize: 16.5, color: colors.paper },
  meDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.accent, borderWidth: 4, borderColor: '#FFFFFF' },
  explore: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 8, paddingRight: 16, height: 66, borderRadius: 33, backgroundColor: '#FBFAF6', alignSelf: 'flex-start', shadowColor: colors.ink, shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  pct: { fontFamily: fonts.display800, fontSize: 25, letterSpacing: -0.6, color: colors.ink, lineHeight: 28 },
  pctSub: { fontFamily: fonts.body600, fontSize: 13, color: colors.muted2 },
  chip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 10, height: 44, paddingLeft: 12, paddingRight: 16, borderRadius: 22, backgroundColor: '#FBFAF6', shadowColor: colors.ink, shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  legend: { flexDirection: 'row', gap: 3 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontFamily: fonts.body700, fontSize: 14, color: colors.ink },
  ask: { borderRadius: 22, backgroundColor: '#FBFAF6', padding: 16, gap: 4, shadowColor: colors.ink, shadowOpacity: 0.14, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  askTitle: { fontFamily: fonts.display700, fontSize: 16.5, color: colors.ink },
  askText: { fontFamily: fonts.body400, fontSize: 14, lineHeight: 19, color: colors.muted2 },
  askBtn: { flex: 1, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  askBtnText: { fontFamily: fonts.body700, fontSize: 15, color: colors.ink },
});
