// Колода «Для тебя» на сервере: те же правила, что в приложении (src/reco), по сигналам из базы.
// Вызов: POST с JWT человека → { events: EventItem[] } (до 10 карточек).
import { buildDeck, mapFeedRow, tasteFrom, type EventItem, type FeedRow, type Signal } from '../_shared/app.js';
import { admin, json, userFrom } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  const db = admin();
  const me = await userFrom(req, db);
  if (!me) return json({ error: 'unauthorized' }, 401);
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 3600e3).toISOString();

  const [answers, signals, decided, feed] = await Promise.all([
    db.from('start_answers').select('interests,times,with_who,budget').eq('user_id', me).maybeSingle(),
    db.from('signals').select('id,event_id,kind,created_at,events(tags,category)').eq('user_id', me).order('created_at').limit(1000),
    db.from('attendance').select('event_id').eq('user_id', me).in('status', ['going', 'skipped', 'arrived']),
    db.from('events_feed').select('*').or(`ends_at.gte.${since},starts_at.gte.${since}`).order('starts_at').limit(500),
  ]);
  if (feed.error) return json({ error: feed.error.message }, 500);

  const a = answers.data ?? { interests: [], times: [], with_who: 'friends', budget: 'mid' };
  const sigs: Signal[] = (signals.data ?? []).map((s: any) => ({
    id: s.id, eventId: s.event_id, kind: s.kind, at: s.created_at, tags: s.events?.tags ?? [], category: s.events?.category,
  }));
  const taste = tasteFrom({ interests: a.interests, times: a.times, withWho: a.with_who, budget: a.budget }, sigs, now);
  const events: EventItem[] = (feed.data as FeedRow[]).map(mapFeedRow);
  // id в колоде — внешние (как в приложении), attendance хранит uuid: сверяем по обоим.
  const done = new Set<string>((decided.data ?? []).map((d: any) => d.event_id));
  const byUuid = new Map((feed.data as FeedRow[]).map((r) => [r.external_id ?? r.id, r.id]));
  const decidedIds = new Set(events.filter((e) => done.has(byUuid.get(e.id) ?? e.id)).map((e) => e.id));

  const deck = buildDeck(taste, events, { decided: decidedIds, swipes: sigs.length }, { now });
  await db.from('taste').upsert({
    user_id: me, tags: taste.tags, time_grid: taste.timeGrid, price_ceiling: taste.priceCeiling,
    company_pref: taste.friendsMultiplier, start_answers: taste.startAnswers, updated_at: now.toISOString(),
  });
  return json({ events: deck });
});
