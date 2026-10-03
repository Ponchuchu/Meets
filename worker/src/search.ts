// Поиск событий ИИ раз в сутки (.github/workflows/search.yml). Быстро и экономно:
//   1. Gemini API с поиском Google — 6 разделов параллельно, по одному запросу на раздел (секунды, а не минуты).
//   2. Страницы событий открывает наш код без ИИ, тоже параллельно: жива ли ссылка, есть ли на ней название,
//      точная дата из разметки schema.org, картинка og:image. Выдуманные и битые ссылки отсеиваются.
//   3. node worker/src/index.ts --search search.json → черновики в «Согласование» (дубли, места, флаги — общий конвейер).
// Запуск шага 1: GEMINI_API_KEY=… node worker/src/search.ts --run > search.json  (ключи базы этому шагу не нужны)
import { createHash } from 'node:crypto';
import { CATEGORIES, type Category, type Extraction, type RawPost } from './types.ts';

export interface Found {
  title: string;
  category: string;
  starts_at: string;
  ends_at?: string | null;
  venue_name?: string | null;
  address?: string | null;
  price_min?: number | null;
  price_max?: number | null;
  is_free?: boolean;
  about?: string;
  url: string;
  image_url?: string | null;
  source_name?: string | null;
  confidence?: number;
}

const ALMATY = '+05:00';
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; ryadom-worker/0.2; +https://ryadom.app)', 'Accept-Language': 'ru' };

/** Дата YYYY-MM-DD по Алматы. */
export function almatyDate(d: Date): string {
  return new Date(d.getTime() + 5 * 3600e3).toISOString().slice(0, 10);
}

/** Разделы ищутся параллельно: быстрее одного большого запроса и разнообразнее. */
export const TOPICS = [
  'концерты, живая музыка, DJ, вечеринки',
  'стендап, импровизация, квизы, настольные игры',
  'театр, опера, балет, цирк, кинопремьеры и показы',
  'выставки, музеи, лекции, мастер-классы, книжные встречи',
  'бесплатные и уличные события: ярмарки, фестивали, маркеты, Арбат, парки, площади, акции и раздачи брендов',
  'спорт для зрителей и участников, забеги, велопрогулки, походы в горы, события для детей',
];

export function topicPrompt(topic: string, from: string, to: string, max = 6): string {
  return `Найди через поиск Google до ${max} реальных событий в Алматы с ${from} по ${to}. Тема: ${topic}.
Бери только события с конкретной датой, у которых есть страница (организатор, площадка, афиша, городской обзор). Ничего не выдумывай, год проверяй.
Ответь только JSON-массивом, без текста вокруг:
[{"title":"","category":"одно из: ${CATEGORIES.join('|')}","starts_at":"ISO 8601 ${ALMATY}","ends_at":null,"venue_name":"","address":"","price_min":null,"price_max":null,"is_free":false,"about":"до 160 символов своими словами","url":"страница события","source_name":"","confidence":0.8}]`;
}

// ——— Gemini API ———

export interface Usage { prompt: number; output: number; searches: number; sources: number }

/** Ответ generateContent → текст + ссылки из поиска + расход. */
export function readResponse(body: unknown): { text: string; links: string[]; usage: Usage } {
  const b = body as {
    candidates?: { content?: { parts?: { text?: string }[] }; groundingMetadata?: { groundingChunks?: { web?: { uri?: string } }[]; webSearchQueries?: string[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  };
  const c = b.candidates?.[0];
  const text = (c?.content?.parts ?? []).map((p) => p.text ?? '').join('');
  const links = (c?.groundingMetadata?.groundingChunks ?? []).map((g) => g.web?.uri).filter((u): u is string => !!u);
  const u = b.usageMetadata ?? {};
  return { text, links, usage: { prompt: u.promptTokenCount ?? 0, output: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0), searches: c?.groundingMetadata?.webSearchQueries?.length ?? 0, sources: links.length } };
}

export const DEFAULT_MODEL = 'gemini-3.8-flash';
const FALLBACK_MODEL = 'gemini-flash-latest';

export async function askGemini(prompt: string, key: string, model: string, timeoutMs = 120_000): Promise<{ found: Found[]; usage: Usage }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = (thinking: boolean) => JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
    // Мало «размышлений» и короткий ответ — экономия токенов; задача простая: найти и заполнить поля.
    generationConfig: { temperature: 0.2, maxOutputTokens: 3000, ...(thinking ? { thinkingConfig: { thinkingLevel: 'low' } } : {}) },
  });
  const call = (thinking: boolean) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: body(thinking), signal: AbortSignal.timeout(timeoutMs) });
  let res = await call(true);
  // Модель без настройки уровня «размышлений» — повторяем без неё.
  if (res.status === 400 && /thinking/i.test(await res.clone().text())) res = await call(false);
  if (res.status === 429 || res.status >= 500) {
    await new Promise((r) => setTimeout(r, 4000));
    res = await call(false);
  }
  // Модель переименовали или убрали — пробуем «последнюю Flash».
  if (res.status === 404 && model !== FALLBACK_MODEL) return askGemini(prompt, key, FALLBACK_MODEL, timeoutMs);
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const { text, usage } = readResponse(await res.json());
  return { found: parseGeminiOutput(text), usage };
}

