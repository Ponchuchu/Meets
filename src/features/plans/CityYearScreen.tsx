// «Год в Алматы»: большие городские события по порядку — что идёт, что скоро, что позже, и что ждём в следующем году.
// У каждого — своя иконка и цвет (те же на карте). Даты 2027 ещё не объявлены — пишем честно.
import { router } from 'expo-router';
import { ChevronLeft, MapPin } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cityYear, leftText, type CityStatus } from '../../data/cityYear';
import { now as clockNow } from '../../lib/clock';
import { useMapState } from '../../state/map';
import { colors, fonts } from '../../theme';
import { plate } from '../../ui/glass';

const HEAD: Record<CityStatus, string> = { now: 'ИДЁТ СЕЙЧАС', soon: 'СКОРО', later: 'ПОЗЖЕ В ЭТОМ ГОДУ', next: 'В СЛЕДУЮЩЕМ ГОДУ' };

export default function CityYearScreen() {
  const insets = useSafeAreaInsets();
  const list = cityYear(clockNow());
  const back = () => (router.canGoBack() ? router.back() : router.replace('/plans'));
  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingTop: Math.max(50, insets.top + 6), paddingHorizontal: 16, paddingBottom: insets.bottom + 32, gap: 10 }}>
      <View style={styles.head}>
        <Pressable onPress={back} style={styles.back} accessibilityRole="button" accessibilityLabel="Назад"><ChevronLeft size={24} color={colors.ink} strokeWidth={2.2} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1} accessibilityRole="header">Год в Алматы</Text>
          <Text style={styles.sub}>Большие события города — на карте появляются сами, когда подходит время</Text>
        </View>
      </View>
      {list.map((s, i) => {
        const first = i === 0 || list[i - 1].status !== s.status;
        const { e } = s;
        return (
          <View key={e.id} style={{ gap: 8 }}>
            {first && <Text style={styles.cap}>{HEAD[s.status]}</Text>}
            <Pressable disabled={!e.point} onPress={() => { if (!e.point) return; useMapState.getState().setCityFocus(e.id); router.navigate('/'); }}
              style={({ pressed }) => [styles.card, s.status === 'next' && { opacity: 0.72 }, pressed && { transform: [{ scale: 0.98 }] }]}
              accessibilityRole={e.point ? 'button' : 'text'} accessibilityLabel={`${e.title}, ${s.when}${e.free ? ', бесплатно' : ''}`}>
              <View style={[styles.icon, { backgroundColor: e.color }]}>
                <View style={styles.iconShine} />
                <e.Icon size={26} color="#FFFFFF" strokeWidth={2} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.title} numberOfLines={1}>{e.title}</Text>
                <Text style={styles.line} numberOfLines={1}>{e.sub}</Text>
                <View style={styles.tags}>
                  <Text style={[styles.when, (s.status === 'now' || s.status === 'soon') && { color: colors.accentText }]}>{s.status === 'soon' ? `${leftText(s)} · ` : ''}{s.when}</Text>
                </View>
                <View style={styles.tags}>
                  {e.free && <View style={[styles.tag, { backgroundColor: '#D7EBDD' }]}><Text style={[styles.tagText, { color: '#1F6B43' }]}>бесплатно</Text></View>}
                  {e.hours && <View style={styles.tag}><Text style={styles.tagText}>{e.hours}</Text></View>}
                  {e.place && <View style={[styles.tag, { flexDirection: 'row', gap: 3 }]}>{e.point && <MapPin size={11} color={colors.ink} strokeWidth={2.4} />}<Text style={styles.tagText}>{e.place}</Text></View>}
                </View>
              </View>
            </Pressable>
          </View>
        );
      })}
      <Text style={styles.note}>Даты — ориентир по 2026 году. Как только организаторы объявят точные дни, событие появится в ленте и на карте с билетами.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 6 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginLeft: -10 },
  h1: { fontFamily: fonts.display800, fontSize: 28, letterSpacing: -0.8, color: colors.ink },
  sub: { fontFamily: fonts.body400, fontSize: 14, lineHeight: 19, color: colors.muted2, marginTop: 2 },
  cap: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.8, color: colors.muted, marginTop: 10 },
  card: { flexDirection: 'row', gap: 14, padding: 14, borderRadius: 22, ...plate, alignItems: 'center' },
  icon: { width: 58, height: 58, borderRadius: 19, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.18), 0 6px 14px -6px rgba(23,22,26,0.45)' },
  iconShine: { position: 'absolute', top: 0, left: 0, right: 0, height: '45%', backgroundColor: 'rgba(255,255,255,0.22)' },
  title: { fontFamily: fonts.display700, fontSize: 17, color: colors.ink },
  line: { fontFamily: fonts.body400, fontSize: 13.5, color: colors.muted2 },
  when: { fontFamily: fonts.mono600, fontSize: 11, letterSpacing: 0.2, color: colors.ink },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  tag: { height: 22, paddingHorizontal: 8, borderRadius: 11, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  tagText: { fontFamily: fonts.body600, fontSize: 11.5, color: colors.ink },
  note: { fontFamily: fonts.body400, fontSize: 12.5, lineHeight: 18, color: colors.muted, marginTop: 8 },
});
