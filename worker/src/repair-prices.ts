// Retry missing prices for existing cards too: a processed Instagram post is not pulled again.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extract } from './heuristics.ts';
import { linkedFacts } from './linkedFacts.ts';
import { priceIn } from './social.ts';
import type { Extraction } from './types.ts';

export async function repairPrices(url: string, key: string, fetchFn: typeof fetch = fetch): Promise<number> {
  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' };
  if (key.split('.').length === 3) headers.Authorization = `Bearer ${key}`;
  const rest = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const r = await fetchFn(`${url}/rest/v1/${path}`, { ...init, headers, signal: AbortSignal.timeout(20_000) });
    if (!r.ok) throw new Error(`Price repair: ${r.status}`);
    const text = await r.text(); return (text ? JSON.parse(text) : null) as T;
  };
  type Row = { id: string; title: string; about: string; starts_at: string; source_url: string; flags: string[] };
  const dayAgo = new Date(Date.now() - 86400e3).toISOString();
  const rows = await rest<Row[]>(`events?select=id,title,about,starts_at,source_url,flags&price_min=is.null&is_free=eq.false&status=in.(draft,published)&starts_at=gte.${new Date().toISOString()}&or=(price_checked_at.is.null,price_checked_at.lt.${dayAgo})&order=price_checked_at.asc.nullsfirst,starts_at.asc&limit=20`);
  const cache = new Map<string, Promise<string | null>>();
  let fixed = 0;
  for (const e of rows) {
    const posts = await rest<{ text: string }[]>(`raw_posts?select=text&event_id=eq.${e.id}&limit=1`);
    const text = posts[0]?.text || e.about;
    const x: Extraction = { ...extract(text, e.starts_at), title: e.title, starts_at: e.starts_at, price_min: null, price_max: null, is_free: false };
    const price = priceIn(text);
    x.price_min = price.min; x.price_max = price.max; x.is_free = price.free;
    await linkedFacts(x, `${text}\n${e.source_url ?? ''}`, fetchFn, cache);
    const patch: Record<string, unknown> = { price_checked_at: new Date().toISOString() };
    if (x.price_min != null || x.is_free) {
      Object.assign(patch, { price_min: x.price_min, price_max: x.price_max, is_free: x.is_free, flags: (e.flags ?? []).filter(f => f !== 'check_price') });
    }
    // Guard against racing with a moderator or another collector.
    await rest(`events?id=eq.${e.id}&price_min=is.null&is_free=eq.false`, { method: 'PATCH', body: JSON.stringify(patch) });
    if (x.price_min != null || x.is_free) fixed++;
  }
  return fixed;
}
if (import.meta.url && process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
  if (url && key) void repairPrices(url, key).then(n => console.log(`Цены: восстановлено ${n}`)).catch(e => { console.error(e.message); process.exitCode = 1; });
}
