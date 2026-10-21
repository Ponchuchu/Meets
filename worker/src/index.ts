// Сборщик событий. Запуск: GitHub Actions каждые 2 часа с 08:00 до 00:00 по Алматы (.github/workflows/worker.yml).
//   node worker/src/index.ts            — все включённые Telegram-источники → черновики в базе
//   node worker/src/index.ts --demo     — посты из worker/fixtures, печать черновиков, без записи в базу
//   node worker/src/index.ts --search search.json [--demo] — события, найденные Gemini CLI (search.ts) → «Согласование»
// Переменные: SUPABASE_URL, SUPABASE_SECRET_KEY (или SUPABASE_SERVICE_ROLE_KEY), ANTHROPIC_API_KEY или KIMI_API_KEY.
import {cancelled,robotUpdate,robotLog,robotMergeStats} from './robot.ts';
import { LANG_TAG, polishAbouts } from './polish.ts';
import { readReport, runStats, telegramLine, telegramStat, type TelegramStat } from './runstats.ts';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { understand } from './ai.ts';
import { createDb } from './db.ts';
import { processPosts, summary, type Outcome } from './pipeline.ts';
import { fillImages, parseGeminiOutput, toPost, type Found } from './search.ts';
import { fetchChannel, parseChannel } from './telegram.ts';
import type { Db } from './db.ts';
import type { Extraction, RawPost, Source } from './types.ts';
import { CINEMA_SITES, type CinemaSite } from './cinema.ts';
import { geocode, type VenueRow } from './venues.ts';
import { EVENT_SITES, type EventSite } from './eventSites.ts';

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const args = new Set(argv);
const searchFile = args.has('--search') ? argv[argv.indexOf('--search') + 1] : null;

/** Найденные события из файла поиска. */
async function readFound(file: string): Promise<Found[]> {
  return parseGeminiOutput(await readFile(file, 'utf8'));
}

/** Найденное → посты конвейера + готовый разбор (второй раз ИИ не нужен). */
async function batchOf(found: Found[], sourceId: string) {
  const items = found.map((f) => toPost(f, sourceId));
  const posts = items.map((i) => i.post);
  if (!args.has('--no-images')) await fillImages(posts);
  const byId = new Map<string, Extraction>(items.map((i) => [i.post.externalId, i.x]));
  const understandFound = async (p: RawPost) => ({ ...byId.get(p.externalId)!, by: 'ai' as const });
  return { posts, understandFound };
}

/** Файл с ответом Gemini CLI → посты + готовые разборы (демо). */
async function loadSearch(file: string, sourceId: string) {
  return batchOf(await readFound(file), sourceId);
}

/** Какой строке «Источников» принадлежит событие: «Яндекс Афиша» → сайт Яндекса, «Sxodim» → Sxodim, остальное — «Поиск». */
type SiteKey = CinemaSite | EventSite | 'yandex' | 'sxodim' | 'search';
function sourceKeyOf(f: Found): SiteKey {
  const n = (f.source_name ?? '').toLowerCase();
  const cinema = Object.entries(CINEMA_SITES).find(([, c]) => c.name.toLowerCase() === n);
  const site = Object.entries(EVENT_SITES).find(([, c]) => c.name.toLowerCase() === n);
  return cinema ? cinema[0] as CinemaSite : site ? site[0] as EventSite : n.includes('яндекс') || n.includes('yandex') ? 'yandex' : n.includes('sxodim') ? 'sxodim' : 'search';
}
/** Строка «Источников» нового сайта-афиши — по адресу её первой страницы (onvibe.me/almaty, kino.kz/ru/concert…). */
const EVENT_HANDLES: Record<EventSite, string> = { onvibe: 'onvibe.me', topbilet: 'topbilet.kz', portalbilet: 'portalbilet.kz', gorodzovet: 'gorodzovet.ru', 'kino-concert': 'kino.kz/ru/concert' };
const rowFor = (key: SiteKey, sources: Source[], fallback: Source): Source => {
  if (key === 'search') return fallback;
  if (key in EVENT_HANDLES) return sources.find(s => s.kind === 'site' && s.handle.toLowerCase().includes(EVENT_HANDLES[key as EventSite])) ?? fallback;
  const cinema = key !== 'yandex' && key !== 'sxodim' ? CINEMA_SITES[key as CinemaSite] : null;
  const handle = cinema ? cinema.url.replace(/^https?:\/\/(?:www\.)?/, '').replace(/\/$/, '') : key;
  return sources.find(s => s.kind === 'site' && (cinema ? s.handle.toLowerCase().replace(/^www\./, '').replace(/\/$/, '') === handle : s.handle.toLowerCase().includes(key) && !s.handle.includes('/cinema'))) ?? fallback;
};

