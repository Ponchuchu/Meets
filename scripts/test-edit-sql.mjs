// Проверка миграции 34 (редактирование сообщений) на изолированной базе PGlite.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const A = '00000000-0000-0000-0000-00000000000a', B = '00000000-0000-0000-0000-00000000000b';
await db.exec(`
  create schema auth; create table auth.jwt(uid uuid);
  create function auth.uid() returns uuid language sql as 'select uid from auth.jwt limit 1';
  create table public.messages(id uuid primary key default gen_random_uuid(), chat_id uuid, author_id uuid, kind text, body text,
    media_path text, created_at timestamptz default now());
  insert into auth.jwt values ('${A}');
`);
await db.exec(await readFile(new URL('../supabase/migrations/20261021000034_chat_edit.sql', import.meta.url), 'utf8'));
await db.exec(await readFile(new URL('../supabase/migrations/20261021000034_chat_edit.sql', import.meta.url), 'utf8')); // повтор безопасен
const ins = async (author, kind = 'text', age = '0 hours') => (await db.query(`insert into messages(chat_id, author_id, kind, body, created_at) values (gen_random_uuid(), $1, $2, 'привет', now() - $3::interval) returning id`, [author, kind, age])).rows[0].id;
const fails = async (sql, params, code) => { await assert.rejects(db.query(sql, params), (e) => e.message.includes(code)); };

const mine = await ins(A);
await db.query(`update messages set body = 'привет!' where id = $1`, [mine]);
const row = (await db.query(`select body, edited_at from messages where id = $1`, [mine])).rows[0];
assert.equal(row.body, 'привет!'); assert.ok(row.edited_at, 'edited_at ставится');
console.log('✓ автор исправляет свой текст, пометка «изменено»');
await fails(`update messages set body = 'чужое' where id = $1`, [await ins(B)], 'message-edit-forbidden');
console.log('✓ чужое сообщение исправить нельзя');
await fails(`update messages set body = 'поздно' where id = $1`, [await ins(A, 'text', '49 hours')], 'message-edit-too-late');
console.log('✓ через 48 часов исправить нельзя');
await fails(`update messages set body = 'x' where id = $1`, [await ins(A, 'photo')], 'message-edit-forbidden');
console.log('✓ подпись фото и прочие виды не исправляются');
await fails(`update messages set body = '  ' where id = $1`, [mine], 'message-edit-empty');
await fails(`update messages set kind = 'photo' where id = $1`, [mine], 'message-readonly');
console.log('✓ пустой текст и смена вида запрещены');
