// Один проход по постам источника: ИИ → корзина / дубль / отмена / черновик. Зависимости передаются снаружи,
// чтобы тот же код работал и с базой, и в демо-режиме на fixtures.
import { findByTitle, findDuplicate, findSeries } from './dedupe.ts';
import { buildDraft } from './draft.ts';
import type { Db } from './db.ts';
import type { Draft, Extraction, KnownEvent, Point, RawPost, Source } from './types.ts';
import type { VenueRow } from './venues.ts';

export type Outcome =
  | { post: RawPost; kind: 'junk'; cls: 'ad' | 'meme' | 'not_almaty' }
  | { post: RawPost; kind: 'duplicate'; of: KnownEvent }
  | { post: RawPost; kind: 'session'; of: KnownEvent; sessions: string[] }
  | { post: RawPost; kind: 'cancel'; of: KnownEvent | null; sure: boolean }
  | { post: RawPost; kind: 'draft'; draft: Draft; by: 'ai' | 'heuristics' }
  | { post: RawPost; kind: 'unclear'; reason: string };

export interface Deps {
  understand(post: RawPost): Promise<Extraction & { by: 'ai' | 'heuristics' }>;
  geocode(q: string): Promise<Point | null>;
  venues: VenueRow[];
  /** Известные события: из базы + найденные в этом же запуске (склеиваем дубли между каналами). */
  known: KnownEvent[];
  /** Текущий момент: события, которые уже закончились, не принимаем. Без него проверка отключена (тесты с датами из прошлого). */
  now?: Date;
  /** false — не склеивать повторы в одну карточку с датами (сайты-афиши дают каждый сеанс отдельно и так задумано). */
  series?: boolean;
}

export async function processPosts(posts: RawPost[], source: Source, deps: Deps): Promise<Outcome[]> {
  const out: Outcome[] = [];
  for (const post of posts) {
    const x = await deps.understand(post);
    if (x.class === 'ad' || x.class === 'meme' || x.class === 'not_almaty') {
      out.push({ post, kind: 'junk', cls: x.class });
      continue;
    }
    if (x.class === 'cancel') {
      const of = findByTitle(x.cancel_of ?? x.title, deps.known);
      out.push({ post, kind: 'cancel', of, sure: source.trusted && x.confidence >= 0.9 });
      continue;
    }
    if (!x.starts_at) {
      out.push({ post, kind: 'unclear', reason: 'нет даты' });
      continue;
    }
    // Уже прошло (с запасом 3 часа на «идёт сейчас»): карточка никому не нужна.
    if (deps.now && Date.parse(x.ends_at ?? x.starts_at) < deps.now.getTime() - 3 * 3600e3) {
      out.push({ post, kind: 'unclear', reason: 'уже прошло' });
      continue;
    }
    const dup = findDuplicate({ title: x.title, starts_at: x.starts_at, venue_name: x.venue_name, is_long: x.is_long, time_known: x.time_known }, deps.known);
    if (dup) {
      out.push({ post, kind: 'duplicate', of: dup });
      continue;
    }
    // Тот же спектакль или шоу в другой день — ещё одна дата у прежней карточки (решение владельца 26 окт.).
    const series = deps.series === false ? null : findSeries({ title: x.title, starts_at: x.starts_at, venue_name: x.venue_name, is_long: x.is_long }, deps.known);
    if (series) {
      const add = x.sessions?.length ? x.sessions : [x.starts_at];
      series.sessions = [...new Set([...(series.sessions?.length ? series.sessions : [series.starts_at]), ...add.map((a) => new Date(a).toISOString())])].sort();
      // Карточка из этого же запуска ещё не записана — дописываем даты прямо в черновик.
      const own = out.find((o) => o.kind === 'draft' && `new:${o.post.externalId}` === series.id);
      if (own && own.kind === 'draft') own.draft.sessions = series.sessions;
      out.push({ post, kind: 'session', of: series, sessions: add.map((a) => new Date(a).toISOString()) });
      continue;
    }
    const draft = await buildDraft(x, post, source, deps.venues, deps.geocode);
    if (!draft) {
      out.push({ post, kind: 'unclear', reason: 'не собрался черновик' });
      continue;
    }
    deps.known.push({ id: `new:${post.externalId}`, title: draft.title, starts_at: draft.starts_at, venue_name: draft.venue_name, is_long: draft.is_long, sessions: draft.sessions });
    out.push({ post, kind: 'draft', draft, by: x.by });
  }
  return out;
}

/** Сводка для лога: «найдено 38 постов · событий 11 · реклама 14 …». */
export function summary(results: Outcome[]): Record<string, number> {
  const s: Record<string, number> = { posts: results.length, events: 0, ad: 0, meme: 0, not_almaty: 0, duplicate: 0, session: 0, cancel: 0, unclear: 0, published: 0 };
  for (const r of results) {
    if (r.kind === 'junk') s[r.cls]++;
    else if (r.kind === 'draft') {
      s.events++;
      if (r.draft.status === 'published') s.published++;
    } else s[r.kind]++;
  }
  return s;
}

/**
 * Результаты конвейера → база: черновики, корзина, дубли, новые даты, отмены. Возвращает число новых черновиков.
 * Записанная карточка получает в known настоящий id: следующая пачка добавит к ней дату, а не создаст вторую.
 * Несколько событий из одного поста (афиша недели) отмечают строку поста один раз.
 */
export async function storeOutcomes(db: Db, results: Outcome[], sourceId: string, known: KnownEvent[]): Promise<number> {
  let drafts = 0;
  const marked = new Set<string>();
  for (const r of results) {
    const id = (r.post as RawPost & { id: string }).id;
    if (r.kind === 'draft') {
      const ev = await db.insertEvent(r.draft, sourceId);
      const k = known.find((x) => x.id === `new:${r.post.externalId}`);
      if (k) k.id = ev;
      if (!marked.has(id)) await db.markPost(id, 'event', ev);
      marked.add(id);
      if (r.draft.status === 'draft') drafts++;
      continue;
    }
    if (r.kind === 'session' && !r.of.id.startsWith('new:')) for (const at of r.sessions) await db.addSession(r.of.id, at);
    if (marked.has(id)) continue;
    marked.add(id);
    if (r.kind === 'junk') await db.markPost(id, r.cls, null);
    else if (r.kind === 'duplicate' || r.kind === 'session') await db.markPost(id, 'duplicate', r.of.id.startsWith('new:') ? null : r.of.id);
    else if (r.kind === 'unclear') await db.markPost(id, r.reason === 'уже прошло' ? 'past' : 'unclear', null);
    else if (r.kind === 'cancel') {
      if (r.of && !r.of.id.startsWith('new:')) await db.cancel(r.of.id, r.sure);
      await db.markPost(id, 'cancel', r.of?.id.startsWith('new:') ? null : (r.of?.id ?? null));
    }
  }
  return drafts;
}
