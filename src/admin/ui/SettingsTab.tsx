// Вкладка «Настройки»: всё, что меняют редко, сгруппировано по смыслу. Каждая настройка сохраняется сразу, без кнопки «Сохранить».
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts } from '../../theme';
import { Toggle } from '../../ui/v6/Settings';
import { getFlag, loadSources, setAutoPublish as saveAutoPublish, setFlag } from '../api';
import { explainError } from '../errors';
import { ALL_TOPICS, MODELS, modelOk, useRobotConfig } from '../robotConfig';
import { useAdminDemo } from '../store';
import { useRobotCommand } from '../useRobot';
import { Banner, Btn, Card, Chip, SettingRow, Section, Stepper } from './kit';
import { Schedule } from './Schedule';
import { Sources } from './Sources';

const TITLE: Record<string, string> = { cinema: 'Кино и театр', music: 'Музыка', standup: 'Стендап', art: 'Выставки', sport: 'Спорт', food: 'Еда' };

function AiSettings() {
  const cfg = useRobotConfig();
  const preset = MODELS.some((m) => m.id === cfg.model);
  const [custom, setCustom] = useState(!preset);
  return (
    <Section title="ИИ-поиск" hint="Работает, когда в поиске выбраны «ИИ» или «Оба». «Скрипт» (афиши сайтов) этих настроек не использует.">
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
    <Section title="Публикация">
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

function Connection({ live }: { live: boolean }) {
  const cmd = useRobotCommand(live);
  const err = cmd.isError ? explainError(cmd.error instanceof Error ? cmd.error.message : '') : null;
  return (
    <Section title="Подключение" hint="Проверяет, что приложение достучалось до GitHub, где работает поиск. Поиск ничего не запускает и ничего не тратит.">
      <Card>
        <Btn label={cmd.isPending ? 'Проверяю…' : 'Проверить связь'} kind="ghost" disabled={cmd.isPending} onPress={() => cmd.mutate('check')} />
        {cmd.isSuccess && <Banner tone="ok" text={cmd.data} />}
        {err && <Banner tone="error" title={err.title} hint={err.hint} text={cmd.error instanceof Error ? cmd.error.message : undefined} />}
      </Card>
    </Section>
  );
}

export function SettingsTab({ live }: { live: boolean }) {
  return (
    <View style={{ gap: 28 }}>
      <AiSettings />
      <Schedule live={live} />
      <Publishing live={live} />
      <Section title="Источники" hint="Откуда читаем афиши. «Доверие» разрешает публикацию без проверки, «собирать» включает чтение.">
        <Sources live={live} />
      </Section>
      <Connection live={live} />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.body600, fontSize: 13, color: colors.muted2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { minHeight: 48, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, color: colors.ink, fontFamily: fonts.body500, fontSize: 15 },
  warn: { fontFamily: fonts.body500, fontSize: 12.5, color: colors.accentText },
});
