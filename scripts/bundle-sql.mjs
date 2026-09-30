// npm run db:bundle — склеивает supabase/migrations/*.sql в один supabase/apply-all.sql.
// Его можно целиком вставить в Supabase → SQL Editor → Run, если нет токена для npm run db:migrate.
// Миграции повторяемые (if not exists / drop … if exists), поэтому файл можно запускать и второй раз.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'supabase/migrations');
const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
let out = '-- Сгенерировано: npm run db:bundle. Не править руками — правь supabase/migrations/.\n-- Supabase → SQL Editor → New query → вставить весь файл → Run.\n';
for (const f of files) out += `\n-- ===== ${f} =====\n${(await readFile(join(dir, f), 'utf8')).trim()}\n`;
await writeFile(join(root, 'supabase/apply-all.sql'), out);
console.log(`supabase/apply-all.sql: ${files.length} миграций, ${Math.round(out.length / 1024)} КБ`);
