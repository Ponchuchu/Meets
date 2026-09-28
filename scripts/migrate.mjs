// npm run db:migrate — применяет supabase/migrations/*.sql через Management API.
// Токен: переменная SUPABASE_ACCESS_TOKEN или API credential облачной среды (прокси подставит сам).
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSql } from './seed-events.mjs';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../supabase/migrations');
const only = process.argv[2];
for (const f of (await readdir(dir)).filter((x) => x.endsWith('.sql')).sort()) {
  if (only && !f.includes(only)) continue;
  try {
    await runSql(await readFile(join(dir, f), 'utf8'));
    console.log(`✓ ${f}`);
  } catch (err) {
    console.error(`✗ ${f}: ${err.message}`);
    console.error('Нет доступа к Supabase Management API — что сделать, написано в docs/KEYS.md.');
    process.exit(1);
  }
}
