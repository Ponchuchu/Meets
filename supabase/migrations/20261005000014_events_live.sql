-- Карта и Рекомендации альфы: только одобренные события (у команды в events_feed видны и черновики).
create or replace view public.events_live with (security_invoker = true) as
select e.id, e.external_id, e.title, e.category, e.tags, e.starts_at, e.ends_at, e.is_long,
       v.id as venue_id, v.name as venue_name, v.kind as venue_kind,
       coalesce(e.address, v.address) as address, e.address_note,
       st_y(v.geog::geometry) as lat, st_x(v.geog::geometry) as lon,
       coalesce(v.needs_pin, true) as needs_pin,
       e.price_min, e.price_max, e.is_free, e.about, e.organizer, e.cover_url, e.source_url, e.visibility, e.status
from public.events e
left join public.venues v on v.id = e.venue_id
where e.status = 'published';
grant select on public.events_live to anon, authenticated;

-- Сколько человек идёт (число — не список, его видят все).
create or replace function public.event_going_counts(ids uuid[])
returns table (event_id uuid, going int, looking int)
language sql stable security definer set search_path = public as $$
  select e.id,
         (select count(*) from public.attendance a where a.event_id = e.id and a.status in ('going', 'arrived'))::int,
         (select count(*) from public.company_requests c where c.event_id = e.id)::int
  from unnest(ids) as e(id);
$$;
grant execute on function public.event_going_counts(uuid[]) to authenticated;
