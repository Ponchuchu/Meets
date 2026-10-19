// Итоги запуска поиска простыми словами. Данные пишет воркер (worker/src/runstats.ts → robot_runs.stats), панель только показывает.
// Всё здесь — чистые функции без экрана и сети, поэтому покрыто тестами.

export interface RunStats {
  window?: { from: string; to: string };
  /** Что прочитал каждый сайт («found» — событий в нужном периоде). */
  sources?: { name: string; found: number; ok: boolean; error?: string }[];
  /** Прочитано, но дата вне выбранного периода. */
  outside?: number;
  /** Склеено как дубли между сайтами. */
  merged?: number;
  kept?: number;
  ai?: { model: string; asked: number; found: number; kept: number; tokensIn: number; tokensOut: number; error?: string };
  kimiPhotos?: number;
  /** Что реально легло в базу. */
  queue?: { added: number; published: number; duplicates: number; unclear: number; past: number; withPhoto: number; withPoint: number; withPrice: number; needPin: number };
  /** Удалено просроченных черновиков в начале запуска. */
  purged?: number;
  telegram?: { name: string; posts: number; events: number; ad: number; meme: number; notAlmaty: number; duplicates: number; cancels: number; unclear: number }[];
}

export interface Tile { n: string; label: string; warn?: boolean }
export interface Tip { tone: 'warn' | 'info' | 'error'; title: string; hint?: string }
export interface RunView {
  /** «Новых в очереди: 28» — главное одной строкой. */
  headline: string;
  /** Пояснение под ней: «Ещё 32 уже были в базе». */
  sub: string;
  tiles: Tile[];
  /** Путь событий словами: прочитано → вне периода → дубли → уже были. */
  steps: string[];
  tips: Tip[];
  /** Строки по Telegram-каналам. */
  telegram: string[];
}

const word = (n: number, a: string, b: string, c: string) => { const m = n % 10, k = n % 100; return m === 1 && k !== 11 ? a : m >= 2 && m <= 4 && (k < 10 || k >= 20) ? b : c; };
const ofN = (a: number, b: number) => (a === b ? `все ${b}` : `${a} из ${b}`);

/** Что показать после запуска. Без итогов (старый запуск) — вернёт null: панель покажет короткую плашку как раньше. */
export function describeRun(s: RunStats | null | undefined): RunView | null {
  if (!s || (!s.queue && !s.sources && !s.telegram)) return null;
  const q = s.queue;
  const added = q?.added ?? 0;
  const tiles: Tile[] = [];
  const tips: Tip[] = [];
  if (q) {
    tiles.push({ n: String(added), label: 'новых в очереди' });
    if (added > 0) {
      tiles.push({ n: ofN(q.withPhoto, added), label: 'с фото', warn: q.withPhoto < added });
      tiles.push({ n: ofN(q.withPoint, added), label: 'с точкой на карте', warn: q.withPoint < added });
      tiles.push({ n: ofN(q.withPrice, added), label: 'с ценой', warn: q.withPrice < added });
    }
  }

  const steps: string[] = [];
  const read = (s.sources ?? []).filter((x) => x.ok);
  if (read.length) steps.push(`Прочитано: ${read.map((x) => `${x.name} ${x.found}`).join(' · ')}`);
  if (s.outside) steps.push(`Дата вне периода: ${s.outside}`);
  if (s.merged) steps.push(`Склеено дублей между сайтами: ${s.merged}`);
  if (q?.duplicates) steps.push(`Уже были в базе: ${q.duplicates}`);
  if (q?.past) steps.push(`Уже прошли: ${q.past}`);
  if (q?.unclear) steps.push(`Не собрались в карточку: ${q.unclear}`);
  if (s.ai) steps.push(`ИИ-поиск (${s.ai.model}): нашёл ${s.ai.found}, прошло проверку ${s.ai.kept}`);

  for (const x of s.sources ?? []) if (!x.ok) tips.push({ tone: 'error', title: `${x.name} не открылся`, hint: 'Сайт мог быть недоступен. Остальные источники прочитаны. Запусти ещё раз позже.' });
  if (s.ai?.error) tips.push({ tone: 'error', title: 'ИИ-поиск не ответил', hint: 'Проверь ключ и баланс в «Настройки → Подключения». Афиши сайтов при этом прочитаны.' });
  if (q && added > 0) {
    const noPhoto = added - q.withPhoto;
    if (noPhoto > 0) tips.push({ tone: 'info', title: `${noPhoto} ${word(noPhoto, 'событие', 'события', 'событий')} без фото`, hint: 'В приложении будет постер раздела. Фото можно поискать ИИ: Настройки → Фото событий.' });
    if (q.needPin > 0) tips.push({ tone: 'warn', title: `${q.needPin} без точки на карте`, hint: 'Поставь точку в «Новые» или поправь адрес, иначе откроется без маршрута.' });
    const noPrice = added - q.withPrice;
    if (noPrice > 0) tips.push({ tone: 'info', title: `${noPrice} без цены`, hint: 'Помечены «проверь цену»: загляни в карточку перед публикацией.' });
  }
  if (s.purged) tips.push({ tone: 'info', title: `Убрано просроченных черновиков: ${s.purged}` });
  if (s.ai && s.ai.tokensIn + s.ai.tokensOut > 0) tips.push({ tone: 'info', title: `ИИ потратил около ${Math.max(1, Math.round((s.ai.tokensIn + s.ai.tokensOut) / 1000))} тыс. токенов` });
  if (s.kimiPhotos) tips.push({ tone: 'info', title: `ИИ нашёл фото для ${s.kimiPhotos} ${word(s.kimiPhotos, 'события', 'событий', 'событий')}` });

  const telegram = (s.telegram ?? []).map((t) => {
    if (!t.posts) return `${t.name}: новых постов нет`;
    const parts = [`${t.events} ${word(t.events, 'событие', 'события', 'событий')}`];
    if (t.ad) parts.push(`реклама ${t.ad}`);
    if (t.meme) parts.push(`мемы ${t.meme}`);
    if (t.notAlmaty) parts.push(`не Алматы ${t.notAlmaty}`);
    if (t.duplicates) parts.push(`дубли ${t.duplicates}`);
    return `${t.name}: ${parts.join(', ')}`;
  });

  const headline = added > 0 ? `Новых в очереди: ${added}` : q ? 'Новых событий нет' : 'Итоги запуска';
  const sub = q
    ? added > 0
      ? q.published ? `Из них сразу на карте: ${q.published}. Остальные ждут проверки.` : 'Ждут проверки в разделе «Новые».'
      : q.duplicates ? `Всё найденное уже есть в базе (${q.duplicates}).`
        : (s.kept ?? 0) > 0 ? `Все ${s.kept} найденных уже были в базе или в прошлых запусках.`
        : 'Попробуй больший период или другой источник.'
    : '';
  return { headline, sub, tiles, steps, tips, telegram };
}

