-- Заряд друга на карте (FIX5, как в Zenly): процент и «заряжается» видят только те, кто видит точку.
alter table public.locations_last add column if not exists battery smallint check (battery between 0 and 100);
alter table public.locations_last add column if not exists charging boolean;

drop function if exists public.friend_locations();
create or replace function public.friend_locations()
returns table (user_id uuid, lat double precision, lon double precision, speed real, heading real, updated_at timestamptz, district text, status text, battery smallint, charging boolean)
language sql stable security definer set search_path = public, extensions as $$
  select l.user_id,
         case when coalesce(v.district_only, false) then null else round(st_y(l.geog::geometry) / 0.00045) * 0.00045 end,
         case when coalesce(v.district_only, false) then null else round(st_x(l.geog::geometry) / 0.0006) * 0.0006 end,
         case when coalesce(v.district_only, false) then null else l.speed end,
         l.heading, l.updated_at, l.district,
         case when coalesce(v.statuses, true) then l.status else null end,
         l.battery, l.charging
  from public.locations_last l
  left join public.visibility v on v.user_id = l.user_id
  where public.can_see_location(auth.uid(), l.user_id);
$$;
grant execute on function public.friend_locations() to authenticated;
