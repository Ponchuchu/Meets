// Посты-воспоминания (26 октября, как в Instagram): фото, подпись, карточка события, отмеченные друзья, комментарии, лайки.
// В базе пост — строка memories (note = подпись), фото — memory_photos, остальное — миграция 50.
// В демо всё живёт на телефоне (посты друзей из макета + свои), чтобы экраны работали без сети.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, withTimeout } from '../data/client';
import { config } from '../lib/config';
import { uid } from '../lib/uid';
import { deviceStorage } from '../state/storage';
import { myId } from './auth';
import { addMemoryPhoto } from './profileExtras';

const LIVE = config.dataMode !== 'demo';
const sb = () => supabase();
const me = () => { const id = myId(); if (!id) throw new Error('Войди в аккаунт'); return id; };
async function must<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>, ms = 10000): Promise<T> {
  const r = await withTimeout(p, ms);
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

export interface PostEvent { id: string; title: string; category: string; starts_at: string; venue_name: string | null }
export interface Post {
  id: string; owner: string; caption: string; created_at: string;
  photos: { id: string; url: string }[];
  event: PostEvent | null; tags: string[]; likes: number; liked: boolean; comments: number;
}
export interface PostComment { id: string; author: string; author_name?: string; author_photo?: string | null; body: string; created_at: string }

// ——— Демо ———
const h = (days: number, hour = 20) => new Date(Date.now() - days * 86400e3 - (24 - hour) * 3600e3).toISOString();
const SEED: Post[] = [
  { id: 'p-igor-jazz', owner: 'igor', caption: 'Лучший вечер недели. Трио играло до последнего, а мы до последнего слушали', created_at: h(3), photos: [{ id: 'a', url: 'igor1' }, { id: 'b', url: 'krug' }, { id: 'c', url: 'igor2' }],
    event: { id: 'jazz', title: 'Джаз во дворе', category: 'music', starts_at: h(3, 19), venue_name: 'Панфилова, 110' }, tags: ['denis', 'me'], likes: 12, liked: false, comments: 2 },
  { id: 'p-igor-hike', owner: 'igor', caption: 'Кок-Жайляу на рассвете. Ноги не чувствую, но оно того стоило', created_at: h(10, 9), photos: [{ id: 'd', url: 'hike' }, { id: 'e', url: 'igor3' }],
    event: { id: 'hike', title: 'Поход на Кок-Жайляу', category: 'hike', starts_at: h(10, 7), venue_name: 'Медеу' }, tags: ['timur'], likes: 8, liked: true, comments: 1 },
  { id: 'p-igor-roof', owner: 'igor', caption: 'Город сверху', created_at: h(30), photos: [{ id: 'f', url: 'igor4' }], event: null, tags: [], likes: 5, liked: false, comments: 0 },
  { id: 'p-ainura-film', owner: 'ainura', caption: 'Осень на плёнку. Проявила наконец', created_at: h(6, 17), photos: [{ id: 'g', url: 'ainura' }, { id: 'i', url: 'krug' }], event: null, tags: [], likes: 21, liked: false, comments: 1 },
  { id: 'p-ainura-lake', owner: 'ainura', caption: 'БАО без людей — редкость', created_at: h(40, 8), photos: [{ id: 'j', url: 'hike' }], event: null, tags: [], likes: 14, liked: false, comments: 0 },
  { id: 'p-anton-anime', owner: 'anton', caption: 'Нашёл свой мерч, остальное неважно', created_at: h(2, 13), photos: [{ id: 'k', url: 'anton' }],
    event: { id: 'anime', title: 'Аниме-выставка «Токио в Алматы»', category: 'art', starts_at: h(2, 10), venue_name: 'ТРЦ на Абая' }, tags: ['igor'], likes: 9, liked: false, comments: 0 },
];
const SEED_COMMENTS: Record<string, PostComment[]> = {
  'p-igor-jazz': [{ id: 'c1', author: 'denis', body: 'Повторим в пятницу?', created_at: h(2, 22) }, { id: 'c2', author: 'anton', body: 'А где был мой билет?', created_at: h(2, 23) }],
  'p-igor-hike': [{ id: 'c3', author: 'timur', body: 'Следующий — Фурманова', created_at: h(9, 12) }],
  'p-ainura-film': [{ id: 'c4', author: 'mira', body: 'Какая плёнка?', created_at: h(5, 18) }],
};
interface DemoPosts { posts: Post[]; comments: Record<string, PostComment[]> }
const useDemo = create<DemoPosts>()(persist(() => ({ posts: SEED, comments: SEED_COMMENTS } as DemoPosts), { name: 'ryadom-demo-posts', storage: deviceStorage(), version: 1 }));

// ——— Живая база ———
interface Row {
  id: string; user_id: string; note: string | null; title: string; created_at: string; happened_at: string;
  events: { id: string; title: string; category: string; starts_at: string; venue_name: string | null } | null;
  memory_photos: { id: string; path: string; created_at: string }[];
  memory_tags?: { user_id: string }[]; memory_likes?: { user_id: string }[]; memory_comments?: { count: number }[];
}
const signed = async (paths: string[]): Promise<Record<string, string>> => {
  if (!paths.length) return {};
  const r = await withTimeout(sb().storage.from('memories').createSignedUrls(paths, 3600), 10000);
  if (r.error) return {};
  return Object.fromEntries((r.data ?? []).filter((x) => x.signedUrl && x.path).map((x) => [x.path!, x.signedUrl as string]));
};
async function mapRows(rows: Row[]): Promise<Post[]> {
  const urls = await signed(rows.flatMap((r) => r.memory_photos.map((p) => p.path)));
  const my = myId();
  return rows.map((r) => ({
    id: r.id, owner: r.user_id, caption: r.note ?? '', created_at: r.created_at ?? r.happened_at,
    photos: [...r.memory_photos].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((p) => ({ id: p.id, url: urls[p.path] })).filter((p) => p.url),
    event: r.events, tags: (r.memory_tags ?? []).map((t) => t.user_id),
    likes: (r.memory_likes ?? []).length, liked: (r.memory_likes ?? []).some((l) => l.user_id === my), comments: r.memory_comments?.[0]?.count ?? 0,
  })).filter((p) => p.photos.length);
}
const FULL = 'id,user_id,note,title,created_at,happened_at,events(id,title,category,starts_at,venue_name),memory_photos(id,path,created_at),memory_tags(user_id),memory_likes(user_id),memory_comments(count)';
const BASIC = 'id,user_id,note,title,created_at,happened_at,events(id,title,category,starts_at,venue_name),memory_photos(id,path,created_at)';

/** Посты человека (свои — без owner), новые сверху. Видимость решает сервер (can_see_memories). */
export async function getPosts(owner?: string): Promise<Post[]> {
  const who = owner ?? (LIVE ? me() : 'me');
  if (!LIVE) return useDemo.getState().posts.filter((p) => p.owner === who).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const q = (cols: string) => sb().from('memories').select(cols).eq('user_id', who).order('created_at', { ascending: false }).limit(60);
  // До миграции 50 (теги, лайки, комментарии) — без них, чтобы посты всё равно показывались.
  const full = await withTimeout(q(FULL), 10000);
  const rows = full.error ? await must(q(BASIC)) : full.data;
  return mapRows((rows ?? []) as unknown as Row[]);
}

export async function getPost(id: string): Promise<Post | null> {
  if (!LIVE) return useDemo.getState().posts.find((p) => p.id === id) ?? null;
  const full = await withTimeout(sb().from('memories').select(FULL).eq('id', id).maybeSingle(), 10000);
  const row = full.error ? await must(sb().from('memories').select(BASIC).eq('id', id).maybeSingle()) : full.data;
  return row ? (await mapRows([row as unknown as Row]))[0] ?? null : null;
}

/** Новый пост: фото (до 10), подпись, событие, отмеченные друзья. */
export async function createPost(p: { uris: string[]; caption: string; event: PostEvent | null; tags: string[] }): Promise<string> {
  const caption = p.caption.trim().slice(0, 1000);
  if (!LIVE) {
    const id = uid('post');
    useDemo.setState((s) => ({ posts: [{ id, owner: 'me', caption, created_at: new Date().toISOString(), photos: p.uris.map((url) => ({ id: uid('ph'), url })), event: p.event, tags: p.tags, likes: 0, liked: false, comments: 0 }, ...s.posts] }));
    return id;
  }
  const title = (p.event?.title || caption.split('\n')[0] || 'Фото').slice(0, 120);
  const row = await must(sb().from('memories').insert({ user_id: me(), event_id: p.event?.id ?? null, title, note: caption || null, happened_at: p.event?.starts_at ?? new Date().toISOString() }).select('id').single()) as { id: string };
  for (const uri of p.uris.slice(0, 10)) await addMemoryPhoto(row.id, uri);
  if (p.tags.length) await withTimeout(sb().from('memory_tags').insert(p.tags.map((user_id) => ({ memory_id: row.id, user_id }))), 10000);
  return row.id;
}

export async function deletePost(id: string): Promise<void> {
  if (!LIVE) { useDemo.setState((s) => ({ posts: s.posts.filter((p) => p.id !== id) })); return; }
  const photos = await must(sb().from('memory_photos').select('path').eq('memory_id', id)) as { path: string }[];
  if (photos.length) await withTimeout(sb().storage.from('memories').remove(photos.map((x) => x.path)), 15000);
  await must(sb().from('memories').delete().eq('id', id));
}

export async function toggleLike(id: string, on: boolean): Promise<void> {
  if (!LIVE) { useDemo.setState((s) => ({ posts: s.posts.map((p) => (p.id === id ? { ...p, liked: on, likes: Math.max(0, p.likes + (on ? 1 : -1)) } : p)) })); return; }
  if (on) await must(sb().from('memory_likes').insert({ memory_id: id, user_id: me() }));
  else await must(sb().from('memory_likes').delete().eq('memory_id', id).eq('user_id', me()));
}

export async function getComments(id: string): Promise<PostComment[]> {
  if (!LIVE) return useDemo.getState().comments[id] ?? [];
  const rows = await must(sb().from('memory_comments').select('id,user_id,body,created_at').eq('memory_id', id).order('created_at').limit(200)) as { id: string; user_id: string; body: string; created_at: string }[];
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const profs = ids.length ? await must(sb().from('profiles').select('id,name,photo_url').in('id', ids)) as { id: string; name: string; photo_url: string | null }[] : [];
  return rows.map((r) => { const pr = profs.find((x) => x.id === r.user_id); return { id: r.id, author: r.user_id, author_name: pr?.name, author_photo: pr?.photo_url ?? null, body: r.body, created_at: r.created_at }; });
}

export async function addComment(id: string, body: string): Promise<void> {
  const text = body.trim().slice(0, 500);
  if (!text) return;
  if (!LIVE) {
    useDemo.setState((s) => ({ comments: { ...s.comments, [id]: [...(s.comments[id] ?? []), { id: uid('cm'), author: 'me', body: text, created_at: new Date().toISOString() }] }, posts: s.posts.map((p) => (p.id === id ? { ...p, comments: p.comments + 1 } : p)) }));
    return;
  }
  await must(sb().from('memory_comments').insert({ memory_id: id, user_id: me(), body: text }));
}

export async function deleteComment(postId: string, commentId: string): Promise<void> {
  if (!LIVE) { useDemo.setState((s) => ({ comments: { ...s.comments, [postId]: (s.comments[postId] ?? []).filter((c) => c.id !== commentId) }, posts: s.posts.map((p) => (p.id === postId ? { ...p, comments: Math.max(0, p.comments - 1) } : p)) })); return; }
  await must(sb().from('memory_comments').delete().eq('id', commentId));
}
