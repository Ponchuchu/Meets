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
  return `Найди через поиск в интернете до ${max} реальных событий в Алматы с ${from} по ${to}. Тема: ${topic}.
Бери только события с конкретной датой, у которых есть страница (организатор, площадка, афиша, городской обзор). Ничего не выдумывай, год проверяй.
Сделай не больше двух поисков, затем сразу ответь. Ответь только JSON-массивом, без текста вокруг и без вызовов функций:
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

export const DEFAULT_MODEL = 'gemini-2.5-flash';
export const KIMI_MODEL = 'kimi-k2.6';
export const isKimi = (model: string) => /^(kimi|moonshot)-/i.test(model);

// ——— Kimi (Moonshot) со встроенным веб-поиском $web_search ———
// Ключ — секрет KIMI_API_KEY. Адрес можно сменить переменной KIMI_BASE_URL (по умолчанию международный api.moonshot.ai; для ключа из Китая — https://api.moonshot.cn/v1).
/** Модели, которые доступны этому ключу; для поиска берём не-«thinking» k2 или moonshot-v1. */
export async function kimiModels(key: string): Promise<string[]> {
  const base = (process.env.KIMI_BASE_URL || 'https://api.moonshot.ai/v1').replace(/\/$/, '');
  const res = await fetch(`${base}/models`, { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Kimi /models ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return ((await res.json()) as { data?: { id: string }[] }).data?.map((m) => m.id) ?? [];
}
export function pickKimiModel(ids: string[]): string | null {
  const ok = ids.filter((m) => !/thinking|vision|image|audio|code/i.test(m));
  for (const re of [/^kimi-k2\.6$/i, /^kimi-k3$/i, /^kimi-k2/i, /^kimi-latest$/i, /^moonshot-v1-32k$/i, /^moonshot-v1/i]) { const m = ok.find((x) => re.test(x)); if (m) return m; }
  return null;
}
const triedModels = new Map<string, string>();

export async function askKimi(prompt: string, key: string, model: string, timeoutMs = 150_000): Promise<{ found: Found[]; usage: Usage }> {
  model = triedModels.get(model) ?? model;
  try { return await askKimiOnce(prompt, key, model, timeoutMs); } catch (e) {
    if (!/Kimi 404/.test((e as Error).message)) throw e;
    // Такой модели у ключа нет — смотрим список доступных и берём подходящую (один раз на запуск).
    const ids = await kimiModels(key);
    console.error(`  Kimi: модели ${model} нет. Доступно: ${ids.join(', ') || '—'}`);
    const alt = pickKimiModel(ids);
    if (!alt || alt === model) throw e;
    console.error(`  Kimi: беру ${alt}`);
    triedModels.set(model, alt);
    return askKimiOnce(prompt, key, alt, timeoutMs);
  }
}

const NUDGE = 'Поиск закончен, больше ничего не вызывай. Выдай результат: только JSON-массив событий из найденного (формат из первого сообщения). Если подходящих событий нет — [].';

async function askKimiOnce(prompt: string, key: string, model: string, timeoutMs: number): Promise<{ found: Found[]; usage: Usage }> {
  const base = (process.env.KIMI_BASE_URL || 'https://api.moonshot.ai/v1').replace(/\/$/, '');
  type Msg = { role: string; content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[]; tool_call_id?: string; name?: string };
  const messages: Msg[] = [{ role: 'user', content: prompt }];
  const usage: Usage = { prompt: 0, output: 0, searches: 0, sources: 0 };
  const deadline = Date.now() + timeoutMs;
  let final = false;
  for (let step = 0; step < 6; step++) {
    const left = deadline - Date.now();
    if (left <= 0) throw new Error('Kimi: время вышло');
    // После двух поисков или после «вызова функции» текстом — инструмент отключаем: пусть пишет итог.
    const payload = () => JSON.stringify({ model, messages, max_tokens: 6000, ...(final ? {} : { tools: [{ type: 'builtin_function', function: { name: '$web_search' } }] }) });
    const send = (ms: number) => fetch(`${base}/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` }, body: payload(), signal: AbortSignal.timeout(ms) });
    let res = await send(left);
    if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 4000)); res = await send(Math.max(1000, deadline - Date.now())); }
    if (!res.ok) throw new Error(`Kimi ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const body = await res.json() as { choices?: { finish_reason?: string; message?: Msg }[]; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } };
    usage.prompt += body.usage?.prompt_tokens ?? 0;
    usage.output += body.usage?.completion_tokens ?? 0;
    const choice = body.choices?.[0];
    if (!choice?.message) throw new Error('Kimi: пустой ответ');
    if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls?.length) {
      messages.push(choice.message);
      for (const tc of choice.message.tool_calls) {
        usage.searches++;
        // Поиск выполняет сам Kimi: по правилам API аргументы возвращаются как есть.
        messages.push({ role: 'tool', tool_call_id: tc.id, name: tc.function.name, content: tc.function.arguments });
      }
      if (usage.searches >= 2) { final = true; messages.push({ role: 'user', content: NUDGE }); }
      continue;
    }
    const text = choice.message.content ?? '';
    const found = parseGeminiOutput(text);
    // Модель написала «вызов функции» текстом или просто план, а JSON не дала — один раз просим итог без поиска.
    if (!found.length && !final && !text.includes('[]')) {
      final = true;
      messages.push({ role: 'assistant', content: text || '…' }, { role: 'user', content: NUDGE });
      continue;
    }
    if (!found.length) console.error(`  Kimi: 0 событий. finish=${choice.finish_reason}, ответ: ${(text || '(пусто)').replace(/\s+/g, ' ').slice(0, 500)}`);
    return { found, usage };
  }
  throw new Error('Kimi: слишком много шагов поиска');
}

