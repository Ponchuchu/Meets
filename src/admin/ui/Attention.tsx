// Уведомления панели (колокольчик в шапке): всё, что сломано или ждёт решения, одним списком из базы.
// useAttention — общий расчёт (число на колокольчике и сам список), Notifications — отдельный экран со списком.
// Каждая строка говорит, что случилось, и по нажатию ведёт туда, где это исправляется.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bug, CalendarX, CircleCheck, CirclePause, CloudOff, ImageOff, Inbox, MapPinOff, SearchX, Tag, X, type LucideIcon } from 'lucide-react-native';
import { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase, withTimeout } from '../../data/client';
import { colors, fonts } from '../../theme';
import { rejectStaleDrafts } from '../api';
import { ago } from '../errors';
import { plural } from '../rules';
import { useRobotView } from '../useRobot';
import { useOverview } from './Overview';
import { useScheduleRow } from './Schedule';
import { Banner, Empty } from './kit';

export type DevTab = 'overview' | 'events' | 'search' | 'settings';
export type Goto = (to: DevTab, sub?: 'queue' | 'map' | 'gaps') => void;

type Target = { tab: DevTab; sub?: 'queue' | 'map' | 'gaps' } | 'crashes' | 'clean' | 'retry';
export interface AttentionRow { key: string; tone: 'error' | 'warn' | 'info'; icon: LucideIcon; title: string; sub?: string; target?: Target }
export interface Crash { at: string; fatal: boolean; screen: string | null; message: string; app_version: string | null }

/** Что требует внимания. Запросы лёгкие и редкие (сводка — раз в минуту, ошибки приложения — раз в 2 минуты). */
export function useAttention(live: boolean) {
  const o = useOverview(live);
  const robot = useRobotView(live);
  const sched = useScheduleRow(live);
  const crashes = useQuery({
    queryKey: ['admin', 'client_errors'], enabled: live, refetchInterval: 120_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 86400e3).toISOString();
      const r = await withTimeout(supabase().from('client_errors').select('at,fatal,screen,message,app_version').gte('at', since).order('at', { ascending: false }).limit(20));
      if (r.error) throw r.error;
      return r.data as Crash[];
    },
  });
  const d = o.data;
  const cr = useMemo(() => crashes.data ?? [], [crashes.data]);
  const paused = live && !!sched.data?.paused;
  const rows = useMemo(() => {
    const out: AttentionRow[] = [];
    if (robot.state === 'failed' && robot.error) out.push({ key: 'fail', tone: 'error', icon: SearchX, title: robot.error.title, sub: robot.error.hint, target: { tab: 'search' } });
    if (cr.length) out.push({ key: 'crash', tone: cr.some((c) => c.fatal) ? 'error' : 'warn', icon: Bug, title: `Ошибки в приложении за неделю: ${cr.length}`, sub: `Последняя: ${cr[0].screen ?? 'экран не известен'} · ${ago(cr[0].at)}`, target: 'crashes' });
    if (d) {
      if (d.events_draft > 0) out.push({ key: 'q', tone: 'warn', icon: Inbox, title: `${d.events_draft} ${plural(d.events_draft, 'событие ждёт', 'события ждут', 'событий ждут')} проверки`, sub: 'Открыть «События → Новые»', target: { tab: 'events', sub: 'queue' } });
      if (d.drafts_stale > 0) out.push({ key: 'stale', tone: 'warn', icon: CalendarX, title: `${d.drafts_stale} ${plural(d.drafts_stale, 'черновик', 'черновика', 'черновиков')} с прошедшей датой`, sub: 'Нажми — уберу из очереди', target: 'clean' });
      if (d.events_no_place > 0) out.push({ key: 'pl', tone: 'warn', icon: MapPinOff, title: `${d.events_no_place} без точной точки на карте`, sub: 'Без неё не строится маршрут', target: { tab: 'events', sub: 'gaps' } });
      if (d.events_no_price > 0) out.push({ key: 'pr', tone: 'info', icon: Tag, title: `${d.events_no_price} без цены`, sub: 'Открыть «Чего-то нет»', target: { tab: 'events', sub: 'gaps' } });
      if (d.events_no_cover > 0) out.push({ key: 'cv', tone: 'info', icon: ImageOff, title: `${d.events_no_cover} без фото`, sub: 'Покажем постер раздела' });
    }
    if (paused) out.push({ key: 'sch', tone: 'info', icon: CirclePause, title: 'Автопоиск выключен', sub: 'События ищутся только по кнопке', target: { tab: 'settings' } });
    if (o.isError) out.push({ key: 'err', tone: 'error', icon: CloudOff, title: 'Сводка не загрузилась', sub: 'Нажми, чтобы повторить', target: 'retry' });
    return out;
  }, [robot.state, robot.error, cr, d, paused, o.isError]);
  // На колокольчике — только то, что требует действия (ошибки и предупреждения), без справочных строк.
  const count = rows.filter((r) => r.tone !== 'info').length;
  return { rows, count, crashes: cr, loading: o.isLoading, refetch: o.refetch };
}

const DOT = { error: colors.accent, warn: '#D9A93B', info: colors.muted3 } as const;

