// Вход тестеров альфы без SMS (docs/ALPHA.md §1).
// ALPHA_TESTERS: «+7…:код[:Имя[:ник[:staff]]],…» — только в секретах Supabase, не в репозитории.
// POST { probe: true, phone } → { codeLength, tester } — длина кода и есть ли номер в списке.
// POST { phone, code }        → { access_token, refresh_token } — приложение делает setSession.
// Неверный код — 401. Не больше 5 попыток за 10 минут на номер. Выключается флагом app_flags.alpha_login = false.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { admin, json } from '../_shared/supabase.ts';

interface Tester { phone: string; code: string; name?: string; handle?: string; staff: boolean }

function testers(): Tester[] {
  return (Deno.env.get('ALPHA_TESTERS') ?? '').split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
    const [phone, code, name, handle, role] = s.split(':');
    return { phone: norm(phone), code: (code ?? '').trim(), name: name || undefined, handle: handle || undefined, staff: role === 'staff' };
  });
}

/** «+7 747 446 07 49», «87474460749» → «+77474460749». */
function norm(p: string): string {
  const d = (p ?? '').replace(/\D/g, '');
  if (d.length === 11 && (d[0] === '8' || d[0] === '7')) return `+7${d.slice(1)}`;
  if (d.length === 10) return `+7${d}`;
  return `+${d}`;
}

async function hmac(key: string, msg: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/[+/=]/g, '').slice(0, 40);
}

/** Тестеры — друзья между собой, Данил — в staff, имена и ники — из списка. */
async function seed(db: ReturnType<typeof admin>, me: string, t: Tester, all: Tester[]) {
  const { data: prof } = await db.from('profiles').select('id').eq('id', me).maybeSingle();
  if (!prof) await db.from('profiles').insert({ id: me, name: t.name ?? 'Тестер', handle: t.handle ?? null });
  if (t.staff) await db.from('staff').upsert({ user_id: me, role: 'admin' });
  const { data: users } = await db.auth.admin.listUsers({ perPage: 200 });
  const phones = new Set(all.map((x) => x.phone.replace('+', '')));
  for (const u of users?.users ?? []) {
    if (u.id === me || !u.phone || !phones.has(u.phone.replace('+', ''))) continue;
    const [a, b] = me < u.id ? [me, u.id] : [u.id, me];
    await db.from('friendships').upsert({ a, b }, { onConflict: 'a,b', ignoreDuplicates: true });
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } });
  const db = admin();
  const { data: flag } = await db.from('app_flags').select('value').eq('key', 'alpha_login').maybeSingle();
  if (flag && flag.value === false) return json({ error: 'disabled' }, 410);

  const body = await req.json().catch(() => ({})) as { probe?: boolean; phone?: string; code?: string };
  const list = testers();
  const phone = norm(body.phone ?? '');
  const t = list.find((x) => x.phone === phone);
  const codeLength = (t ?? list[0])?.code.length || 4;
  if (body.probe) return json({ codeLength, tester: !!t });
  if (!t) return json({ error: 'not_tester' }, 403);

  // Лимит: 5 неудачных попыток за 10 минут на номер.
  const secret = Deno.env.get('ALPHA_SECRET') ?? '';
  const phoneHash = await hmac(secret, `attempt:${phone}`);
  const since = new Date(Date.now() - 10 * 60e3).toISOString();
  const { count } = await db.from('alpha_attempts').select('id', { count: 'exact', head: true }).eq('phone_hash', phoneHash).eq('ok', false).gte('at', since);
  if ((count ?? 0) >= 5) return json({ error: 'too_many' }, 429);
  if ((body.code ?? '').trim() !== t.code) {
    await db.from('alpha_attempts').insert({ phone_hash: phoneHash, ok: false });
    return json({ error: 'bad_code' }, 401);
  }
  await db.from('alpha_attempts').insert({ phone_hash: phoneHash, ok: true });

  const password = await hmac(secret, phone);
  const created = await db.auth.admin.createUser({ phone, phone_confirm: true, password });
  if (created.error && !/already|registered|exists/i.test(created.error.message)) return json({ error: created.error.message }, 500);
  if (created.error) {
    // Пользователь уже есть — пароль мог смениться вместе с ALPHA_SECRET: обновляем.
    const { data: users } = await db.auth.admin.listUsers({ perPage: 200 });
    const u = users?.users.find((x) => x.phone === phone.replace('+', ''));
    if (u) await db.auth.admin.updateUserById(u.id, { password });
  }
  const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.signInWithPassword({ phone, password });
  if (error || !data.session) return json({ error: error?.message ?? 'no_session' }, 500);
  await seed(db, data.session.user.id, t, list);
  return json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token, user_id: data.session.user.id });
});
