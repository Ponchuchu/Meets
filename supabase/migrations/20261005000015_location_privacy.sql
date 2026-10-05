-- Альфа А2: друзья видят точку только через friend_locations() и Broadcast — без прямого чтения таблицы
-- (иначе «только район» и огрубление до ~50 м обходились бы запросом к locations_last).
drop policy if exists locations_friends_read on public.locations_last;

drop function if exists public.friend_locations();
create or replace function public.friend_locations()
returns table (user_id uuid, lat double precision, lon double precision, speed real, heading real, updated_at timestamptz, district text, status text)
language sql stable security definer set search_path = public, extensions as $$
  select l.user_id,
         case when coalesce(v.district_only, false) then null else round(st_y(l.geog::geometry) / 0.00045) * 0.00045 end,
         case when coalesce(v.district_only, false) then null else round(st_x(l.geog::geometry) / 0.0006) * 0.0006 end,
         case when coalesce(v.district_only, false) then null else l.speed end,
         l.heading, l.updated_at, l.district,
         case when coalesce(v.statuses, true) then l.status else null end
  from public.locations_last l
  left join public.visibility v on v.user_id = l.user_id
  where public.can_see_location(auth.uid(), l.user_id);
$$;
grant execute on function public.friend_locations() to authenticated;

-- Хвост тоже огрублён.
create or replace function public.friend_trail(friend uuid)
returns table (lat double precision, lon double precision, at timestamptz)
language sql stable security definer set search_path = public, extensions as $$
  select round(st_y(p.point::geometry) / 0.00045) * 0.00045, round(st_x(p.point::geometry) / 0.0006) * 0.0006, p.at
  from public.location_points p
  where p.user_id = friend and public.can_see_location(auth.uid(), friend) and p.at > now() - interval '10 minutes'
    and not coalesce((select v.district_only from public.visibility v where v.user_id = friend), false)
  order by p.at desc limit 4;
$$;
grant execute on function public.friend_trail(uuid) to authenticated;
