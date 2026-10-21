// Изолированный PostgreSQL (WASM), без доступа к рабочей базе и пользовательским данным.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const base = await readFile(new URL('../supabase/migrations/20260928000002_people_chats.sql', import.meta.url), 'utf8');
await db.exec(`
  create role anon; create role authenticated;
  create schema auth;
  create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;
  grant usage on schema auth to authenticated;
`);
// Настоящие таблицы, триггер принятия и политики друзей из исходной миграции.
await db.exec(base.slice(0, base.indexOf('-- ——— Мой')));
await db.exec(`
  create table public.chats(id uuid primary key default gen_random_uuid());
  create table public.chat_members(chat_id uuid references chats, user_id uuid references auth.users, primary key(chat_id, user_id));
  create table public.messages(id uuid primary key default gen_random_uuid(), chat_id uuid references chats,
    author_id uuid references auth.users, body text, created_at timestamptz not null default now());
  create function public.is_chat_member(chat uuid) returns boolean language sql stable security definer as $$
    select exists(select 1 from public.chat_members where chat_id = chat and user_id = auth.uid());
  $$;
  alter table public.messages enable row level security;
  create policy messages_insert on public.messages for insert to authenticated with check (
    author_id = auth.uid() and exists(select 1 from chat_members where chat_id = messages.chat_id and user_id = auth.uid())
  );
  create policy messages_read on public.messages for select to authenticated using (
    exists(select 1 from chat_members where chat_id = messages.chat_id and user_id = auth.uid())
  );
  grant select, insert, update, delete on all tables in schema public to authenticated;
`);
const migration = await readFile(new URL('../supabase/migrations/20261020000024_reliability.sql', import.meta.url), 'utf8');
await db.exec(migration);
await db.exec(migration); // повторное применение безопасно
const ids = ['1', '2', '3'].map(s => `00000000-0000-4000-8000-${s.padStart(12, '0')}`);
for (const id of ids) await db.query('insert into auth.users values ($1)', [id]);
await db.exec('set role authenticated');
const as = id => db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
const count = async sql => Number((await db.query(sql)).rows[0].n);
let checks = 0;
async function test(name, run) { await run(); checks++; console.log(`✓ ${name}`); }
try {
  await as(ids[0]);
  await test('повторная заявка создаёт одну запись', async () => {
    await db.query('select public.send_friend_request($1)', [ids[1]]);
    await db.query('select public.send_friend_request($1)', [ids[1]]);
    assert.equal(await count('select count(*) n from friend_requests'), 1);
  });
  await test('отправитель не может принять собственную заявку за получателя', async () => {
    assert.equal((await db.query("update friend_requests set status='accepted' returning *")).rows.length, 0);
    assert.equal(await count('select count(*) n from friendships'), 0);
  });
  await test('нельзя подменить отправителя заявки', async () => {
    await as(ids[1]);
    await assert.rejects(db.query('update friend_requests set from_id=$1', [ids[2]]), /permission denied/);
    await as(ids[0]);
  });
  await test('принятие получателем сохраняет дружбу', async () => {
    await as(ids[1]);
    await db.exec("update friend_requests set status='accepted'");
    assert.equal(await count('select count(*) n from friendships'), 1);
  });
  await test('после удаления друга можно отправить новую заявку', async () => {
    await db.exec('delete from friendships');
    await as(ids[0]);
    await db.query('select public.send_friend_request($1)', [ids[1]]);
    assert.equal((await db.query('select status from friend_requests')).rows[0].status, 'pending');
  });
  await test('посторонний не может отменить чужую заявку', async () => {
    await as(ids[2]);
    assert.equal((await db.query('delete from friend_requests returning *')).rows.length, 0);
    await as(ids[0]);
    assert.equal(await count('select count(*) n from friend_requests'), 1);
  });
  await test('отправитель может отменить ожидающую заявку', async () => {
    await db.exec('delete from friend_requests');
    assert.equal(await count('select count(*) n from friend_requests'), 0);
  });
  await test('встречные заявки создают одну дружбу', async () => {
    await db.query('select public.send_friend_request($1)', [ids[1]]);
    await as(ids[1]);
    await db.query('select public.send_friend_request($1)', [ids[0]]);
    assert.equal(await count('select count(*) n from friendships'), 1);
  });
  await test('блокировка запрещает заявку', async () => {
    await db.query('insert into blocks values ($1,$2)', [ids[1], ids[2]]);
    await assert.rejects(db.query('select public.send_friend_request($1)', [ids[2]]), /blocked/);
  });
  await test('без входа и самому себе нельзя отправить заявку', async () => {
    await assert.rejects(db.query('select public.send_friend_request($1)', [ids[1]]), /invalid-recipient/);
    await as('');
    await assert.rejects(db.query('select public.send_friend_request($1)', [ids[0]]), /auth-required/);
  });
  await db.exec('reset role');
  const chat = (await db.query('insert into chats default values returning id')).rows[0].id;
  for (const id of ids.slice(0, 2)) await db.query('insert into chat_members values ($1,$2)', [chat, id]);
  await db.exec('set role authenticated');
  await as(ids[0]);
  const messageId = '00000000-0000-4000-8000-000000000100';
  const send = (id, key = messageId) => db.query(`insert into messages(id,chat_id,author_id,body) values ($3,$1,$2,'Привет')
    on conflict(id) do nothing`, [chat, id, key]);
  await test('повтор после потерянного ответа не дублирует сообщение', async () => {
    await send(ids[0]); await send(ids[0]);
    assert.equal(await count('select count(*) n from messages'), 1);
  });
  await test('разные сообщения двух пользователей сохраняются отдельно', async () => {
    await as(ids[1]); await send(ids[1], '00000000-0000-4000-8000-000000000101');
    assert.equal(await count('select count(*) n from messages'), 2);
  });
  await test('участник чата не может переписать чужое сообщение', async () => {
    const result = await db.query('update messages set body=$1 where author_id=$2 returning *', ['Подмена', ids[0]]);
    assert.equal(result.rows.length, 0);
    assert.equal((await db.query('select body from messages where author_id=$1', [ids[0]])).rows[0].body, 'Привет');
    assert.equal((await db.query('update messages set body=$1 where author_id=$2 returning *', ['Мой текст', ids[1]])).rows.length, 1);
  });
  await test('посторонний не читает и не отправляет сообщения', async () => {
    await as(ids[2]);
    assert.equal(await count('select count(*) n from messages'), 0);
    await assert.rejects(send(ids[2]), /row-level security/);
  });
  console.log(`${checks} SQL-проверок пройдено; это изолированная схема, не проверка работающего Supabase.`);
} finally { await db.close(); }
