-- Несколько дат у одного события (26 октября, решение владельца): спектакль 31 октября и 1 ноября — одна карточка с двумя датами.
-- events.sessions — все начала по возрастанию (включая starts_at). starts_at — ближайшее ещё не прошедшее.
-- В «Рекомендациях» «Пойду» у такого события спрашивает дату; выбранная дата лежит в attendance.session_at.

alter table public.events add column if not exists sessions timestamptz[] not null default '{}';
alter table public.attendance add column if not exists session_at timestamptz;

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
