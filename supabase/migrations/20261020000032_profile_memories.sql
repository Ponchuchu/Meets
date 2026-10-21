-- FIX3 Ф8–Ф10: значки у имени, «Воспоминания» (альбомы прошедших событий со своими фото), ночёвки и «Мои места» сами.
-- Приватность (PRODUCT.md «Кто что видит»): воспоминания и ночёвки по умолчанию видишь только ты; друзьям — если включил.
-- Точные точки ночёвок никому не отдаются: только имя друга-хозяина, район и дата.
begin;

-- ——— Значки рядом с именем (до трёх из полученных) ———
alter table public.profiles add column if not exists shown_badges text[] not null default '{}';
alter table public.profiles drop constraint if exists profiles_shown_badges_max;
alter table public.profiles add constraint profiles_shown_badges_max check (cardinality(shown_badges) <= 3);
alter table public.profiles add column if not exists memories_visible boolean not null default false;
alter table public.profiles add column if not exists sleepovers_visible boolean not null default false;

create or replace function public.check_shown_badges() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.shown_badges is not distinct from old.shown_badges then return new; end if;
  if exists (select 1 from unnest(new.shown_badges) b
             where not exists (select 1 from public.user_badges u where u.user_id = new.id and u.badge_id = b and u.got_at is not null)
               and b not like 'steps-%') then
    raise exception 'badge-not-earned';
  end if;
  return new;
end $$;
drop trigger if exists check_shown_badges on public.profiles;
create trigger check_shown_badges before update of shown_badges on public.profiles for each row execute function public.check_shown_badges();