export const askModel = (prompt: string, key: string, model: string) => (isKimi(model) ? askKimi(prompt, key, model) : askGemini(prompt, key, model));
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

/** Похоже на логотип, иконку или заглушку сайта, а не на афишу события. */
export const looksLikeLogo = (u: string) => /(logo|favicon|sprite|placeholder|no[-_]?image|default[-_]?(image|og|share)|avatar|icon[-_.]|blank|pixel)/i.test(u);

/** Адрес отвечает и отдаёт настоящую картинку (не страницу и не пустышку). */
export async function imageAlive(u: string): Promise<boolean> {
  try {
    const res = await fetch(u, { headers: { ...UA, Range: 'bytes=0-0' }, redirect: 'follow', signal: AbortSignal.timeout(8_000) });
    if (!res.ok && res.status !== 206) return false;
    return /^image\//i.test(res.headers.get('content-type') ?? '');
  } catch { return false; }
}

/** Решение по странице: оставить (и уточнить дату, картинку, ссылку) или выбросить как выдуманное. */
export function judgePage(f: Found, html: string, finalUrl: string): Found | null {
  const page = html.toLowerCase().replace(/ё/g, 'е');
  const ws = [...new Set(words(f.title))];
  const hits = ws.filter((w) => page.includes(w)).length;
  if (ws.length && hits === 0) return null; // на странице нет ни одного слова из названия — ссылка не про это событие
  const out: Found = { ...f, url: finalUrl };
  if (!out.image_url || looksLikeLogo(out.image_url)) out.image_url = pageImage(html, finalUrl);
  if (out.image_url && looksLikeLogo(out.image_url)) out.image_url = null;
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
    const judged = judgePage(f, (await res.text()).slice(0, 1_500_000), res.url || f.url);
    // Картинка не открывается — лучше без неё: приложение покажет обложку раздела, а не пустой квадрат.
    if (judged?.image_url && !(await imageAlive(judged.image_url))) judged.image_url = null;
    return judged;
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

export async function runSearch(key: string, model = DEFAULT_MODEL, now = new Date(), days = 7, topics: string[] = TOPICS, limit = 40): Promise<Found[]> {
  const from = almatyDate(now), to = almatyDate(new Date(now.getTime() + days * 86400e3));
  const t0 = Date.now();
  const answers = await Promise.all(topics.map(async (topic) => {
    try { return await askModel(topicPrompt(topic, from, to), key, model); } catch (err) {
      console.error(`  ✕ ${topic.split(',')[0]}: ${(err as Error).message}`);
      return { found: [] as Found[], usage: { prompt: 0, output: 0, searches: 0, sources: 0 } };
    }
  }));
  if (answers.every(a=>a.usage.prompt===0)) throw new Error(`${isKimi(model) ? 'Kimi' : 'Gemini'} не ответил. Проверь модель, ключ и квоту API`);
  const usage = answers.reduce((s, a) => ({ prompt: s.prompt + a.usage.prompt, output: s.output + a.usage.output, searches: s.searches + a.usage.searches, sources: s.sources + a.usage.sources }), { prompt: 0, output: 0, searches: 0, sources: 0 });
  const raw = finalize(answers.flatMap((a) => a.found), from, to);
  const t1 = Date.now();
  const checked = (await pool(raw, 8, checkOne)).filter((f): f is Found => !!f);
  const out = finalize(checked, from, to);
  console.error(`Поиск ${from}…${to}: ИИ нашёл ${raw.length} (${((t1 - t0) / 1000).toFixed(0)} с), после проверки страниц ${out.length} (${((Date.now() - t1) / 1000).toFixed(0)} с).`);
  console.error(`Расход: токенов на вход ${usage.prompt}, на выход ${usage.output}, поисков Google ${usage.searches}, страниц-источников ${usage.sources}. Модель ${model}.`);
  return out.slice(0,limit);
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
async function main() {
  const model = process.env.GEMINI_MODEL || (process.env.KIMI_API_KEY && !process.env.GEMINI_API_KEY ? KIMI_MODEL : undefined) || DEFAULT_MODEL;
  const key = isKimi(model) ? process.env.KIMI_API_KEY : process.env.GEMINI_API_KEY;
  if(!key)throw new Error(isKimi(model) ? 'Нет KIMI_API_KEY. Добавь ключ в секреты GitHub Actions' : 'Нет GEMINI_API_KEY. Добавь ключ в секреты GitHub Actions');
  const names=['music','standup','cinema','art','food','sport'];
  const selected=(process.env.SEARCH_TOPICS||'').split(',').filter(Boolean);
  const topics=selected.length?TOPICS.filter((_t,i)=>selected.includes(names[i])):TOPICS;
  const days=Number(process.env.SEARCH_DAYS||7), limit=Number(process.env.SEARCH_LIMIT||40);
  if(!topics.length||!Number.isInteger(days)||days<1||days>30||!Number.isInteger(limit)||limit<1||limit>100)throw new Error('Invalid search parameters');
  const out=await runSearch(key,model,new Date(),days,topics,limit);
  console.log(JSON.stringify(out,null,1));
}

if(process.argv[1]?.endsWith('search.ts')&&process.argv.includes('--run'))void main().catch(e=>{console.error(e instanceof Error?e.message:'Search failed');process.exitCode=1;});
