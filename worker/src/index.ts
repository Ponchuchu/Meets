// Сборщик событий. Запуск: GitHub Actions каждые 2 часа с 08:00 до 00:00 по Алматы (.github/workflows/worker.yml).
//   node worker/src/index.ts            — все включённые Telegram-источники → черновики в базе
//   node worker/src/index.ts --demo     — посты из worker/fixtures, печать черновиков, без записи в базу
// Переменные: SUPABASE_URL, SUPABASE_SECRET_KEY (или SUPABASE_SERVICE_ROLE_KEY), ANTHROPIC_API_KEY.
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { understand } from './ai.ts';
import { createDb } from './db.ts';
import { processPosts, summary, type Outcome } from './pipeline.ts';
import { fetchChannel, parseChannel } from './telegram.ts';
import type { RawPost, Source } from './types.ts';
import { geocode, type VenueRow } from './venues.ts';

const here = dirname(fileURLToPath(import.meta.url));
const args = new Set(process.argv.slice(2));

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

async function live() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log('Нет SUPABASE_URL / SUPABASE_SECRET_KEY — запускаю демо. Что нужно, написано в docs/KEYS.md.');
    return demo();
  }
  const db = createDb(url, key);
  const [sources, venues, known] = await Promise.all([db.sources(), db.venues(), db.known()]);
  let drafts = 0;
  for (const source of sources) {
    try {
      const fresh = await db.savePosts(await fetchChannel(source.handle, source.id, source.cursor));
      console.log(`${source.title}: новых постов ${fresh.length}`);
      const results = await processPosts(fresh, source, { understand: (p) => understand(p), geocode, venues, known });
      for (const r of results) {
        const id = (r.post as RawPost & { id: string }).id;
        if (r.kind === 'draft') {
          const ev = await db.insertEvent(r.draft, source.id);
          await db.markPost(id, 'event', ev);
          if (r.draft.status === 'draft') drafts++;
        } else if (r.kind === 'junk') await db.markPost(id, r.cls, null);
        else if (r.kind === 'duplicate') await db.markPost(id, 'duplicate', r.of.id.startsWith('new:') ? null : r.of.id);
        else if (r.kind === 'cancel') {
          if (r.of && !r.of.id.startsWith('new:')) await db.cancel(r.of.id, r.sure);
          await db.markPost(id, 'cancel', r.of?.id.startsWith('new:') ? null : (r.of?.id ?? null));
        }
      }
      print(results);
      const lastId = fresh.at(-1)?.externalId ?? source.cursor;
      await db.touchSource(source.id, lastId);
    } catch (err) {
      console.error(`${source.title}: ${(err as Error).message}`);
    }
  }
  if (drafts) await db.notifyStaff();
}

await (args.has('--demo') ? demo() : live());
