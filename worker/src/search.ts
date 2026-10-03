// Поиск событий через Gemini CLI (раз в сутки, .github/workflows/search.yml).
// Шаг 1 (без секретов базы): node worker/src/search.ts --prompt → текст задания → gemini -p … -o json > search.json
// Шаг 2: node worker/src/index.ts --search search.json → черновики в «Согласование» (тот же конвейер: дубли, места, флаги).
// ИИ здесь только находит события и заполняет поля. Картинка — с самой страницы события (og:image), без генерации.
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

/** Дата YYYY-MM-DD по Алматы. */
export function almatyDate(d: Date): string {
  return new Date(d.getTime() + 5 * 3600e3).toISOString().slice(0, 10);
}

export function buildPrompt(now = new Date(), days = 7, max = 25): string {
  const from = almatyDate(now);
  const to = almatyDate(new Date(now.getTime() + days * 86400e3));
  return `Найди события в Алматы с ${from} по ${to} для приложения-карты «рядом.».
Ищи через google_web_search, каждую найденную страницу открывай через web_fetch и бери данные только с неё.
Где искать: сайты площадок и организаторов (театры, клубы, бары, музеи, ТРЦ, кинотеатры), almaty-ayenderi.kz (управление культуры),
городские обзоры «куда сходить в Алматы», анонсы бесплатных и уличных событий (Арбат, парки, площади), спорт и походы.
Правила:
- Только события, которые ты видел на открытой странице. Ничего не выдумывай. Год проверяй по странице.
- url — адрес страницы события (лучше у организатора или площадки).
- image_url — картинка-афиша с этой же страницы (og:image или главный постер), полный адрес; нет — null.
- about — 2–3 предложения своими словами, без копирования текста страницы, без эмодзи.
- category — одно из: ${CATEGORIES.join(', ')}.
- starts_at и ends_at — ISO 8601 с поясом ${ALMATY}. Цены — числа в тенге; бесплатно — is_free true.
- confidence — от 0 до 1, насколько ты уверен в дате, месте и цене.
- Не больше ${max} событий, разные жанры, без повторов.
Ответь ТОЛЬКО JSON-массивом без пояснений, элементы такие:
{"title":"","category":"","starts_at":"","ends_at":null,"venue_name":"","address":"","price_min":null,"price_max":null,"is_free":false,"about":"","url":"","image_url":null,"source_name":"","confidence":0.8}`;
}

/** Ответ Gemini CLI (-o json: {"response": "...", "stats": …}) или просто текст → список событий. */
export function parseGeminiOutput(raw: string): Found[] {
  let text = raw.trim();
  try {
    const wrapped = JSON.parse(text) as { response?: unknown };
    if (wrapped && typeof wrapped === 'object' && !Array.isArray(wrapped) && typeof wrapped.response === 'string') text = wrapped.response;
    else if (Array.isArray(wrapped)) return clean(wrapped);
  } catch { /* не JSON-обёртка — ищем массив в тексте */ }
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

/** og:image со страницы события — если Gemini не вернул картинку. */
export function ogImage(html: string, base: string): string | null {
  const m = html.match(/<meta[^>]+property=["']og:image(?::url)?["'][^>]*content=["']([^"']+)["']/i) ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  if (!m) return null;
  try { return new URL(m[1], base).toString(); } catch { return null; }
}

export async function fillImages(posts: RawPost[], limit = 25): Promise<void> {
  for (const p of posts.filter((q) => !q.images.length).slice(0, limit)) {
    try {
      const res = await fetch(p.url, { headers: { 'User-Agent': 'ryadom-worker/0.1 (+https://ryadom.app)' }, signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const img = ogImage(await res.text(), p.url);
      if (img) p.images.push(img);
    } catch { /* страница не открылась — карточка будет с обложкой раздела */ }
  }
}

// Шаг 1 воркфлоу: напечатать задание для Gemini CLI.
if (process.argv[1]?.endsWith('search.ts') && process.argv.includes('--prompt')) console.log(buildPrompt());
