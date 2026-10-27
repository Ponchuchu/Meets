// Explicit ticket links only. Never follow arbitrary user URLs or forward service credentials.
import { ldNodes, ldEventFound } from './eventSites.ts';
import type { Extraction } from './types.ts';
const HOSTS = new Set(['ticketon.kz', 'www.ticketon.kz', 'afisha.yandex.kz', 'afisha.yandex.ru', 'sxodim.com', 'www.sxodim.com', 'kino.kz', 'www.kino.kz', 'topbilet.kz', 'portalbilet.kz']);
export function ticketUrl(value: string): string | null {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && !u.port && HOSTS.has(u.hostname) ? u.href : null; } catch { return null; }
}
const normalize = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export function sameShow(a: Pick<Extraction, 'title' | 'starts_at'>, b: { title: string; starts_at?: string | null }): boolean {
  if (!a.starts_at || !b.starts_at || Math.abs(Date.parse(a.starts_at) - Date.parse(b.starts_at)) > 2 * 3600e3) return false;
  const left = normalize(a.title), right = normalize(b.title);
  const words = left.split(' ').filter(w => w.length > 2);
  return left === right || words.filter(w => right.split(' ').includes(w)).length >= Math.max(2, Math.ceil(words.length * 0.6));
}
async function page(url: string, fetchFn: typeof fetch): Promise<string | null> {
  for (let i = 0; i < 3; i++) {
    const safe = ticketUrl(url); if (!safe) return null;
    const r = await fetchFn(safe, { redirect: 'manual', signal: AbortSignal.timeout(8000), headers: { 'Accept': 'text/html', 'Accept-Language': 'ru' } });
    if (r.status >= 300 && r.status < 400) { url = new URL(r.headers.get('location') ?? '', safe).href; await r.body?.cancel(); continue; }
    if (!r.ok || !/html/i.test(r.headers.get('content-type') ?? '')) { await r.body?.cancel(); return null; }
    const reader = r.body?.getReader(); if (!reader) return null;
    const chunks: Uint8Array[] = []; let size = 0;
    try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 512_000) return null; chunks.push(value); } }
    finally { await reader.cancel(); }
    const body = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
    return new TextDecoder().decode(body);
  }
  return null;
}
export async function linkedFacts(x: Extraction, text: string, fetchFn: typeof fetch = fetch, cache?: Map<string, Promise<string | null>>): Promise<void> {
  const links = [...new Set((text.match(/https:\/\/[^\s<>"']+/g) ?? []).map(s => ticketUrl(s.replace(/[).,;]+$/, ''))).filter((s): s is string => !!s))].slice(0, 2);
  for (const url of links) {
    try {
      let pending = cache?.get(url);
      if (!pending) { pending = page(url, fetchFn); if (cache && cache.size < 80) cache.set(url, pending); }
      const html = await pending; if (!html) continue;
      for (const node of ldNodes(html).filter(n => /Event/.test(String(n['@type'])))) {
        const found = ldEventFound(node, url, 'Билеты', true);
        if (!found || !sameShow(x, found)) continue;
        if (x.price_min == null && !x.is_free && (found.price_min != null || found.is_free)) {
          x.price_min = found.price_min ?? null; x.price_max = found.price_max ?? null; x.is_free = !!found.is_free; x.price_unsure = false;
        }
        x.address ||= found.address ?? null;
        x.venue_name ||= found.venue_name ?? null;
      }
    } catch { /* keep original facts; retry with a later source post */ }
  }
}