const Row = memo(function Row({ r, onPress, open }: { r: AttentionRow; onPress?: (r: AttentionRow) => void; open?: boolean }) {
  const Icon = r.icon;
  const body = (
    <View style={styles.row}>
      <View style={[styles.icon, r.tone === 'error' && styles.iconErr]}>
        <Icon size={20} color={r.tone === 'error' ? colors.accentText : colors.ink} strokeWidth={1.8} />
        <View style={[styles.dot, { backgroundColor: DOT[r.tone] }]} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.title, r.tone === 'error' && { color: colors.accentText }]}>{r.title}</Text>
        {!!r.sub && <Text style={styles.sub}>{open ? 'Нажми, чтобы скрыть' : r.sub}</Text>}
      </View>
    </View>
  );
  return r.target && onPress
    ? <Pressable onPress={() => onPress(r)} accessibilityRole="button" style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}>{body}</Pressable>
    : <View style={styles.card}>{body}</View>;
});

/** Отдельный экран «Уведомления»: список на FlatList, у каждой строки — куда она ведёт. */
export function Notifications({ live, go, onClose }: { live: boolean; go: Goto; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const a = useAttention(live);
  const [showCrashes, setShowCrashes] = useState(false);
  const [done, setDone] = useState('');
  const clean = useMutation({
    mutationFn: async () => { if (!live) throw new Error('Откроется после входа сотрудника'); return rejectStaleDrafts(); },
    onSuccess: (n) => { setDone(`Убрали черновиков: ${n}`); void qc.invalidateQueries({ queryKey: ['admin'] }); },
  });
  const press = useCallback((r: AttentionRow) => {
    const t = r.target;
    if (!t) return;
    if (t === 'crashes') setShowCrashes((v) => !v);
    else if (t === 'clean') { if (!clean.isPending) clean.mutate(); }
    else if (t === 'retry') void a.refetch();
    else go(t.tab, t.sub);
  }, [go, clean, a]);

  type Item = { kind: 'row'; r: AttentionRow } | { kind: 'crash'; c: Crash; i: number };
  const items = useMemo<Item[]>(() => a.rows.flatMap((r): Item[] => [
    { kind: 'row', r: r.key === 'stale' && clean.isPending ? { ...r, sub: 'Убираю…' } : r },
    ...(r.key === 'crash' && showCrashes ? a.crashes.map((c, i): Item => ({ kind: 'crash', c, i })) : []),
  ]), [a.rows, a.crashes, showCrashes, clean.isPending]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
      <View style={styles.head}>
        <Text style={styles.h} accessibilityRole="header">Уведомления</Text>
        <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Закрыть уведомления" hitSlop={6}>
          <X size={24} color={colors.ink} strokeWidth={1.8} />
        </Pressable>
      </View>
      {!live && <Text style={styles.demo}>Пример. Настоящие уведомления — после входа сотрудника.</Text>}
      <FlatList
        data={items}
        keyExtractor={(x) => (x.kind === 'row' ? x.r.key : `c${x.i}`)}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 32 }]}
        renderItem={({ item }) => item.kind === 'row'
          ? <Row r={item.r} onPress={press} open={item.r.key === 'crash' && showCrashes} />
          : (
            <View style={styles.crash}>
              <Text style={styles.crashMeta}>{ago(item.c.at).toUpperCase()} · {item.c.fatal ? 'ВЫЛЕТ' : 'ОШИБКА'} · {item.c.screen ?? '—'}{item.c.app_version ? ` · v${item.c.app_version}` : ''}</Text>
              <Text style={styles.crashText} numberOfLines={3}>{item.c.message}</Text>
            </View>
          )}
        ListHeaderComponent={(clean.isError || !!done) ? (
          <View style={{ marginBottom: 10 }}>
            {clean.isError && <Banner tone="error" text={(clean.error as Error).message} />}
            {!!done && <Banner tone="ok" text={done} />}
          </View>
        ) : null}
        ListEmptyComponent={a.loading
          ? <Empty loading title="Проверяю, всё ли в порядке…" />
          : <Empty icon={CircleCheck} title="Всё спокойно" text="Ошибок нет, очередь пуста. Если что-то сломается — здесь появится строка." />}
        ItemSeparatorComponent={Sep}
      />
    </View>
  );
}

const Sep = () => <View style={{ height: 8 }} />;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 20, paddingRight: 10, minHeight: 52 },
  h: { fontFamily: fonts.display700, fontSize: 24, color: colors.ink, letterSpacing: -0.4 },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  demo: { fontFamily: fonts.body400, fontSize: 13, color: colors.muted, paddingHorizontal: 20, paddingBottom: 4 },
  list: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 10 },
  card: { backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  icon: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  iconErr: { backgroundColor: 'rgba(240,82,31,0.14)' },
  dot: { position: 'absolute', top: -2, right: -2, width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: colors.card },
  title: { fontFamily: fonts.body700, fontSize: 15, lineHeight: 20, color: colors.ink },
  sub: { fontFamily: fonts.body400, fontSize: 13, lineHeight: 18, color: colors.muted2 },
  crash: { marginLeft: 22, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: colors.line, gap: 2, paddingVertical: 2 },
  crashMeta: { fontFamily: fonts.mono600, fontSize: 10.5, color: colors.muted2 },
  crashText: { fontFamily: fonts.body500, fontSize: 13, color: colors.ink },
});