-- ——— Воспоминания ———
create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  event_id uuid references public.events(id) on delete set null,
  title text not null check (length(title) between 1 and 120),
  note text check (length(note) <= 1000),
  happened_at timestamptz not null default now(),
  cover_path text,
  created_at timestamptz not null default now(),
  unique (user_id, event_id)
);
create index if not exists memories_user on public.memories(user_id, happened_at desc);
create table if not exists public.memory_photos (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  path text not null check (length(path) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists memory_photos_memory on public.memory_photos(memory_id, created_at);

create or replace function public.can_see_memories(owner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select owner = auth.uid() or (public.is_friend(auth.uid(), owner) and not public.is_blocked(auth.uid(), owner)
    and coalesce((select memories_visible from public.profiles where id = owner), false));
$$;

alter table public.memories enable row level security;
alter table public.memory_photos enable row level security;
drop policy if exists memories_read on public.memories;
create policy memories_read on public.memories for select to authenticated using (public.can_see_memories(user_id));
drop policy if exists memories_write on public.memories;
create policy memories_write on public.memories for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists memory_photos_read on public.memory_photos;
create policy memory_photos_read on public.memory_photos for select to authenticated using (public.can_see_memories(user_id));
drop policy if exists memory_photos_write on public.memory_photos;
create policy memory_photos_write on public.memory_photos for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.memories m where m.id = memory_id and m.user_id = auth.uid()));
grant select, insert, update, delete on public.memories, public.memory_photos to authenticated;

-- Фото воспоминаний: закрытый бакет, путь <user_id>/<memory_id>/<файл>; читать — тем, кому видны воспоминания владельца.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('memories', 'memories', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
  on conflict (id) do nothing;
drop policy if exists memories_obj_read on storage.objects;
create policy memories_obj_read on storage.objects for select to authenticated
  using (bucket_id = 'memories' and public.can_see_memories(((storage.foldername(name))[1])::uuid));
drop policy if exists memories_obj_write on storage.objects;
create policy memories_obj_write on storage.objects for insert to authenticated
  with check (bucket_id = 'memories' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists memories_obj_delete on storage.objects;
create policy memories_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'memories' and (storage.foldername(name))[1] = auth.uid()::text);

-- Прошедшие события, где я был («пойду» или «я на месте») — основа альбомов. Уже созданные альбомы помечены.
create or replace function public.my_past_events(lim int default 60)
returns table (event_id uuid, title text, category text, starts_at timestamptz, venue_name text, cover_url text, arrived boolean, memory_id uuid)
language sql stable security invoker set search_path = public as $$
  select e.id, e.title, e.category, coalesce(a.visit_at, e.starts_at), v.name, e.cover_url, a.status = 'arrived', m.id
  from public.attendance a
  join public.events e on e.id = a.event_id
  left join public.venues v on v.id = e.venue_id
  left join public.memories m on m.event_id = e.id and m.user_id = auth.uid()
  where a.user_id = auth.uid() and a.status in ('going', 'arrived')
    and coalesce(e.ends_at, e.starts_at + interval '3 hours') < now()
  order by 4 desc limit least(greatest(lim, 1), 200)
$$;
grant execute on function public.my_past_events(int) to authenticated;

-- ——— Ночёвки ———
create table if not exists public.sleepovers (
  user_id uuid not null references auth.users(id) on delete cascade,
  night date not null,
  host_id uuid references auth.users(id) on delete set null,
  area text,
  cell text not null,
  primary key (user_id, night)
);
alter table public.sleepovers enable row level security;
drop policy if exists sleepovers_read on public.sleepovers;
create policy sleepovers_read on public.sleepovers for select to authenticated using (
  user_id = auth.uid() or (public.is_friend(auth.uid(), user_id) and coalesce((select sleepovers_visible from public.profiles where id = user_id), false)));
drop policy if exists sleepovers_delete on public.sleepovers;
create policy sleepovers_delete on public.sleepovers for delete to authenticated using (user_id = auth.uid());
grant select, delete on public.sleepovers to authenticated;

-- «Мои места» сами и ночёвки — по своим точкам за 3 недели (только свои, только для себя).
-- Дом: ночью (00–06 по Алматы) чаще всего здесь, минимум 3 ночи. Работа/учёба: будни 09–17, минимум 3 дня, не дома;
-- учёба — если обычно уходишь до 15:00. Ночёвка: ночь ≥ 2 часов не дома (дальше 400 м). Ручные места не трогаем.
create or replace function public.learn_my_places() returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me uuid := auth.uid(); home_cell text; home_pt geography; manual_home geography; day_cell text; day_pt geography; leave_h numeric;
  added int := 0; nights int := 0;
begin
  if me is null then raise exception 'auth'; end if;
  create temp table if not exists _pts (at timestamptz, lt timestamp, g geography, cell text) on commit drop;
  truncate _pts;
  insert into _pts select p.at, p.at at time zone 'Asia/Almaty', p.point,
      (round(st_y(p.point::geometry) / 0.0015))::text || ':' || (round(st_x(p.point::geometry) / 0.002))::text
    from public.location_points p where p.user_id = me and p.at > now() - interval '21 days' and p.point is not null;

  select point into manual_home from public.user_places where user_id = me and kind = 'home' order by auto, created_at limit 1;
  select cell, st_centroid(st_collect(g::geometry))::geography into home_cell, home_pt from _pts
    where extract(hour from lt) < 6 group by cell having count(distinct lt::date) >= 3 order by count(distinct lt::date) desc, count(*) desc limit 1;
  if manual_home is null and home_pt is not null then
    insert into public.user_places(user_id, kind, title, point, auto) values (me, 'home', 'Дом', home_pt, true); added := added + 1;
  end if;
  home_pt := coalesce(manual_home, home_pt);

  select cell, st_centroid(st_collect(g::geometry))::geography, percentile_cont(0.5) within group (order by extract(hour from lt))
    into day_cell, day_pt, leave_h from _pts
    where extract(isodow from lt) between 1 and 5 and extract(hour from lt) between 9 and 16
      and (home_pt is null or not st_dwithin(g, home_pt, 300))
    group by cell having count(distinct lt::date) >= 3 order by count(distinct lt::date) desc, count(*) desc limit 1;
  if day_pt is not null and not exists (select 1 from public.user_places where user_id = me and kind in ('work', 'study')) then
    insert into public.user_places(user_id, kind, title, point, days, auto)
      values (me, case when leave_h < 13 then 'study' else 'work' end, case when leave_h < 13 then 'Учёба' else 'Работа' end, day_pt, '{1,2,3,4,5}', true);
    added := added + 1;
  end if;

  if home_pt is not null then
    insert into public.sleepovers(user_id, night, host_id, area, cell)
    select me, n.night,
      (select f.id from public.user_places h join lateral (select case when fr.a = me then fr.b else fr.a end id from public.friendships fr where (fr.a = me or fr.b = me)) f on f.id = h.user_id
        where h.kind = 'home' and st_dwithin(h.point, n.g, 250) limit 1),
      (select a.street from public.addresses a where st_dwithin(a.geog, n.g, 400) order by a.geog <-> n.g limit 1),
      n.cell
    from (select (lt - interval '6 hours')::date night, mode() within group (order by cell) cell, st_centroid(st_collect(g::geometry))::geography g
          from _pts where extract(hour from lt) < 6 and not st_dwithin(g, home_pt, 400)
          group by 1 having max(at) - min(at) >= interval '2 hours') n
    on conflict (user_id, night) do nothing;
    get diagnostics nights = row_count;
  end if;
  return jsonb_build_object('places', added, 'sleepovers', nights);
end $$;
revoke all on function public.learn_my_places() from public, anon;
grant execute on function public.learn_my_places() to authenticated;

-- Ночёвки с именем хозяина (только друзья, точек нет).
create or replace function public.my_sleepovers(owner uuid default null)
returns table (night date, host_id uuid, host_name text, host_photo text, area text)
language sql stable security invoker set search_path = public as $$
  select s.night, s.host_id, p.name, p.photo_url, s.area from public.sleepovers s
  left join public.profiles p on p.id = s.host_id
  where s.user_id = coalesce(owner, auth.uid()) order by s.night desc limit 200
$$;
grant execute on function public.my_sleepovers(uuid) to authenticated;

commit;
