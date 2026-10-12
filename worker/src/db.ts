// Запись в Supabase через REST (PostgREST) с секретным ключом. Ключ — только в секретах GitHub Actions.
import type { Draft, KnownEvent, RawPost, Source } from './types.ts';
import type { VenueRow } from './venues.ts';

export interface Db {
  sources(): Promise<Source[]>;
  venues(): Promise<VenueRow[]>;
  known(): Promise<KnownEvent[]>;
  /** Сохраняет посты, возвращает только новые (которых ещё не было). */
  savePosts(posts: RawPost[]): Promise<(RawPost & { id: string })[]>;
  markPost(id: string, cls: string, eventId: string | null): Promise<void>;
  insertEvent(d: Draft, sourceId: string): Promise<string>;
  cancel(eventId: string, sure: boolean): Promise<void>;
  touchSource(id: string, cursor: string | null): Promise<void>;
  notifyStaff(): Promise<void>;
  /** Закончившиеся черновики убираем в архив, сохраняя защиту от повторного поиска. */
  purgeExpiredDrafts(): Promise<number>;
}

export function createDb(url: string, key: string): Db {
  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' };
  // Старые ключи service_role — это JWT, их нужно передавать и в Authorization.
  if (key.split('.').length === 3) headers.Authorization = `Bearer ${key}`;

  async function rest<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string>) } });
    const text = await res.text();
    if (!res.ok) throw new Error(`Supabase ${res.status} ${path.split('?')[0]}: ${text.slice(0, 200)}`);
    return (text ? JSON.parse(text) : null) as T;
  }
  const post = <T>(path: string, body: unknown, prefer = 'return=representation') =>
    rest<T>(path, { method: 'POST', body: JSON.stringify(body), headers: { Prefer: prefer } });
  const patch = (path: string, body: unknown) => rest(path, { method: 'PATCH', body: JSON.stringify(body), headers: { Prefer: 'return=minimal' } });

  return {
    sources: () => rest<Source[]>('sources?enabled=eq.true&kind=in.(telegram,site,search)&select=*'),
    venues: () => rest<VenueRow[]>('venues_points?select=id,name,aliases,lat,lon'),
    known: async () => {
      const since = new Date(Date.now() - 2 * 86400e3).toISOString();
      const now = new Date().toISOString();
      // Долгие события пересекают окно; запреты и старые названия сохраняем независимо от даты.
      // Читаем по страницам: Supabase ограничивает размер одного ответа.
      type Row = { id: string; title: string; orig_title: string | null; status: string; rejected: boolean; starts_at: string; is_long?: boolean; venues: { name: string } | null };
      const out: { id: string; title: string; starts_at: string; venue_name: string | null; is_long?: boolean }[] = [];
      let after: string | null = null;
      for (;;) {
        const rows: Row[] = await rest<Row[]>(
          `events?select=id,title,orig_title,status,rejected,starts_at,is_long,venues(name)&visibility=eq.public&or=(starts_at.gte.${since},ends_at.gte.${now},rejected.eq.true,orig_title.not.is.null)&order=id.asc&limit=500${after ? `&id=gt.${after}` : ''}`,
        );
        for (const r of rows) {
          const live = !r.rejected && (r.status === 'draft' || r.status === 'published');
          const venue_name = r.venues?.name ?? null;
          out.push({ id: live ? r.id : `new:gone-${r.id}`, title: r.title, starts_at: r.starts_at, venue_name, is_long: r.is_long });
          if (r.orig_title) out.push({ id: `new:orig-${r.id}`, title: r.orig_title, starts_at: r.starts_at, venue_name, is_long: r.is_long });
        }
        if (rows.length < 500) break;
        after = rows[rows.length - 1].id;
      }
      return out;
    },
    savePosts: async (posts) => {
      if (!posts.length) return [];
      const rows = await post<{ id: string; external_id: string }[]>(
        'raw_posts?on_conflict=source_id,external_id',
        posts.map((p) => ({ source_id: p.sourceId, external_id: p.externalId, url: p.url, text: p.text.slice(0, 4000), images: p.images, posted_at: p.postedAt })),
        'resolution=ignore-duplicates,return=representation',
      );
      const ids = new Map(rows.map((r) => [r.external_id, r.id]));
      return posts.filter((p) => ids.has(p.externalId)).map((p) => ({ ...p, id: ids.get(p.externalId)! }));
    },
    markPost: async (id, cls, eventId) => {
      await patch(`raw_posts?id=eq.${id}`, { class: cls, event_id: eventId, processed_at: new Date().toISOString() });
    },
    insertEvent: async (d, sourceId) => {
      let venueId = d.venue_id;
      if (!venueId && d.point) {
        const name = `${d.venue_name ?? d.address ?? d.title}`.slice(0, 120);
        const [v] = await post<{ id: string }[]>('venues?on_conflict=name', [{ name, address: d.address, geog: `SRID=4326;POINT(${d.point.lon} ${d.point.lat})` }], 'resolution=merge-duplicates,return=representation');
        venueId = v.id;
      }
      const [e] = await post<{ id: string }[]>('events', [{
        title: d.title, category: d.category, tags: d.tags, starts_at: d.starts_at, ends_at: d.ends_at, is_long: d.is_long,
        venue_id: venueId, address: d.address, address_note: d.address_note, price_min: d.price_min, price_max: d.price_max,
        is_free: d.is_free, about: d.about, organizer: d.organizer, cover_url: d.cover_url, source_url: d.source_url,
        ai_confidence: d.ai_confidence, flags: d.flags, status: d.status, source_id: sourceId,
        published_at: d.status === 'published' ? new Date().toISOString() : null,
      }]);
      return e.id;
    },
    cancel: async (eventId, sure) => {
      await post('rpc/worker_cancel', { ev: eventId, sure }, 'return=minimal');
    },
    touchSource: async (id, cursor) => {
      await patch(`sources?id=eq.${id}`, { cursor, last_run_at: new Date().toISOString() });
    },
    purgeExpiredDrafts: async () => {
      const now = new Date().toISOString();
      const cutoff = new Date(Date.now() - 3 * 3600e3).toISOString();
      const gone = await rest<{ id: string }[]>(
        `events?visibility=eq.public&status=eq.draft&or=(ends_at.lt.${now},and(ends_at.is.null,starts_at.lt.${cutoff}))&select=id`,
        { method: 'PATCH', body: JSON.stringify({ status: 'archived', rejected: true, updated_at: now }), headers: { Prefer: 'return=representation' } },
      );
      return gone?.length ?? 0;
    },
    notifyStaff: async () => {
      await post('rpc/notify_staff', {}, 'return=minimal');
    },
  };
}
