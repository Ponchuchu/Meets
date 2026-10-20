// Контракт рамок на PostgreSQL WASM: реальные constraint/trigger, сокращённая схема уровней.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
try {
  await db.exec(`
    create table public.user_level(user_id uuid primary key, level integer);
    create table public.profiles(id uuid primary key, map_frame text not null default 'classic'
      check (map_frame in ('classic','sunset','forest','violet')), map_trail text not null default 'dots');
    insert into profiles values ('00000000-0000-4000-8000-000000000001','forest','dots');
  `);
  const sql = await readFile(new URL('../supabase/migrations/20261020000029_illustrated_frames.sql', import.meta.url), 'utf8');
  await db.exec(sql);
  await db.exec(sql);
  const id = '00000000-0000-4000-8000-000000000001';
  assert.equal((await db.query('select map_frame from profiles where id=$1', [id])).rows[0].map_frame, 'forest');
  let checks = 1;
  const frames = { classic: 1, sunset: 2, forest: 3, violet: 7, 'almaty-apples': 1, tulips: 1, alatau: 2, dusk: 3, 'starry-night': 5, ornament: 7 };
  for (const [frame, level] of Object.entries(frames)) {
    await db.query('insert into user_level values ($1,$2) on conflict (user_id) do update set level=excluded.level', [id, Math.max(1, level - 1)]);
    await db.query("update profiles set map_frame='classic' where id=$1", [id]);
    if (level > 1) {
      await assert.rejects(db.query('update profiles set map_frame=$1 where id=$2', [frame, id]), /frame-locked/);
      assert.equal((await db.query('select map_frame from profiles where id=$1', [id])).rows[0].map_frame, 'classic');
      checks++;
    }
    await db.query('update user_level set level=$1 where user_id=$2', [level, id]);
    await db.query('update profiles set map_frame=$1 where id=$2', [frame, id]);
    assert.equal((await db.query('select map_frame from profiles where id=$1', [id])).rows[0].map_frame, frame);
    checks++;
  }
  await db.query('update user_level set level=1 where user_id=$1', [id]);
  await db.query("update profiles set map_frame='tulips' where id=$1", [id]);
  await assert.rejects(db.query("update profiles set map_trail='comet' where id=$1", [id]), /frame-locked/); checks++;
  await assert.rejects(db.query("update profiles set map_frame='unknown' where id=$1", [id]), /profiles_map_frame_check/); checks++;
  await assert.rejects(db.query("insert into profiles(id,map_frame) values ('00000000-0000-4000-8000-000000000002','ornament')"), /frame-locked/); checks++;
  await db.query("insert into profiles(id,map_frame) values ('00000000-0000-4000-8000-000000000003','almaty-apples')"); checks++;
  // FIX3: рамки по таблице frame_levels, новые формы, ошибки клиента.
  await db.exec(`
    create schema if not exists auth; create table if not exists auth.users(id uuid primary key);
    create or replace function auth.uid() returns uuid language sql as $$ select null::uuid $$;
    create or replace function public.is_staff() returns boolean language sql as $$ select false $$;
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    do $$ begin create role anon; exception when duplicate_object then null; end $$;
  `);
  const fix3 = await readFile(new URL('../supabase/migrations/20261020000030_fix3_backend.sql', import.meta.url), 'utf8');
  await db.exec(fix3);
  await db.exec(fix3);
  await db.query('update user_level set level=1 where user_id=$1', [id]);
  await db.query("update profiles set map_frame='bubble' where id=$1", [id]); checks++;
  await assert.rejects(db.query("update profiles set map_frame='tesla' where id=$1", [id]), /frame-locked/); checks++;
  await assert.rejects(db.query("update profiles set map_frame='nope-frame' where id=$1", [id]), /frame-unknown/); checks++;
  await assert.rejects(db.query("update profiles set map_frame='Bad Frame!' where id=$1", [id]), /frame-unknown|profiles_map_frame_check/); checks++;
  await db.query('update user_level set level=5 where user_id=$1', [id]);
  await db.query("update profiles set map_frame='tesla' where id=$1", [id]); checks++;
  await db.query("insert into client_errors(message, fatal) values ('test', true)"); checks++;
  console.log(`✓ ${checks} SQL-проверки рамок: повтор миграции, старый выбор, уровни, INSERT, неизвестный id, след.`);
} finally { await db.close(); }
