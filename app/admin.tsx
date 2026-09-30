// Web-админка /admin (docs/PIPELINE.md §5): Модерация / Рекомендации / Источники / Метрики.
// Настоящие данные — только команде (таблица staff). Остальным — демо макета, в базу ничего не пишется.
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isStaff } from '../src/admin/api';
import { Metrics } from '../src/admin/ui/Metrics';
import { Moderation } from '../src/admin/ui/Moderation';
import { Sources } from '../src/admin/ui/Sources';
import { TasteAdmin } from '../src/admin/ui/TasteAdmin';
import { useSession } from '../src/state/session';
import { colors, fonts } from '../src/theme';

type Tab = 'moderation' | 'taste' | 'sources' | 'metrics';
const TABS: [Tab, string][] = [['moderation', 'Модерация'], ['taste', 'Рекомендации'], ['sources', 'Источники'], ['metrics', 'Метрики']];

export default function Admin() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 820;
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const tab: Tab = TABS.some(([k]) => k === params.tab) ? (params.tab as Tab) : 'moderation';
  const { data: staff = false } = useQuery({ queryKey: ['admin', 'staff'], queryFn: isStaff });
  const name = useSession((s) => s.draft.name) || 'Данил';
  const go = (t: Tab) => router.setParams({ tab: t });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {wide && (
        <View style={styles.nav}>
          <Text style={styles.logo}>рядом<Text style={{ color: colors.accent }}>.</Text> <Text style={styles.logoSub}>АДМИНКА</Text></Text>
          <View style={styles.tabs}>
            {TABS.map(([k, label]) => (
              <Pressable key={k} onPress={() => go(k)} style={[styles.tab, tab === k && styles.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: tab === k }}>
                <Text style={[styles.tabText, tab === k && styles.tabTextOn]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.who}><Text style={styles.whoText}>{staff ? `${name} · команда` : `${name} · #10482 · демо`}</Text></View>
        </View>
      )}
      {!staff && (
        <Text style={styles.demo}>Демо-режим: очередь и решения — только на этом экране. Настоящая очередь откроется после входа сотрудника (таблица staff в Supabase).</Text>
      )}
      <ScrollView contentContainerStyle={{ paddingBottom: wide ? 0 : 76 + insets.bottom }}>
        {tab === 'moderation' && <Moderation live={staff} />}
        {tab === 'taste' && <TasteAdmin live={staff} />}
        {tab === 'sources' && <Sources live={staff} />}
        {tab === 'metrics' && <Metrics live={staff} />}
      </ScrollView>
      {!wide && (
        <View style={[styles.bottom, { paddingBottom: 10 + insets.bottom }]}>
          {TABS.map(([k, label]) => (
            <Pressable key={k} onPress={() => go(k)} style={[styles.pill, tab === k && styles.pillOn]} accessibilityRole="tab" accessibilityState={{ selected: tab === k }}>
              <Text style={[styles.pillText, tab === k && { color: colors.paper }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  nav: { height: 64, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 32, gap: 32 },
  logo: { fontFamily: fonts.display800, fontSize: 21, color: colors.paper, letterSpacing: -0.5 },
  logoSub: { fontFamily: fonts.mono600, fontSize: 10.5, color: '#A9A59C', letterSpacing: 0.6 },
  tabs: { flexDirection: 'row', gap: 6, flex: 1 },
  tab: { height: 36, borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center' },
  tabOn: { backgroundColor: '#2A292E' },
  tabText: { fontFamily: fonts.body500, fontSize: 14, color: '#C9C5BC' },
  tabTextOn: { fontFamily: fonts.body700, color: colors.paper },
  who: { height: 38, minWidth: 280, borderRadius: 10, borderWidth: 1, borderColor: '#3A3940', backgroundColor: '#212024', paddingHorizontal: 14, justifyContent: 'center' },
  whoText: { fontFamily: fonts.body500, fontSize: 13.5, color: colors.paper },
  demo: { fontFamily: fonts.body400, fontSize: 12, color: colors.muted, textAlign: 'center', paddingHorizontal: 16, paddingTop: 8 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingTop: 10, backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.line },
  pill: { flex: 1, height: 38, borderRadius: 12, borderWidth: 1, borderColor: colors.line2, alignItems: 'center', justifyContent: 'center' },
  pillOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  pillText: { fontFamily: fonts.body600, fontSize: 13, color: colors.ink },
});
