// Панель разработчика /dev. Шапка: «Панель» и колокольчик «Уведомления» (что сломано или ждёт решения — отдельным экраном).
// Четыре вкладки, у каждой одна задача:
//   Обзор     — главные цифры, метрики рекомендаций и «вкус человека» (свёрнуты);
//   События   — новые на проверку с кнопкой «Опубликовать всё» и все события на карте;
//   Поиск     — запуск поиска, его ход (анимация — только пока идёт) и история запусков;
//   Настройки — источники, фото, публикация, расписание, ИИ, подключения (всё свёрнуто).
// Рисуется только открытая вкладка: запросы других вкладок не идут. Настоящие данные — только команде (таблица staff).
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Bell, ChartColumn, ChevronLeft, UserSearch } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isStaff, loadStats } from '../../admin/api';
import { useRobotView } from '../../admin/useRobot';
import { Notifications, useAttention, type DevTab, type Goto } from '../../admin/ui/Attention';
import { EventsList, type ListFilter } from '../../admin/ui/EventsList';
import { Metrics } from '../../admin/ui/Metrics';
import { Moderation } from '../../admin/ui/Moderation';
import { OverviewBlock } from '../../admin/ui/Overview';
import { RunHistory } from '../../admin/ui/RunHistory';
import { SearchCard } from '../../admin/ui/SearchCard';
import { SettingsTab } from '../../admin/ui/SettingsTab';
import { TasteAdmin } from '../../admin/ui/TasteAdmin';
import { Chip, Section } from '../../admin/ui/kit';
import { colors, fonts } from '../../theme';

type Sub = 'queue' | 'map';
const TABS: [DevTab, string][] = [['overview', 'Обзор'], ['events', 'События'], ['search', 'Поиск'], ['settings', 'Настройки']];
// Старые ссылки (/dev?tab=analytics) ведут в «Обзор».
const OLD: Record<string, DevTab> = { analytics: 'overview' };

