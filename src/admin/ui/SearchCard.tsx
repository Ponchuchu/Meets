// «Поиск» в панели (FIX5, переделано): три понятных состояния вместо одной перегруженной карточки.
//   Готов к поиску — шаги «Где искать» (большие карточки), «На сколько вперёд», «Темы» (только для ИИ) и большая кнопка;
//   Идёт поиск     — радар, живой счётчик найденного и список источников со статусами (ждём / готово / не открылся);
//   Готово         — итог: сколько нашёл и сколько ждут проверки, кнопка «Проверить N карточек», ответы источников.
// Подробный журнал — по кнопке «Журнал», а не сразу.
import { Bot, Check, ChevronRight, Globe, Layers, RotateCcw, Search, Square, TriangleAlert, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, Easing, FadeIn, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { colors, fonts } from '../../theme';
import { ago, explainError } from '../errors';
import { ALL_TOPICS, useRobotConfig, type SearchSources } from '../robotConfig';
import { activeSources, elapsed, PERIODS, searchProblem, sourceProgress, sourceResults, TOPIC_TITLE } from '../rules';
import { useEnabledSources, useRobotCommand, useRobotView } from '../useRobot';
import { Banner, Card, Chip } from './kit';

const MODES: { id: SearchSources; title: string; sub: string; price: string; Icon: typeof Globe }[] = [
  { id: 'sites', title: 'Сайты-афиши', sub: 'код читает включённые сайты, 1–2 мин', price: 'бесплатно', Icon: Globe },
  { id: 'ai', title: 'ИИ-поиск', sub: 'ищет по интернету то, чего нет на сайтах', price: 'платно', Icon: Bot },
  { id: 'all', title: 'Всё вместе', sub: 'сначала сайты, потом ИИ добавит недостающее', price: 'платно', Icon: Layers },
];
/** Запуск на GitHub живёт не дольше 20 минут; дольше — скорее всего завис. */
const STUCK_MS = 25 * 60_000;

/** Демо (без входа сотрудника): поиск по-настоящему не идёт, но его ход и итог проигрываются — видно каждое состояние. */
const DEMO_SRC = ['Яндекс Афиша', 'Sxodim', 'Ticketon', 'onvibe.me'];
const DEMO_STEPS = [
  { at: 1800, text: 'Источник · Яндекс Афиша · найдено 9', level: 'ok' },
  { at: 3400, text: 'Источник · Sxodim · найдено 7', level: 'ok' },
  { at: 4600, text: 'Источник · Ticketon · не открылся', level: 'warn' },
  { at: 6200, text: 'Источник · onvibe.me · найдено 4', level: 'ok' },
];
function useDemoRun(on: boolean) {
  const [since, setSince] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (since == null) return;
    const id = setInterval(() => setNow(Date.now()), 400);
    return () => clearInterval(id);
  }, [since]);
  if (!on) return null;
  const t = since == null ? -1 : now - since;
  const logs = DEMO_STEPS.filter((x) => t >= x.at).map((x, i) => ({ id: i, text: x.text, level: x.level as 'ok' | 'warn' })).reverse();
  const found = logs.reduce((n, l) => n + Number(/найдено (\d+)/.exec(l.text)?.[1] ?? 0), 0);
  const running = since != null && t < 7600;
  return {
    start: () => { setSince(Date.now()); setNow(Date.now()); },
    stop: () => setSince(null),
    running, done: since != null && t >= 7600, since: since ? new Date(since).toISOString() : null, logs, found, queued: Math.round(found * 0.6),
  };
}

