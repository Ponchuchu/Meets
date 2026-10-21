// Поиск событий ИИ раз в сутки (.github/workflows/search.yml). Быстро и экономно:
//   1. Gemini API с поиском Google — 6 разделов параллельно, по одному запросу на раздел (секунды, а не минуты).
//   2. Страницы событий открывает наш код без ИИ, тоже параллельно: жива ли ссылка, есть ли на ней название,
//      точная дата из разметки schema.org, картинка og:image. Выдуманные и битые ссылки отсеиваются.
//   3. node worker/src/index.ts --search search.json → черновики в «Согласование» (дубли, места, флаги — общий конвейер).
// Запуск шага 1: GEMINI_API_KEY=… node worker/src/search.ts --run > search.json  (ключи базы этому шагу не нужны)
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { CATEGORIES, type Category, type Extraction, type RawPost } from './types.ts';
import { normalize, similarity } from './dedupe.ts';
import { fetchSxodimFound } from './sites.ts';
import { CINEMA_SITES, fetchCinemaFound } from './cinema.ts';
import { robotLog, robotUpdate } from './robot.ts';
import { fetchYandexFound } from './yandex.ts';
import { EVENT_SITES, fetchEventSiteFound, type EventSite } from './eventSites.ts';
import { isKimi, KIMI_DEFAULT_MODEL, kimiPost, type KimiMessage } from './kimi.ts';

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
  lat?: number | null;
  lon?: number | null;
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

/** Подборки «куда сходить на выходных» и городские праздники — статьи, их разбирает только ИИ (сайты без разметки событий). */
export const CITY_TOPIC = 'подборка «куда сходить в выходные» и городские праздники, бесплатные массовые события акимата';
const CITY_SITES: Record<string, string> = { inform: 'inform.kz', akimat: 'gov.kz/memleket/entities/almaty' };

/** Сайты, на которых ИИ ищет афишу (дешевле и точнее, чем весь интернет). Меняется переменной SEARCH_SITES (через запятую). */
export const SITES = ['sxodim.com', 'afisha.yandex.kz', 'ticketon.kz', 'kassir.kz', 'kino.kz'];

