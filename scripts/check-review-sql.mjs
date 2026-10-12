// Проверка миграции 24 на локальном PostgreSQL: доступ к планам и права переименования.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const uid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const sqlFile = (name) => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
try {
  await db.exec(`
    create role authenticated; create role anon;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    create table public.staff(user_id uuid primary key);
    create function public.is_staff() returns boolean language sql stable security definer set search_path=public as $$
      select exists(select 1 from public.staff s where s.user_id=auth.uid());
    $$;
    create domain public.geometry as text;
    create function public.st_x(public.geometry) returns double precision language sql immutable strict as $$ select split_part($1::text,',',1)::double precision; $$;
    create function public.st_y(public.geometry) returns double precision language sql immutable strict as $$ select split_part($1::text,',',2)::double precision; $$;
    create table public.venues(id uuid primary key, name text, kind text, address text, geog text, needs_pin boolean);
    create table public.events(
      id uuid primary key, external_id text, title text, category text, tags text[], starts_at timestamptz, ends_at timestamptz,
      is_long boolean, venue_id uuid, address text, address_note text, price_min integer, price_max integer, is_free boolean,
      about text, organizer text, cover_url text, source_url text, visibility text, status text, rejected boolean default false,
      created_by uuid, published_at timestamptz, updated_at timestamptz
    );
    create table public.attendance(user_id uuid, event_id uuid, status text, primary key(user_id,event_id));
    alter table public.events enable row level security;
    alter table public.attendance enable row level security;
    create policy attendance_self on public.attendance for select using(user_id=auth.uid());
    create policy events_published on public.events for select using((status='published' and visibility='public') or public.is_staff());
    create policy events_private on public.events for select using(visibility='friends' and created_by=auth.uid());
    create schema storage; create table storage.objects(bucket_id text);
    grant usage on schema public,auth to authenticated,anon;
    grant select on public.events,public.attendance,public.venues to authenticated;
    insert into public.staff values('${uid(1)}');
    insert into public.events(id,title,status,visibility,created_by) values
      ('${uid(11)}','Концерт','published','public',null),
      ('${uid(12)}','Удалённый концерт','archived','public',null),
      ('${uid(13)}','Снят с карты','draft','public',null),
      ('${uid(14)}','Частная встреча','published','friends','${uid(4)}'),
      ('${uid(15)}','Хроника','archived','public',null),
      ('${uid(16)}','Чужой план','archived','public',null);
    insert into public.attendance values
      ('${uid(2)}','${uid(12)}','going'),('${uid(2)}','${uid(13)}','going'),
      ('${uid(2)}','${uid(15)}','arrived'),('${uid(3)}','${uid(16)}','going');
  `);
  // Именно существующая политика доступа к архиву, а не её замена в тесте.
  const pipeline = await sqlFile('20260928000004_pipeline.sql');
  const begin = pipeline.indexOf('drop policy if exists events_attended_read');
  const end = pipeline.indexOf('-- Хроника профиля', begin);
  assert(begin >= 0 && end > begin);
  await db.exec(pipeline.slice(begin, end));
  await db.exec(await sqlFile('20261012000022_admin_events_manage.sql'));
  await db.exec(await sqlFile('20261012000024_review_fixes.sql'));
  const user = async (n) => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid(n)]);
    await db.exec('set role authenticated');
  };
  await user(2);
  const plans = await db.query('select id,status from events_for_plans order by id');
  assert.deepEqual(plans.rows.map((r) => r.id), [11,12,13,15].map(uid));
  assert.equal(plans.rows.find((r) => r.id === uid(12)).status, 'archived');
  await assert.rejects(db.query('select staff_rename_event($1,$2)', [uid(11),'Новое имя']), /staff-only/);
  await user(3);
  assert.equal((await db.query('select * from events_for_plans where id=$1', [uid(12)])).rows.length, 0);
  assert.equal((await db.query('select * from events_for_plans where id=$1', [uid(14)])).rows.length, 0);
  await user(1);
  await assert.rejects(db.query('select staff_rename_event($1,$2)', [uid(14),'Новое имя']), /public-event-not-found/);
  assert.equal((await db.query('select title from events where id=$1', [uid(14)])).rows[0].title, 'Частная встреча');
  await assert.rejects(db.query('select staff_rename_event($1,$2)', [uid(11),'а']), /bad-title/);
  await db.query('select staff_rename_event($1,$2)', [uid(11),'  Новое имя  ']);
  assert.deepEqual((await db.query('select title,orig_title from events where id=$1', [uid(11)])).rows[0], { title: 'Новое имя', orig_title: 'Концерт' });
  await db.exec('reset role; set role anon');
  await assert.rejects(db.query('select * from events_for_plans'), /permission denied/);
  await db.exec('reset role');
  await db.exec(`create table public.sources(kind text,handle text,title text,trusted boolean,auto_publish boolean,enabled boolean,unique(kind,handle));`);
  const cinema = await sqlFile('20261012000025_cinema_sources.sql');
  await db.exec(cinema); await db.exec(cinema);
  const sources = await db.query('select * from public.sources');
  assert.equal(sources.rows.length, 7);
  assert(sources.rows.every(s => !s.enabled && !s.trusted && !s.auto_publish));
  await db.exec(`create table public.chat_members(chat_id uuid,user_id uuid,last_read_at timestamptz,primary key(chat_id,user_id)); alter table public.chat_members enable row level security; create policy member_self on public.chat_members for all using(user_id=auth.uid()) with check(user_id=auth.uid()); grant select,update on public.chat_members to authenticated; insert into public.chat_members values('${uid(50)}','${uid(2)}',null),('${uid(50)}','${uid(3)}',null);`);
  await db.exec(await sqlFile('20261012000026_chat_read.sql'));
  await user(2);
  await db.query('select mark_chat_read($1,$2)', [uid(50),'2026-10-10T10:00:00Z']);
  await db.query('select mark_chat_read($1,$2)', [uid(50),'2026-10-09T10:00:00Z']);
  const read = await db.query('select last_read_at from public.chat_members');
  assert.equal(new Date(read.rows[0].last_read_at).toISOString(), '2026-10-10T10:00:00.000Z');
  await assert.rejects(db.query('select mark_chat_read($1,$2)', [uid(51),'2026-10-10T10:00:00Z']), /chat-not-found/);
  await assert.rejects(db.query('update chat_members set chat_id=$1', [uid(51)]), /permission denied/);
  await db.exec('reset role');
  const otherRead = await db.query('select last_read_at from chat_members where user_id=$1', [uid(3)]);
  assert.equal(otherRead.rows[0].last_read_at, null);
  console.log('SQL: планы участника сохранены, чужие планы и частные встречи закрыты, права переименования проверены.');
} finally { await db.close(); }
