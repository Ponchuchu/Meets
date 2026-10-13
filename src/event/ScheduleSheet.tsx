import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { EventItem } from '../data/types';
import { almaty, dayIndex, dayStart } from '../lib/clock';
import { colors, fonts } from '../theme';
import { DateWheel, TimeWheel } from './ui/pickers';

export function ScheduleSheet({ e, now, reschedule, initial, onSave }: { e: EventItem; now: Date; reschedule: boolean; initial?: string; onSave: (at: string) => Promise<void> }) {
  const earliest = Math.max(now.getTime() + 60000, reschedule ? 0 : Date.parse(e.startsAt));
  const first = new Date(Math.ceil(Math.max(earliest, Date.parse(initial ?? e.startsAt)) / 300000) * 300000);
  const [day, setDay] = useState(dayIndex(first));
  const a = almaty(first);
  const [time, setTime] = useState(`${String(a.getUTCHours()).padStart(2, '0')}:${String(a.getUTCMinutes()).padStart(2, '0')}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const last = reschedule ? dayIndex(now) + 91 : dayIndex(e.endsAt ?? e.startsAt);
  const save = async () => {
    if (busy) return;
    const [h, m] = time.split(':').map(Number);
    const at = new Date(dayStart(day).getTime() + (h * 60 + m) * 60000);
    if (at.getTime() < earliest || (!reschedule && at.getTime() >= Date.parse(e.endsAt ?? e.startsAt))) { setError('Выбери время в пределах события, позже текущего'); return; }
    setBusy(true); setError('');
    try { await onSave(at.toISOString()); } catch { setError('Не удалось сохранить время. Проверь связь и повтори'); } finally { setBusy(false); }
  };
  return <>
    <Text style={{ fontFamily: fonts.display700, fontSize: 26, color: colors.ink }}>{reschedule ? 'Перенести встречу' : 'Когда пойти'}</Text>
    <Text style={{ fontFamily: fonts.body400, color: colors.muted }}>{reschedule ? 'Новое время увидят приглашённые друзья' : 'Выбери дату и время посещения. Проверь часы работы в описании события.'}</Text>
    <DateWheel min={dayIndex(new Date(earliest))} max={last} value={day} onChange={setDay} />
    <TimeWheel value={time} onChange={setTime} />
    {!!error && <Text accessibilityRole="alert" style={{ color: colors.accentText }}>{error}</Text>}
    <View><Pressable onPress={() => void save()} disabled={busy} accessibilityRole="button" style={{ minHeight: 50, borderRadius: 16, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.paper, fontFamily: fonts.body600 }}>{busy ? 'Сохраняю…' : reschedule ? 'Перенести встречу' : 'Добавить в планы'}</Text></Pressable></View>
  </>;
}