// ——— Ключи и подключения ———

export interface KeyStatus { name: string; ok: boolean; note: string; low?: boolean }

/** Строки журнала «Ключ · Kimi · есть, баланс 12.50» → статусы. Последняя строка по имени побеждает (список от новых к старым). */
export function keyStatuses(lines: { text: string }[]): KeyStatus[] {
  const seen = new Map<string, KeyStatus>();
  for (const l of lines) {
    const m = /^Ключ · (.+?) · (.+)$/.exec(l.text);
    if (!m || seen.has(m[1])) continue;
    const ok = m[2].startsWith('есть');
    seen.set(m[1], { name: m[1], ok, note: ok ? m[2].replace(/^есть,?\s*/, '') : m[2] === 'нет' ? '' : m[2], low: /мало/.test(m[2]) });
  }
  return [...seen.values()];
}

/** Что делать, если ключа нет или он не принят. */
export function keyHelp(k: KeyStatus): string | null {
  if (k.ok && !k.low) return null;
  if (k.low) return 'Баланс заканчивается: пополни его на platform.moonshot.ai, иначе ИИ-поиск остановится.';
  const secret = k.name.startsWith('Kimi') ? 'KIMI' : k.name.startsWith('Gemini') ? 'GEMINI_API_KEY' : 'ANTHROPIC_API_KEY';
  return k.note === 'не принят' ? `Ключ не подходит. Замени секрет ${secret}: GitHub → Settings → Secrets → Actions.` : `Добавь секрет ${secret}: GitHub → Settings → Secrets → Actions.`;
}

// ——— Источники: как читаются ———

export type SourceKind = 'telegram' | 'site' | 'threads' | 'manual' | 'user' | 'search';
const SITE_MARK: [RegExp, string][] = [[/sxodim/i, 'СХ'], [/yandex|яндекс/i, 'ЯА']];

/** Две буквы на плашке источника. */
export function sourceMark(kind: SourceKind, title: string, handle = ''): string {
  if (kind === 'site') return SITE_MARK.find(([re]) => re.test(`${title} ${handle}`))?.[1] ?? 'WW';
  return { telegram: 'TG', threads: 'TH', manual: 'РУ', user: 'ПП', search: 'ИИ' }[kind] ?? '··';
}

/** Как источник читается и сколько это стоит. */
export function sourceHow(kind: SourceKind): { label: string; free: boolean } {
  if (kind === 'site') return { label: 'Код читает афишу сам · без ИИ', free: true };
  if (kind === 'telegram') return { label: 'ИИ отсеивает рекламу и мемы · токены только на новые посты', free: false };
  if (kind === 'search') return { label: 'ИИ ищет по интернету · платно', free: false };
  return { label: '', free: true };
}
