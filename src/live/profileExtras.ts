// Воспоминания, ночёвки, значки у имени, «Мои места» сами (FIX3 Ф8–Ф10). Миграция 20261020000032_profile_memories.sql.
// В демо — данные на устройстве, чтобы экраны работали без сети и для web-скриншотов.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, withTimeout } from '../data/client';
import { config } from '../lib/config';
import { uid } from '../lib/uid';
import { deviceStorage } from '../state/storage';
import { myId } from './auth';

const LIVE = config.dataMode !== 'demo';
const sb = () => supabase();
const me = () => { const id = myId(); if (!id) throw new Error('Войди в аккаунт'); return id; };
async function must<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>, ms = 10000): Promise<T> {
  const r = await withTimeout(p, ms);
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

export interface PastEvent { event_id: string; title: string; category: string; starts_at: string; venue_name: string | null; cover_url: string | null; arrived: boolean; memory_id: string | null }
export interface Memory { id: string; event_id: string | null; title: string; note: string | null; happened_at: string; cover: string | null; photos: { id: string; url: string }[] }
export interface Sleepover { night: string; host_id: string | null; host_name: string | null; host_photo: string | null; area: string | null }

interface DemoState { memories: Memory[]; shown: string[]; memoriesVisible: boolean; memoriesPublic?: boolean; sleepoversVisible: boolean }
const useDemo = create<DemoState>()(persist(() => ({ memories: [], shown: [], memoriesVisible: false, sleepoversVisible: false } as DemoState), { name: 'ryadom-demo-memories', storage: deviceStorage() }));

const DEMO_PAST: PastEvent[] = [
  { event_id: 'jazz', title: 'Джаз во дворе', category: 'music', starts_at: new Date(Date.now() - 3 * 86400e3).toISOString(), venue_name: 'Панфилова, 110', cover_url: null, arrived: true, memory_id: null },
  { event_id: 'standup', title: 'Стендап в Central', category: 'standup', starts_at: new Date(Date.now() - 9 * 86400e3).toISOString(), venue_name: 'Central Stand-up Club', cover_url: null, arrived: true, memory_id: null },
  { event_id: 'hike', title: 'Поход на Кумбель', category: 'hike', starts_at: new Date(Date.now() - 16 * 86400e3).toISOString(), venue_name: 'Медеу', cover_url: null, arrived: false, memory_id: null },
];
const DEMO_SLEEP: Sleepover[] = [
  { night: new Date(Date.now() - 5 * 86400e3).toISOString().slice(0, 10), host_id: 'igor', host_name: 'Игорь', host_photo: null, area: 'мкр. Самал-2' },
  { night: new Date(Date.now() - 20 * 86400e3).toISOString().slice(0, 10), host_id: 'denis', host_name: 'Денис', host_photo: null, area: 'улица Жандосова' },
  { night: new Date(Date.now() - 40 * 86400e3).toISOString().slice(0, 10), host_id: null, host_name: null, host_photo: null, area: 'Каменское плато' },
];

/** Прошедшие события, где ты был, — из них делаются альбомы. */
export async function getPastEvents(): Promise<PastEvent[]> {
  if (!LIVE) { const ms = useDemo.getState().memories; return DEMO_PAST.map(p => ({ ...p, memory_id: ms.find(m => m.event_id === p.event_id)?.id ?? null })); }
  return must(sb().rpc('my_past_events', { lim: 60 }));
}

const signed = async (paths: string[]): Promise<Record<string, string>> => {
  if (!paths.length) return {};
  const r = await withTimeout(sb().storage.from('memories').createSignedUrls(paths, 3600), 10000);
  if (r.error) return {};
  return Object.fromEntries((r.data ?? []).filter(x => x.signedUrl && x.path).map(x => [x.path!, x.signedUrl as string]));
};

/** Альбомы человека (свои — всегда; друга — если он открыл воспоминания). */
export async function getMemories(owner?: string): Promise<Memory[]> {
  if (!LIVE) return useDemo.getState().memories;
  const rows = await must(sb().from('memories').select('id,event_id,title,note,happened_at,cover_path,memory_photos(id,path,created_at)').eq('user_id', owner ?? me()).order('happened_at', { ascending: false }).limit(100)) as
    { id: string; event_id: string | null; title: string; note: string | null; happened_at: string; cover_path: string | null; memory_photos: { id: string; path: string; created_at: string }[] }[];
  const urls = await signed(rows.flatMap(r => r.memory_photos.map(p => p.path)));
  return rows.map(r => {
    const photos = [...r.memory_photos].sort((a, b) => a.created_at.localeCompare(b.created_at)).map(p => ({ id: p.id, url: urls[p.path] })).filter(p => p.url);
    return { id: r.id, event_id: r.event_id, title: r.title, note: r.note, happened_at: r.happened_at, cover: (r.cover_path && urls[r.cover_path]) || photos[0]?.url || null, photos };
  });
}

/** Альбом из прошедшего события (или свой, без события). */
export async function createMemory(p: { event_id: string | null; title: string; happened_at: string }): Promise<string> {
  if (!LIVE) {
    const id = uid('mem');
    useDemo.setState(s => ({ memories: [{ id, event_id: p.event_id, title: p.title, note: null, happened_at: p.happened_at, cover: null, photos: [] }, ...s.memories] }));
    return id;
  }
  // Альбом события — один (берём уже созданный); с миграции 50 уникальности в базе нет, постов про событие может быть много.
  if (p.event_id) {
    const old = await must(sb().from('memories').select('id').eq('user_id', me()).eq('event_id', p.event_id).limit(1)) as { id: string }[];
    if (old[0]) return old[0].id;
  }
  const row = await must(sb().from('memories').insert({ user_id: me(), event_id: p.event_id, title: p.title.slice(0, 120), happened_at: p.happened_at }).select('id').single()) as { id: string };
  return row.id;
}

export async function saveMemoryNote(id: string, note: string): Promise<void> {
  if (!LIVE) { useDemo.setState(s => ({ memories: s.memories.map(m => m.id === id ? { ...m, note } : m) })); return; }
  await must(sb().from('memories').update({ note: note.slice(0, 1000) }).eq('id', id));
}

export async function deleteMemory(id: string): Promise<void> {
  if (!LIVE) { useDemo.setState(s => ({ memories: s.memories.filter(m => m.id !== id) })); return; }
  const photos = await must(sb().from('memory_photos').select('path').eq('memory_id', id)) as { path: string }[];
  if (photos.length) await withTimeout(sb().storage.from('memories').remove(photos.map(p => p.path)), 15000);
  await must(sb().from('memories').delete().eq('id', id));
}

/** Фото в альбом: файл в закрытый бакет memories/<я>/<альбом>/…, запись в memory_photos. */
export async function addMemoryPhoto(memoryId: string, uri: string): Promise<void> {
  if (!LIVE) { useDemo.setState(s => ({ memories: s.memories.map(m => m.id === memoryId ? { ...m, cover: m.cover ?? uri, photos: [...m.photos, { id: uid('ph'), url: uri }] } : m) })); return; }
  const blob = await (await fetch(uri)).arrayBuffer();
  const path = `${me()}/${memoryId}/${Date.now()}.jpg`;
  const up = await withTimeout(sb().storage.from('memories').upload(path, blob, { contentType: 'image/jpeg' }), 30000);
  if (up.error) throw new Error(up.error.message);
  await must(sb().from('memory_photos').insert({ memory_id: memoryId, user_id: me(), path }));
}

export async function removeMemoryPhoto(memoryId: string, photoId: string): Promise<void> {
  if (!LIVE) { useDemo.setState(s => ({ memories: s.memories.map(m => m.id === memoryId ? { ...m, photos: m.photos.filter(p => p.id !== photoId) } : m) })); return; }
  const row = await must(sb().from('memory_photos').select('path').eq('id', photoId).single()) as { path: string };
  await withTimeout(sb().storage.from('memories').remove([row.path]), 15000);
  await must(sb().from('memory_photos').delete().eq('id', photoId));
}

export async function getSleepovers(owner?: string): Promise<Sleepover[]> {
  if (!LIVE) return DEMO_SLEEP;
  return must(sb().rpc('my_sleepovers', owner ? { owner } : {}));
}

/** Раз в сутки: дом/работа/учёба по расписанию и новые ночёвки (на сервере, только свои точки). */
export async function learnMyPlaces(): Promise<{ places: number; sleepovers: number } | null> {
  if (!LIVE || !myId()) return null;
  return must(sb().rpc('learn_my_places'), 20000);
}

export interface ProfileExtras { shown: string[]; memoriesVisible: boolean; sleepoversVisible: boolean; stepsVisible?: boolean; /** Альбомы видят все, не только друзья (миграция 49). */ memoriesPublic?: boolean }
export async function getProfileExtras(): Promise<ProfileExtras> {
  if (!LIVE) { const s = useDemo.getState(); return { shown: s.shown, memoriesVisible: s.memoriesVisible, memoriesPublic: !!s.memoriesPublic, sleepoversVisible: s.sleepoversVisible, stepsVisible: true }; }
  // select('*'): колонка memories_public появится после миграции 49 — до неё просто false.
  const r = await must(sb().from('profiles').select('*').eq('id', me()).single()) as { shown_badges: string[] | null; memories_visible: boolean; memories_public?: boolean; sleepovers_visible: boolean; steps_visible: boolean };
  return { shown: r.shown_badges ?? [], memoriesVisible: r.memories_visible, memoriesPublic: !!r.memories_public, sleepoversVisible: r.sleepovers_visible, stepsVisible: r.steps_visible };
}

export async function saveProfileExtras(p: Partial<ProfileExtras>): Promise<void> {
  if (!LIVE) { useDemo.setState({ ...(p.shown ? { shown: p.shown } : {}), ...(p.memoriesVisible != null ? { memoriesVisible: p.memoriesVisible } : {}), ...(p.memoriesPublic != null ? { memoriesPublic: p.memoriesPublic } : {}), ...(p.sleepoversVisible != null ? { sleepoversVisible: p.sleepoversVisible } : {}) }); return; }
  await must(sb().from('profiles').update({
    ...(p.shown ? { shown_badges: p.shown.slice(0, 3) } : {}),
    ...(p.memoriesVisible != null ? { memories_visible: p.memoriesVisible } : {}),
    ...(p.memoriesPublic != null ? { memories_public: p.memoriesPublic } : {}),
    ...(p.sleepoversVisible != null ? { sleepovers_visible: p.sleepoversVisible } : {}),
    ...(p.stepsVisible != null ? { steps_visible: p.stepsVisible } : {}),
  }).eq('id', me()));
}

/** Значки у имени другого человека (видны, если он открыл награды). */
export async function getShownBadges(userId: string): Promise<string[]> {
  if (!LIVE) return [];
  const r = await withTimeout(sb().from('profiles').select('shown_badges').eq('id', userId).maybeSingle(), 8000);
  return ((r.data as { shown_badges?: string[] } | null)?.shown_badges ?? []).slice(0, 3);
}

// ——— Шаги с друзьями (миграция 33): рейтинг и соревнования ———
export interface StepRank { user_id: string; name: string; photo_url: string | null; map_frame: string | null; map_shape: string | null; today: number; week: number; me: boolean }
export interface Challenge {
  id: string; title: string; kind: 'most' | 'goal'; goal: number | null; starts_on: string; ends_on: string; created_by: string; my_status: 'invited' | 'joined';
  members: { user_id: string; name: string; photo_url: string | null; status: string; steps: number }[];
}

const DEMO_RANK: StepRank[] = [
  { user_id: 'igor', name: 'Игорь', photo_url: null, map_frame: 'neon', map_shape: 'auto', today: 9120, week: 48300, me: false },
  { user_id: 'me', name: 'Ты', photo_url: null, map_frame: 'bubble', map_shape: 'auto', today: 6240, week: 41200, me: true },
  { user_id: 'denis', name: 'Денис', photo_url: null, map_frame: 'classic', map_shape: 'heart', today: 11800, week: 39900, me: false },
  { user_id: 'aru', name: 'Аружан', photo_url: null, map_frame: 'tulips', map_shape: 'auto', today: 3400, week: 22100, me: false },
];
const useDemoChallenges = create<{ list: Challenge[] }>(() => ({ list: [{
  id: 'demo-ch', title: 'Кто больше за 7 дн.', kind: 'most', goal: null, starts_on: new Date(Date.now() - 2 * 86400e3).toISOString().slice(0, 10), ends_on: new Date(Date.now() + 4 * 86400e3).toISOString().slice(0, 10), created_by: 'igor', my_status: 'joined',
  members: [{ user_id: 'igor', name: 'Игорь', photo_url: null, status: 'joined', steps: 24800 }, { user_id: 'me', name: 'Ты', photo_url: null, status: 'joined', steps: 21300 }, { user_id: 'denis', name: 'Денис', photo_url: null, status: 'invited', steps: 18900 }],
}] }));

/** Шаги друзей по дням за период (FIX5). Сервер без функции (миграция 41) — сегодня и неделя из старой. */
export interface StepDay { user_id: string; name: string; photo_url: string | null; map_frame: string | null; map_shape: string | null; day: string | null; steps: number; me: boolean }
export async function getFriendsStepsDays(from: string, to: string): Promise<StepDay[]> {
  if (!LIVE) {
    // Демо: у каждого свой ритм по дням недели, стабильно от даты.
    const days: string[] = [];
    for (let t = Date.parse(from); t <= Date.parse(to); t += 86400e3) days.push(new Date(t).toISOString().slice(0, 10));
    return DEMO_RANK.flatMap((r, k) => days.map((day) => ({ ...r, day, steps: Math.round(r.week / 7 * (0.55 + ((Date.parse(day) / 86400e3 * (k + 3)) % 9) / 10)) })));
  }
  try { return await must(sb().rpc('friends_steps_days', { from_day: from, to_day: to })) as StepDay[]; }
  catch (e) {
    if (!/friends_steps_days|function/i.test(String((e as Error)?.message ?? e))) throw e;
    const rows = await must(sb().rpc('friends_steps')) as StepRank[];
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Almaty' });
    return rows.map((r) => ({ ...r, day: from === to ? today : null, steps: from === to ? r.today : r.week }));
  }
}

export async function getChallenges(): Promise<Challenge[]> {
  if (!LIVE) return useDemoChallenges.getState().list;
  const rows = await must(sb().rpc('my_step_challenges')) as (Omit<Challenge, 'members'> & { user_id: string; name: string; photo_url: string | null; status: string; steps: number })[];
  const by = new Map<string, Challenge>();
  for (const r of rows) {
    const c = by.get(r.id) ?? { id: r.id, title: r.title, kind: r.kind, goal: r.goal, starts_on: r.starts_on, ends_on: r.ends_on, created_by: r.created_by, my_status: r.my_status, members: [] };
    c.members.push({ user_id: r.user_id, name: r.name, photo_url: r.photo_url, status: r.status, steps: r.steps });
    by.set(r.id, c);
  }
  return [...by.values()];
}

export async function createChallenge(p: { friends: string[]; days: number; kind: 'most' | 'goal'; goal?: number }): Promise<void> {
  if (!LIVE) {
    const start = new Date().toISOString().slice(0, 10);
    useDemoChallenges.setState(s => ({ list: [{ id: uid('ch'), title: p.kind === 'goal' ? `Кто первым пройдёт ${p.goal} шагов` : `Кто больше за ${p.days} дн.`, kind: p.kind, goal: p.goal ?? null, starts_on: start, ends_on: new Date(Date.now() + (p.days - 1) * 86400e3).toISOString().slice(0, 10), created_by: 'me', my_status: 'joined',
      members: [{ user_id: 'me', name: 'Ты', photo_url: null, status: 'joined', steps: 0 }, ...p.friends.map(f => ({ user_id: f, name: DEMO_RANK.find(r => r.user_id === f)?.name ?? 'Друг', photo_url: null, status: 'invited', steps: 0 }))] }, ...s.list] }));
    return;
  }
  await must(sb().rpc('create_step_challenge', { friends: p.friends, days: p.days, challenge_kind: p.kind, target: p.goal ?? null }));
}

export async function answerChallenge(id: string, accept: boolean): Promise<void> {
  if (!LIVE) { useDemoChallenges.setState(s => ({ list: accept ? s.list.map(c => c.id === id ? { ...c, my_status: 'joined' } : c) : s.list.filter(c => c.id !== id) })); return; }
  await must(sb().rpc('answer_step_challenge', { challenge: id, accept }));
}
