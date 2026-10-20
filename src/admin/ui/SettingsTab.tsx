// Вкладка «Настройки»: всё, что меняют редко, сгруппировано по смыслу. Каждая настройка сохраняется сразу, без кнопки «Сохранить».
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts } from '../../theme';
import { Toggle } from '../../ui/v6/Settings';
import { getFlag, loadSources, setAutoPublish as saveAutoPublish, setFlag } from '../api';
import { explainError } from '../errors';
import { ALL_TOPICS, MODELS, modelOk, useRobotConfig, type FindImages } from '../robotConfig';
import { keyHelp } from '../runStats';
import { useAdminDemo } from '../store';
import { useKeyStatuses, useRobotCommand } from '../useRobot';
import { Banner, Btn, Card, Chip, Segmented, SettingRow, Section, Stepper } from './kit';
import { Schedule } from './Schedule';
import { Sources } from './Sources';

const TITLE: Record<string, string> = { cinema: 'Кино и театр', music: 'Музыка', standup: 'Стендап', art: 'Выставки', sport: 'Спорт', food: 'Еда' };

function AiSettings() {
  const cfg = useRobotConfig();
  const preset = MODELS.some((m) => m.id === cfg.model);
  const [custom, setCustom] = useState(!preset);
  return (
    <Section fold="closed" title="ИИ-поиск" hint="Работает, когда в поиске выбраны «ИИ» или «Оба». «Скрипт» (афиши сайтов) этих настроек не использует.">
      <Card>
        <Text style={styles.label}>Модель</Text>
        <View style={styles.chips}>
          {MODELS.map((m) => <Chip key={m.id} label={m.label} on={!custom && cfg.model === m.id} onPress={() => { setCustom(false); cfg.set({ model: m.id }); }} />)}
          <Chip label="Другая" on={custom} onPress={() => setCustom(true)} />
        </View>
        {custom && (
          <>
            <TextInput style={styles.input} value={cfg.model} onChangeText={(v) => cfg.set({ model: v.trim() })} autoCapitalize="none" autoCorrect={false} accessibilityLabel="Название модели" placeholder="gemini-… или kimi-…" placeholderTextColor={colors.muted3} />
            {!modelOk(cfg.model) && <Text style={styles.warn}>Название должно начинаться с gemini-, kimi- или moonshot-.</Text>}
          </>
        )}
        <Stepper label="Искать вперёд" unit="дн." value={cfg.days} min={1} max={30} onChange={(days) => cfg.set({ days })} />
        <Stepper label="Не больше событий" value={cfg.limit} min={10} max={100} step={10} onChange={(limit) => cfg.set({ limit })} />
        <Text style={styles.label}>Что искать</Text>
        <View style={styles.chips}>
          {ALL_TOPICS.map((t) => <Chip key={t} label={TITLE[t]} on={cfg.topics.includes(t)} onPress={() => cfg.set({ topics: cfg.topics.includes(t) ? cfg.topics.filter((x) => x !== t) : [...cfg.topics, t] })} />)}
        </View>
        {!cfg.topics.length && <Text style={styles.warn}>Выбери хотя бы одну тему.</Text>}
      </Card>
    </Section>
  );
}

function Publishing({ live }: { live: boolean }) {
  const qc = useQueryClient();
  const demo = useAdminDemo();
  const sources = useQuery({ queryKey: ['admin', 'sources'], queryFn: loadSources, enabled: live });
  const covers = useQuery({ queryKey: ['admin', 'flag', 'covers_paused'], queryFn: () => getFlag('covers_paused'), enabled: live });
  const auto = live ? !!sources.data?.some((s) => s.trusted && s.autoPublish) : demo.autoPublish;
  const [note, setNote] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const saveAuto = useMutation({
    mutationFn: async (v: boolean) => { if (!live) { demo.setAutoPublish(v); return v; } await saveAutoPublish(v); return v; },
    onSuccess: (v) => { setNote({ tone: 'ok', text: v ? 'Источники с доверием публикуются сразу' : 'Всё идёт через очередь' }); void qc.invalidateQueries({ queryKey: ['admin', 'sources'] }); },
    onError: () => setNote({ tone: 'error', text: 'Не удалось сохранить. Проверь связь' }),
  });
  const saveCovers = useMutation({
    mutationFn: async (on: boolean) => { if (!live) throw new Error('Откроется после входа сотрудника'); await setFlag('covers_paused', !on); return on; },
    onSuccess: (on) => { setNote({ tone: 'ok', text: on ? 'Обложки ИИ включены' : 'Обложки ИИ выключены' }); void qc.invalidateQueries({ queryKey: ['admin', 'flag'] }); },
    onError: (e) => setNote({ tone: 'error', text: e instanceof Error ? e.message : 'Не удалось сохранить' }),
  });
  return (
    <Section fold="closed" title="Публикация">
      <Card>
        <SettingRow title="Публиковать сразу, если 95%+" sub="Только для источников с доверием. Остальное идёт в очередь."
          right={<Toggle on={auto} onChange={(v) => saveAuto.mutate(v)} label="Публиковать сразу, если 95%+" />} />
        <SettingRow title="Рисовать обложки ИИ" sub="Для событий без фото. Платно, по умолчанию выключено."
          right={<Toggle on={covers.data === false} onChange={(v) => saveCovers.mutate(v)} label="Рисовать обложки ИИ" />} />
        {note && <Banner tone={note.tone} text={note.text} />}
      </Card>
    </Section>
  );
}

