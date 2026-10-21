-- 21 октября (вечер): «был в сети» в чате и новый профиль друга.
-- presence — когда человек последний раз открывал приложение. Видят только он сам и друзья.
-- person_card — всё, что нужно странице друга, одним запросом: друзья, общие, шаги, альбомы, «в сети».
create table if not exists public.presence (
  user_id uuid primary key references auth.users (id) on delete cascade,
  seen_at timestamptz not null default now()
);
alter table public.presence enable row level security;
drop policy if exists presence_read on public.presence;
create policy presence_read on public.presence for select to authenticated
  using (user_id = auth.uid() or public.is_friend(user_id, auth.uid()));

-- Пишется только своя строка и не чаще раза в 30 с (защита от лишней нагрузки).
create or replace function public.touch_presence() returns void
language sql security definer set search_path = public as $$
  insert into public.presence (user_id, seen_at) values (auth.uid(), now())
  on conflict (user_id) do update set seen_at = excluded.seen_at
  where public.presence.seen_at < now() - interval '30 seconds';
$$;
revoke all on function public.touch_presence() from public, anon;
grant execute on function public.touch_presence() to authenticated;

create or replace function public.person_card(p uuid) returns table (
  friends_count int, common_count int, common_ids uuid[], seen_at timestamptz,
  steps_today int, memories_count int, frame text, shape text
)
language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as id),
  f as (select case when a = p then b else a end as id from public.friendships where a = p or b = p),
  mine as (select case when a = (select id from me) then b else a end as id from public.friendships where a = (select id from me) or b = (select id from me)),
  pr as (select * from public.profiles where id = p),
  fr as (select public.is_friend(p, (select id from me)) as yes)
  select
    (select count(*)::int from f),
    (select count(*)::int from f where f.id in (select id from mine)),
    (select coalesce(array_agg(f.id), '{}') from (select f.id from f where f.id in (select id from mine) limit 6) f),
    case when (select yes from fr) or p = (select id from me) then (select seen_at from public.presence where user_id = p) end,
    case when ((select yes from fr) and coalesce((select steps_visible from pr), true)) or p = (select id from me)
      then (select steps from public.daily_steps where user_id = p and day = (now() at time zone 'Asia/Almaty')::date) end,
    case when ((select yes from fr) and coalesce((select memories_visible from pr), false)) or p = (select id from me)
      then (select count(*)::int from public.memories where user_id = p) end,
    (select map_frame from pr),
    (select map_shape from pr)
  where not public.is_blocked(p, (select id from me));
$$;
revoke all on function public.person_card(uuid) from public, anon;
grant execute on function public.person_card(uuid) to authenticated;

-- Пробки: реже (раз в 15 минут) — квота TomTom общая с плитками пробок на карте.
select cron.schedule('traffic-score', '*/15 * * * *', $$select public.call_function('traffic-score')$$);
