-- Несколько дат у одного события (26 октября, решение владельца): спектакль 31 октября и 1 ноября — одна карточка с двумя датами.
-- events.sessions — все начала по возрастанию (включая starts_at). starts_at — ближайшее ещё не прошедшее.
-- В «Рекомендациях» «Пойду» у такого события спрашивает дату; выбранная дата лежит в attendance.visit_at (как день выставки).

alter table public.events add column if not exists sessions timestamptz[] not null default '{}';
alter table public.attendance drop column if exists session_at;

-- Витрина для приложения: даты и фото/видео события.
create or replace view public.events_live with (security_invoker = true) as
select e.id, e.external_id, e.title, e.category, e.tags, e.starts_at, e.ends_at, e.is_long,
       v.id as venue_id, v.name as venue_name, v.kind as venue_kind,
       coalesce(e.address, v.address) as address, e.address_note,
       st_y(v.geog::geometry) as lat, st_x(v.geog::geometry) as lon, coalesce(v.needs_pin, true) as needs_pin,
       e.price_min, e.price_max, e.is_free, e.about, e.organizer, e.cover_url, e.source_url, e.visibility, e.status, e.created_by,
       e.sessions, e.media
from public.events e left join public.venues v on v.id = e.venue_id
where e.status = 'published';

-- Выбор даты: у события с несколькими датами — одна из них; у долгого (выставка) — время внутри периода, как раньше.
create or replace function public.choose_event_visit(event uuid, visit timestamptz) returns void
language plpgsql security definer set search_path = public as $$
declare e public.events;
begin
  if auth.uid() is null then raise exception 'auth'; end if;
  select * into e from public.events where id = event and status = 'published' and (visibility = 'public' or created_by = auth.uid() or exists (select 1 from public.meetup_guests g where g.event_id = event and g.user_id = auth.uid()));
  if not found then raise exception 'event-unavailable'; end if;
  if cardinality(e.sessions) > 1 then
    if visit is null or visit < now() - interval '3 hours' or not (visit = any (e.sessions)) then raise exception 'invalid-visit'; end if;
  elsif visit is null or visit < greatest(e.starts_at, now()) or visit >= coalesce(e.ends_at, e.starts_at + interval '2 hours') then raise exception 'invalid-visit'; end if;
  insert into public.attendance (user_id, event_id, status, visit_at) values (auth.uid(), event, 'going', visit)
    on conflict (user_id, event_id) do update set status = 'going', visit_at = excluded.visit_at;
end $$;
revoke all on function public.choose_event_visit(uuid, timestamptz) from public;
grant execute on function public.choose_event_visit(uuid, timestamptz) to authenticated;

-- Добавить дату к событию (сборщик: тот же спектакль нашёлся в другом посте с другим днём). Повтор даты не дублирует.
create or replace function public.event_add_session(ev uuid, at timestamptz) returns void
language sql security definer set search_path = public as $$
  update events set
    sessions = (select array_agg(distinct s order by s) from unnest(array_append(case when cardinality(sessions) = 0 then array[starts_at] else sessions end, at)) s),
    updated_at = now()
  where id = ev;
  -- Ближайшая не прошедшая дата — в starts_at (карта и лента смотрят на неё).
  update events set starts_at = coalesce((select min(s) from unnest(sessions) s where s > now() - interval '3 hours'), starts_at)
  where id = ev and cardinality(sessions) > 1;
$$;
revoke execute on function public.event_add_session(uuid, timestamptz) from public, anon, authenticated;

-- Прошёл первый показ — событие переходит на следующую дату, а не уходит в архив.
create or replace function public.roll_sessions() returns int
language sql security definer set search_path = public as $$
  with next as (
    update events e set starts_at = n.at, updated_at = now()
    from (select id, (select min(s) from unnest(sessions) s where s > now() - interval '3 hours') at from events where cardinality(sessions) > 1 and status = 'published') n
    where e.id = n.id and n.at is not null and n.at > e.starts_at
    returning 1
  )
  select count(*)::int from next;
$$;
revoke execute on function public.roll_sessions() from public, anon, authenticated;

create or replace function public.archive_finished() returns int
language sql security definer set search_path = public as $$
  select public.roll_sessions();
  with done as (
    update events set status = 'archived', updated_at = now()
    where status = 'published' and coalesce(ends_at, starts_at + interval '3 hours') < now() - interval '48 hours'
      and not exists (select 1 from unnest(sessions) s where s > now() - interval '3 hours')
    returning 1
  )
  select count(*)::int from done;
$$;
revoke execute on function public.archive_finished() from public, anon, authenticated;

-- Даты сдвигаются чаще раза в сутки: каждый час.
select cron.unschedule('roll-sessions') where exists (select 1 from cron.job where jobname = 'roll-sessions');
select cron.schedule('roll-sessions', '7 * * * *', $$select public.roll_sessions()$$);