function print(results: Outcome[]) {
  for (const r of results) {
    const head = r.post.text.split('\n')[0].slice(0, 60);
    if (r.kind === 'draft') {
      const d = r.draft;
      console.log(`  ✚ ${d.status === 'published' ? 'НА КАРТУ' : 'черновик'} ${Math.round(d.ai_confidence * 100)}% · ${d.title} · ${d.starts_at} · ${d.venue_name ?? d.address ?? '—'}${d.flags.length ? ` · ${d.flags.join(', ')}` : ''} (${r.by})`);
    } else if (r.kind === 'junk') console.log(`  ✕ ${r.cls}: ${head}`);
    else if (r.kind === 'duplicate') console.log(`  = дубль «${r.of.title}»: ${head}`);
    else if (r.kind === 'cancel') console.log(`  ⊘ отмена ${r.of ? `«${r.of.title}»` : '(не нашли событие)'}${r.sure ? '' : ' → модератору'}`);
    else console.log(`  ? ${r.reason}: ${head}`);
  }
  console.log('  итого', summary(results));
}

async function demo() {
  if (searchFile) {
    const source: Source = { id: 'search-demo', kind: 'search', handle: 'gemini', title: 'Поиск · Gemini', trusted: false, auto_publish: false, enabled: true, cursor: null };
    const { posts, understandFound } = await loadSearch(searchFile, source.id);
    const venues = JSON.parse(await readFile(join(here, '../fixtures/venues.json'), 'utf8')) as VenueRow[];
    console.log(`Демо поиска: событий ${posts.length} из ${searchFile}`);
    print(await processPosts(posts, source, { understand: understandFound, geocode: async () => null, venues, known: [] }));
    return;
  }
  const source: Source = { id: 'demo', kind: 'telegram', handle: 'afisha_almaty', title: 'Telegram · @afisha_almaty', trusted: false, auto_publish: false, enabled: true, cursor: null };
  const html = await readFile(join(here, '../fixtures/telegram.html'), 'utf8');
  const extra = JSON.parse(await readFile(join(here, '../fixtures/posts.json'), 'utf8')) as RawPost[];
  const posts = [...parseChannel(html, source.id), ...extra];
  const venues = JSON.parse(await readFile(join(here, '../fixtures/venues.json'), 'utf8')) as VenueRow[];
  console.log(`Демо: ${posts.length} постов из worker/fixtures${process.env.ANTHROPIC_API_KEY ? ', разбор — Claude' : ', разбор — эвристики (нет ANTHROPIC_API_KEY)'}`);
  const results = await processPosts(posts, source, {
    understand: (p) => understand(p),
    geocode: args.has('--geocode') ? geocode : async () => null,
    venues,
    known: [{ id: 'jazz', title: 'Джаз во дворе', starts_at: '2026-10-03T19:30:00+05:00', venue_name: 'Панфилова 110' }],
  });
  print(results);
}

/** Результаты конвейера → база: черновики, корзина, дубли, отмены. Возвращает число новых черновиков. */
async function store(db: Db, results: Outcome[], sourceId: string): Promise<number> {
  let drafts = 0;
  for (const r of results) {
    const id = (r.post as RawPost & { id: string }).id;
    if (r.kind === 'draft') {
      const ev = await db.insertEvent(r.draft, sourceId);
      await db.markPost(id, 'event', ev);
      if (r.draft.status === 'draft') drafts++;
    } else if (r.kind === 'junk') await db.markPost(id, r.cls, null);
    else if (r.kind === 'duplicate') await db.markPost(id, 'duplicate', r.of.id.startsWith('new:') ? null : r.of.id);
    else if (r.kind === 'cancel') {
      if (r.of && !r.of.id.startsWith('new:')) await db.cancel(r.of.id, r.sure);
      await db.markPost(id, 'cancel', r.of?.id.startsWith('new:') ? null : (r.of?.id ?? null));
    }
  }
  return drafts;
}

