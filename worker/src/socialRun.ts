// Сбор Instagram и Threads (26 октября). Посты берёт функция Supabase `social` (ключи Facebook только там),
// разбирает скрипт без ИИ (social.ts), дальше общий конвейер: дубли со всеми источниками, место на карте, черновик.
// Фото и видео событий копируются в хранилище event-media: ссылки Instagram перестают работать через несколько дней.
//   node worker/src/index.ts --social        — все включённые страницы Instagram и Threads
import type { Db } from './db.ts';
import { processPosts, storeOutcomes, summary, type Outcome } from './pipeline.ts';
import { parseSocial } from './social.ts';
import type { Extraction, KnownEvent, MediaItem, Point, RawPost, Source } from './types.ts';
import type { VenueRow } from './venues.ts';

interface Pulled { kind: string; handle: string; ok: boolean; error?: string; profile?: { name: string | null; followers: number | null; avatar: string | null; posts: number | null }; posts?: { id: string; url: string; text: string; at: string; media: MediaItem[] }[] }

/** Первый сбор новой страницы — посты за 45 дней (две страницы ленты), дальше — только новое с прошлого раза. */
const FIRST_DAYS = 45;
const VIDEO_MAX = 12 * 1024 * 1024;
const VIDEOS_PER_RUN = Number(process.env.SOCIAL_VIDEOS ?? 20);

export async function pullSocial(items: { kind: string; handle: string; since: string | null }[], pages: number, fetchFn: typeof fetch = fetch): Promise<Pulled[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Нет SUPABASE_URL / SUPABASE_SECRET_KEY');
  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' };
  if (key.split('.').length === 3) headers.Authorization = `Bearer ${key}`;
  const res = await fetchFn(`${url}/functions/v1/social`, { method: 'POST', headers, body: JSON.stringify({ action: 'pull', items, pages }), signal: AbortSignal.timeout(140_000) });
  if (!res.ok) throw new Error(`Функция social: ${res.status} ${(await res.text()).slice(0, 160)}`);
  return ((await res.json()) as { results: Pulled[] }).results;
}

