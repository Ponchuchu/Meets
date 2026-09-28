-- Этап 9: как события попадают на карту (docs/PIPELINE.md). Источники, сырые посты, черновики,
-- предложения пользователей, модерация, отмены и архив.

-- ——— Источники: команда добавляет один раз ———
create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('telegram', 'site', 'threads', 'manual', 'user')),
  handle text not null,             -- «afisha_almaty», ссылка на раздел
  title text not null,              -- «Telegram · @afisha_almaty»
  note text,                        -- «канал читается целиком»
  trusted boolean not null default false,
  auto_publish boolean not null default false, -- публиковать сразу при уверенности 95%+
  enabled boolean not null default true,
  cursor text,                      -- последний прочитанный пост
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  unique (kind, handle)
);
alter table public.sources enable row level security;
drop policy if exists sources_staff on public.sources;
create policy sources_staff on public.sources for all using (public.is_staff()) with check (public.is_staff());

-- ——— Сырые посты: краткая выжимка и ссылка, картинки — только адреса ———
create table if not exists public.raw_posts (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.sources (id) on delete cascade,
  external_id text not null,
  url text,
  text text,
  images text[] not null default '{}',
  posted_at timestamptz,
  class text check (class in ('event', 'ad', 'meme', 'not_almaty', 'duplicate', 'cancel')),
  event_id uuid references public.events (id) on delete set null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (source_id, external_id)
);
alter table public.raw_posts enable row level security;
drop policy if exists raw_posts_staff on public.raw_posts;
create policy raw_posts_staff on public.raw_posts for select using (public.is_staff());

-- ——— Черновики: поля модерации в events ———
alter table public.events add column if not exists source_id uuid references public.sources (id) on delete set null;
alter table public.events add column if not exists ai_confidence real;
alter table public.events add column if not exists flags text[] not null default '{}'; -- needs_pin, check_price
alter table public.events add column if not exists suggested_by uuid references auth.users (id) on delete set null;
alter table public.events add column if not exists published_at timestamptz;
alter table public.events add column if not exists cancelled_at timestamptz;
alter table public.events add column if not exists rejected boolean not null default false;
create index if not exists events_queue_idx on public.events (status, created_at) where status = 'draft' and not rejected;

-- ——— Предложения пользователей: в ту же очередь, статус draft ———
create or replace function public.suggest_event(
  p_title text, p_category text, p_starts_at timestamptz, p_ends_at timestamptz,
  p_place text, p_price text, p_about text, p_source_url text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  src uuid;
  ev uuid;
  today int;
begin
  if me is null then raise exception 'auth-required'; end if;
  select count(*) into today from events where suggested_by = me and created_at > now() - interval '1 day';
  if today >= 5 then raise exception 'too-many-suggestions'; end if;
  insert into sources (kind, handle, title) values ('user', 'app', 'Предложил пользователь')
    on conflict (kind, handle) do update set title = excluded.title returning id into src;
  insert into events (title, category, starts_at, ends_at, address, about, source_url, status, source_id, suggested_by, flags, is_free, created_by)
  values (
    left(p_title, 120), p_category, p_starts_at, p_ends_at, left(p_place, 200), left(p_about, 1000), p_source_url, 'draft', src, me,
    array['needs_pin'] || case when p_price is not null and p_price !~* '^\s*(бесплатно|0)\s*$' then array['check_price'] else '{}'::text[] end,
    p_price is null or p_price ~* '^\s*(бесплатно|0)\s*$', me
  ) returning id into ev;
  return ev;
end;
$$;
grant execute on function public.suggest_event(text, text, timestamptz, timestamptz, text, text, text, text) to authenticated;

-- ——— Модерация: одно действие — одна функция, только команда ———
create or replace function public.moderate_event(ev uuid, action text, lat double precision default null, lon double precision default null)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v uuid;
begin
  if not public.is_staff() then raise exception 'staff-only'; end if;
  if action = 'publish' then
    update events set status = 'published', published_at = now(), updated_at = now() where id = ev;
  elsif action = 'reject' then
    update events set rejected = true, updated_at = now() where id = ev;
  elsif action = 'pin' then
    if lat is null or lon is null then raise exception 'pin-needs-point'; end if;
    select venue_id into v from events where id = ev;
    if v is null then
      insert into venues (name, address, geog)
      select coalesce(nullif(e.address, ''), e.title) || ' · ' || left(e.id::text, 6), e.address, st_setsrid(st_makepoint(lon, lat), 4326)::geography
      from events e where e.id = ev
      returning id into v;
      update events set venue_id = v where id = ev;
    else
      update venues set geog = st_setsrid(st_makepoint(lon, lat), 4326)::geography, needs_pin = false where id = v;
    end if;
    update events set flags = array_remove(flags, 'needs_pin'), updated_at = now() where id = ev;
  elsif action = 'cancel' then
    update events set status = 'cancelled', cancelled_at = now(), updated_at = now() where id = ev;
    perform public.call_function('notify', jsonb_build_object('type', 'cancelled', 'event_id', ev));
  else
    raise exception 'unknown-action';
  end if;
end;
$$;
grant execute on function public.moderate_event(uuid, text, double precision, double precision) to authenticated;

-- Счётчики для шапки админки: ждут, на карте, отсеял ИИ (за 7 дней).
create or replace function public.moderation_stats()
returns table (waiting bigint, on_map bigint, filtered bigint, last_run timestamptz)
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from events where status = 'draft' and not rejected),
    (select count(*) from events where status = 'published' and coalesce(ends_at, starts_at + interval '3 hours') > now()),
    (select count(*) from raw_posts where class in ('ad', 'meme', 'not_almaty', 'duplicate') and created_at > now() - interval '7 days'),
    (select max(last_run_at) from sources)
  where public.is_staff();
