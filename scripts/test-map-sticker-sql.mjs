import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const a = '00000000-0000-4000-8000-000000000001';
const b = '00000000-0000-4000-8000-000000000002';
const c = '00000000-0000-4000-8000-000000000003';
try {
  await db.exec(`create role authenticated; create schema auth; create schema realtime;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create function realtime.topic() returns text language sql stable as $$ select current_setting('test.topic', true) $$;
    create table public.friendships(a uuid, b uuid); create table public.blocks(a uuid, b uuid);
    create function public.is_blocked(x uuid, y uuid) returns boolean language sql stable as $$ select exists(select 1 from public.blocks where (a=x and b=y) or (a=y and b=x)) $$;
    create table realtime.messages(extension text); alter table realtime.messages enable row level security;
    grant usage on schema auth, realtime, public to authenticated; grant select on public.friendships, public.blocks to authenticated;
    grant select, insert on realtime.messages to authenticated;
    insert into public.friendships values ('${a}','${b}');`);
  await db.exec(await readFile(new URL('../supabase/migrations/20261101002540_map_sticker_broadcast.sql', import.meta.url), 'utf8'));
  await db.exec(`select set_config('test.uid','${a}',false); select set_config('test.topic','map-sticker:${a}:${b}',false); set role authenticated; insert into realtime.messages values ('broadcast');`);
  assert.equal((await db.query('select count(*)::int as n from realtime.messages')).rows[0].n, 1);
  await db.exec(`select set_config('test.uid','${b}',false)`);
  assert.equal((await db.query('select count(*)::int as n from realtime.messages')).rows[0].n, 1);
  await assert.rejects(db.exec("insert into realtime.messages values ('broadcast')"), /row-level security/);
  await db.exec(`select set_config('test.uid','${c}',false)`);
  assert.equal((await db.query('select count(*)::int as n from realtime.messages')).rows[0].n, 0);
  await assert.rejects(db.exec("insert into realtime.messages values ('broadcast')"), /row-level security/);
  await db.exec(`reset role; insert into public.blocks values ('${a}','${b}'); set role authenticated; select set_config('test.uid','${a}',false)`);
  assert.equal((await db.query('select count(*)::int as n from realtime.messages')).rows[0].n, 0);
  await assert.rejects(db.exec("insert into realtime.messages values ('broadcast')"), /row-level security/);
  console.log('Приватные стикеры: отправитель, получатель, посторонний и блокировка проверены.');
} finally { await db.close(); }

