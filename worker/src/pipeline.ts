// Один проход по постам источника: ИИ → корзина / дубль / отмена / черновик. Зависимости передаются снаружи,
// чтобы тот же код работал и с базой, и в демо-режиме на fixtures.
import { findByTitle, findDuplicate } from './dedupe.ts';
import { buildDraft } from './draft.ts';
import type { Draft, Extraction, KnownEvent, Point, RawPost, Source } from './types.ts';
import type { VenueRow } from './venues.ts';

export type Outcome =
  | { post: RawPost; kind: 'junk'; cls: 'ad' | 'meme' | 'not_almaty' }
  | { post: RawPost; kind: 'duplicate'; of: KnownEvent }
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
    const dup = findDuplicate({ title: x.title, starts_at: x.starts_at, venue_name: x.venue_name, is_long: x.is_long }, deps.known);
    if (dup) {
      out.push({ post, kind: 'duplicate', of: dup });
      continue;
    }
    const draft = await buildDraft(x, post, source, deps.venues, deps.geocode);
    if (!draft) {
      out.push({ post, kind: 'unclear', reason: 'не собрался черновик' });
      continue;
    }
    deps.known.push({ id: `new:${post.externalId}`, title: draft.title, starts_at: draft.starts_at, venue_name: draft.venue_name, is_long: draft.is_long });
    out.push({ post, kind: 'draft', draft, by: x.by });
  }
  return out;
}

/** Сводка для лога: «найдено 38 постов · событий 11 · реклама 14 …». */
export function summary(results: Outcome[]): Record<string, number> {
  const s: Record<string, number> = { posts: results.length, events: 0, ad: 0, meme: 0, not_almaty: 0, duplicate: 0, cancel: 0, unclear: 0, published: 0 };
  for (const r of results) {
    if (r.kind === 'junk') s[r.cls]++;
    else if (r.kind === 'draft') {
      s.events++;
      if (r.draft.status === 'published') s.published++;
    } else s[r.kind]++;
  }
  return s;
}