$$;
grant execute on function public.moderation_stats() to authenticated;

-- ——— Архив и хроника ———
-- Закончившиеся события уходят в архив через 48 часов (чат события живёт столько же).
create or replace function public.archive_finished() returns int
language sql security definer set search_path = public as $$
  with done as (
    update events set status = 'archived', updated_at = now()
    where status = 'published' and coalesce(ends_at, starts_at + interval '3 hours') < now() - interval '48 hours'
    returning 1
  )
  select count(*)::int from done;
$$;
revoke execute on function public.archive_finished() from public, anon, authenticated;

-- Кто отметился на событии, видит его и в архиве, и после отмены — для хроники профиля.
drop policy if exists events_attended_read on public.events;
create policy events_attended_read on public.events for select using (
  exists (select 1 from public.attendance a where a.event_id = id and a.user_id = auth.uid() and a.status in ('going', 'arrived'))
);

-- Хроника профиля: где я отметился «Я на месте».
create or replace view public.my_timeline with (security_invoker = true) as
select e.id as event_id, e.title, e.category, e.starts_at, a.at as arrived_at, v.name as venue_name
from public.attendance a
join public.events e on e.id = a.event_id
left join public.venues v on v.id = e.venue_id
where a.user_id = auth.uid() and a.status = 'arrived';
grant select on public.my_timeline to authenticated;

-- ——— Для админки «Рекомендации»: вкус и сигналы человека видит только команда ———
drop policy if exists signals_staff_read on public.signals;
create policy signals_staff_read on public.signals for select using (public.is_staff());
drop policy if exists start_answers_staff_read on public.start_answers;
create policy start_answers_staff_read on public.start_answers for select using (public.is_staff());
drop policy if exists taste_staff_write on public.taste;
create policy taste_staff_write on public.taste for delete using (public.is_staff());

-- ——— Расписание: архив раз в сутки (04:10 по Алматы) ———
select cron.unschedule(jobname) from cron.job where jobname = 'archive-finished';
select cron.schedule('archive-finished', '10 23 * * *', $$select public.archive_finished()$$);

-- Стартовые источники из макета (выключены, пока нет юридической проверки — см. TECH.md «Источники»).
insert into public.sources (kind, handle, title, note, trusted, enabled) values
  ('telegram', 'afisha_almaty', 'Telegram · @afisha_almaty', 'канал читается целиком', false, false),
  ('site', 'afisha.yandex.kz/almaty', 'Яндекс Афиша · Алматы', 'ссылка на раздел города', true, false),
  ('threads', 'almaty.weekend', 'Threads · @almaty.weekend', 'посты и картинки-афиши', false, false),
  ('manual', 'admin', 'Добавлено вручную', null, true, true)
on conflict (kind, handle) do nothing;

-- Пуш команде после сбора: «7 событий ждут проверки». Зовёт воркер (ключ service role).
create or replace function public.notify_staff() returns void
language plpgsql security definer set search_path = public as $$
declare n bigint;
begin
  select count(*) into n from events where status = 'draft' and not rejected;
  if n > 0 then perform public.call_function('notify', jsonb_build_object('type', 'staff', 'count', n)); end if;
end;
$$;
revoke execute on function public.notify_staff() from public, anon, authenticated;
grant execute on function public.notify_staff() to service_role;

-- Площадки с координатами плоскими полями — для воркера (поиск по алиасам) и админки.
create or replace view public.venues_points with (security_invoker = true) as
select id, name, aliases, address, needs_pin,
       extensions.st_y(geog::extensions.geometry) as lat, extensions.st_x(geog::extensions.geometry) as lon
from public.venues;
grant select on public.venues_points to anon, authenticated;

-- Отмена от сборщика: источник с доверием — сразу и с пушем тем, кто собирался; иначе — флаг модератору.
create or replace function public.worker_cancel(ev uuid, sure boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if sure then
    update events set status = 'cancelled', cancelled_at = now(), updated_at = now() where id = ev and status = 'published';
    if found then perform public.call_function('notify', jsonb_build_object('type', 'cancelled', 'event_id', ev)); end if;
  else
    update events set flags = array_append(array_remove(flags, 'cancel_reported'), 'cancel_reported'), updated_at = now() where id = ev;
  end if;
end;
$$;
revoke execute on function public.worker_cancel(uuid, boolean) from public, anon, authenticated;
grant execute on function public.worker_cancel(uuid, boolean) to service_role;
