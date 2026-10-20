// Панель разработчика /dev. Три вкладки, у каждой одна задача:
//   Ивенты    — найти новые события, согласовать очередь, посмотреть, что на карте;
//   Аналитика — что требует внимания (ошибки, пустые поля), люди и метрики из базы;
//   Настройки — ИИ-поиск, расписание, публикация, источники, подключение.
// Настоящие данные — только команде (таблица staff), остальным — демо.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isStaff, loadStats } from '../../admin/api';
import { Attention, type Goto } from '../../admin/ui/Attention';
import { EventsList, type ListFilter } from '../../admin/ui/EventsList';
import { Metrics } from '../../admin/ui/Metrics';
import { Moderation } from '../../admin/ui/Moderation';
import { OverviewBlock, useOverview } from '../../admin/ui/Overview';
import { SearchCard } from '../../admin/ui/SearchCard';
import { SettingsTab } from '../../admin/ui/SettingsTab';
import { TasteAdmin } from '../../admin/ui/TasteAdmin';
import { Chip, Section } from '../../admin/ui/kit';
import { colors, fonts } from '../../theme';

type Tab = 'events' | 'analytics' | 'settings';
type Sub = 'queue' | 'map';
const TABS: [Tab, string][] = [['events', 'Ивенты'], ['analytics', 'Аналитика'], ['settings', 'Настройки']];

export default function Admin() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const tab: Tab = TABS.some(([k]) => k === params.tab) ? (params.tab as Tab) : 'events';
  const [sub, setSub] = useState<Sub>('queue');
  const [filter, setFilter] = useState<ListFilter>('all');
  const [taste, setTaste] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { data: staff = false } = useQuery({ queryKey: ['admin', 'staff'], queryFn: isStaff });
  const stats = useQuery({ queryKey: ['admin', 'stats'], queryFn: loadStats, enabled: staff });
  const overview = useOverview(staff);

  const showFound = useCallback(() => setSub('queue'), []);
  const go: Goto = (to, s) => {
    router.setParams({ tab: to });
    if (s === 'queue') setSub('queue');
    if (s === 'map') { setSub('map'); setFilter('all'); }
    if (s === 'gaps') { setSub('map'); setFilter('gaps'); }
  };
  // Точка на вкладке «Аналитика», если есть что исправить.
  const alerts = !!overview.data && (overview.data.runs_failed_24h > 0 || overview.data.drafts_stale > 0 || overview.data.events_no_place > 0 || overview.data.events_no_price > 0);
  const waiting = stats.data?.waiting ?? (staff ? 0 : 4);
  const refresh = async () => { setRefreshing(true); await qc.invalidateQueries({ queryKey: ['admin'] }); setRefreshing(false); };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
      <View style={styles.head}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/me'))} style={styles.back} accessibilityRole="button" accessibilityLabel="Назад" hitSlop={6}>
          <ChevronLeft size={26} color={colors.ink} strokeWidth={2} />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">Панель разработчика</Text>
      </View>
      <View style={styles.seg} accessibilityRole="tablist">
        {TABS.map(([k, label]) => (
          <Pressable key={k} onPress={() => router.setParams({ tab: k })} style={[styles.segBtn, tab === k && styles.segOn]} accessibilityRole="tab" accessibilityState={{ selected: tab === k }}>
            <Text style={[styles.segText, tab === k && { color: colors.paper }]}>{label}</Text>
            {k === 'events' && waiting > 0 && <View style={styles.count}><Text style={styles.countText}>{waiting}</Text></View>}
            {k === 'analytics' && alerts && <View style={styles.dot} accessibilityLabel="Есть что исправить" />}
          </Pressable>
        ))}
      </View>
      {!staff && <Text style={styles.demo}>Демо: настоящие данные откроются после входа сотрудника (таблица staff в Supabase).</Text>}
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}>
        <View style={styles.page}>
          {tab === 'events' && (
            <>
              <SearchCard live={staff} onSettings={() => go('settings')} onDone={showFound} />
              <View style={styles.subs}>
                <Chip label="Новые" a11y="Новые: найденное, ждёт проверки" count={waiting} on={sub === 'queue'} onPress={() => setSub('queue')} />
                <Chip label="Все" a11y="Все события на карте" count={staff ? overview.data?.events_upcoming : undefined} on={sub === 'map'} onPress={() => setSub('map')} />
              </View>
              {sub === 'queue' ? <Moderation live={staff} /> : <EventsList live={staff} filter={filter} onFilter={setFilter} />}
            </>
          )}
          {tab === 'analytics' && (
            <>
              <OverviewBlock live={staff} />
              <Attention live={staff} go={go} />
              <Metrics live={staff} />
              <Section fold="closed" title="Вкус человека" hint="Найди человека по нику и увидишь, что ему показываем и почему.">
                {taste ? <TasteAdmin live={staff} /> : <Chip label="Открыть" onPress={() => setTaste(true)} />}
              </Section>
            </>
          )}
          {tab === 'settings' && <SettingsTab live={staff} />}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  head: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, minHeight: 48 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.display700, fontSize: 20, color: colors.ink, letterSpacing: -0.3 },
  seg: { flexDirection: 'row', gap: 4, marginHorizontal: 16, marginVertical: 8, padding: 4, borderRadius: 18, backgroundColor: colors.sand },
  segBtn: { flex: 1, minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  segOn: { backgroundColor: colors.ink },
  segText: { fontFamily: fonts.display700, fontSize: 15, color: colors.ink },
  count: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  countText: { fontFamily: fonts.mono600, fontSize: 10.5, color: colors.ink },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.accent },
  demo: { fontFamily: fonts.body400, fontSize: 12.5, color: colors.muted, textAlign: 'center', paddingHorizontal: 16, paddingBottom: 6 },
  page: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 8, gap: 24 },
  subs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
