// Посты Instagram (и Threads, когда будет ключ) для сборщика событий. Ключи — только в секретах Supabase: IG_TOKEN, IG_USER_ID, THREADS_TOKEN.
// Instagram: API Facebook, Business Discovery — публичные посты бизнес- и авторских аккаунтов по нику.
// POST { action: 'pull', items: [{ kind: 'instagram' | 'threads', handle, since? }], pages?: 1..3 } → { results: [{ handle, ok, profile?, posts?, error? }] }
// POST { action: 'probe', kind?, handle }  → профиль и 12 последних постов: панель показывает, подходит ли страница, до добавления
// POST { action: 'token' }                 → { instagram: { ok, expires_at, error? }, threads: { ok } }
// Кто может звать: сотрудник (JWT приложения), сборщик (секретный ключ проекта) и расписание (CRON_SECRET).
import { admin, isServiceCall, json, preflight, userFrom } from '../_shared/supabase.ts';

const GRAPH = 'https://graph.facebook.com/v21.0';
const THREADS = 'https://graph.threads.net/v1.0';
const FIELDS = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{media_type,media_url,thumbnail_url}';

interface Media { type: 'image' | 'video'; url: string; poster?: string | null }
interface Post { id: string; url: string; text: string; at: string; media: Media[] }
interface Profile { name: string | null; followers: number | null; avatar: string | null; posts: number | null }
type Result = { kind: string; handle: string; ok: boolean; profile?: Profile; posts?: Post[]; error?: string };

/** Секретный ключ проекта (sb_secret_… или старый service_role) — так зовёт сборщик из GitHub Actions. */
function isProjectSecret(req: Request): boolean {
  const key = req.headers.get('apikey') ?? req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!key) return false;
  if (key === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) return true;
  try {
    const all = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>;
    return Object.values(all).includes(key);
  } catch {
    return false;
  }
}

/** Понятная причина вместо ответа Facebook. */
function reason(e: { message?: string; code?: number; error_subcode?: number; error_user_title?: string } | undefined, status: number): string {
  const m = e?.error_user_title || e?.message || `ошибка ${status}`;
  if (e?.code === 190) return 'Токен Instagram истёк или отозван — нужен новый IG_TOKEN (docs/KEYS.md)';
  if (e?.code === 4 || e?.code === 17 || e?.code === 32 || e?.code === 613) return 'Лимит запросов Instagram — продолжим в следующий запуск';
  if (e?.code === 110 || /не удалось найти|cannot be found|does not exist/i.test(m)) return 'Страница не найдена или это личный аккаунт (нужен бизнес или автор)';
  return m.slice(0, 160);
}

