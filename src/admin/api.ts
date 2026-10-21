// Данные админки: команда (таблица staff) работает с настоящей очередью, остальные видят демо макета.
import { readPoint } from '../live/point';
import { requireUser, supabase, withTimeout } from '../data/client';
import type {Category} from '../data/types';
import { metaLine, sourceLabel, type QueueFlag, type QueueItem, type QueueStats, type SourceItem } from './model';

export async function isStaff(): Promise<boolean> {
  try {
    const me = await requireUser();
    const { data } = await withTimeout(supabase().from('staff').select('role').eq('user_id', me).maybeSingle(), 4000);
    return !!data;
  } catch {
    return false;
  }
}

interface DraftRow {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  address: string | null;
  about: string | null;
  price_min: number | null;
  price_max: number | null;
  is_free: boolean;
  ai_confidence: number | null;
  flags: QueueFlag[];
  venues: { name: string; geog: unknown } | null;
  sources: { kind: SourceItem['kind']; handle: string; title: string } | null;
  suggested_by: string | null;
  cover_url: string | null;
  category: Category;
}

export async function loadQueue(): Promise<QueueItem[]> {
  const { data, error } = await withTimeout(
    supabase().from('events')
      .select('id,title,starts_at,ends_at,address,about,price_min,price_max,is_free,ai_confidence,flags,venues(name,geog),sources(kind,handle,title),suggested_by,cover_url,category')
      .eq('status', 'draft').eq('rejected', false).order('created_at').limit(100),
  );
  if (error) throw error;
  const rows = data as unknown as DraftRow[];
  // Имена тех, кто предложил: suggested_by ссылается на auth.users, поэтому профили — отдельным запросом.
  const ids = [...new Set(rows.map((r) => r.suggested_by).filter((x): x is string => !!x))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: ps } = await supabase().from('profiles').select('id,name').in('id', ids);
    (ps as { id: string; name: string }[] | null)?.forEach((p) => names.set(p.id, p.name));
  }
  return rows.map((r) => ({
    id: r.id,
    source: r.sources ? sourceLabel(r.sources.kind, r.sources.handle, r.sources.title, r.suggested_by ? names.get(r.suggested_by) : null) : 'ДОБАВЛЕНО ВРУЧНУЮ',
    confidence: r.ai_confidence != null ? Math.round(r.ai_confidence * 100) : null,
    title: r.title,
    meta: metaLine({ startsAt: r.starts_at, endsAt: r.ends_at, place: r.venues?.name ?? r.address, priceMin: r.price_min, priceMax: r.price_max, isFree: r.is_free }),
    flags: r.flags ?? [],
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    address: r.address,
    about: r.about ?? '',
    priceMin: r.price_min,
    priceMax: r.price_max,
    isFree: r.is_free,
    point: readPoint(r.venues?.geog),
    coverUrl:r.cover_url,
    category:r.category,
  }));
}

export async function loadStats(): Promise<QueueStats> {
  const { data, error } = await withTimeout(supabase().rpc('moderation_stats'));
  if (error) throw error;
  const r = (data as { waiting: number; on_map: number; filtered: number; last_run: string | null }[])[0];
  return { waiting: r.waiting, onMap: r.on_map, filtered: r.filtered, lastRun: r.last_run };
}

export async function moderate(id: string, action: 'publish' | 'reject' | 'cancel' | 'pin', point?: { lat: number; lon: number }): Promise<void> {
  const { error } = await withTimeout(supabase().rpc('moderate_event', { ev: id, action, lat: point?.lat ?? null, lon: point?.lon ?? null }));
  if (error) throw error;
  // Одобрили — точка по адресу (FIX1 И2 п.8). Не нашлось — событие получит флаг «Поставь точку вручную».
  if (action === 'publish' && !point) void supabase().functions.invoke('geocode', { body: { event_id: id } }).catch(() => undefined);
}

export async function saveDraft(id: string, patch: { title: string; about: string; address: string | null; price_min: number | null; is_free: boolean; flags: QueueFlag[] }): Promise<void> {
  const { error } = await withTimeout(supabase().from('events').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id));
  if (error) throw error;
}

