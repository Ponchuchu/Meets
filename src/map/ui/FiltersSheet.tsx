// Фильтр — шторка на карте (MapFilters): цена, категории, слои.
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../../theme';
import { Slider, Switch } from '../../ui/controls';
import { FILTER_CATS, MAX_PRICE, type MapFilters } from '../filters';

const fmt = (v: number) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export function FiltersSheet({ f, set, reset, onShow, showText }: {
  f: MapFilters; set: (p: Partial<MapFilters>) => void; reset: () => void; onShow: () => void; showText: string;
}) {
  const priceLabel = f.free ? 'бесплатно' : f.max >= MAX_PRICE ? 'любой' : `до ${fmt(f.max)} ₸`;
  return (
    <ScrollView style={{ maxHeight: 640 }} contentContainerStyle={{ gap: 16 }} showsVerticalScrollIndicator={false}>
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">Фильтры</Text>
        <Pressable onPress={reset} hitSlop={8} accessibilityRole="button"><Text style={styles.reset}>Сбросить</Text></Pressable>
      </View>

      <View style={styles.block}>
        <Text style={styles.cap}>ЦЕНА</Text>
        <View style={styles.box}>
          <View style={[styles.line, styles.sep]}>
            <Text style={[styles.name, { flex: 1 }]}>Только бесплатные</Text>
            <Switch on={f.free} onChange={(free) => set(free ? { free } : { free, max: f.max === 0 ? 5000 : f.max })} label="Только бесплатные" />
          </View>
          <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10, gap: 4 }}>
            <View style={styles.budgetHead}>
              <Text style={styles.name}>Бюджет</Text>
              <Text style={styles.budget}>{priceLabel}</Text>
            </View>
            {/* Довёл бюджет до нуля — это и есть «Только бесплатные». */}
            <Slider value={f.free ? 0 : f.max} min={0} max={MAX_PRICE} step={500} onChange={(max) => set(max === 0 ? { max, free: true } : { max, free: false })} label="Максимальная цена билета" />
            <View style={styles.scale}>
              {['0 ₸', '10 000', '20 000+'].map((t) => <Text key={t} style={styles.scaleText}>{t}</Text>)}
            </View>
          </View>
        </View>
      </View>

      <View style={styles.block}>
        <Text style={styles.cap}>ЧТО ИНТЕРЕСНО</Text>
        <View style={styles.chips} accessibilityLabel="Категории">
          {FILTER_CATS.map(([k, label]) => {
            const on = f.cats.includes(k);
            return (
              <Pressable key={k} onPress={() => set({ cats: on ? f.cats.filter((x) => x !== k) : [...f.cats, k] })}
                accessibilityRole="button" accessibilityState={{ selected: on }}
                style={[styles.chip, { backgroundColor: on ? colors.ink : colors.card, borderColor: on ? colors.ink : colors.line2 }]}>
                <Text style={[styles.chipText, { color: on ? colors.paper : colors.ink }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.block}>
        <Text style={styles.cap}>НА КАРТЕ</Text>
        <View style={styles.box}>
          <View style={[styles.line, styles.sep]}>
            <Text style={[styles.name, { flex: 1 }]}>Друзья</Text>
            <Switch on={f.friends} onChange={(friends) => set({ friends })} label="Друзья" />
          </View>
          <View style={styles.line}>
            <Text style={[styles.name, { flex: 1 }]}>Где ищут компанию</Text>
            <Switch on={f.company} onChange={(company) => set({ company })} label="Где ищут компанию" />
          </View>
        </View>
      </View>

      <Pressable onPress={onShow} style={styles.show} accessibilityRole="button">
        <Text style={styles.showText}>{showText}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fonts.display700, fontSize: 22, letterSpacing: -0.2, color: colors.ink },
  reset: { fontFamily: fonts.body600, fontSize: 14, color: colors.ink, textDecorationLine: 'underline' },
  block: { gap: 8 },
  cap: { fontFamily: fonts.mono600, fontSize: 11, letterSpacing: 0.9, color: colors.muted },
  box: { borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  sep: { borderBottomWidth: 1, borderBottomColor: colors.sand },
  name: { fontFamily: fonts.body600, fontSize: 15, color: colors.ink },
  budgetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  budget: { fontFamily: fonts.display700, fontSize: 17, color: colors.ink },
  scale: { flexDirection: 'row', justifyContent: 'space-between' },
  scaleText: { fontFamily: fonts.mono500, fontSize: 10.5, color: colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { height: 38, paddingHorizontal: 14, borderWidth: 1, borderRadius: 19, justifyContent: 'center' },
  chipText: { fontFamily: fonts.body600, fontSize: 13.5 },
  show: { height: 54, borderRadius: 16, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  showText: { fontFamily: fonts.body600, fontSize: 16, color: colors.paper },
});
