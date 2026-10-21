// «Ивенты» → главная карточка: выбор источника (Скрипт / ИИ / Оба), темы и период, большая кнопка «Найти».
// Пока идёт поиск — анимация и что читается (сразу после нажатия, ещё до того, как сервер взял задачу); когда закончил —
// одна строка итога, которую можно смахнуть крестиком. Подробности и предупреждения — только в колокольчике (21 окт.).
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../../theme';
import { ago, explainError } from '../errors';
import { ALL_TOPICS, useRobotConfig, type SearchSources } from '../robotConfig';
import { activeSources, PERIODS, searchProblem, sourceResults, TOPIC_TITLE } from '../rules';
import { describeRun } from '../runStats';
import { useEnabledSources, useRobotCommand, useRobotView } from '../useRobot';
import { Banner, Btn, Card, Chip, Segmented } from './kit';
import { RunSummary } from './RunSummary';
import { SearchRadar } from './SearchRadar';

const WHAT: Record<SearchSources, string> = {
  sites: 'Код читает афиши включённых сайтов. Без ИИ, бесплатно, 1–2 минуты.',
  ai: 'ИИ ищет по интернету. Платно, у аккаунта есть лимит запросов.',
  all: 'Сначала афиши сайтов, потом ИИ добавляет то, чего не хватило.',
};

