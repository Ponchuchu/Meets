// Клиенты Supabase внутри Edge Functions. SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY платформа кладёт сама.
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export function admin(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
}

/** id человека из заголовка Authorization (JWT приложения). */
export async function userFrom(req: Request, db: SupabaseClient): Promise<string | null> {
  const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!jwt) return null;
  const { data } = await db.auth.getUser(jwt);
  return data.user?.id ?? null;
}

/** Вызовы по расписанию (pg_cron) и из триггеров несут общий секрет CRON_SECRET (он же лежит в Vault). */
export function isServiceCall(req: Request): boolean {
  const secret = Deno.env.get('CRON_SECRET');
  return !!secret && req.headers.get('x-cron-secret') === secret;
}

/** CORS: web-версия приложения зовёт функции из браузера. */
export const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
export const preflight = (req: Request) => (req.method === 'OPTIONS' ? new Response('ok', { headers: CORS }) : null);
export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