/** Ответ модели (или файл search.json) → список событий. Понимает и обёртку Gemini CLI {"response": "..."}. */
export function parseGeminiOutput(raw: string): Found[] {
  let text = raw.trim();
  try {
    const wrapped = JSON.parse(text) as { response?: unknown };
    if (Array.isArray(wrapped)) return clean(wrapped);
    if (wrapped && typeof wrapped === 'object' && typeof wrapped.response === 'string') text = wrapped.response;
  } catch { /* не чистый JSON — ищем массив в тексте */ }
  const start = text.indexOf('['), end = text.lastIndexOf(']');
  if (start < 0 || end <= start) return [];
  try { return clean(JSON.parse(text.slice(start, end + 1))); } catch { return []; }
}

const isUrl = (u: unknown): u is string => typeof u === 'string' && /^https?:\/\/\S+$/.test(u);

function clean(list: unknown[]): Found[] {
  return list.filter((x): x is Found => {
    const f = x as Found;
    return !!f && typeof f.title === 'string' && f.title.trim().length > 1 && typeof f.starts_at === 'string' && !Number.isNaN(Date.parse(f.starts_at)) && isUrl(f.url);
  });
}

// ——— Проверка страниц без ИИ ———

/** og:image со страницы события. */
export function ogImage(html: string, base: string): string | null {
  const m = html.match(/<meta[^>]+property=["']og:image(?::url)?["'][^>]*content=["']([^"']+)["']/i) ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  if (!m) return null;
  try { return new URL(m[1], base).toString(); } catch { return null; }
}

/** Картинка события со страницы: og:image → twitter:image → картинка из разметки schema.org. */
export function pageImage(html: string, base: string): string | null {
  const og = ogImage(html, base);
  if (og) return og;
  const tw = html.match(/<meta[^>]+name=["']twitter:image(?::src)?["'][^>]*content=["']([^"']+)["']/i)?.[1];
  const ld = html.match(/"image"\s*:\s*(?:\[\s*)?"([^"]+\.(?:jpe?g|png|webp)[^"]*)"/i)?.[1];
  for (const u of [tw, ld]) {
    if (!u) continue;
    try { return new URL(u.replace(/\\\//g, '/'), base).toString(); } catch { /* битый адрес */ }
  }
  return null;
}

/** Дата начала из разметки schema.org Event на странице (если есть). */
export function ldStart(html: string): string | null {
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1]) as unknown;
      const list = (Array.isArray(data) ? data : [data]).flatMap((d) => ((d as { '@graph'?: unknown[] })['@graph'] ?? [d]) as unknown[]);
      const ev = list.find((d) => /Event$/.test(String((d as { '@type'?: string })['@type'] ?? ''))) as { startDate?: string } | undefined;
      if (ev?.startDate && !Number.isNaN(Date.parse(ev.startDate))) return ev.startDate;
    } catch { /* битый блок */ }
  }
  return null;
}

const words = (s: string) => s.toLowerCase().replace(/ё/g, 'е').match(/[a-zа-я0-9]{4,}/g) ?? [];

/** Решение по странице: оставить (и уточнить дату, картинку, ссылку) или выбросить как выдуманное. */
export function judgePage(f: Found, html: string, finalUrl: string): Found | null {
  const page = html.toLowerCase().replace(/ё/g, 'е');
  const ws = [...new Set(words(f.title))];
  const hits = ws.filter((w) => page.includes(w)).length;
  if (ws.length && hits === 0) return null; // на странице нет ни одного слова из названия — ссылка не про это событие
  const out: Found = { ...f, url: finalUrl };
  if (!out.image_url) out.image_url = pageImage(html, finalUrl);
  const start = ldStart(html);
  if (start && start.slice(0, 10) !== f.starts_at.slice(0, 10)) {
    out.starts_at = start; // разметка страницы точнее модели
    out.confidence = Math.min(Number(f.confidence ?? 0.6), 0.7);
  }
  return out;
}

async function checkOne(f: Found): Promise<Found | null> {
  try {
    const res = await fetch(f.url, { headers: UA, redirect: 'follow', signal: AbortSignal.timeout(12_000) });
    // Сайт закрыт для роботов (403/429) — не выкидываем, но понижаем уверенность: модератор проверит сам.
    if (res.status === 403 || res.status === 429) return { ...f, url: res.url || f.url, confidence: Math.min(Number(f.confidence ?? 0.6), 0.6) };
    if (!res.ok) return null;
    return judgePage(f, (await res.text()).slice(0, 1_500_000), res.url || f.url);
  } catch {
    return { ...f, confidence: Math.min(Number(f.confidence ?? 0.6), 0.5) };
  }
}

/** Параллельно, но не больше n запросов одновременно. */
async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

/** Дубли внутри запуска и даты вне окна — прочь. */
export function finalize(list: Found[], from: string, to: string): Found[] {
  const seen = new Set<string>();
  return list.filter((f) => {
    const day = almatyDate(new Date(f.starts_at));
    const endDay = f.ends_at && !Number.isNaN(Date.parse(f.ends_at)) ? almatyDate(new Date(f.ends_at)) : day;
    if (endDay < from || day > to) return false;
    const key = `${words(f.title).join(' ')}|${day}`;
    if (seen.has(key) || seen.has(f.url)) return false;
    seen.add(key);
    seen.add(f.url);
    return true;
  });
}

export async function runSearch(key: string, model = DEFAULT_MODEL, now = new Date(), days = 7): Promise<Found[]> {
  const from = almatyDate(now), to = almatyDate(new Date(now.getTime() + days * 86400e3));
  const t0 = Date.now();
  const answers = await Promise.all(TOPICS.map(async (topic) => {
    try { return await askGemini(topicPrompt(topic, from, to), key, model); } catch (err) {
      console.error(`  ✕ ${topic.split(',')[0]}: ${(err as Error).message}`);
      return { found: [] as Found[], usage: { prompt: 0, output: 0, searches: 0, sources: 0 } };
    }
  }));
  const usage = answers.reduce((s, a) => ({ prompt: s.prompt + a.usage.prompt, output: s.output + a.usage.output, searches: s.searches + a.usage.searches, sources: s.sources + a.usage.sources }), { prompt: 0, output: 0, searches: 0, sources: 0 });
  const raw = finalize(answers.flatMap((a) => a.found), from, to);
  const t1 = Date.now();
  const checked = (await pool(raw, 8, checkOne)).filter((f): f is Found => !!f);
  const out = finalize(checked, from, to);
  console.error(`Поиск ${from}…${to}: ИИ нашёл ${raw.length} (${((t1 - t0) / 1000).toFixed(0)} с), после проверки страниц ${out.length} (${((Date.now() - t1) / 1000).toFixed(0)} с).`);
  console.error(`Расход: токенов на вход ${usage.prompt}, на выход ${usage.output}, поисков Google ${usage.searches}, страниц-источников ${usage.sources}. Модель ${model}.`);
  return out;
}

// ——— В конвейер ———

export function externalId(f: Found): string {
  return 'g:' + createHash('sha1').update(`${f.url}|${f.title.trim().toLowerCase()}|${f.starts_at.slice(0, 10)}`).digest('hex').slice(0, 16);
}

/** Найденное событие → «пост» для конвейера + готовый разбор (второй раз ИИ не нужен). */
export function toPost(f: Found, sourceId: string, now = new Date()): { post: RawPost; x: Extraction } {
  const category = (CATEGORIES as readonly string[]).includes(f.category) ? (f.category as Category) : 'meetup';
  const price = f.is_free ? 'бесплатно' : f.price_min != null ? `от ${f.price_min} ₸` : 'цена не указана';
  const post: RawPost = {
    sourceId,
    externalId: externalId(f),
    url: f.url,
    text: [f.title, f.starts_at, [f.venue_name, f.address].filter(Boolean).join(', '), price, f.about ?? '', f.source_name ? `Источник: ${f.source_name}` : ''].filter(Boolean).join('\n'),
    images: isUrl(f.image_url) ? [f.image_url] : [],
    postedAt: now.toISOString(),
  };
  const long = f.ends_at ? Date.parse(f.ends_at) - Date.parse(f.starts_at) > 6 * 3600e3 : false;
  const x: Extraction = {
    class: 'event',
    title: f.title.trim().slice(0, 80),
    category,
    tags: [],
    starts_at: f.starts_at,
    ends_at: f.ends_at ?? null,
    is_long: long,
    venue_name: f.venue_name ?? null,
    address: f.address ?? null,
    address_note: null,
    price_min: f.price_min ?? null,
    price_max: f.price_max ?? null,
    is_free: !!f.is_free,
    price_unsure: !f.is_free && f.price_min == null,
    about: (f.about ?? '').trim(),
    organizer: null,
    // Поиск — не проверенный источник: сразу на карту не идёт никогда (см. autoPublish), только в «Согласование».
    confidence: Math.max(0, Math.min(1, Number(f.confidence ?? 0.6))),
    cancel_of: null,
  };
  return { post, x };
}

/** Картинка для событий из старых файлов поиска (без проверки страниц). */
export async function fillImages(posts: RawPost[], limit = 25): Promise<void> {
  await pool(posts.filter((q) => !q.images.length).slice(0, limit), 8, async (p) => {
    try {
      const res = await fetch(p.url, { headers: UA, signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return;
      const img = pageImage(await res.text(), p.url);
      if (img) p.images.push(img);
    } catch { /* не открылась — будет обложка раздела */ }
  });
}

// Шаг 1 воркфлоу: поиск → JSON в stdout, отчёт — в stderr.
if (process.argv[1]?.endsWith('search.ts') && process.argv.includes('--run')) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error('Нет GEMINI_API_KEY — поиск пропущен (docs/KEYS.md).');
    console.log('[]');
  } else {
    void runSearch(key, process.env.GEMINI_MODEL || undefined).then((out) => console.log(JSON.stringify(out, null, 1)));
  }
}
