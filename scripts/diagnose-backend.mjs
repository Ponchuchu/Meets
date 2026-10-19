// Только чтение схемы/стабильных RPC, без печати ключей, токенов и пользовательских данных.
import { readFile } from 'node:fs/promises';
const keys = JSON.parse(await readFile(new URL('../config/public-keys.json', import.meta.url), 'utf8'));
const base = process.env.EXPO_PUBLIC_SUPABASE_URL || keys.supabaseUrl;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY || keys.supabasePublishableKey;
const token = process.env.DIAGNOSE_ACCESS_TOKEN;
const checks = [
  { name: 'events_live', path: '/rest/v1/events_live?select=id&limit=0' },
  { name: 'profile_frames_migration_27', path: '/rest/v1/profiles?select=id,map_frame,map_trail&limit=0' },
  { name: 'message_keys_migration_27', path: '/rest/v1/messages?select=id,client_key&limit=0' },
  { name: 'chat_summaries_migration_27', path: '/rest/v1/rpc/my_chat_summaries', method: 'POST' },
];
const results = await Promise.all(checks.map(async check => {
  try {
    const res = await fetch(new URL(check.path, base), {
      method: check.method || 'GET',
      headers: { apikey: key, ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
      ...(check.method ? { body: '{}' } : {}), signal: AbortSignal.timeout(15000),
    });
    const data = await res.json().catch(() => null);
    const code = !res.ok && typeof data?.code === 'string' ? data.code : undefined;
    const missing = ['42703', '42P01', 'PGRST202', 'PGRST204'].includes(code);
    return { name: check.name, status: res.status, code, result: res.ok ? 'available' : missing ? 'schema_missing' : [401, 403].includes(res.status) ? 'needs_authorization' : 'request_failed' };
  } catch {
    return { name: check.name, result: 'network_unavailable' };
  }
}));
console.log(JSON.stringify({ source: 'read_only_schema_probe', authenticated: !!token, results }, null, 2));
if (results.some(r => r.result !== 'available')) process.exitCode = 1;
