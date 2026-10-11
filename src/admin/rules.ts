// Правила панели «Ивенты» в одном месте: что можно запускать, что считать «надёжным», что показать по источникам. Чистые функции, есть тесты.
import type { QueueItem } from './model';
import { modelOk, type SearchSources } from './robotConfig';

export const PERIODS = [7, 14, 30] as const;
export const TOPIC_TITLE: Record<string, string> = { cinema: 'Кино и театр', music: 'Музыка', standup: 'Стендап', art: 'Выставки', sport: 'Спорт', food: 'Еда' };

/** Почему нельзя запустить поиск (или null, если можно). Сайты работают без ИИ — им нужны только дни. */
export function searchProblem(c: { sources: SearchSources; model: string; topics: string[]; days: number }): string | null {
  if (!Number.isInteger(c.days) || c.days < 1 || c.days > 30) return 'Период — от 1 до 30 дней';
  if (c.sources === 'sites') return null;
  if (!modelOk(c.model)) return 'Выбери модель ИИ в «Настройки → ИИ-поиск»';
  if (!c.topics.length) return 'Выбери хотя бы одну тему для ИИ';
  return null;
}

/** «Надёжное»: без пометок, уверенность 90%+ (или событие прочитано кодом с сайта) и не предложено человеком. */
export function isReliable(x: Pick<QueueItem, 'flags' | 'confidence' | 'source' | 'startsAt'>, now = Date.now()): boolean {
  if (x.flags.length) return false;
  if (x.source.startsWith('ПРЕДЛОЖИЛ') || x.source.startsWith('ДОБАВЛЕНО')) return false;
  if (x.confidence != null && x.confidence < 90) return false;
  return Date.parse(x.startsAt) > now;
}

/** Строки «Источник · имя · итог» из журнала → для плашки результата. */
export function sourceResults(lines: { text: string }[]): { name: string; result: string; bad: boolean }[] {
  const out: { name: string; result: string; bad: boolean }[] = [];
  for (const l of [...lines].reverse()) {
    const m = /^Источник · (.+?) · (.+)$/.exec(l.text);
    if (m) out.push({ name: m[1], result: m[2], bad: m[2] === 'не открылся' });
  }
  return out;
}

/** «0:42», «12:05»: сколько идёт поиск. */
export function elapsed(fromIso: string, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - Date.parse(fromIso)) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Что читает поиск сейчас — по выбранному режиму и включённым источникам («собирать» в настройках). */
export function activeSources(s: SearchSources, model: string, sites: string[] = ['Яндекс Афиша', 'Sxodim'], telegram = false): string[] {
  return [
    ...(s !== 'ai' ? sites : []),
    ...(telegram ? ['Telegram'] : []),
    ...(s !== 'sites' ? [model.startsWith('kimi') ? 'ИИ · Kimi' : 'ИИ · Gemini'] : []),
  ];
}
