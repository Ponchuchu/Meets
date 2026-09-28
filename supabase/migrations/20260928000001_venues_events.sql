-- Этап 0: площадки и события. PostGIS, RLS: читать опубликованное может любой, писать — только команда.
create extension if not exists postgis with schema extensions;

-- Команда (модераторы, админы). Заполняется вручную из дашборда.
create table if not exists public.staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'moderator' check (role in ('moderator', 'admin')),
  created_at timestamptz not null default now()
);
alter table public.staff enable row level security;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid());
$$;

drop policy if exists staff_self_read on public.staff;
create policy staff_self_read on public.staff for select using (user_id = auth.uid());

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  aliases text[] not null default '{}',
  address text,
  district text,
  geog extensions.geography(point, 4326),
  needs_pin boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists venues_geog_idx on public.venues using gist (geog);
alter table public.venues enable row level security;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  title text not null,
  category text not null,
  tags text[] not null default '{}',
  starts_at timestamptz not null,
  ends_at timestamptz,
  is_long boolean not null default false,
  venue_id uuid references public.venues (id) on delete set null,
  address text,
  address_note text,
  price_min integer,
  price_max integer,
  is_free boolean not null default false,
  about text,
  organizer text,
  cover_url text,
  source_url text,
  confidence text,
  status text not null default 'draft' check (status in ('draft', 'published', 'cancelled', 'archived')),
  visibility text not null default 'public' check (visibility in ('public', 'friends')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists events_starts_idx on public.events (starts_at);
create index if not exists events_status_idx on public.events (status);
alter table public.events enable row level security;

-- Чтение: опубликованные публичные события — всем (включая анонимов); команде — всё.
drop policy if exists events_read_published on public.events;
create policy events_read_published on public.events for select
  using ((status = 'published' and visibility = 'public') or public.is_staff());
drop policy if exists events_staff_write on public.events;
create policy events_staff_write on public.events for all
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists venues_read on public.venues;
create policy venues_read on public.venues for select using (true);
drop policy if exists venues_staff_write on public.venues;
create policy venues_staff_write on public.venues for all
  using (public.is_staff()) with check (public.is_staff());

-- Лента для клиента: событие + координаты площадки плоскими полями.
create or replace view public.events_feed with (security_invoker = true) as
select e.id, e.external_id, e.title, e.category, e.tags, e.starts_at, e.ends_at, e.is_long,
       v.name as venue_name, coalesce(e.address, v.address) as address, e.address_note,
       extensions.st_y(v.geog::extensions.geometry) as lat, extensions.st_x(v.geog::extensions.geometry) as lon,
       coalesce(v.needs_pin, true) as needs_pin,
       e.price_min, e.price_max, e.is_free, e.about, e.organizer, e.cover_url, e.source_url, e.visibility
from public.events e
left join public.venues v on v.id = e.venue_id;

grant select on public.events_feed to anon, authenticated;