export async function loadSources(): Promise<SourceItem[]> {
  const { data, error } = await withTimeout(supabase().from('sources').select('id,kind,handle,title,note,trusted,auto_publish,enabled').neq('kind', 'user').order('created_at'));
  if (error) throw error;
  return (data as { id: string; kind: SourceItem['kind']; handle: string; title: string; note: string | null; trusted: boolean; auto_publish: boolean; enabled: boolean }[])
    .map((r) => ({ id: r.id, kind: r.kind, handle: r.handle, title: r.title, note: r.note, trusted: r.trusted, autoPublish: r.auto_publish, enabled: r.enabled }));
}

export async function updateSource(id: string, patch: Partial<{ trusted: boolean; auto_publish: boolean; enabled: boolean; title: string }>): Promise<void> {
  const { error } = await withTimeout(supabase().from('sources').update(patch).eq('id', id));
  if (error) throw error;
}

/** «Публиковать сразу, если 95%+» — включается только у источников с доверием. */
export async function setAutoPublish(on: boolean): Promise<void> {
  const { error } = await withTimeout(supabase().from('sources').update({ auto_publish: on }).eq('trusted', true));
  if (error) throw error;
}

/** Ссылка → источник. Понимает t.me/<канал>, @канал (Telegram), threads.net/@<ник> и просто адрес сайта. */
export function parseSourceLink(link: string): { kind: SourceItem['kind']; handle: string; title: string } | null {
  const s = link.trim();
  const at = /^@([A-Za-z0-9_]{4,})$/.exec(s);
  if (at) return { kind: 'telegram', handle: at[1], title: `Telegram · @${at[1]}` };
  const tg = /(?:t\.me\/(?:s\/)?|^@)([A-Za-z0-9_]{4,})/.exec(s);
  if (/t\.me\//.test(s) && tg) return { kind: 'telegram', handle: tg[1], title: `Telegram · @${tg[1]}` };
  const th = /threads\.(?:net|com)\/@([\w.]+)/.exec(s);
  if (th) return { kind: 'threads', handle: th[1], title: `Threads · @${th[1]}` };
  const site = /^(?:https?:\/\/)?([\w-]+(?:\.[\w-]+)+)(\/\S*)?$/.exec(s);
  if (site) return { kind: 'site', handle: `${site[1]}${site[2] ?? ''}`.replace(/\/$/, ''), title: site[1] };
  return null;
}

/** Новый источник. title — своё название (по умолчанию — из ссылки). */
export async function addSource(link: string, title?: string): Promise<void> {
  const src = parseSourceLink(link);
  if (!src) throw new Error('bad-link');
  const { error } = await withTimeout(supabase().from('sources').insert({ ...src, title: title?.trim() || src.title, enabled: src.kind === 'telegram' }));
  if (error) throw error;
}

/** Удалить источник (таблица sources, политика sources_staff — только команда). */
export async function removeSource(id: string): Promise<void> {
  const { error } = await withTimeout(supabase().from('sources').delete().eq('id', id));
  if (error) throw error;
}

export interface UserTaste {
  id: string;
  name: string;
  age: number | null;
  since: string;
  answers: { interests: string[]; times: string[]; withWho: string; budget: string } | null;
  signals: { id: string; eventId: string; kind: string; at: string; tags: string[]; category: string; title: string }[];
}

/** Вкус человека для вкладки «Рекомендации»: только команда (RLS — staff). Поиск по нику или id. */
export async function loadUserTaste(query: string): Promise<UserTaste | null> {
  const q = query.trim().replace(/^@|^#/, '');
  const byId = /^[0-9a-f-]{36}$/i.test(q);
  const { data: p } = await withTimeout(supabase().from('profiles').select('id,name,birth_date,created_at').eq(byId ? 'id' : 'handle', q).maybeSingle());
  if (!p) return null;
  const prof = p as { id: string; name: string; birth_date: string | null; created_at: string };
  const [{ data: a }, { data: s }] = await Promise.all([
    withTimeout(supabase().from('start_answers').select('interests,times,with_who,budget').eq('user_id', prof.id).maybeSingle()),
    withTimeout(supabase().from('signals').select('id,event_id,kind,created_at,events(title,tags,category)').eq('user_id', prof.id).order('created_at').limit(1000)),
  ]);
  const ans = a as { interests: string[]; times: string[]; with_who: string; budget: string } | null;
  type Row = { id: string; event_id: string; kind: string; created_at: string; events: { title: string; tags: string[]; category: string } | null };
  return {
    id: prof.id,
    name: prof.name,
    age: prof.birth_date ? Math.floor((Date.now() - new Date(prof.birth_date).getTime()) / (365.25 * 86400e3)) : null,
    since: prof.created_at,
    answers: ans ? { interests: ans.interests, times: ans.times, withWho: ans.with_who, budget: ans.budget } : null,
    signals: ((s as Row[] | null) ?? []).map((r) => ({
      id: r.id, eventId: r.event_id, kind: r.kind, at: r.created_at, tags: r.events?.tags ?? [], category: r.events?.category ?? 'meetup', title: r.events?.title ?? 'Событие',
    })),
  };
}

/** Черновики, у которых дата уже прошла: в согласовании они не нужны. Возвращает, сколько убрали. */
export async function rejectStaleDrafts(): Promise<number> {
  const cutoff = new Date(Date.now() - 3 * 3600e3).toISOString();
  const { data, error } = await withTimeout(supabase().from('events').update({ rejected: true, updated_at: new Date().toISOString() })
    .eq('status', 'draft').eq('rejected', false).lt('starts_at', cutoff).or(`ends_at.is.null,ends_at.lt.${cutoff}`).select('id'));
  if (error) throw error;
  return (data as unknown[] | null)?.length ?? 0;
}

/** Флаг в app_flags (например, covers_paused). */
export async function getFlag(key: string): Promise<boolean | null> {
  const { data, error } = await withTimeout(supabase().from('app_flags').select('value').eq('key', key).maybeSingle());
  if (error) throw error;
  return data ? (data as { value: unknown }).value === true : null;
}
export async function setFlag(key: string, value: boolean): Promise<void> {
  const { error } = await withTimeout(supabase().from('app_flags').upsert({ key, value, updated_at: new Date().toISOString() }));
  if (error) throw error;
}

// ——— «Все события»: переименовать, фото, снять с карты, удалить ———

export const TITLE_MIN = 2;
export const TITLE_MAX = 120;
/** Название после правки: без лишних пробелов; null — если не подходит. */
export function cleanTitle(s: string): string | null {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length >= TITLE_MIN && t.length <= TITLE_MAX ? t : null;
}

export async function renameEvent(id: string, title: string): Promise<string> {
  const t = cleanTitle(title);
  if (!t) throw new Error(`Название — от ${TITLE_MIN} до ${TITLE_MAX} знаков`);
  const { error } = await withTimeout(supabase().rpc('staff_rename_event', { ev: id, new_title: t }));
  if (error) throw error;
  return t;
}

/** «Снять с карты» — событие возвращается в очередь «Новые»; «Удалить» — уходит в архив и больше не находится поиском. */
export async function eventAction(id: string, action: 'unpublish' | 'delete'): Promise<void> {
  const { error } = await withTimeout(supabase().rpc('staff_event_action', { ev: id, action }));
  if (error) throw error;
}

/** Своё фото события: в бакет covers, ссылка — в cover_url. Возвращает ссылку. */
export async function setEventCover(id: string, uri: string): Promise<string> {
  const bytes = await (await fetch(uri)).arrayBuffer();
  if (bytes.byteLength > 8 * 1024 * 1024) throw new Error('Фото больше 8 МБ — выбери другое');
  const path = `manual/${id}-${Date.now()}.jpg`;
  const up = await withTimeout(supabase().storage.from('covers').upload(path, bytes, { contentType: 'image/jpeg' }), 30000);
  if (up.error) throw new Error(up.error.message);
  const url = supabase().storage.from('covers').getPublicUrl(path).data.publicUrl;
  const { error } = await withTimeout(supabase().from('events').update({ cover_url: url, cover_ai: false, updated_at: new Date().toISOString() }).eq('id', id));
  if (error) throw error;
  return url;
}
