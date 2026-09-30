// npm run db:seed-demo [-- +77071234567] — демо-люди и чаты макета в настоящей базе.
// С номером телефона: ещё и подключает этот аккаунт (друзья, заявки, чаты). Сначала войди в приложение по этому номеру.
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSql } from './seed-events.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const phone = (process.argv[2] ?? '').replace(/\D/g, '');
try {
  await runSql(await readFile(join(root, 'supabase/seed/demo.sql'), 'utf8'));
  console.log('✓ демо-люди и функция demo_connect');
  if (phone) {
    const rows = JSON.parse(await runSql(`select public.demo_connect(id) from auth.users where phone = '${phone}';`));
    console.log(rows?.length ? `✓ аккаунт +${phone} подключён к демо` : `Аккаунт +${phone} не найден — войди в приложение по этому номеру и повтори.`);
  }
} catch (err) {
  console.error(`✗ ${err.message}`);
  console.error('Нет доступа к Supabase Management API — что сделать, написано в docs/KEYS.md.');
  process.exit(1);
}
