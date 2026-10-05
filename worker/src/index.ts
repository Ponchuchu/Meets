// Сборщик событий. Запуск: GitHub Actions каждые 2 часа с 08:00 до 00:00 по Алматы (.github/workflows/worker.yml).
//   node worker/src/index.ts            — все включённые Telegram-источники → черновики в базе
//   node worker/src/index.ts --demo     — посты из worker/fixtures, печать черновиков, без записи в базу
//   node worker/src/index.ts --search search.json [--demo] — события, найденные Gemini CLI (search.ts) → «Согласование»
// Переменные: SUPABASE_URL, SUPABASE_SECRET_KEY (или SUPABASE_SERVICE_ROLE_KEY), ANTHROPIC_API_KEY или KIMI_API_KEY.
import {cancelled,robotUpdate,robotLog} from './robot.ts';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { understand } from './ai.ts';
import { createDb } from './db.ts';
import { processPosts, summary, type Outcome } from './pipeline.ts';
import { fillImages, parseGeminiOutput, toPost } from './search.ts';
import { fetchSite } from './sites.ts';
import { fetchChannel, parseChannel } from './telegram.ts';
import type { Db } from './db.ts';
import type { Extraction, RawPost, Source } from './types.ts';
import { geocode, type VenueRow } from './venues.ts';

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const args = new Set(argv);
const searchFile = args.has('--search') ? argv[argv.indexOf('--search') + 1] : null;

/** Файл с ответом Gemini CLI → посты + готовые разборы. */
async function loadSearch(file: string, sourceId: string) {
  const items = parseGeminiOutput(await readFile(file, 'utf8')).map((f) => toPost(f, sourceId));
  const posts = items.map((i) => i.post);
  if (!args.has('--no-images')) await fillImages(posts);
  const byId = new Map<string, Extraction>(items.map((i) => [i.post.externalId, i.x]));
  const understandFound = async (p: RawPost) => ({ ...byId.get(p.externalId)!, by: 'ai' as const });
  return { posts, understandFound };
}

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
  if (searchFile) {
    if(await cancelled()){await robotLog('Остановлено до публикации черновиков');return;}
    const source = sources.find((s) => s.kind === 'search');
    if (!source) {
      console.log('В базе нет источника «Поиск · Gemini» — примени миграцию 20261004000008_search.sql.');
      throw new Error('Нет источника Gemini в базе');
    }
    const { posts, understandFound } = await loadSearch(searchFile, source.id);
    const fresh = await db.savePosts(posts);
    console.log(`${source.title}: найдено ${posts.length}, новых ${fresh.length}`);
    const results = await processPosts(fresh, source, { understand: understandFound, geocode, venues, known });
    drafts += await store(db, results, source.id);
    print(results);
    await robotUpdate({found:posts.length,verified:results.filter(r=>r.kind==='draft').length,queued:drafts});
    await robotLog(`На согласование отправлено ${drafts} новых событий`);
    await db.touchSource(source.id, null);
    if (drafts) await db.notifyStaff();
    return;
  }
  for (const source of sources) {
    if (source.kind === 'search') continue;
    try {
      const fetched = source.kind === 'site' ? await fetchSite(source.handle, source.id) : await fetchChannel(source.handle, source.id, source.cursor);
      const fresh = await db.savePosts(fetched);
      console.log(`${source.title}: новых постов ${fresh.length}`);
      const results = await processPosts(fresh, source, { understand: (p) => understand(p), geocode, venues, known });
      drafts += await store(db, results, source.id);
      print(results);
      // У сайтов нет сквозной нумерации — повторы отсекает база по адресу страницы.
      const lastId = source.kind === 'site' ? source.cursor : (fresh.at(-1)?.externalId ?? source.cursor);
      await db.touchSource(source.id, lastId);
    } catch (err) {
      console.error(`${source.title}: ${(err as Error).message}`);
    }
  }
  if (drafts) await db.notifyStaff();
}

await (args.has('--demo') ? demo() : live());