async function live() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log('Нет SUPABASE_URL / SUPABASE_SECRET_KEY — запускаю демо. Что нужно, написано в docs/KEYS.md.');
    return demo();
  }
  const db = createDb(url, key);
  const load = () => Promise.all([db.sources(), db.venues(), db.known()]);
  let loaded: Awaited<ReturnType<typeof load>>;
  try {
    loaded = await load();
  } catch (err) {
    // Таблиц сборщика ещё нет (миграции не применены) — не падаем каждые 2 часа, а подсказываем, что сделать.
    if (/PGRST205|Could not find the table/.test((err as Error).message)) {
      console.log('В базе ещё нет таблиц сборщика. Примени supabase/apply-all.sql (docs/KEYS.md) — до этого сборщик ничего не пишет.');
      return;
    }
    if (/Supabase 401/.test((err as Error).message)) {
      console.log('Supabase не принял ключ (401). В GitHub → Settings → Secrets → SUPABASE_SECRET_KEY должен лежать секретный ключ этого проекта (Supabase → Project Settings → API Keys → Secret keys). Подробно — docs/KEYS.md.');
    }
    throw err;
  }
  const [sources, venues, known] = loaded;
  let drafts = 0;
  // Просроченные черновики никому не нужны: чистим при каждом запуске, чтобы «Согласование» не копило мусор.
  const purged = await db.purgeExpiredDrafts().catch((err) => { console.error(`Чистка просроченных: ${(err as Error).message}`); return 0; });
  if (purged) { console.log(`Убрано из очереди просроченных черновиков: ${purged}`); await robotLog(`Убрано из очереди просроченных черновиков: ${purged}`); }
  if (searchFile) {
    if(await cancelled()){await robotLog('Остановлено до публикации черновиков');return;}
    // ИИ-поиск может быть выключен — тогда находки афиш записываем на «Добавлено вручную» (FIX3: запуск падал целиком).
    const source = sources.find((s) => s.kind === 'search') ?? sources.find((s) => s.kind === 'manual') ?? sources[0];
    if (!source) {
      console.log('В базе нет ни одного источника — примени supabase/apply-all.sql (docs/KEYS.md).');
      throw new Error('Нет источников в базе');
    }
    const found = await readFound(searchFile);
    // Старые карточки с обрезанным описанием (до FIX3 сборщик резал до 160 символов) — дописываем полным текстом.
    try {
      const short = await db.shortAbouts([...new Set(found.map(f => f.url).filter(Boolean))]);
      const fix = short.map(r => ({ r, f: found.find(f => f.url === r.source_url)! })).filter(x => x.f && (x.f.about ?? '').length > 200).slice(0, 40);
      if (fix.length) {
        const copy = fix.map(x => ({ ...x.f }));
        await polishAbouts(copy);
        for (let i = 0; i < fix.length; i++) await db.setAbout(fix[i].r.id, copy[i].about ?? '');
        await robotLog(`Дописаны описания старых карточек: ${fix.length}`);
      }
    } catch (err) { console.error(`Описания старых карточек: ${(err as Error).message}`); }
    // Каждое событие записываем на «свой» источник: на карточке будет «Яндекс Афиша» или «Sxodim», а не «ИИ».
    const groups = new Map<string, { source: Source; found: Found[] }>();
    for (const f of found) {
      const src = rowFor(sourceKeyOf(f), sources, source);
      const g = groups.get(src.id) ?? { source: src, found: [] };
      g.found.push(f);
      groups.set(src.id, g);
    }
    const all: Outcome[] = [];
    let total = 0;
    for (const { source: src, found: list } of groups.values()) {
      const { posts, understandFound } = await batchOf(list, src.id);
      const fresh = await db.savePosts(posts);
      total += posts.length;
      console.log(`${src.title}: найдено ${posts.length}, новых ${fresh.length}`);
      // Только новым — описание как у редактора (Kimi), чтобы карточку хотелось читать (FIX3).
      const extracted = await Promise.all(fresh.map(async p => ({ p, x: await understandFound(p) })));
      const draftLike = extracted.map(({ x }) => ({ title: x.title, starts_at: x.starts_at ?? undefined, venue_name: x.venue_name ?? undefined, address: x.address ?? undefined, about: x.about ?? '' }) as Found);
      const { polished } = await polishAbouts(draftLike);
      if (polished) await robotLog(`Описания оформлены: ${polished}`);
      const better = new Map(extracted.map(({ p, x }, i) => {
        const lang = LANG_TAG[draftLike[i].lang ?? ''];
        return [p.externalId, { ...x, about: draftLike[i].about ?? x.about, tags: lang && !x.tags.includes(lang) ? [...x.tags, lang] : x.tags }];
      }));
      const results = await processPosts(fresh, src, { understand: async (p: RawPost) => better.get(p.externalId) ?? understandFound(p), geocode, venues, known, now: new Date() });
      drafts += await store(db, results, src.id);
      print(results);
      all.push(...results);
      await db.touchSource(src.id, null);
    }
    await robotUpdate({ found: total, verified: all.filter((r) => r.kind === 'draft').length, queued: drafts });
    await robotMergeStats({ ...runStats(all, await readReport(), purged) });
    await robotLog(`На согласование отправлено ${drafts} новых событий`);
    if (drafts) await db.notifyStaff();
    return;
  }
  const tgStats: TelegramStat[] = [];
  for (const source of sources) {
    // Сайты-афиши читает поиск (код, без ИИ); здесь только каналы. Режим --telegram: только Telegram, с отчётом для панели.
    if (source.kind !== 'telegram') continue;
    if (args.has('--telegram') && source.kind !== 'telegram') continue;
    try {
      const fetched = await fetchChannel(source.handle, source.id, source.cursor);
      const fresh = await db.savePosts(fetched);
      console.log(`${source.title}: новых постов ${fresh.length}`);
      const results = await processPosts(fresh, source, { understand: (p) => understand(p), geocode, venues, known, now: new Date() });
      drafts += await store(db, results, source.id);
      print(results);
      if (source.kind === 'telegram') {
        const t = telegramStat(source.handle, results);
        tgStats.push(t);
        await robotLog(telegramLine(t));
      }
      await db.touchSource(source.id, fresh.at(-1)?.externalId ?? source.cursor);
    } catch (err) {
      console.error(`${source.title}: ${(err as Error).message}`);
      if (source.kind === 'telegram') await robotLog(`Источник · Telegram @${source.handle} · не открылся`, 'warn');
    }
  }
  if (tgStats.length) await robotMergeStats({ telegram: tgStats });
  if (drafts) await db.notifyStaff();
}

await (args.has('--demo') ? demo() : live());