export function topicPrompt(topic: string, from: string, to: string, max = 6, citySites: string[] = []): string {
  const sites = topic === CITY_TOPIC && citySites.length ? citySites.join(', ') : (process.env.SEARCH_SITES ? process.env.SEARCH_SITES.split(',') : SITES).slice(0, 4).join(', ');
  return `Найди через поиск до ${max} реальных событий в Алматы с ${from} по ${to}. Тема: ${topic}.
Ищи на: ${sites}. Нужны дата и время, площадка, адрес, цена (нет — null). url — страница события или афиша площадки, не главная сайта. Не выдумывай, год проверяй. Не больше двух поисков, затем сразу ответ: только JSON-массив без вызовов функций ([] если пусто):
[{"title":"","category":"${CATEGORIES.join('|')}","starts_at":"ISO 8601 ${ALMATY}","ends_at":null,"venue_name":"","address":"","price_min":null,"price_max":null,"is_free":false,"about":"полное описание со страницы события, до 1500 символов","url":"","source_name":"","confidence":0.8}]`;
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
export { isKimi } from './kimi.ts';

const NUDGE = 'Поиск закончен, больше ничего не вызывай. Выдай результат: только JSON (формат из первого сообщения). Если подходящего нет — [].';

/**
 * Вопрос Kimi с её встроенным веб-поиском ($web_search). Не больше двух поисков, потом просим итог без инструментов.
 * Возвращает текст ответа и расход.
 */
export async function kimiSearch(prompt: string, key: string, model: string, maxSearches = 2): Promise<{ text: string; usage: Usage }> {
  const messages: KimiMessage[] = [{ role: 'user', content: prompt }];
  const usage: Usage = { prompt: 0, output: 0, searches: 0, sources: 0 };
  let final = false;
  for (let step = 0; step < maxSearches + 3; step++) {
    const body = await kimiPost(key, { model, messages, max_tokens: 6000, ...(final ? {} : { tools: [{ type: 'builtin_function', function: { name: '$web_search' } }] }) }, 300_000);
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
      if (usage.searches >= maxSearches) { final = true; messages.push({ role: 'user', content: NUDGE }); }
      continue;
    }
    const text = choice.message.content ?? '';
    // «Вызов функции» текстом или план вместо JSON — один раз просим итог без поиска.
    if (!final && !/[[{]/.test(text)) { final = true; messages.push({ role: 'assistant', content: text || '…' }, { role: 'user', content: NUDGE }); continue; }
    return { text, usage };
  }
  throw new Error('Kimi: слишком много шагов поиска');
}

export async function askKimi(prompt: string, key: string, model: string): Promise<{ found: Found[]; usage: Usage }> {
  const { text, usage } = await kimiSearch(prompt, key, model);
  const found = parseGeminiOutput(text);
  if (!found.length) console.error(`  Kimi: 0 событий. Ответ: ${(text || '(пусто)').replace(/\s+/g, ' ').slice(0, 400)}`);
  return { found, usage };
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

/** Ссылка ведёт на главную страницу сайта, а не на само событие. */
export const isHomepage = (u: string) => { try { const x = new URL(u); return x.pathname.replace(/\/+$/, '') === '' && !x.search; } catch { return false; } };

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
    // Главная страница сайта — не страница события: оставляем на проверку модератору, без картинки сайта.
    if (judged && isHomepage(judged.url)) { judged.confidence = Math.min(Number(judged.confidence ?? 0.6), 0.5); judged.image_url = null; }
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

/** Начинается в окне или это короткое (до 14 дней) событие, которое уже идёт; туры «на весь год» отсекаем. */
export function startsInWindow(f: Found, from: string): boolean {
  const day = almatyDate(new Date(f.starts_at));
  if (day >= from) return true;
  // Уже идущее показываем только если это выставка и закончится в ближайшие недели.
  if (f.category !== 'art' || !f.ends_at || Number.isNaN(Date.parse(f.ends_at))) return false;
  return Date.parse(f.ends_at) - Date.parse(f.starts_at) <= 60 * 86400e3;
}

/** Дубли внутри запуска и даты вне окна — прочь. */
/** Событие пересекается с окном дат [from, to] (по Алматы). */
export function inWindow(f: Found, from: string, to: string): boolean {
  const day = almatyDate(new Date(f.starts_at));
  const endDay = f.ends_at && !Number.isNaN(Date.parse(f.ends_at)) ? almatyDate(new Date(f.ends_at)) : day;
  return !(endDay < from || day > to);
}

export function finalize(list: Found[], from: string, to: string): Found[] {
  const kept: Found[] = [];
  const urls = new Set<string>();
  for (const f of list) {
    if (!inWindow(f, from, to)) continue;
    const day = almatyDate(new Date(f.starts_at));
    // Ссылка одна, а сеансов несколько (Яндекс) — дубль только ссылка в тот же день.
    if (urls.has(`${f.url}|${day}`)) continue;
    urls.add(`${f.url}|${day}`);
    const twin = kept.find((k) => sameEvent(k, f));
    if (twin) { mergeInto(twin, f); continue; }
    kept.push({ ...f });
  }
  return kept;
}

const stems = (t: string) => new Set(normalize(t).split(' ').filter((w) => w.length >= 4).map((w) => w.slice(0, 3)));
const hasTime = (iso: string) => /T\d{2}:\d{2}/.test(iso);

/** Одно и то же событие на разных сайтах: день и площадка те же, а название похоже или совпадает время и корни слов (падежи: «Миша» / «Миши»). */
export function sameEvent(a: Found, b: Found): boolean {
  if (almatyDate(new Date(a.starts_at)) !== almatyDate(new Date(b.starts_at))) return false;
  if (a.venue_name && b.venue_name && similarity(a.venue_name, b.venue_name) < 0.3) return false;
  const long = [a, b].some(x => x.ends_at && Date.parse(x.ends_at) - Date.parse(x.starts_at) > 6 * 3600e3);
  if (!long && Math.floor(Date.parse(a.starts_at) / 60000) !== Math.floor(Date.parse(b.starts_at) / 60000)) return false;
  if (similarity(a.title, b.title) >= 0.5) return true;
  const sameTime = hasTime(a.starts_at) && hasTime(b.starts_at) && Math.abs(Date.parse(a.starts_at) - Date.parse(b.starts_at)) <= 30 * 60e3;
  if (!sameTime) return false;
  const x = stems(a.title), y = stems(b.title);
  let common = 0;
  x.forEach((w) => y.has(w) && common++);
  return common >= 2;
}

/** То же событие нашли на втором сайте: пустые поля первой карточки (фото, цена, точка, площадка) берём со второй. */
export function mergeInto(a: Found, b: Found): void {
  a.image_url ||= b.image_url ?? null;
  if (a.price_min == null && b.price_min != null) { a.price_min = b.price_min; a.price_max = b.price_max ?? a.price_max ?? null; }
  if (!a.is_free && b.is_free) a.is_free = true;
  a.venue_name ||= b.venue_name ?? null;
  a.address ||= b.address ?? null;
  a.about ||= b.about;
  if (a.lat == null && b.lat != null) { a.lat = b.lat; a.lon = b.lon ?? null; }
  if (a.source_name && b.source_name && !a.source_name.includes(b.source_name)) a.source_name = `${a.source_name} + ${b.source_name}`;
  // Подтверждено двумя сайтами — доверяем чуть больше.
  a.confidence = Math.min(0.95, Math.max(Number(a.confidence ?? 0.6), Number(b.confidence ?? 0.6)) + 0.05);
}

/**
 * Последний шаг для карточек без картинки: Kimi ищет официальную страницу события, а картинку берём с неё сами и проверяем
 * (открывается, не логотип, на странице есть слова из названия). Ссылкам на картинки от ИИ напрямую не верим.
 * Дорого по токенам и по лимиту аккаунта (3 запроса в минуту), поэтому не больше `max` карточек за запуск.
 */
export async function findImagesWithKimi(list: Found[], key: string, model: string, max: number): Promise<number> {
  let filled = 0;
  for (const f of list.filter((x) => !x.image_url).slice(0, max)) {
    try {
      const day = almatyDate(new Date(f.starts_at));
      const { text } = await kimiSearch(`Найди официальную страницу или афишу события «${f.title}» (${day}, ${f.venue_name ?? 'Алматы'}). Верни только JSON {"page":"ссылка на страницу события","image":"прямая ссылка на афишу или null"}. Ничего не выдумывай.`, key, model, 1);
      const raw = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
      const hit = JSON.parse(raw) as { page?: unknown; image?: unknown };
      let image: string | null = null;
      if (isUrl(hit.page)) {
        const res = await fetch(hit.page, { headers: UA, redirect: 'follow', signal: AbortSignal.timeout(12_000) });
        if (res.ok) {
          const judged = judgePage({ ...f, image_url: null }, (await res.text()).slice(0, 1_500_000), res.url || hit.page);
          if (judged?.image_url && !looksLikeLogo(judged.image_url) && (await imageAlive(judged.image_url))) image = judged.image_url;
        }
      }
      if (!image && isUrl(hit.image) && !looksLikeLogo(hit.image) && (await imageAlive(hit.image))) image = hit.image;
      if (image) { f.image_url = image; filled++; console.error(`  фото найдено Kimi: ${f.title.slice(0, 40)}`); }
    } catch (err) { console.error(`  ✕ фото для «${f.title.slice(0, 30)}»: ${(err as Error).message.slice(0, 120)}`); }
  }
  return filled;
}

/** До limit штук: по кругу берём ближайшее событие каждой категории, чтобы стендап не вытеснил концерты, театр и лекции. */
export function balanced(list: Found[], limit: number): Found[] {
  if (list.length <= limit) return list;
  const groups = new Map<string, Found[]>();
  for (const f of list) groups.set(f.category, [...(groups.get(f.category) ?? []), f]);
  const queues = [...groups.values()];
  const out: Found[] = [];
  for (let i = 0; out.length < limit; i++) {
    let took = false;
    for (const q of queues) if (q[i] && out.length < limit) { out.push(q[i]); took = true; }
    if (!took) break;
  }
  return out.sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
}

/** Отчёт запуска для панели разработчика: откуда сколько пришло, что отсеялось, какого качества результат. Пишется в robot_runs.stats. */
export interface SearchReport {
  window: { from: string; to: string };
  sources: { name: string; found: number; ok: boolean; error?: string }[];
  /** Прочитано, но дата вне выбранного периода. */
  outside: number;
  /** Склеено как дубли между сайтами. */
  merged: number;
  kept: number;
  photo: number;
  noPhoto: number;
  /** Событий, у которых координаты пришли вместе с сайтом (Яндекс). Остальное определяет геокодер при записи в базу. */
  siteGeo: number;
  price: number;
  ai?: { model: string; asked: number; found: number; kept: number; tokensIn: number; tokensOut: number; error?: string };
  kimiPhotos?: number;
}
export const newReport = (): SearchReport => ({ window: { from: '', to: '' }, sources: [], outside: 0, merged: 0, kept: 0, photo: 0, noPhoto: 0, siteGeo: 0, price: 0 });

export const SITE_KEYS = ['yandex', 'sxodim', ...Object.keys(CINEMA_SITES), ...Object.keys(EVENT_SITES), 'inform', 'akimat'] as const;

export async function runSearch(key: string | undefined, model = DEFAULT_MODEL, now = new Date(), days = 7, topics: string[] = TOPICS, limit = 40, sources: 'sites' | 'ai' | 'all' = 'all', report: SearchReport = newReport(), sitesOn: readonly string[] = SITE_KEYS): Promise<Found[]> {
  const from = almatyDate(now), to = almatyDate(new Date(now.getTime() + days * 86400e3));
  report.window = { from, to };
  const t0 = Date.now();
  // 1. Афиши читает код: дата, площадка, цена, фото берутся прямо со страницы события, ИИ не нужен (0 токенов).
  //    Яндекс Афиша — первой: у неё есть координаты площадки; дубли между сайтами отсекает finalize и общий конвейер.
  let fromSites: Found[] = [];
  if (sources !== 'ai') {
    let progress: Promise<void> = Promise.resolve();
    const publishProgress = () => { progress = progress.catch(() => undefined).then(() => robotUpdate({ found: report.sources.reduce((n, s) => n + s.found, 0) })).catch(() => undefined); return progress; };
    const grab = async (name: string, run: () => Promise<Found[]>): Promise<Found[]> => {
      const t = Date.now();
      try {
        const list = (await run()).filter((f) => startsInWindow(f, from));
        console.error(`  ${name}: ${list.length} событий с ${from} (${((Date.now() - t) / 1000).toFixed(0)} с)`);
        report.sources.push({ name, found: list.length, ok: true });
        await robotLog(`Источник · ${name} · найдено ${list.length}`, 'ok').catch(() => undefined);
        await publishProgress();
        return list;
      } catch (err) {
        console.error(`  ✕ ${name}: ${(err as Error).message}`);
        report.sources.push({ name, found: 0, ok: false, error: (err as Error).message.slice(0, 120) });
        await robotLog(`Источник · ${name} · ${(err as Error).message.slice(0, 120)}`, 'warn').catch(() => undefined);
        return [];
      }
    };
    // Какие сайты читать, решают переключатели «собирать» в панели (передаются из функции запуска).
    const lists = await Promise.all([
      sitesOn.includes('yandex') ? grab('Яндекс Афиша', () => fetchYandexFound(from)) : Promise.resolve([] as Found[]),
      sitesOn.includes('sxodim') ? grab('Sxodim', () => fetchSxodimFound()) : Promise.resolve([] as Found[]),
      ...Object.entries(CINEMA_SITES).map(([site, config]) => sitesOn.includes(site) ? grab(config.name, () => fetchCinemaFound(site as keyof typeof CINEMA_SITES)) : Promise.resolve([] as Found[])),
      ...Object.entries(EVENT_SITES).map(([site, config]) => sitesOn.includes(site) ? grab(config.name, () => fetchEventSiteFound(site as EventSite)) : Promise.resolve([] as Found[])),
    ]);
    const all = lists.flat();
    const inside = all.filter((f) => inWindow(f, from, to));
    fromSites = finalize(inside, from, to);
    report.outside = all.length - inside.length;
    report.merged = inside.length - fromSites.length;
    console.error(`Сайты: после отсева дублей и дат ${fromSites.length} событий в окне ${from}…${to} (${((Date.now() - t0) / 1000).toFixed(0)} с, токенов 0).`);
  }
  // 2. ИИ ищет дополнительно, только по заданным сайтам. Включены «Казинформ» или акимат — добавляется раздел подборок.
  const citySites = Object.entries(CITY_SITES).filter(([k]) => sitesOn.includes(k)).map(([, v]) => v);
  if (citySites.length && !topics.includes(CITY_TOPIC)) topics = [...topics, CITY_TOPIC];
  let fromAi: Found[] = [];
  if (sources !== 'sites' && !key) {
    const error = isKimi(model) ? 'Нет KIMI_API_KEY' : 'Нет GEMINI_API_KEY';
    report.ai = { model, asked: 0, found: 0, kept: 0, tokensIn: 0, tokensOut: 0, error };
    if (!fromSites.length) throw new Error(error);
    console.error(`${error}. Сохраняем найденное сайтами.`);
  }
  if (sources !== 'sites' && key) {
    const t1 = Date.now();
    // Kimi на этом ключе пускает один запрос за раз (лимит аккаунта) — идём по разделам по очереди, Gemini — параллельно.
    const mapTopics = async <R>(fn: (t: string) => Promise<R>): Promise<R[]> => {
      if (!isKimi(model)) return Promise.all(topics.map(fn));
      const out: R[] = [];
      for (const t of topics) out.push(await fn(t));
      return out;
    };
    const answers = await mapTopics(async (topic) => {
      try { return await askModel(topicPrompt(topic, from, to, 6, citySites), key, model); } catch (err) {
        console.error(`  ✕ ${topic.split(',')[0]}: ${(err as Error).message}`);
        return { found: [] as Found[], usage: { prompt: 0, output: 0, searches: 0, sources: 0 } };
      }
    });
    // Если ИИ недоступен, а сайты уже дали события — не падаем, отдаём то, что есть.
    if (answers.every((a) => a.usage.prompt === 0)) report.ai = { model, asked: topics.length, found: 0, kept: 0, tokensIn: 0, tokensOut: 0, error: `${isKimi(model) ? 'Kimi' : 'Gemini'} не ответил` };
    if (answers.every((a) => a.usage.prompt === 0) && !fromSites.length) throw new Error(`${isKimi(model) ? 'Kimi' : 'Gemini'} не ответил. Проверь модель, ключ и квоту API`);
    const usage = answers.reduce((s, a) => ({ prompt: s.prompt + a.usage.prompt, output: s.output + a.usage.output, searches: s.searches + a.usage.searches, sources: s.sources + a.usage.sources }), { prompt: 0, output: 0, searches: 0, sources: 0 });
    const raw = finalize(answers.flatMap((a) => a.found), from, to);
    const t2 = Date.now();
    const checked = (await pool(raw, 8, checkOne)).filter((f): f is Found => !!f);
    fromAi = finalize(checked, from, to);
    report.ai = { model, asked: topics.length, found: raw.length, kept: fromAi.length, tokensIn: usage.prompt, tokensOut: usage.output, ...(report.ai?.error ? { error: report.ai.error } : {}) };
    console.error(`ИИ нашёл ${raw.length} (${((t2 - t1) / 1000).toFixed(0)} с), после проверки страниц ${fromAi.length}. Расход: вход ${usage.prompt}, выход ${usage.output} токенов, поисков ${usage.searches}. Модель ${model}.`);
  }
  // Сначала то, что прочитано с сайта (точнее); дубли по названию и дню отсекает finalize.
  const out = finalize([...fromSites, ...fromAi], from, to).sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  const withPhoto = out.filter((f) => f.image_url).length;
  console.error(`Итого ${out.length} событий, с фото ${withPhoto}. Оставляем ${Math.min(limit, out.length)}.`);
  const picked = balanced(out, limit);
  // Фото: сначала со страницы события и со второго сайта (уже сделано выше); для оставшихся без фото — Kimi, если разрешено.
  const kimiKey = process.env.KIMI_API_KEY;
  const findMax = Number(process.env.SEARCH_FIND_IMAGES || 0);
  if (findMax > 0 && kimiKey) {
    const filled = await findImagesWithKimi(picked, kimiKey, isKimi(model) ? model : KIMI_DEFAULT_MODEL, findMax);
    report.kimiPhotos = filled;
    console.error(`Фото через Kimi: нашла для ${filled} из ${Math.min(findMax, picked.filter((f) => !f.image_url).length + filled)} карточек без фото.`);
  }
  console.error(`Без фото осталось ${picked.filter((f) => !f.image_url).length} (в приложении покажется обложка раздела).`);
  report.kept = picked.length;
  report.photo = picked.filter((f) => f.image_url).length;
  report.noPhoto = picked.length - report.photo;
  report.siteGeo = picked.filter((f) => f.lat != null).length;
  report.price = picked.filter((f) => f.price_min != null || f.is_free).length;
  return picked;
}

// ——— В конвейер ———

export function externalId(f: Found): string {
  return 'g:' + createHash('sha1').update(`${f.url}|${f.title.trim().toLowerCase()}|${new Date(f.starts_at).toISOString()}|${f.venue_name ?? f.address ?? ''}`).digest('hex').slice(0, 16);
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
    lat: f.lat ?? null,
    lon: f.lon ?? null,
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
  const sources = (['sites', 'ai', 'all'] as const).find((x) => x === process.env.SEARCH_SOURCES) ?? 'all';
  const model = process.env.GEMINI_MODEL || (process.env.KIMI_API_KEY && !process.env.GEMINI_API_KEY ? KIMI_DEFAULT_MODEL : undefined) || DEFAULT_MODEL;
  const key = isKimi(model) ? process.env.KIMI_API_KEY : process.env.GEMINI_API_KEY;
  if (sources !== 'sites' && !key) throw new Error(isKimi(model) ? 'Нет KIMI_API_KEY. Добавь ключ в секреты GitHub Actions' : 'Нет GEMINI_API_KEY. Добавь ключ в секреты GitHub Actions');
  const names=['music','standup','cinema','art','food','sport'];
  const selected=(process.env.SEARCH_TOPICS||'').split(',').filter(Boolean);
  const topics=selected.length?TOPICS.filter((_t,i)=>selected.includes(names[i])):TOPICS;
  const days=Number(process.env.SEARCH_DAYS||7), limit=Number(process.env.SEARCH_LIMIT||40);
  if(!topics.length||!Number.isInteger(days)||days<1||days>30||!Number.isInteger(limit)||limit<1||limit>100)throw new Error('Invalid search parameters');
  const sitesOn = (process.env.SEARCH_SITES_ON || SITE_KEYS.join(',')).split(',').map((x) => x.trim()).filter((x) => (SITE_KEYS as readonly string[]).includes(x));
  const report = newReport();
  try {
    const out=await runSearch(key,model,new Date(),days,topics,limit,sources,report,sitesOn);
    console.log(JSON.stringify(out,null,1));
  } finally {
    // Отчёт нужен панели даже если поиск упал: следующий шаг (с доступом к базе) положит его в запуск.
    writeFileSync(process.env.SEARCH_REPORT || 'search-report.json', JSON.stringify(report));
  }
}

if(process.argv[1]?.endsWith('search.ts')&&process.argv.includes('--run'))void main().catch(e=>{console.error(e instanceof Error?e.message:'Search failed');process.exitCode=1;});
