// «Ивенты» → главная карточка: что сейчас с поиском и одна большая кнопка «Найти события».
// Источник выбирается здесь же (сайты бесплатно / ИИ платно / оба), остальные параметры — в «Настройках».
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../../theme';
import { ago, explainError } from '../errors';
import { useRobotConfig, type SearchSources } from '../robotConfig';
import { useRobotCommand, useRobotView } from '../useRobot';
import { Banner, Btn, Card, Segmented } from './kit';

const WHAT: Record<SearchSources, string> = {
  sites: 'Читает афиши Sxodim и Яндекс.Афиши кодом, без ИИ. Бесплатно, 1–2 минуты.',
  ai: 'ИИ ищет по интернету. Платно, у аккаунта есть лимит запросов.',
  all: 'Сначала афиши сайтов, потом ИИ добавляет то, чего не хватило.',
};

export function SearchCard({ live, onSettings }: { live: boolean; onSettings: () => void }) {
  const view = useRobotView(live);
  const cmd = useRobotCommand(live, view.run?.id);
  const cfg = useRobotConfig();
  const [log, setLog] = useState(false);
  const running = view.state === 'running';
  const cmdError = cmd.isError ? explainError(cmd.error instanceof Error ? cmd.error.message : '') : null;
  const plain = cmd.isError && cmd.error instanceof Error && /откроется|Выбери/.test(cmd.error.message);

  return (
    <Card style={{ gap: 14 }}>
      <Text style={styles.h}>Найти новые события</Text>

      {view.fetchError && <Banner tone="error" title="Не удалось загрузить состояние поиска" hint="Проверь связь и потяни вниз, чтобы обновить." />}
      {view.state === 'never' && !view.loading && <Banner tone="info" text="Поиск ещё не запускали." />}
      {running && <Banner tone="info" title="Идёт поиск…" text={view.line ?? 'Запускаю на GitHub'} />}
      {view.state === 'done' && view.run && (
        <Banner tone="ok" title={`Готово · ${ago(view.run.finished_at ?? view.run.started_at)}`} text={`Найдено ${view.run.found}${view.run.queued ? `, ждут согласования ${view.run.queued}` : ''}`} />
      )}
      {view.state === 'cancelled' && <Banner tone="info" text="Поиск остановлен." />}
      {view.state === 'failed' && view.error && (
        <Banner tone="error" title={view.error.title} hint={view.error.hint} action={{ label: 'Запустить снова', onPress: () => cmd.mutate('start') }} />
      )}

      <Segmented<SearchSources> value={cfg.sources} onChange={(sources) => cfg.set({ sources })}
        options={[{ id: 'sites', label: 'Сайты', sub: 'бесплатно' }, { id: 'ai', label: 'ИИ', sub: 'платно' }, { id: 'all', label: 'Оба' }]} />
      <Text style={styles.what}>{cfg.sources === 'ai' ? `Модель ${cfg.model}. ` : ''}{WHAT[cfg.sources]}</Text>

      <View style={styles.two}>
        <Btn flex label={cmd.isPending ? 'Подожди…' : running ? 'Идёт поиск…' : 'Найти события'} disabled={cmd.isPending || running} onPress={() => cmd.mutate('start')} />
        {running && <Btn label="Стоп" kind="ghost" onPress={() => cmd.mutate('stop')} />}
      </View>

      {cmd.isSuccess && <Banner tone="ok" text={cmd.data} />}
      {cmdError && (plain ? <Banner tone="info" text={(cmd.error as Error).message} /> : <Banner tone="error" title={cmdError.title} hint={cmdError.hint} />)}

      <View style={styles.foot}>
        <Text style={styles.meta}>{cfg.days} дн. вперёд · до {cfg.limit} событий</Text>
        <Pressable onPress={onSettings} accessibilityRole="button" hitSlop={8} style={styles.link}><Text style={styles.linkText}>Настроить</Text></Pressable>
      </View>
      {view.logs.length > 0 && (
        <View style={{ gap: 6 }}>
          <Pressable onPress={() => setLog(!log)} accessibilityRole="button" hitSlop={8} style={styles.link}><Text style={styles.linkText}>{log ? 'Скрыть журнал' : 'Показать журнал'}</Text></Pressable>
          {log && view.logs.map((l) => <Text key={l.id} style={[styles.log, l.level === 'error' && { color: colors.accentText }]}>{l.text}</Text>)}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  h: { fontFamily: fonts.display700, fontSize: 21, color: colors.ink, letterSpacing: -0.3 },
  what: { fontFamily: fonts.body400, fontSize: 13.5, lineHeight: 19, color: colors.muted },
  two: { flexDirection: 'row', gap: 10 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meta: { fontFamily: fonts.mono500, fontSize: 11.5, color: colors.muted3, letterSpacing: 0.3 },
  link: { minHeight: 40, justifyContent: 'center' },
  linkText: { fontFamily: fonts.body700, fontSize: 13.5, color: colors.ink, textDecorationLine: 'underline' },
  log: { fontFamily: fonts.body400, fontSize: 12.5, lineHeight: 18, color: colors.muted },
});