export function SearchCard({ live, onSettings, onDone, onReview }: { live: boolean; onSettings: () => void; onDone: () => void; onReview: () => void }) {
  const real = useRobotView(live);
  const demo = useDemoRun(!live);
  const view = demo && (demo.running || demo.done) ? {
    ...real, state: demo.running ? 'running' as const : 'done' as const, logs: demo.logs, line: demo.logs[0]?.text,
    run: { id: 'demo', status: demo.running ? 'running' as const : 'done' as const, found: demo.found, queued: demo.queued, started_at: demo.since!, finished_at: demo.running ? null : new Date().toISOString(), params: null, stats: null },
  } : real;
  const cmd = useRobotCommand(live, view.run?.id);
  const cfg = useRobotConfig();
  const enabled = useEnabledSources(live);
  const [log, setLog] = useState(false);
  const [fresh, setFresh] = useState(false);
  // С нажатия «Найти» до ответа сервера тоже показываем ход поиска — иначе непонятно, идёт он или нет.
  const [pressedAt, setPressedAt] = useState<string | null>(null);
  useEffect(() => {
    if (!pressedAt) return;
    const t = setTimeout(() => setPressedAt(null), 45_000);
    return () => clearTimeout(t);
  }, [pressedAt]);
  const serverTook = !!pressedAt && !!view.run?.started_at && Date.parse(view.run.started_at) >= Date.parse(pressedAt) - 60_000;
  const running = view.state === 'running' || (!!pressedAt && !cmd.isError && !serverTook);
  const start = () => { setFresh(true); if (demo) { demo.start(); return; } setPressedAt(new Date().toISOString()); cmd.mutate('start'); };
  const noSource = live && !enabled.loading && cfg.sources !== 'ai' && enabled.list.length === 0;
  const problem = searchProblem(cfg) ?? (noSource ? 'Включи хотя бы один источник: Настройки → Источники → «собирать»' : null);
  const cmdError = cmd.isError ? explainError(cmd.error instanceof Error ? cmd.error.message : '') : null;
  const plain = cmd.isError && cmd.error instanceof Error && /откроется|Выбери|Период|Включи/.test(cmd.error.message);

  // Был «идёт» — стало «готово»: панель сама показывает найденное.
  const was = useRef(view.state);
  useEffect(() => {
    if (was.current === 'running' && view.state === 'done') onDone();
    was.current = view.state;
  }, [view.state, onDone]);

  const siteNames = enabled.list.filter((x) => x.kind === 'site').map((x) => x.title.replace(/ · .*$/, ''));
  const tgOn = enabled.list.some((x) => x.kind === 'telegram');
  const sources = demo ? DEMO_SRC : activeSources(cfg.sources, cfg.model, live && siteNames.length ? siteNames : undefined, tgOn);
  const startedAt = view.state === 'running' ? view.run?.started_at : pressedAt ?? view.run?.started_at;

  if (running && startedAt) {
    return (
      <Card style={{ gap: 16 }}>
        <Progress since={startedAt} sources={sources} live={view.state === 'running'} found={view.state === 'running' ? view.run?.found ?? 0 : 0}
          queued={view.state === 'running' ? view.run?.queued ?? 0 : 0} line={view.state === 'running' ? view.line : 'Запускаю поиск на сервере…'} logs={view.state === 'running' ? view.logs : []} />
        <Pressable onPress={() => (demo ? demo.stop() : cmd.mutate('stop'))} style={({ pressed }) => [styles.stop, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Остановить поиск">
          <Square size={14} color={colors.ink} fill={colors.ink} /><Text style={styles.stopText}>Остановить</Text>
        </Pressable>
      </Card>
    );
  }

  const results = view.state === 'done' ? sourceResults(view.logs) : [];
  return (
    <View style={{ gap: 14 }}>
      {view.fetchError && <Banner tone="error" title="Не удалось загрузить состояние поиска" hint="Проверь связь и потяни вниз, чтобы обновить." />}

      {/* Итог последнего поиска — крупно, с переходом к найденному. */}
      {view.state === 'done' && view.run && (
        <Animated.View entering={fresh ? FadeInDown.springify().damping(16) : undefined} style={styles.done}>
          <View style={styles.doneHead}>
            <View style={styles.doneIcon}><Check size={22} color="#FFFFFF" strokeWidth={3} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.doneTitle}>{view.run.found ? `Нашёл ${view.run.found}` : 'Новых событий нет'}</Text>
              <Text style={styles.doneSub}>Поиск завершён {ago(view.run.finished_at ?? view.run.started_at)}</Text>
            </View>
          </View>
          {view.run.queued > 0 ? (
            <Pressable onPress={onReview} style={({ pressed }) => [styles.review, pressed && styles.pressed]} accessibilityRole="button">
              <Text style={styles.reviewText}>Проверить {view.run.queued} {plural(view.run.queued)}</Text>
              <ChevronRight size={20} color={colors.paper} strokeWidth={2.4} />
            </Pressable>
          ) : <Text style={styles.doneSub}>Всё найденное уже было в базе или отсеяно как реклама и дубли.</Text>}
          {results.length > 0 && (
            <View style={styles.resList}>
              {results.map((r) => (
                <View key={r.name} style={styles.resRow}>
                  {r.bad ? <TriangleAlert size={15} color={colors.accentText} strokeWidth={2.2} /> : <View style={styles.okDot} />}
                  <Text style={styles.resName} numberOfLines={1}>{r.name}</Text>
                  <Text style={[styles.resVal, r.bad && { color: colors.accentText }]}>{r.result}</Text>
                </View>
              ))}
            </View>
          )}
        </Animated.View>
      )}
      {view.state === 'cancelled' && <Banner tone="info" text="Поиск остановлен. Можно запустить заново." />}
      {view.state === 'failed' && view.error && (
        <Banner tone="error" title={view.error.title} hint={view.error.hint} action={problem ? undefined : { label: 'Запустить снова', onPress: start }} />
      )}

      <Card style={{ gap: 18 }}>
        <Text style={styles.h}>{view.state === 'never' ? 'Первый поиск событий' : 'Новый поиск'}</Text>

        <Step n={1} title="Где искать">
          <View style={{ gap: 8 }}>
            {MODES.map((m) => {
              const on = cfg.sources === m.id;
              return (
                <Pressable key={m.id} onPress={() => cfg.set({ sources: m.id })} style={({ pressed }) => [styles.mode, on && styles.modeOn, pressed && styles.pressed]} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                  <View style={[styles.modeIcon, on && { backgroundColor: colors.accent }]}><m.Icon size={20} color={on ? '#FFFFFF' : colors.ink} strokeWidth={2} /></View>
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text style={[styles.modeTitle, on && { color: colors.paper }]}>{m.title}</Text>
                    <Text style={[styles.modeSub, on && { color: '#B9B3A6' }]}>{m.sub}</Text>
                  </View>
                  <Text style={[styles.price, m.price === 'бесплатно' ? styles.free : styles.paid]}>{m.price}</Text>
                </Pressable>
              );
            })}
          </View>
          {live && !enabled.loading && (
            <View style={styles.reads}>
              <Text style={styles.cap}>БУДЕТ ПРОЧИТАНО</Text>
              <View style={styles.pills}>
                {sources.length ? sources.map((s) => <View key={s} style={styles.pill}><Text style={styles.pillText}>{s}</Text></View>) : <Text style={styles.warn}>ничего: включи источник</Text>}
              </View>
              <Pressable onPress={onSettings} accessibilityRole="button" hitSlop={8} style={styles.link}><Text style={styles.linkText}>Изменить источники</Text></Pressable>
            </View>
          )}
        </Step>

        <Step n={2} title="На сколько дней вперёд">
          <View style={styles.periods}>
            {PERIODS.map((d) => {
              const on = cfg.days === d;
              return (
                <Pressable key={d} onPress={() => cfg.set({ days: d })} style={[styles.period, on && styles.periodOn]} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                  <Text style={[styles.periodN, on && { color: colors.paper }]}>{d}</Text>
                  <Text style={[styles.periodT, on && { color: '#B9B3A6' }]}>дней</Text>
                </Pressable>
              );
            })}
          </View>
        </Step>

        {cfg.sources !== 'sites' && (
          <Animated.View entering={FadeIn}>
            <Step n={3} title={`Темы для ИИ · модель ${cfg.model}`}>
              <View style={styles.pills}>
                {ALL_TOPICS.map((t) => (
                  <Chip key={t} label={TOPIC_TITLE[t]} on={cfg.topics.includes(t)}
                    onPress={() => cfg.set({ topics: cfg.topics.includes(t) ? cfg.topics.filter((x) => x !== t) : [...cfg.topics, t] })} />
                ))}
              </View>
            </Step>
          </Animated.View>
        )}

        {!!problem && <Text style={styles.warn}>{problem}</Text>}
        <Pressable disabled={cmd.isPending || !!problem} onPress={start} style={({ pressed }) => [styles.go, (cmd.isPending || !!problem) && { opacity: 0.4 }, pressed && styles.pressed]} accessibilityRole="button">
          {cmd.isPending ? <ActivityIndicator color={colors.paper} /> : view.state === 'done' ? <RotateCcw size={20} color={colors.paper} strokeWidth={2.2} /> : <Search size={20} color={colors.paper} strokeWidth={2.2} />}
          <Text style={styles.goText}>{cmd.isPending ? 'Запускаю…' : 'Найти события'}</Text>
        </Pressable>
        <Text style={styles.meta}>{cfg.days} дн. вперёд{cfg.sources === 'sites' ? ' · бесплатно' : ` · до ${cfg.limit} событий от ИИ`}</Text>
        {cmdError && (plain ? <Banner tone="info" text={(cmd.error as Error).message} /> : <Banner tone="error" title={cmdError.title} hint={cmdError.hint} />)}
      </Card>

      {view.logs.length > 0 && (
        <View style={{ gap: 6 }}>
          <Pressable onPress={() => setLog(!log)} accessibilityRole="button" hitSlop={8} style={styles.link}><Text style={styles.linkText}>{log ? 'Скрыть журнал' : 'Журнал последнего поиска'}</Text></Pressable>
          {log && view.logs.slice(0, 60).map((l) => <Text key={l.id} style={[styles.log, l.level === 'error' && { color: colors.accentText }]}>{l.text}</Text>)}
        </View>
      )}
    </View>
  );
}

const plural = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? 'карточку' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'карточки' : 'карточек');

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.stepHead}>
        <View style={styles.stepN}><Text style={styles.stepNText}>{n}</Text></View>
        <Text style={styles.stepTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

/** Ход поиска: радар, живой счётчик, полоска по источникам и список «кто уже ответил». */
function Progress({ since, sources, live, found, queued, line, logs }: { since: string; sources: string[]; live: boolean; found: number; queued: number; line?: string; logs: { text: string; level: string }[] }) {
  const reduce = useReducedMotion();
  const rows = sourceProgress(sources, logs);
  const doneN = rows.filter((r) => r.state !== 'wait').length;
  const share = sources.length ? doneN / sources.length : 0;
  const bar = useSharedValue(0);
  useEffect(() => { bar.set(withTiming(Math.max(0.06, live ? Math.min(0.94, 0.1 + share * 0.84) : 0.04), { duration: 700, easing: Easing.out(Easing.cubic) })); }, [share, live, bar]);
  const barSt = useAnimatedStyle(() => ({ width: `${bar.get() * 100}%` }));
  return (
    <View style={{ gap: 14 }} accessibilityRole="progressbar" accessibilityLabel="Идёт поиск событий" accessibilityLiveRegion="polite">
      <View style={styles.progHead}>
        <Radar reduce={reduce} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.progTitle}>Ищу события</Text>
          <Clock since={since} />
        </View>
      </View>
      <View style={styles.counters}>
        <Counter n={found} label="найдено" />
        <Counter n={queued} label="ждут проверки" accent />
        <Counter n={doneN} label={`из ${sources.length} источн.`} />
      </View>
      <View style={styles.track}><Animated.View style={[styles.fill, barSt]} /></View>
      <View style={{ gap: 4 }}>
        {rows.map((r) => (
          <Animated.View key={r.name} entering={FadeIn} style={styles.srcRow}>
            {r.state === 'wait' ? <ActivityIndicator size="small" color={colors.muted2} style={{ width: 20 }} />
              : r.state === 'bad' ? <View style={[styles.srcIcon, { backgroundColor: '#F6D5C3' }]}><X size={13} color={colors.accentText} strokeWidth={3} /></View>
              : <View style={[styles.srcIcon, { backgroundColor: colors.ok }]}><Check size={13} color="#FFFFFF" strokeWidth={3} /></View>}
            <Text style={styles.srcName} numberOfLines={1}>{r.name}</Text>
            <Text style={[styles.srcVal, r.state === 'bad' && { color: colors.accentText }, r.state === 'done' && { color: colors.ink }]} numberOfLines={1}>{r.text}</Text>
          </Animated.View>
        ))}
      </View>
      {!!line && <Text style={styles.line} numberOfLines={2}>Сейчас: {line}</Text>}
    </View>
  );
}