const PHOTO_HELP: Record<FindImages, string> = {
  0: 'Фото берётся со страницы афиши. Если его там нет, в приложении показывается постер раздела (музыка, стендап…). Бесплатно.',
  6: 'ИИ найдёт страницу события в интернете, а картинку с неё возьмёт и проверит код (не логотип, открывается, про это событие). До 6 событий за поиск. Платно и небыстро: Kimi отвечает примерно раз в минуту.',
  12: 'То же, до 12 событий за поиск. Платно и небыстро: запуск может занять до 10 минут.',
};

function PhotoSettings() {
  const cfg = useRobotConfig();
  return (
    <Section fold="closed" title="Фото событий" hint="Откуда берётся картинка, если на афише её нет.">
      <Card>
        <Text style={styles.label}>Если фото нет</Text>
        <Segmented<string> value={String(cfg.findImages)} onChange={(v) => cfg.set({ findImages: Number(v) as FindImages })}
          options={[{ id: '0', label: 'Постер раздела', sub: 'бесплатно' }, { id: '6', label: 'Искать ИИ', sub: 'до 6' }, { id: '12', label: 'Искать ИИ', sub: 'до 12' }]} />
        <Text style={styles.help}>{PHOTO_HELP[cfg.findImages]}</Text>
        <Text style={styles.help}>Картинки, которые рисует ИИ, включаются в «Публикация → Рисовать обложки ИИ».</Text>
      </Card>
    </Section>
  );
}

function Dot({ ok, warn }: { ok: boolean; warn?: boolean }) {
  return <View style={[styles.dot, { backgroundColor: !ok ? colors.accent : warn ? '#C79A2E' : '#4E7A52' }]} accessibilityElementsHidden />;
}

function Connection({ live }: { live: boolean }) {
  const cmd = useRobotCommand(live);
  const { keys, loading } = useKeyStatuses(live);
  const err = cmd.isError ? explainError(cmd.error instanceof Error ? cmd.error.message : '') : null;
  return (
    <Section fold="closed" title="Подключения" hint="Что нужно, чтобы поиск работал: связь с GitHub и ключи ИИ. Статусы обновляются при каждом поиске. Сами ключи здесь не видны.">
      <Card>
        <SettingRow title="GitHub" sub={cmd.isSuccess ? 'Связь работает' : 'Здесь запускается поиск. Нажми, чтобы проверить связь (ничего не тратит)'}
          right={<Btn label={cmd.isPending ? 'Проверяю…' : 'Проверить'} kind="ghost" disabled={cmd.isPending} onPress={() => cmd.mutate('check')} />} />
        {err && <Banner tone="error" title={err.title} hint={err.hint} text={cmd.error instanceof Error ? cmd.error.message : undefined} />}
        {live && loading && <Text style={styles.help}>Читаю статусы ключей…</Text>}
        {live && !loading && keys.length === 0 && <Text style={styles.help}>Статусы ключей появятся после первого поиска.</Text>}
        {keys.map((k) => {
          const help = keyHelp(k);
          return (
            <View key={k.name} style={styles.keyRow}>
              <Dot ok={k.ok} warn={k.low} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.keyName}>{k.name}</Text>
                <Text style={styles.help}>{k.ok ? (k.note ? `Ключ есть · ${k.note}` : 'Ключ есть') : k.note || 'Ключа нет'}</Text>
                {!!help && <Text style={[styles.help, { color: colors.accentText }]}>{help}</Text>}
              </View>
            </View>
          );
        })}
        {live && !loading && keys.length > 0 && <Text style={styles.help}>Ключи нужны только для ИИ-поиска и разбора Telegram. Афиши сайтов работают без них.</Text>}
      </Card>
    </Section>
  );
}

export function SettingsTab({ live }: { live: boolean }) {
  // Порядок по смыслу: откуда события → фото → что публиковать сразу → когда искать → ИИ → подключения.
  return (
    <View style={{ gap: 28 }}>
      <Section fold="open" title="Источники" hint="Откуда берём события. «Собирать» включает чтение при поиске. «Доверие» разрешает публиковать события оттуда без проверки (только если включено «Публиковать сразу» ниже).">
        <Sources live={live} />
      </Section>
      <PhotoSettings />
      <Publishing live={live} />
      <Schedule live={live} />
      <AiSettings />
      <Connection live={live} />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.body600, fontSize: 13, color: colors.muted2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { minHeight: 48, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, color: colors.ink, fontFamily: fonts.body500, fontSize: 15 },
  warn: { fontFamily: fonts.body500, fontSize: 12.5, color: colors.accentText },
  help: { fontFamily: fonts.body400, fontSize: 13, lineHeight: 18, color: colors.muted },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  keyRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingTop: 4 },
  keyName: { fontFamily: fonts.body700, fontSize: 15, color: colors.ink },
});
