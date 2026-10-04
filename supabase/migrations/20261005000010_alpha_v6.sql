-- Альфа v6 (docs/ALPHA.md А0, docs/V6.md §12): кто видит, места, точки, бамп, очки и значки, голосовые и кружки,
-- робот поиска, переключатели панели. Повторяемая: if not exists / drop … if exists.

-- ——— ТРЦ и кино ———
alter table public.venues add column if not exists kind text not null default 'place';
alter table public.venues add column if not exists hours text;
alter table public.venues add column if not exists cover_url text;
alter table public.venues drop constraint if exists venues_kind_check;
alter table public.venues add constraint venues_kind_check check (kind in ('place', 'mall', 'cinema', 'park', 'bar', 'cafe'));

create table if not exists public.cinema_films (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  age text,
  poster_url text,
  duration_min int,
  source_url text,
  created_at timestamptz not null default now()
);
create table if not exists public.cinema_sessions (
  id uuid primary key default gen_random_uuid(),
  film_id uuid not null references public.cinema_films (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  starts_at timestamptz not null,
  hall text,
  format text,
  price_from int,
  buy_url text
);
create index if not exists cinema_sessions_venue_idx on public.cinema_sessions (venue_id, starts_at);
alter table public.cinema_films enable row level security;
alter table public.cinema_sessions enable row level security;
drop policy if exists cinema_films_read on public.cinema_films;
create policy cinema_films_read on public.cinema_films for select using (true);
drop policy if exists cinema_sessions_read on public.cinema_sessions;
create policy cinema_sessions_read on public.cinema_sessions for select using (true);

-- ——— Настройки профиля: любой переключатель из V6 §8.3 — пара ключ/значение ———
create table if not exists public.profile_settings (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null check (char_length(key) <= 48),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.profile_settings enable row level security;
drop policy if exists profile_settings_self on public.profile_settings;
create policy profile_settings_self on public.profile_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ——— Кто видит, где я ———
create table if not exists public.visibility (
  user_id uuid primary key references auth.users (id) on delete cascade,
  mode text not null default 'all' check (mode in ('all', 'except', 'only')),
  list uuid[] not null default '{}',
  invisible_until timestamptz,
  district_only boolean not null default false,
  statuses boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.visibility enable row level security;
drop policy if exists visibility_self on public.visibility;
create policy visibility_self on public.visibility for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Видит ли viewer точку owner: друзья, не в чёрном списке, по режиму «все / кроме / только», не невидимка.
create or replace function public.can_see_location(viewer uuid, owner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select viewer is not null and owner is not null and viewer <> owner
    and public.is_friend(viewer, owner)
    and not public.is_blocked(viewer, owner)
    and coalesce((
      select (v.invisible_until is null or v.invisible_until < now())
        and case v.mode when 'all' then true when 'except' then not (viewer = any (v.list)) else viewer = any (v.list) end
      from public.visibility v where v.user_id = owner
    ), true)
    and not coalesce((select m.invisible from public.marker_settings m where m.user_id = owner), false);
$$;
grant execute on function public.can_see_location(uuid, uuid) to authenticated;

-- ——— Мои места ———
create table if not exists public.user_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('home', 'work', 'study', 'gym', 'dacha', 'other')),
  title text,
  point extensions.geography(point, 4326) not null,
  days int[] not null default '{}',
  auto boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.user_places enable row level security;
drop policy if exists user_places_self on public.user_places;
create policy user_places_self on public.user_places for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ——— История точек (14 дней): статусы, хвост, «Где я был» ———
create table if not exists public.location_points (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now(),
  point extensions.geography(point, 4326) not null,
  speed real,
  heading real,
  accuracy real
);
create index if not exists location_points_user_idx on public.location_points (user_id, at desc);
alter table public.location_points enable row level security;
drop policy if exists location_points_self on public.location_points;
create policy location_points_self on public.location_points for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Последняя точка: владелец пишет, друзья читают по can_see_location (Realtime Postgres Changes тоже идёт через RLS).
alter table public.locations_last add column if not exists accuracy real;
alter table public.locations_last add column if not exists district text;
alter table public.locations_last add column if not exists status text;
drop policy if exists locations_friends_read on public.locations_last;
create policy locations_friends_read on public.locations_last for select using (public.can_see_location(auth.uid(), user_id));

-- Хвост: последние 4 точки друга за 10 минут.
create or replace function public.friend_trail(friend uuid)
returns table (lat double precision, lon double precision, at timestamptz)
language sql stable security definer set search_path = public, extensions as $$
  select st_y(p.point::geometry), st_x(p.point::geometry), p.at
  from public.location_points p
  where p.user_id = friend and public.can_see_location(auth.uid(), friend) and p.at > now() - interval '10 minutes'
    and not coalesce((select v.district_only from public.visibility v where v.user_id = friend), false)
  order by p.at desc limit 4;
$$;
grant execute on function public.friend_trail(uuid) to authenticated;

-- Точки друзей для карты: по can_see_location; «только район» — без координат, только район.
drop function if exists public.friend_locations();
create or replace function public.friend_locations()
returns table (user_id uuid, lat double precision, lon double precision, speed real, heading real, updated_at timestamptz, district text, status text)
language sql stable security definer set search_path = public, extensions as $$
  select l.user_id,
         case when coalesce(v.district_only, false) then null else st_y(l.geog::geometry) end,
         case when coalesce(v.district_only, false) then null else st_x(l.geog::geometry) end,
         case when coalesce(v.district_only, false) then null else l.speed end,
         l.heading, l.updated_at, l.district,
         case when coalesce(v.statuses, true) then l.status else null end
  from public.locations_last l
  left join public.visibility v on v.user_id = l.user_id
  where public.can_see_location(auth.uid(), l.user_id);
$$;
grant execute on function public.friend_locations() to authenticated;

-- ——— «Где я был» ———
create table if not exists public.explore_cells (
  user_id uuid not null references auth.users (id) on delete cascade,
  h3 text not null,
  first_at timestamptz not null default now(),
  primary key (user_id, h3)
);
alter table public.explore_cells enable row level security;
drop policy if exists explore_cells_self on public.explore_cells;
create policy explore_cells_self on public.explore_cells for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ——— Бамп ———
create table if not exists public.bumps (
  id uuid primary key default gen_random_uuid(),
  a uuid not null references auth.users (id) on delete cascade,
  b uuid references auth.users (id) on delete cascade,
  at timestamptz not null default now(),
  point extensions.geography(point, 4326)
);
create index if not exists bumps_at_idx on public.bumps (at desc);
alter table public.bumps enable row level security;
drop policy if exists bumps_read on public.bumps;
create policy bumps_read on public.bumps for select using (a = auth.uid() or b = auth.uid());

-- ——— Очки, уровень, награды, значки (начисляет только сервер) ———
create table if not exists public.points_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now(),
  kind text not null,
  points int not null,
  ref text
);
create unique index if not exists points_ledger_once on public.points_ledger (user_id, kind, ref);
alter table public.points_ledger enable row level security;
drop policy if exists points_self_read on public.points_ledger;
create policy points_self_read on public.points_ledger for select using (user_id = auth.uid());

create or replace view public.user_level with (security_invoker = true) as
  select user_id, sum(points)::int as points,
         case when sum(points) < 10000 then 1 + (sum(points) / 1000)::int else 11 + ((sum(points) - 10000) / 1500)::int end as level
  from public.points_ledger group by user_id;
grant select on public.user_level to authenticated;

create table if not exists public.rewards (
  code text primary key,
  kind text not null check (kind in ('frame', 'dot', 'trail')),
  level int not null,
  title text not null
);
create table if not exists public.user_rewards (
  user_id uuid not null references auth.users (id) on delete cascade,
  code text not null references public.rewards (code) on delete cascade,
  equipped boolean not null default false,
  primary key (user_id, code)
);
alter table public.rewards enable row level security;
alter table public.user_rewards enable row level security;
drop policy if exists rewards_read on public.rewards;
create policy rewards_read on public.rewards for select using (true);
drop policy if exists user_rewards_read on public.user_rewards;
create policy user_rewards_read on public.user_rewards for select using (user_id = auth.uid() or public.is_friend(auth.uid(), user_id));
drop policy if exists user_rewards_equip on public.user_rewards;
create policy user_rewards_equip on public.user_rewards for update using (user_id = auth.uid()) with check (user_id = auth.uid());

insert into public.rewards (code, kind, level, title) values
  ('frame-plain', 'frame', 1, 'Белая'), ('frame-sand', 'frame', 4, 'Песок'), ('frame-fire', 'frame', 8, 'Огонёк'), ('frame-night', 'frame', 12, 'Ночь'),
  ('dot-plain', 'dot', 1, 'Обычная'), ('dot-ring', 'dot', 3, 'Кольцо'), ('dot-star', 'dot', 6, 'Звезда'), ('dot-comet', 'dot', 10, 'Комета'),
  ('trail-ink', 'trail', 1, 'Чернила'), ('trail-sand', 'trail', 2, 'Песок'), ('trail-sea', 'trail', 5, 'Море'), ('trail-sunset', 'trail', 7, 'Закат'), ('trail-mountain', 'trail', 9, 'Горы')
on conflict (code) do nothing;

-- Значки альфы (V6 §8.6, ALPHA А6).
insert into public.badges (id, name, goal, how) values
  ('first-bump', 'Первый бамп', 1, 'Стукнись телефонами с другом'),
  ('call-friend', 'Позови друга', 1, 'Позови друга на событие, и он скажет «Иду»'),
  ('night-city', 'Ночь в городе', 1, 'Сходи на событие после 22:00'),
  ('walker', 'Пешеход', 10, 'Пройди 10 км пешком по дороге на события')
on conflict (id) do nothing;

-- Начислить очки и продвинуть значок (только сервер: security definer, вызывают функции и триггеры).
create or replace function public.award(who uuid, what text, pts int, refkey text, badge text default null, step int default 1)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.points_ledger (user_id, kind, points, ref) values (who, what, pts, refkey) on conflict do nothing;
  if badge is not null then
    insert into public.user_badges (user_id, badge_id, progress) values (who, badge, step)
    on conflict (user_id, badge_id) do update set progress = public.user_badges.progress + excluded.progress;
    update public.user_badges ub set got_at = now()
      from public.badges b where ub.user_id = who and ub.badge_id = badge and b.id = badge and ub.got_at is null and ub.progress >= b.goal;
  end if;
end $$;
revoke execute on function public.award(uuid, text, int, text, text, int) from public, anon, authenticated;

-- Новая дружба: +20 обоим.
create or replace function public.on_friendship_points() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.award(new.a, 'friend', 20, new.b::text);
  perform public.award(new.b, 'friend', 20, new.a::text);
  return new;
end $$;
drop trigger if exists friendship_points on public.friendships;
create trigger friendship_points after insert on public.friendships for each row execute function public.on_friendship_points();

-- ——— Сообщения: голосовые и кружки ———
alter table public.messages add column if not exists media_url text;
alter table public.messages add column if not exists duration_ms int;
alter table public.messages add column if not exists waveform smallint[];
alter table public.messages add column if not exists reply_to uuid references public.messages (id) on delete set null;
alter table public.messages add column if not exists deleted_for uuid[] not null default '{}';
alter table public.messages add column if not exists event_id uuid references public.events (id) on delete set null;
drop policy if exists messages_update_own on public.messages;
create policy messages_update_own on public.messages for update using (public.is_chat_member(chat_id)) with check (public.is_chat_member(chat_id));

-- ——— Робот поиска и панель разработчика (только staff) ———
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff s where s.user_id = auth.uid());
$$;
grant execute on function public.is_staff() to authenticated;

create table if not exists public.robot_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed', 'cancelled')),
  params jsonb not null default '{}',
  found int not null default 0,
  verified int not null default 0,
  queued int not null default 0,
  tokens int not null default 0,
  cancel boolean not null default false,
  started_by uuid references auth.users (id) on delete set null
);
create table if not exists public.robot_log (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.robot_runs (id) on delete cascade,
  at timestamptz not null default now(),
  level text not null default 'info' check (level in ('info', 'ok', 'warn', 'error')),
  text text not null
);
create index if not exists robot_log_run_idx on public.robot_log (run_id, at);
create table if not exists public.robot_schedule (
  task text primary key check (task in ('search', 'covers')),
  repeat text not null default 'daily' check (repeat in ('daily', 'weekly', 'hours')),
  days int[] not null default '{1,2,3,4,5,6,0}',
  time text not null default '09:00',
  every_hours int,
  paused boolean not null default true,
  last_run_at timestamptz
);
create table if not exists public.search_topics (
  id text primary key,
  title text not null,
  prompt text not null,
  enabled boolean not null default true
);
create table if not exists public.app_flags (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.robot_runs enable row level security;
alter table public.robot_log enable row level security;
alter table public.robot_schedule enable row level security;
alter table public.search_topics enable row level security;
alter table public.app_flags enable row level security;
drop policy if exists robot_runs_staff on public.robot_runs;
create policy robot_runs_staff on public.robot_runs for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists robot_log_staff on public.robot_log;
create policy robot_log_staff on public.robot_log for select using (public.is_staff());
drop policy if exists robot_schedule_staff on public.robot_schedule;
create policy robot_schedule_staff on public.robot_schedule for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists search_topics_staff on public.search_topics;
create policy search_topics_staff on public.search_topics for all using (public.is_staff()) with check (public.is_staff());
-- Флаги читают все (например, «alpha_login»), меняет только команда.
drop policy if exists app_flags_read on public.app_flags;
create policy app_flags_read on public.app_flags for select using (true);
drop policy if exists app_flags_staff on public.app_flags;
create policy app_flags_staff on public.app_flags for all using (public.is_staff()) with check (public.is_staff());

insert into public.app_flags (key, value) values
  ('alpha_login', 'true'), ('robot_paused', 'true'), ('covers_paused', 'true'), ('auto_publish', 'false')
on conflict (key) do nothing;
insert into public.robot_schedule (task, repeat, time, paused) values ('search', 'daily', '09:00', true), ('covers', 'daily', '10:00', true)
on conflict (task) do nothing;
insert into public.search_topics (id, title, prompt) values
  ('concerts', 'Концерты', 'концерты и живая музыка в Алматы'),
  ('standup', 'Стендап', 'стендап, открытые микрофоны, импровизация в Алматы'),
  ('art', 'Выставки', 'выставки, музеи, галереи в Алматы'),
  ('outdoor', 'Горы и город', 'походы, прогулки, городские события на улице в Алматы'),
  ('games', 'Настолки и квизы', 'настольные игры, квизы, мафия в Алматы'),
  ('food', 'Еда и маркеты', 'маркеты, фестивали еды, ярмарки в Алматы')
on conflict (id) do nothing;

-- Модерация из панели: staff видит и меняет черновики событий.
drop policy if exists events_staff_all on public.events;
create policy events_staff_all on public.events for all using (public.is_staff()) with check (public.is_staff());

-- ——— Хранилища: голосовые, кружки, обложки, аватарки ———
insert into storage.buckets (id, name, public) values
  ('voice', 'voice', false), ('circles', 'circles', false), ('covers', 'covers', true), ('avatars', 'avatars', true)
on conflict (id) do nothing;
-- Голосовые и кружки: путь «<chat_id>/<файл>», читать и писать — участникам чата.
drop policy if exists chat_media_read on storage.objects;
create policy chat_media_read on storage.objects for select to authenticated using (
  bucket_id in ('voice', 'circles') and public.is_chat_member((storage.foldername(name))[1]::uuid)
);
drop policy if exists chat_media_write on storage.objects;
create policy chat_media_write on storage.objects for insert to authenticated with check (
  bucket_id in ('voice', 'circles') and public.is_chat_member((storage.foldername(name))[1]::uuid)
);
-- Аватарки: путь «<user_id>/…», пишет только владелец.
drop policy if exists avatars_write on storage.objects;
create policy avatars_write on storage.objects for insert to authenticated with check (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects for update to authenticated using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);

-- ——— Realtime ———
do $$ begin alter publication supabase_realtime add table public.locations_last; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.robot_log; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.robot_runs; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.invites; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.events; exception when duplicate_object then null; end $$;

-- Broadcast каналов v6: «locations:<user>» — читать по can_see_location, «chat:<id>» — участникам («печатает…»),
-- «robot:<run>» — команде.
drop policy if exists v6_broadcast_write on realtime.messages;
create policy v6_broadcast_write on realtime.messages for insert to authenticated with check (
  realtime.topic() = 'locations:' || auth.uid()::text
  or (realtime.topic() like 'chat:%' and public.is_chat_member(substr(realtime.topic(), 6)::uuid))
);
drop policy if exists v6_broadcast_read on realtime.messages;
create policy v6_broadcast_read on realtime.messages for select to authenticated using (
  (realtime.topic() like 'locations:%' and public.can_see_location(auth.uid(), substr(realtime.topic(), 11)::uuid))
  or (realtime.topic() like 'chat:%' and public.is_chat_member(substr(realtime.topic(), 6)::uuid))
  or (realtime.topic() like 'robot:%' and public.is_staff())
);

-- ——— Уборка: история точек 14 дней ———
select cron.unschedule(jobname) from cron.job where jobname = 'location-points-retention';
select cron.schedule('location-points-retention', '40 23 * * *', $$delete from public.location_points where at < now() - interval '14 days'$$);
