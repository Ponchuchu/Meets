// Проверка уже опубликованных адресов: по умолчанию только отчёт, --apply сохраняет уверенный результат.
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { geocode, isVague } from './venues.ts';

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Нужны SUPABASE_URL и SUPABASE_SECRET_KEY');
  const apply = process.argv.includes('--apply');
  const limit = Math.min(100, Math.max(1, Number(process.env.GEOCODE_LIMIT) || 40));
  const headers: Record<string,string> = { apikey: key, 'Content-Type': 'application/json' };
  if (key.split('.').length === 3) headers.Authorization = `Bearer ${key}`;
  const params = new URLSearchParams({ select: 'id,title,address,venue_name,lat,lon,needs_pin', visibility: 'eq.public', limit: String(limit), order: 'starts_at', or: `(ends_at.gte.${new Date().toISOString()},starts_at.gte.${new Date().toISOString()})` });
  if (!process.argv.includes('--all')) params.set('needs_pin', 'eq.true');
  const response = await fetch(`${url}/rest/v1/events_live?${params}`, { headers, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Не удалось получить события: ${response.status}`);
  const events = await response.json() as { id:string;title:string;address:string|null;venue_name:string|null;lat:number|null;lon:number|null }[];
  let found=0, saved=0;
  for (const e of events) {
    if (isVague(e.address)) { console.log(`Пропуск · ${e.title}: нужен точный адрес`); continue; }
    const query = [e.venue_name,e.address].filter(Boolean).join(', ');
    const point = await geocode(query);
    if (!point) { console.log(`Не найден точный дом · ${e.title}`); continue; }
    found++;
    console.log(`${apply ? 'Обновление' : 'Проверка'} · ${e.title} · ${e.address} · ${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`);
    if (apply) {
      const r = await fetch(`${url}/rest/v1/rpc/repair_event_point`, { method:'POST',headers,body:JSON.stringify({event:e.id,latitude:point.lat,longitude:point.lon}),signal:AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error(`Не удалось сохранить координаты: ${r.status}`);
      saved++;
    }
  }
  console.log(`Проверено ${events.length} · найдено ${found} · обновлено ${saved}`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main().catch(error => { console.error(error instanceof Error ? error.message : 'Ошибка проверки адресов'); process.exitCode=1; });
}
