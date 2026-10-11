// Панель разработчика /dev: две вкладки. «Аналитика» — люди, метрики, вкус. «Ивенты» — поиск Gemini, расписание,
// согласование, все события с поиском, источники. Настоящие данные — только команде (таблица staff), остальным — демо.
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isStaff } from '../../admin/api';
import { Chip, Section } from '../../admin/ui/kit';
import { EventsList } from '../../admin/ui/EventsList';
import { Metrics } from '../../admin/ui/Metrics';
import { Moderation } from '../../admin/ui/Moderation';
import { OverviewBlock } from '../../admin/ui/Overview';
import { RobotPanel } from '../../admin/ui/RobotPanel';
import { Schedule } from '../../admin/ui/Schedule';
import { Sources } from '../../admin/ui/Sources';
import { TasteAdmin } from '../../admin/ui/TasteAdmin';
import { colors, fonts } from '../../theme';

type Tab = 'analytics' | 'events';
type Sub = 'queue' | 'all' | 'sources';
const TABS: [Tab, string][] = [['analytics', 'Аналитика'], ['events', 'Ивенты']];

export default function Admin() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const tab: Tab = params.tab === 'analytics' ? 'analytics' : 'events';
  const [sub, setSub] = useState<Sub>('queue');
  const { data: staff = false } = useQuery({ queryKey: ['admin', 'staff'], queryFn: isStaff });

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
      <View style={styles.head}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/me'))} style={styles.back} accessibilityRole="button" accessibilityLabel="Назад" hitSlop={6}>
          <ChevronLeft size={26} color={colors.ink} strokeWidth={2} />
        </Pressable>
        <View style={styles.badge}><Text style={styles.badgeText}>РЕЖИМ РАЗРАБОТЧИКА</Text></View>
      </View>
      <View style={styles.seg}>
        {TABS.map(([k, label]) => (
          <Pressable key={k} onPress={() => router.setParams({ tab: k })} style={[styles.segBtn, tab === k && styles.segOn]} accessibilityRole="tab" accessibilityState={{ selected: tab === k }}>
            <Text style={[styles.segText, tab === k && { color: colors.paper }]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {!staff && <Text style={styles.demo}>Демо: настоящие данные откроются после входа сотрудника (таблица staff в Supabase).</Text>}
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={styles.page}>
          {tab === 'analytics' ? (
            <>
              <OverviewBlock live={staff} />
              <Metrics live={staff} />
              <Section title="Вкус человека" hint="Найди человека по нику — увидишь, что ему показываем и почему.">
                <TasteAdmin live={staff} />
              </Section>
            </>
          ) : (
            <>
              <RobotPanel live={staff} />
              <Schedule live={staff} />
              <View style={styles.subs}>
                <Chip label="Согласование" on={sub === 'queue'} onPress={() => setSub('queue')} />
                <Chip label="Все события" on={sub === 'all'} onPress={() => setSub('all')} />
                <Chip label="Источники" on={sub === 'sources'} onPress={() => setSub('sources')} />
              </View>
              {sub === 'queue' && <Moderation live={staff} />}
              {sub === 'all' && <EventsList live={staff} />}
              {sub === 'sources' && <Sources live={staff} />}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, minHeight: 48 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  badge: { backgroundColor: colors.ink, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  badgeText: { fontFamily: fonts.mono600, fontSize: 11, color: colors.paper, letterSpacing: 0.8 },
  seg: { flexDirection: 'row', gap: 6, marginHorizontal: 16, marginVertical: 8, padding: 4, borderRadius: 18, backgroundColor: colors.sand },
  segBtn: { flex: 1, minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: colors.ink },
  segText: { fontFamily: fonts.display700, fontSize: 16, color: colors.ink },
  demo: { fontFamily: fonts.body400, fontSize: 12.5, color: colors.muted, textAlign: 'center', paddingHorizontal: 16, paddingBottom: 6 },
  page: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 8, gap: 28 },
  subs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
