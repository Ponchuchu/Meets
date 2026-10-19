// Рельеф Алматы (data/terrain, Copernicus DEM) → публичная папка Storage «terrain». Запуск — workflow «terrain».
// Ключ — только из секрета SUPABASE_SECRET_KEY; права в базе не меняем.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error('Нужны SUPABASE_URL и SUPABASE_SECRET_KEY');
const h = { apikey: key, Authorization: `Bearer ${key}` };
const root = 'data/terrain';

const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? files(p) : p.endsWith('.png') ? [p] : [];
});

const bucket = await fetch(`${url}/storage/v1/bucket`, { method: 'POST', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'terrain', name: 'terrain', public: true }) });
console.log('bucket', bucket.status, bucket.ok ? '' : (await bucket.text()).slice(0, 200));
let ok = 0;
for (const f of files(root)) {
  const path = `v1/${relative(root, f)}`;
  const r = await fetch(`${url}/storage/v1/object/terrain/${path}`, {
    method: 'POST', headers: { ...h, 'Content-Type': 'image/png', 'Cache-Control': 'max-age=31536000', 'x-upsert': 'true' }, body: readFileSync(f),
  });
  if (r.ok) ok++; else console.log(path, r.status, (await r.text()).slice(0, 200));
}
console.log(`загружено ${ok} тайлов`);
if (!ok) process.exit(1);