/** Число плавно «подпрыгивает», когда растёт. */
function Counter({ n, label, accent }: { n: number; label: string; accent?: boolean }) {
  const s = useSharedValue(1);
  const prev = useRef(n);
  useEffect(() => { if (n !== prev.current) { s.set(1.25); s.set(withSpring(1, { damping: 8, stiffness: 220 })); prev.current = n; } }, [n, s]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: s.get() }] }));
  return (
    <View style={styles.counter}>
      <Animated.Text style={[styles.counterN, accent && { color: colors.accentText }, st]}>{n}</Animated.Text>
      <Text style={styles.counterT}>{label}</Text>
    </View>
  );
}

function Radar({ reduce }: { reduce: boolean }) {
  return (
    <View style={styles.radar}>
      {[0, 700, 1400].map((d) => <Ring key={d} delay={d} reduce={reduce} />)}
      <View style={styles.lens}><Search size={20} color={colors.paper} strokeWidth={2.2} /></View>
    </View>
  );
}
function Ring({ delay, reduce }: { delay: number; reduce: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduce) { t.set(0.5); return; }
    t.set(withDelay(delay, withRepeat(withTiming(1, { duration: 2100, easing: Easing.out(Easing.quad) }), -1, false)));
    return () => cancelAnimation(t);
  }, [reduce, delay, t]);
  const st = useAnimatedStyle(() => ({ opacity: 0.55 * (1 - t.get()), transform: [{ scale: 0.6 + t.get() * 0.65 }] }));
  return <Animated.View pointerEvents="none" style={[styles.ring, st]} />;
}