export function SearchCard({ live, onSettings, onDone }: { live: boolean; onSettings: () => void; onDone: () => void }) {
  const view = useRobotView(live);
  const cmd = useRobotCommand(live, view.run?.id);
  const cfg = useRobotConfig();
  const enabled = useEnabledSources(live);
  const [log, setLog] = useState(false);
  // С нажатия «Найти» до ответа сервера тоже показываем радар — иначе непонятно, идёт поиск или нет.
  const [pressedAt, setPressedAt] = useState<string | null>(null);
  const [hidden, setHidden] = useState<string | null>(null);
  useEffect(() => {
    if (!pressedAt) return;
    const t = setTimeout(() => setPressedAt(null), 45_000);
    return () => clearTimeout(t);
  }, [pressedAt]);
  // Сервер взял задачу (новый запуск не раньше нажатия, с запасом на разницу часов) — дальше показываем его состояние.
  const serverTook = !!pressedAt && !!view.run?.started_at && Date.parse(view.run.started_at) >= Date.parse(pressedAt) - 60_000;
  const running = view.state === 'running' || (!!pressedAt && !cmd.isError && !serverTook);
  const start = () => { setPressedAt(new Date().toISOString()); cmd.mutate('start'); };
  const noSource = live && !enabled.loading && cfg.sources !== 'ai' && enabled.list.length === 0;
  const problem = searchProblem(cfg) ?? (noSource ? 'Включи хотя бы один источник: Настройки → Источники → «собирать»' : null);
  const cmdError = cmd.isError ? explainError(cmd.error instanceof Error ? cmd.error.message : '') : null;
  const plain = cmd.isError && cmd.error instanceof Error && /откроется|Выбери|Период|Включи/.test(cmd.error.message);

  // Был «идёт» — стало «готово»: показать найденное.
  const was = useRef(view.state);
  useEffect(() => {
    if (was.current === 'running' && view.state === 'done') onDone();
    was.current = view.state;
  }, [view.state, onDone]);

  const startedAt = view.state === 'running' ? view.run?.started_at : pressedAt ?? view.run?.started_at;
  const summary = view.state === 'done' && view.run?.stats ? describeRun(view.run.stats) : null;
  const results = view.state === 'done' && !summary ? sourceResults(view.logs) : [];
  const siteNames = enabled.list.filter((x) => x.kind === 'site').map((x) => x.title.replace(/ · .*$/, ''));
  const tgOn = enabled.list.some((x) => x.kind === 'telegram');
  const days = cfg.days;

  return (
    <Card style={{ gap: 14 }}>
      <Text style={styles.h}>Найти новые события</Text>

      {view.fetchError && <Banner tone="error" title="Не удалось загрузить состояние поиска" hint="Проверь связь и потяни вниз, чтобы обновить." />}

      {running && startedAt ? (
        <>
          <SearchRadar since={startedAt} sources={activeSources(cfg.sources, cfg.model, live && siteNames.length ? siteNames : undefined, tgOn)} line={view.state === 'running' ? view.line : 'Запускаю поиск…'} found={view.state === 'running' ? view.run?.found : 0} queued={view.state === 'running' ? view.run?.queued : 0} logs={view.state === 'running' ? view.logs : []} />
        </>
      ) : (
        <>
          {view.state === 'never' && !view.loading && <Banner tone="info" text="Поиск ещё не запускали." />}
          {view.state === 'done' && view.run && hidden !== view.run.id && (
            <View style={styles.doneRow}>
              <View style={styles.dot} />
              <Text style={styles.doneText} numberOfLines={2}>Готово · {ago(view.run.finished_at ?? view.run.started_at)} · найдено {view.run.found}{view.run.queued ? `, ждут проверки ${view.run.queued}` : ''}</Text>
              <Pressable onPress={() => setHidden(view.run!.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Скрыть итог"><X size={18} color={colors.muted2} strokeWidth={2} /></Pressable>
            </View>
          )}
          {view.state === 'done' && summary && view.run?.stats && hidden !== view.run.id && log && <RunSummary stats={view.run.stats} when={`Готово · ${ago(view.run.finished_at ?? view.run.started_at)}`} />}
          {results.length > 0 && log && (
            <View style={styles.results}>
              {results.map((r) => (
                <View key={r.name} style={styles.resRow}>
                  <View style={[styles.dot, r.bad && { backgroundColor: colors.accent }]} />
                  <Text style={styles.resName}>{r.name}</Text>
                  <Text style={[styles.resVal, r.bad && { color: colors.accentText }]}>{r.result}</Text>
                </View>
              ))}
            </View>
          )}
          {view.state === 'cancelled' && <Banner tone="info" text="Поиск остановлен." />}
          {view.state === 'failed' && view.error && (
            <Banner tone="error" title={view.error.title} hint={view.error.hint} action={problem ? undefined : { label: 'Запустить снова', onPress: () => cmd.mutate('start') }} />
          )}

          {live && !enabled.loading && (
            <View style={styles.reads}>
              <Text style={styles.readsT}>Будет прочитано</Text>
              <Text style={styles.readsV}>{activeSources(cfg.sources, cfg.model, siteNames, tgOn).join(' · ') || 'ничего: включи источник'}</Text>
              <Pressable onPress={onSettings} accessibilityRole="button" hitSlop={8} style={styles.link}><Text style={styles.linkText}>Изменить источники</Text></Pressable>
            </View>
          )}
          <Segmented<SearchSources> value={cfg.sources} onChange={(sources) => cfg.set({ sources })}
            options={[{ id: 'sites', label: 'Скрипт', sub: 'бесплатно' }, { id: 'ai', label: 'ИИ', sub: 'платно' }, { id: 'all', label: 'Оба' }]} />
          <Text style={styles.what}>{cfg.sources === 'sites' ? '' : `Модель ${cfg.model}. `}{WHAT[cfg.sources]}{tgOn ? ' Telegram разбирает ИИ: отсеивает рекламу и мемы, токены уходят только на новые посты.' : ''}</Text>

          {cfg.sources !== 'sites' && (
            <View style={styles.chips} accessibilityLabel="Темы для ИИ">
              {ALL_TOPICS.map((t) => (
                <Chip key={t} label={TOPIC_TITLE[t]} on={cfg.topics.includes(t)}
                  onPress={() => cfg.set({ topics: cfg.topics.includes(t) ? cfg.topics.filter((x) => x !== t) : [...cfg.topics, t] })} />
              ))}
            </View>
          )}
          <View style={styles.chips} accessibilityLabel="Период поиска">
            <Text style={styles.period}>Период</Text>
            {PERIODS.map((d) => <Chip key={d} label={`${d} дн.`} on={days === d} onPress={() => cfg.set({ days: d })} />)}
            {!(PERIODS as readonly number[]).includes(days) && <Chip label={`${days} дн.`} on onPress={() => undefined} />}
          </View>
        </>
      )}

      {!running && !!problem && <Text style={styles.warn}>{problem}</Text>}
      <View style={styles.two}>
        <Btn flex label={cmd.isPending ? 'Подожди…' : running ? 'Идёт поиск…' : 'Найти'} disabled={cmd.isPending || running || !!problem} onPress={start} />
        {running && <Btn label="Стоп" kind="ghost" onPress={() => cmd.mutate('stop')} />}
      </View>

      {cmdError && (plain ? <Banner tone="info" text={(cmd.error as Error).message} /> : <Banner tone="error" title={cmdError.title} hint={cmdError.hint} />)}

      <View style={styles.foot}>
        <Text style={styles.meta}>{cfg.days} дн. вперёд{cfg.sources === 'sites' ? '' : ` · до ${cfg.limit} событий`}</Text>
        <Pressable onPress={onSettings} accessibilityRole="button" hitSlop={8} style={styles.link}><Text style={styles.linkText}>Настроить</Text></Pressable>
      </View>
      {view.logs.length > 0 && (
        <View style={{ gap: 6 }}>
          <Pressable onPress={() => setLog(!log)} accessibilityRole="button" hitSlop={8} style={styles.link}><Text style={styles.linkText}>{log ? 'Скрыть подробности' : 'Подробности'}</Text></Pressable>
          {log && view.logs.slice(0, 60).map((l) => <Text key={l.id} style={[styles.log, l.level === 'error' && { color: colors.accentText }]}>{l.text}</Text>)}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  h: { fontFamily: fonts.display700, fontSize: 21, color: colors.ink, letterSpacing: -0.3 },
  what: { fontFamily: fonts.body400, fontSize: 13.5, lineHeight: 19, color: colors.muted },
  reads: { gap: 2, padding: 12, borderRadius: 14, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.line },
  readsT: { fontFamily: fonts.mono500, fontSize: 11, color: colors.muted3, textTransform: 'uppercase', letterSpacing: 0.3 },
  readsV: { fontFamily: fonts.body700, fontSize: 14.5, lineHeight: 20, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  period: { fontFamily: fonts.mono500, fontSize: 11, color: colors.muted3, textTransform: 'uppercase', marginRight: 2 },
  warn: { fontFamily: fonts.body600, fontSize: 13, color: colors.accentText },
  two: { flexDirection: 'row', gap: 10 },
  results: { gap: 6 },
  resRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4E7A52' },
  resName: { flex: 1, fontFamily: fonts.body600, fontSize: 14, color: colors.ink },
  resVal: { fontFamily: fonts.mono600, fontSize: 12, color: colors.muted2 },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.cardAlt },
  doneText: { flex: 1, fontFamily: fonts.body600, fontSize: 14, color: colors.ink },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meta: { fontFamily: fonts.mono500, fontSize: 11.5, color: colors.muted3, letterSpacing: 0.3 },
  link: { minHeight: 40, justifyContent: 'center' },
  linkText: { fontFamily: fonts.body700, fontSize: 13.5, color: colors.ink, textDecorationLine: 'underline' },
  log: { fontFamily: fonts.body400, fontSize: 12.5, lineHeight: 18, color: colors.muted },
});