const clean = (h: string) => h.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?(instagram\.com|threads\.(net|com))\/@?/i, '').replace(/[/?#].*$/, '').replace(/[^\w.]/g, '').toLowerCase();

type IgMedia = { id: string; caption?: string; media_type?: string; media_url?: string; thumbnail_url?: string; permalink?: string; timestamp?: string; children?: { data?: IgMedia[] } };
function igPost(m: IgMedia): Post {
  const one = (x: IgMedia): Media | null => x.media_type === 'VIDEO'
    ? (x.media_url ? { type: 'video', url: x.media_url, poster: x.thumbnail_url ?? null } : x.thumbnail_url ? { type: 'image', url: x.thumbnail_url } : null)
    : x.media_url ? { type: 'image', url: x.media_url } : null;
  const media = (m.media_type === 'CAROUSEL_ALBUM' ? (m.children?.data ?? []).map(one) : [one(m)]).filter((x): x is Media => !!x).slice(0, 10);
  return { id: m.id, url: m.permalink ?? '', text: m.caption ?? '', at: m.timestamp ? new Date(m.timestamp.replace(/\+0000$/, 'Z')).toISOString() : new Date().toISOString(), media };
}

async function instagram(handle: string, since: string | null, pages: number, limit = 30): Promise<Result> {
  const token = Deno.env.get('IG_TOKEN');
  const me = Deno.env.get('IG_USER_ID');
  if (!token || !me) return { kind: 'instagram', handle, ok: false, error: 'Нет IG_TOKEN или IG_USER_ID в секретах Supabase' };
  const posts: Post[] = [];
  let profile: Profile | undefined;
  let after: string | null = null;
  const stop = since ? Date.parse(since) : 0;
  for (let page = 0; page < pages; page++) {
    const media = `media${after ? `.after(${after})` : ''}.limit(${limit}){${FIELDS}}`;
    const fields = `business_discovery.username(${handle}){username,name,followers_count,media_count,profile_picture_url,${media}}`;
    let res: Response;
    try {
      res = await fetch(`${GRAPH}/${me}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(25_000) });
    } catch (e) {
      return { kind: 'instagram', handle, ok: posts.length > 0, profile, posts, error: `Instagram не ответил: ${(e as Error).message}` };
    }
    const body = await res.json().catch(() => ({})) as { error?: Parameters<typeof reason>[0]; business_discovery?: { name?: string; followers_count?: number; media_count?: number; profile_picture_url?: string; media?: { data?: IgMedia[]; paging?: { cursors?: { after?: string } } } } };
    const bd = body.business_discovery;
    // Слишком большой ответ (длинные карусели) — просим меньше постов за раз.
    if (!bd && /reduce the amount of data/i.test(body.error?.message ?? '') && limit > 8) return instagram(handle, since, pages, Math.floor(limit / 3));
    if (!res.ok || !bd) return { kind: 'instagram', handle, ok: posts.length > 0, profile, posts, error: reason(body.error, res.status) };
    profile ??= { name: bd.name ?? null, followers: bd.followers_count ?? null, avatar: bd.profile_picture_url ?? null, posts: bd.media_count ?? null };
    const list = (bd.media?.data ?? []).map(igPost);
    posts.push(...list.filter((p) => !stop || Date.parse(p.at) > stop));
    after = bd.media?.paging?.cursors?.after ?? null;
    // Дальше не листаем: дошли до уже прочитанного или посты кончились.
    if (!after || !list.length || (stop && Date.parse(list[list.length - 1].at) <= stop)) break;
  }
  return { kind: 'instagram', handle, ok: true, profile, posts };
}

/** Threads: публичные посты профиля (нужен THREADS_TOKEN с разрешением threads_profile_discovery). */
async function threads(handle: string, since: string | null): Promise<Result> {
  const token = Deno.env.get('THREADS_TOKEN');
  if (!token) return { kind: 'threads', handle, ok: false, error: 'Нет ключа THREADS_TOKEN — как получить, в docs/KEYS.md' };
  const fields = 'id,text,media_type,media_url,thumbnail_url,permalink,timestamp';
  const res = await fetch(`${THREADS}/profile_posts?username=${encodeURIComponent(handle)}&fields=${fields}&limit=50&access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(25_000) }).catch(() => null);
  if (!res) return { kind: 'threads', handle, ok: false, error: 'Threads не ответил' };
  const body = await res.json().catch(() => ({})) as { error?: Parameters<typeof reason>[0]; data?: { id: string; text?: string; media_type?: string; media_url?: string; thumbnail_url?: string; permalink?: string; timestamp?: string }[] };
  if (!res.ok || !body.data) return { kind: 'threads', handle, ok: false, error: reason(body.error, res.status) };
  const stop = since ? Date.parse(since) : 0;
  const posts = body.data.map((m): Post => ({
    id: m.id, url: m.permalink ?? '', text: m.text ?? '', at: m.timestamp ? new Date(m.timestamp.replace(/\+0000$/, 'Z')).toISOString() : new Date().toISOString(),
    media: m.media_type === 'VIDEO' && m.media_url ? [{ type: 'video', url: m.media_url, poster: m.thumbnail_url ?? null }] : m.media_url ? [{ type: 'image', url: m.media_url }] : [],
  })).filter((p) => !stop || Date.parse(p.at) > stop);
  return { kind: 'threads', handle, ok: true, posts };
}

async function tokenInfo() {
  const t = Deno.env.get('IG_TOKEN');
  const ig = !t ? { ok: false, error: 'Нет IG_TOKEN' } : await fetch(`${GRAPH}/debug_token?input_token=${encodeURIComponent(t)}&access_token=${encodeURIComponent(t)}`)
    .then((r) => r.json()).then((j: { data?: { is_valid?: boolean; expires_at?: number; data_access_expires_at?: number }; error?: { message?: string } }) => ({
      ok: !!j.data?.is_valid,
      expires_at: j.data?.expires_at ? new Date(j.data.expires_at * 1000).toISOString() : null,
      error: j.error?.message ?? (j.data?.is_valid === false ? 'Токен недействителен' : undefined),
    })).catch((e) => ({ ok: false, error: String(e) }));
  return { instagram: ig, threads: { ok: !!Deno.env.get('THREADS_TOKEN') } };
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (!isServiceCall(req) && !isProjectSecret(req)) {
    const db = admin();
    const me = await userFrom(req, db);
    if (!me) return json({ error: 'auth' }, 401);
    const { data: staff } = await db.from('staff').select('user_id').eq('user_id', me).maybeSingle();
    if (!staff) return json({ error: 'forbidden' }, 403);
  }
  const body = await req.json().catch(() => ({})) as { action?: string; kind?: string; handle?: string; items?: { kind?: string; handle?: string; since?: string | null }[]; pages?: number };

  if (body.action === 'token') return json(await tokenInfo());

  if (body.action === 'probe') {
    const handle = clean(body.handle ?? '');
    if (!handle) return json({ error: 'Нужен ник страницы' }, 400);
    const r = body.kind === 'threads' ? await threads(handle, null) : await instagram(handle, null, 1, 12);
    return json(r);
  }

  if (body.action === 'pull') {
    const items = (body.items ?? []).slice(0, 25).map((i) => ({ kind: i.kind === 'threads' ? 'threads' : 'instagram', handle: clean(i.handle ?? ''), since: i.since ?? null })).filter((i) => i.handle);
    const pages = Math.min(Math.max(Number(body.pages) || 1, 1), 3);
    const results: Result[] = new Array(items.length);
    let next = 0;
    let limited = false;
    // По 4 страницы одновременно: быстро и без всплеска запросов к лимиту Facebook.
    // Упёрлись в лимит — остальные не дёргаем (каждый лишний запрос продлевает блокировку), они пойдут первыми в следующий раз.
    const worker = async () => {
      while (next < items.length) {
        const i = next++;
        const it = items[i];
        if (limited && it.kind === 'instagram') { results[i] = { kind: it.kind, handle: it.handle, ok: false, error: 'Лимит запросов Instagram — продолжим в следующий запуск' }; continue; }
        results[i] = it.kind === 'threads' ? await threads(it.handle, it.since) : await instagram(it.handle, it.since, pages);
        if (/Лимит запросов/.test(results[i].error ?? '')) limited = true;
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    return json({ results });
  }
  return json({ error: 'unknown action' }, 400);
});
