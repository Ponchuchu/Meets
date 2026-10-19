-- Переименование касается только публичной афиши, частные встречи не меняем.
create or replace function public.staff_rename_event(ev uuid, new_title text)
returns void language plpgsql security definer set search_path = public as $$
declare t text := btrim(coalesce(new_title, ''));
begin
  if not public.is_staff() then raise exception 'staff-only'; end if;
  if char_length(t) < 2 or char_length(t) > 120 then raise exception 'bad-title'; end if;
  update public.events set orig_title = coalesce(orig_title, title), title = t, updated_at = now()
    where id = ev and visibility = 'public';
  if not found then raise exception 'public-event-not-found'; end if;
end;
$$;
revoke execute on function public.staff_rename_event(uuid, text) from public, anon;
grant execute on function public.staff_rename_event(uuid, text) to authenticated;

-- Карта остаётся на events_live. Планы могут показать снятое событие его участнику.
-- security_invoker сохраняет существующие правила доступа events, attendance и venues.
create or replace view public.events_for_plans with (security_invoker = true) as
select e.id, e.external_id, e.title, e.category, e.tags, e.starts_at, e.ends_at, e.is_long,
       v.id as venue_id, v.name as venue_name, v.kind as venue_kind,
       coalesce(e.address, v.address) as address, e.address_note,
       st_y(v.geog::geometry) as lat, st_x(v.geog::geometry) as lon,
       coalesce(v.needs_pin, true) as needs_pin,
       e.price_min, e.price_max, e.is_free, e.about, e.organizer, e.cover_url, e.source_url,
       e.visibility, e.status
from public.events e
left join public.venues v on v.id = e.venue_id
where e.status = 'published'
   or (e.visibility = 'public' and exists (
     select 1 from public.attendance a
     where a.event_id = e.id and a.user_id = auth.uid() and a.status in ('going', 'arrived')
   ));
revoke all on public.events_for_plans from public, anon;
grant select on public.events_for_plans to authenticated;