export default function Admin() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ tab?: string; view?: string }>();
  const raw = OLD[params.tab ?? ''] ?? params.tab;
  const tab: DevTab = TABS.some(([k]) => k === raw) ? (raw as DevTab) : 'overview';
  const alertsOpen = params.view === 'alerts';
  const [sub, setSub] = useState<Sub>('queue');
  const [filter, setFilter] = useState<ListFilter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const { data: staff = false } = useQuery({ queryKey: ['admin', 'staff'], queryFn: isStaff });
  const stats = useQuery({ queryKey: ['admin', 'stats'], queryFn: loadStats, enabled: staff });
  const attention = useAttention(staff);

  const openAlerts = useCallback(() => router.setParams({ view: 'alerts' }), []);
  const closeAlerts = useCallback(() => router.setParams({ view: undefined }), []);
  const go: Goto = useCallback((to, s) => {
    router.setParams({ tab: to, view: undefined });
    if (s === 'queue') setSub('queue');
    if (s === 'map') { setSub('map'); setFilter('all'); }
    if (s === 'gaps') { setSub('map'); setFilter('gaps'); }
  }, []);
  const showFound = useCallback(() => setSub('queue'), []);
  // «Назад» на Android закрывает уведомления, а не всю панель.
  useEffect(() => {
    if (!alertsOpen) return;
    const h = BackHandler.addEventListener('hardwareBackPress', () => { closeAlerts(); return true; });
    return () => h.remove();
  }, [alertsOpen, closeAlerts]);

  const waiting = stats.data?.waiting ?? (staff ? 0 : 4);
  const refresh = async () => { setRefreshing(true); await qc.invalidateQueries({ queryKey: ['admin'] }); setRefreshing(false); };

  if (alertsOpen) return <Notifications live={staff} go={go} onClose={closeAlerts} />;

  const n = attention.count;
  return (
    <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
      <View style={styles.head}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/me'))} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Назад" hitSlop={6}>
          <ChevronLeft size={26} color={colors.ink} strokeWidth={1.8} />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">Панель</Text>
        <Pressable onPress={openAlerts} style={({ pressed }) => [styles.bell, pressed && { opacity: 0.7 }]} accessibilityRole="button"
          accessibilityLabel={n ? `Уведомления: ${n}` : 'Уведомления'} hitSlop={4}>
          <Bell size={22} color={colors.ink} strokeWidth={1.8} />
          {n > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{n > 9 ? '9+' : n}</Text></View>}
        </Pressable>
      </View>
      <View style={styles.seg} accessibilityRole="tablist">
        {TABS.map(([k, label]) => (
          <Pressable key={k} onPress={() => router.setParams({ tab: k })} style={[styles.segBtn, tab === k && styles.segOn]} accessibilityRole="tab"
            accessibilityState={{ selected: tab === k }} accessibilityLabel={k === 'events' && waiting > 0 ? `${label}, новых: ${waiting}` : label}>
            <Text style={[styles.segText, tab === k && { color: colors.paper }]} numberOfLines={1}>{label}</Text>
            {k === 'events' && waiting > 0 && <View style={styles.count} />}
          </Pressable>
        ))}
      </View>
      {!staff && <Text style={styles.demo}>Демо: настоящие данные — после входа сотрудника</Text>}
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}>
        <View style={styles.page}>
          {tab === 'overview' && (
            <>
              {/* Уведомления — только в колокольчике сверху (21 окт.): в самих вкладках не дублируем. */}
              <OverviewBlock live={staff} />
              <View style={{ gap: 12 }}>
                <Section fold="closed" icon={ChartColumn} title="Рекомендации" hint="Доля «пойду», дошли, возвраты и отмены.">
                  <Metrics live={staff} />
                </Section>
                <Section fold="closed" icon={UserSearch} title="Вкус человека" hint="Найди человека по нику и увидишь, что ему показываем и почему.">
                  <TasteAdmin live={staff} />
                </Section>
              </View>
            </>
          )}
          {tab === 'events' && (
            <>
              <View style={styles.subs}>
                <Chip label="Новые" a11y="Новые: найденное, ждёт проверки" count={waiting} on={sub === 'queue'} onPress={() => setSub('queue')} />
                <Chip label="На карте" a11y="Все события на карте" on={sub === 'map'} onPress={() => setSub('map')} />
              </View>
              {sub === 'queue' ? <Moderation live={staff} /> : <EventsList live={staff} filter={filter} onFilter={setFilter} />}
            </>
          )}
          {tab === 'search' && <SearchTab live={staff} onSettings={() => go('settings')} onDone={showFound} onReview={() => go('events', 'queue')} />}
          {tab === 'settings' && <SettingsTab live={staff} />}
        </View>
      </ScrollView>
    </View>
  );
}

function SearchTab({ live, onSettings, onDone, onReview }: { live: boolean; onSettings: () => void; onDone: () => void; onReview: () => void }) {
  const view = useRobotView(live);
  return (
    <>
      <SearchCard live={live} onSettings={onSettings} onDone={onDone} onReview={onReview} />
      <RunHistory live={live} runs={view.runs} loading={view.loading} />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  head: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, minHeight: 52 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontFamily: fonts.display700, fontSize: 24, color: colors.ink, letterSpacing: -0.4 },
  bell: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  badge: { position: 'absolute', top: -3, right: -3, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: colors.accent, borderWidth: 2, borderColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.mono600, fontSize: 10.5, color: colors.ink },
  seg: { flexDirection: 'row', gap: 2, marginHorizontal: 16, marginTop: 6, marginBottom: 8, padding: 4, borderRadius: 16, backgroundColor: colors.sand },
  segBtn: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  segOn: { backgroundColor: colors.ink },
  segText: { fontFamily: fonts.body700, fontSize: 13, letterSpacing: -0.1, color: colors.ink },
  // Точка на «События», если есть новые (само число — в «Новые» и в подписи для экранного диктора): подпись не сдвигается, доли вкладок равные.
  count: { position: 'absolute', top: 7, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  demo: { fontFamily: fonts.body400, fontSize: 12, color: colors.muted, textAlign: 'center', paddingHorizontal: 16, paddingBottom: 4 },
  page: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 8, gap: 16 },
  subs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