const ext = (type: string) => (type.includes('mp4') ? 'mp4' : type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg');

/** Копии фото (до 4) и одного видео в хранилище. Не скачалось — пропускаем этот файл, событие всё равно сохраняется. */
export async function copyMedia(db: Db, media: MediaItem[], key: string, budget: { videos: number }, fetchFn: typeof fetch = fetch): Promise<MediaItem[]> {
  const out: MediaItem[] = [];
  const copy = async (src: string, name: string, maxBytes: number): Promise<string | null> => {
    try {
      const r = await fetchFn(src, { signal: AbortSignal.timeout(40_000) });
      if (!r.ok) return null;
      const type = r.headers.get('content-type') ?? 'image/jpeg';
      const len = Number(r.headers.get('content-length') ?? 0);
      if (len > maxBytes) return null;
      const body = await r.arrayBuffer();
      if (body.byteLength > maxBytes) return null;
      return await db.upload(`${key}/${name}.${ext(type)}`, body, type.split(';')[0]);
    } catch {
      return null;
    }
  };
  let images = 0;
  let videos = 0;
  for (const [i, m] of media.entries()) {
    if (m.type === 'image' && images < 4) {
      const url = await copy(m.url, `p${i}`, 8 * 1024 * 1024);
      if (url) { out.push({ type: 'image', url }); images++; }
    } else if (m.type === 'video' && videos < 1) {
      const poster = m.poster ? await copy(m.poster, `v${i}-poster`, 8 * 1024 * 1024) : null;
      const url = budget.videos > 0 ? await copy(m.url, `v${i}`, VIDEO_MAX) : null;
      if (url) { budget.videos--; videos++; out.push({ type: 'video', url, poster }); }
      else if (poster) { out.push({ type: 'image', url: poster }); images++; }
    }
  }
  return out;
}

export interface SocialStat { handle: string; kind: string; ok: boolean; error?: string; posts: number; events: number; dups: number; junk: number }

export async function runSocial(db: Db, sources: Source[], venues: VenueRow[], known: KnownEvent[], geocode: (q: string) => Promise<Point | null>,
  log: (text: string, level?: string) => Promise<void>, cancelled: () => Promise<boolean>): Promise<{ drafts: number; stats: SocialStat[]; outcomes: Outcome[] }> {
  const list = sources.filter((s) => (s.kind === 'instagram' || s.kind === 'threads') && s.enabled);
  const stats: SocialStat[] = [];
  const outcomes: Outcome[] = [];
  let drafts = 0;
  const budget = { videos: VIDEOS_PER_RUN };
  if (!list.length) return { drafts, stats, outcomes };
  await log(`Instagram и Threads: страниц ${list.length}`);
  for (let i = 0; i < list.length; i += 12) {
    if (await cancelled()) break;
    const chunk = list.slice(i, i + 12);
    const fresh = chunk.some((s) => !s.cursor);
    let pulled: Pulled[];
    try {
      pulled = await pullSocial(chunk.map((s) => ({ kind: s.kind, handle: s.handle, since: s.cursor ?? new Date(Date.now() - FIRST_DAYS * 86400e3).toISOString() })), fresh ? 2 : 1);
    } catch (err) {
      await log(`Instagram: ${(err as Error).message}`, 'warn');
      continue;
    }
    for (const [k, r] of pulled.entries()) {
      const source = chunk[k];
      const stat: SocialStat = { handle: source.handle, kind: source.kind, ok: r.ok, error: r.error, posts: r.posts?.length ?? 0, events: 0, dups: 0, junk: 0 };
      stats.push(stat);
      const profile = r.profile ? { name: r.profile.name, followers: r.profile.followers, avatar: r.profile.avatar } : {};
      if (!r.ok && !r.posts?.length) {
        await db.sourceStats(source.id, { error: r.error ?? 'не ответил', error_at: new Date().toISOString() });
        await log(`Источник · ${source.title} · ${r.error ?? 'не открылся'}`, 'warn');
        continue;
      }
      const posts: RawPost[] = (r.posts ?? []).map((p) => ({ sourceId: source.id, externalId: p.id, url: p.url, text: p.text, images: p.media.filter((m) => m.type === 'image').map((m) => m.url), postedAt: p.at, media: p.media }));
      const saved = await db.savePosts(posts);
      const { subs, parsed, junk } = await splitPosts(db, saved, source, venues);
      stat.junk = junk;
      const results = await processPosts(subs, source, { understand: async (p) => ({ ...parsed.get(p.externalId)!, by: 'heuristics' as const }), geocode, venues, known, now: new Date() });
      // Фото и видео — только у новых карточек.
      for (const o of results) {
        if (o.kind !== 'draft') continue;
        const media = o.post.media ?? [];
        if (!media.length) continue;
        const copies = await copyMedia(db, media, `${source.kind}/${source.handle}/${o.post.externalId.replace(/[^\w-]/g, '_')}`, budget);
        o.draft.media = copies;
        o.draft.cover_url = copies.find((m) => m.type === 'image')?.url ?? copies[0]?.poster ?? null;
      }
      drafts += await storeOutcomes(db, results, source.id, known);
      const sum = summary(results);
      stat.events = sum.events;
      stat.dups = sum.duplicate + sum.session;
      outcomes.push(...results);
      const newest = posts.map((p) => p.postedAt ?? '').sort().at(-1) ?? null;
      await db.touchSource(source.id, newest ?? source.cursor);
      await db.sourceStats(source.id, { ...profile, ok_at: new Date().toISOString(), error: null, posts: stat.posts, events: stat.events, dups: stat.dups, junk: stat.junk, last_post_at: newest ?? undefined });
      await log(`Источник · ${source.title} · постов ${stat.posts}, событий ${stat.events}${stat.dups ? `, дублей ${stat.dups}` : ''}`);
    }
  }
  return { drafts, stats, outcomes };
}

/** Разбор скриптом: один пост → несколько «подпостов» (афиша недели), мусор сразу отмечается в raw_posts. */
export async function splitPosts(db: Db, saved: (RawPost & { id: string })[], source: Source, venues: VenueRow[]) {
  const subs: (RawPost & { id: string })[] = [];
  const parsed = new Map<string, Extraction>();
  let junk = 0;
  for (const p of saved) {
    const res = parseSocial(p.text, p.postedAt ?? new Date().toISOString(), { folder: source.folder ?? 'other', venue_name: source.venue_name ?? null, title: source.title }, venues);
    if (res.kind === 'junk') { junk++; await db.markPost(p.id, res.cls, null); continue; }
    res.items.forEach((x, n) => {
      const sub = { ...p, externalId: n ? `${p.externalId}#${n}` : p.externalId };
      subs.push(sub);
      parsed.set(sub.externalId, x);
    });
  }
  return { subs, parsed, junk };
}