/** Секундомер — тикает только он, а не весь экран. */
function Clock({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  return (
    <>
      <Text style={styles.clock}>идёт {elapsed(since, now)}</Text>
      {now - Date.parse(since) > STUCK_MS && <Text style={styles.warn}>Дольше обычного — нажми «Остановить» и запусти снова.</Text>}
    </>
  );
}

const styles = StyleSheet.create({
  pressed: { transform: [{ scale: 0.98 }] },
  h: { fontFamily: fonts.display700, fontSize: 21, color: colors.ink, letterSpacing: -0.3 },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepN: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  stepNText: { fontFamily: fonts.mono600, fontSize: 12, color: colors.paper },
  stepTitle: { fontFamily: fonts.body700, fontSize: 15, color: colors.ink },
  mode: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.line },
  modeOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  modeIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  modeTitle: { fontFamily: fonts.body700, fontSize: 15, color: colors.ink },
  modeSub: { fontFamily: fonts.body400, fontSize: 12.5, lineHeight: 16, color: colors.muted },
  price: { fontFamily: fonts.mono600, fontSize: 10, letterSpacing: 0.3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },
  free: { backgroundColor: '#D7EBD5', color: '#1F6B3A' },
  paid: { backgroundColor: '#F6D5C3', color: colors.accentText },
  reads: { gap: 8, padding: 12, borderRadius: 16, backgroundColor: 'rgba(23,22,26,0.04)' },
  cap: { fontFamily: fonts.mono600, fontSize: 10.5, letterSpacing: 0.6, color: colors.muted },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.line },
  pillText: { fontFamily: fonts.body600, fontSize: 13, color: colors.ink },
  periods: { flexDirection: 'row', gap: 8 },
  period: { flex: 1, height: 64, borderRadius: 16, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  periodOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  periodN: { fontFamily: fonts.display800, fontSize: 22, color: colors.ink },
  periodT: { fontFamily: fonts.body500, fontSize: 11.5, color: colors.muted },
  go: { flexDirection: 'row', gap: 10, height: 58, borderRadius: 18, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  goText: { fontFamily: fonts.body700, fontSize: 16.5, color: colors.paper },
  meta: { fontFamily: fonts.mono500, fontSize: 11.5, color: colors.muted3, textAlign: 'center', marginTop: -8 },
  warn: { fontFamily: fonts.body600, fontSize: 13, color: colors.accentText },
  link: { minHeight: 36, justifyContent: 'center', alignSelf: 'flex-start' },
  linkText: { fontFamily: fonts.body700, fontSize: 13.5, color: colors.ink, textDecorationLine: 'underline' },
  log: { fontFamily: fonts.body400, fontSize: 12.5, lineHeight: 18, color: colors.muted },
  done: { gap: 14, padding: 16, borderRadius: 24, backgroundColor: '#E3EFDF', borderWidth: 1, borderColor: '#C5DEC0' },
  doneHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  doneIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.ok, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { fontFamily: fonts.display800, fontSize: 22, color: colors.ink, letterSpacing: -0.4 },
  doneSub: { fontFamily: fonts.body500, fontSize: 13.5, color: colors.muted2 },
  review: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 52, borderRadius: 16, backgroundColor: colors.ink },
  reviewText: { fontFamily: fonts.body700, fontSize: 16, color: colors.paper },
  resList: { gap: 6 },
  resRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 26 },
  okDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.ok, marginHorizontal: 3.5 },
  resName: { flex: 1, fontFamily: fonts.body600, fontSize: 13.5, color: colors.ink },
  resVal: { fontFamily: fonts.mono600, fontSize: 11.5, color: colors.muted2 },
  stop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 16, backgroundColor: colors.sand },
  stopText: { fontFamily: fonts.body700, fontSize: 15, color: colors.ink },
  progHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  progTitle: { fontFamily: fonts.display700, fontSize: 21, color: colors.ink },
  clock: { fontFamily: fonts.mono600, fontSize: 12.5, color: colors.muted },
  radar: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 76, height: 76, borderRadius: 38, borderWidth: 2, borderColor: colors.accent, backgroundColor: 'rgba(240,82,31,0.08)' },
  lens: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  counters: { flexDirection: 'row', gap: 8 },
  counter: { flex: 1, paddingVertical: 10, borderRadius: 16, backgroundColor: colors.cardAlt, alignItems: 'center' },
  counterN: { fontFamily: fonts.display800, fontSize: 26, color: colors.ink },
  counterT: { fontFamily: fonts.body500, fontSize: 11.5, color: colors.muted, textAlign: 'center' },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.sand, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
  srcRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 34 },
  srcIcon: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  srcName: { flex: 1, fontFamily: fonts.body600, fontSize: 14, color: colors.ink },
  srcVal: { maxWidth: '50%', fontFamily: fonts.mono500, fontSize: 11.5, color: colors.muted },
  line: { fontFamily: fonts.body400, fontSize: 12.5, color: colors.muted },
});
