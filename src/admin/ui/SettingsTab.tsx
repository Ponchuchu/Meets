// Публикация: источники «с доверием» сразу на карту и обложки ИИ (выкл. по умолчанию). Живёт во вкладке «Сбор».
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react-native';
import { useState } from 'react';
import { Toggle } from '../../ui/v6/Settings';
import { getFlag, loadSources, setAutoPublish as saveAutoPublish, setFlag } from '../api';
import { useAdminDemo } from '../store';
import { Banner, Card, SettingRow, Section } from './kit';

export function Publishing({ live }: { live: boolean }) {
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
    <Section fold="closed" icon={Send} title="Публикация">
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

