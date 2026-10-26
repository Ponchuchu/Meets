// Правила панели «Ивенты» в одном месте: что можно запускать, что считать «надёжным», что показать по источникам. Чистые функции, есть тесты.
import type { QueueItem, SourceItem } from './model';
import { modelOk, type SearchSources } from './robotConfig';


/** Почему нельзя запустить поиск (или null, если можно). Сайты работают без ИИ — им нужны только дни. */
export function searchProblem(c: { sources: SearchSources; model: string; topics: string[]; days: number }): string | null {
  if (!Number.isInteger(c.days) || c.days < 1 || c.days > 30) return 'Период — от 1 до 30 дней';
  if (c.sources === 'sites') return null;
  if (!modelOk(c.model)) return 'Выбери модель ИИ в «Настройки → ИИ-поиск»';
  if (!c.topics.length) return 'Выбери хотя бы одну тему для ИИ';
  return null;
}

/**
 * «Надёжное»: без пометок, уверенность 90%+ (афиши: Sxodim и Яндекс — 90%, подтверждённые двумя сайтами — 95%; ИИ-поиск — 85% и ниже,
 * поэтому он остаётся на ручную проверку) и не предложено человеком. Не закончилось: идущая выставка тоже годится.
 */
export function isReliable(x: Pick<QueueItem, 'flags' | 'confidence' | 'source' | 'startsAt'> & { endsAt?: string | null }, now = Date.now()): boolean {
  if (x.flags.length) return false;
  if (x.source.startsWith('ПРЕДЛОЖИЛ') || x.source.startsWith('ДОБАВЛЕНО')) return false;
  if (x.confidence != null && x.confidence < 90) return false;
  const end = x.endsAt ? Date.parse(x.endsAt) : Date.parse(x.startsAt) + 3 * 3600e3;
  return end > now;
}

/**
 * «Готово к публикации» для кнопки «Опубликовать всё»: у события есть точка на карте (в live — координаты, в демо — нет пометки
 * «поставь точку»), нет сигнала «отменили» и оно ещё не закончилось. Неточный адрес и «отменили» остаются на ручную проверку.
 */
export function isReady(x: Pick<QueueItem, 'flags' | 'startsAt' | 'point'> & { endsAt?: string | null }, live: boolean, now = Date.now()): boolean {
  if (x.flags.includes('needs_pin') || x.flags.includes('cancel_reported')) return false;
  if (live && !x.point) return false;
  const end = x.endsAt ? Date.parse(x.endsAt) : Date.parse(x.startsAt) + 3 * 3600e3;
  return !(end <= now);
}

/** «1 событие», «2 события», «5 событий». */
export function plural(n: number, one: string, few: string, many: string): string {
  const m = n % 10, k = n % 100;
  return m === 1 && k !== 11 ? one : m >= 2 && m <= 4 && (k < 10 || k >= 20) ? few : many;
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

export type SourceType = 'yandex' | 'site' | 'telegram' | 'threads' | 'instagram' | 'manual' | 'search';
const TYPE_LABEL: Record<SourceType, string> = { yandex: 'Яндекс Афиша', site: 'Сайт', telegram: 'Telegram', threads: 'Threads', instagram: 'Instagram', manual: 'Вручную', search: 'ИИ-поиск' };

/**
 * Как показать источник одной строкой: тип (для значка), подпись типа и вторая строка — адрес сайта или @канал.
 * Яндекс — это тоже «сайт» в базе, но узнаём его по адресу/названию.
 */
export function sourceInfo(s: Pick<SourceItem, 'kind' | 'title' | 'handle'>): { type: SourceType; label: string; line: string } {
  const text = `${s.title} ${s.handle ?? ''}`;
  const type: SourceType = s.kind === 'site' ? (/yandex|яндекс/i.test(text) ? 'yandex' : 'site')
    : s.kind === 'telegram' || s.kind === 'threads' || s.kind === 'instagram' || s.kind === 'search' ? s.kind : 'manual';
  const tail = s.title.includes(' · ') ? s.title.split(' · ').slice(1).join(' · ') : '';
  const line = s.kind === 'telegram' || s.kind === 'threads' || s.kind === 'instagram'
    ? (s.handle ? `@${s.handle}` : tail || s.title)
    : s.handle ? s.handle.replace(/^https?:\/\//, '') : tail || TYPE_LABEL[type];
  return { type, label: TYPE_LABEL[type], line };
}


export type SourceState = 'wait' | 'done' | 'bad';
/**
 * Ход поиска по источникам (FIX5): по строкам журнала — какой источник уже ответил и что нашёл.
 * «Источник · Sxodim · найдено 7» → готов; «… · не открылся» или строка ошибки с именем → ошибка; иначе — ждём.
 */
export function sourceProgress(sources: string[], logs: { text: string; level?: string }[]): { name: string; state: SourceState; text: string; found: number | null }[] {
  return sources.map((name) => {
    const low = name.toLowerCase();
    const line = logs.find((l) => l.text.toLowerCase().includes(low) && (l.text.startsWith('Источник · ') || l.level === 'error' || /готов|найден|прочитан|событ|ошиб|нет новых|не открылся/i.test(l.text)));
    if (!line) return { name, state: 'wait' as const, text: 'ждём ответ', found: null };
    const bad = line.level === 'error' || /не открылся|ошиб/i.test(line.text);
    const n = /найдено\s+(\d+)/i.exec(line.text) ?? /(\d+)\s+событ/i.exec(line.text);
    const tail = line.text.startsWith('Источник · ') ? line.text.split(' · ').slice(2).join(' · ') : line.text;
    return { name, state: bad ? 'bad' as const : 'done' as const, text: tail, found: n ? Number(n[1]) : null };
  });
}
