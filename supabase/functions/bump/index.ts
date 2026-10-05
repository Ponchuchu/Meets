// Бамп (V6 §7.2): два телефона стукнулись — удар в пределах ±1,5 с и 100 м → дружба сразу.
// POST { lat, lon, at } (at — время удара на телефоне, мс). Ждём пару до 3 с.
// → { matched: true, friend: { id, name, handle, photo_url } } | { matched: false }
import { admin, json, preflight, userFrom } from '../_shared/supabase.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const db = admin();
  const me = await userFrom(req, db);
  if (!me) return json({ error: 'auth' }, 401);
  const { lat, lon, at } = await req.json().catch(() => ({})) as { lat?: number; lon?: number; at?: number };
  if (typeof lat !== 'number' || typeof lon !== 'number') return json({ error: 'lat/lon' }, 400);
  // Часы телефона могут врать: берём время сервера, если расхождение больше 5 с.
  const when = typeof at === 'number' && Math.abs(at - Date.now()) < 5000 ? new Date(at) : new Date();
  const { data: row, error } = await db.from('bump_pending')
    .insert({ user_id: me, at: when.toISOString(), point: `SRID=4326;POINT(${lon} ${lat})` }).select('id').single();
  if (error || !row) return json({ error: error?.message ?? 'insert' }, 500);
  for (let i = 0; i < 7; i++) {
    const { data: other } = await db.rpc('bump_match', { me, pending: row.id });
    if (other) {
      const { data: friend } = await db.from('profiles').select('id,name,handle,photo_url').eq('id', other).maybeSingle();
      return json({ matched: true, friend: friend ?? { id: other } });
    }
    await sleep(450);
  }
  return json({ matched: false });
});
