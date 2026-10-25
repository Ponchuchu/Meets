-- Профиль поживее (26 октября, просьба владельца):
--  · «был в сети» с устройства: iPhone или Android (presence.device) — видят только друзья, как и само время;
--  · короткий статус под именем («ищу компанию на выходные») и интересы в профиле (profiles.status_line, profiles.tags) —
--    их человек заполняет сам на экране «Редактировать профиль»; интересы из анкеты (start_answers) остаются только для рекомендаций.

alter table public.presence add column if not exists device text check (device in ('ios', 'android', 'web'));
alter table public.profiles add column if not exists status_line text check (length(status_line) <= 60);
alter table public.profiles add column if not exists tags text[] not null default '{}' check (cardinality(tags) <= 8);

-- Отметка «в сети» теперь знает устройство. Старый вызов без аргумента тоже работает (device не меняется).
drop function if exists public.touch_presence();
create or replace function public.touch_presence(dev text default null) returns void
language sql security definer set search_path = public as $$
  insert into public.presence (user_id, seen_at, device)
  values (auth.uid(), now(), case when dev in ('ios', 'android', 'web') then dev end)
  on conflict (user_id) do update set seen_at = excluded.seen_at, device = coalesce(excluded.device, public.presence.device)
  where public.presence.seen_at < now() - interval '30 seconds' or public.presence.device is distinct from coalesce(excluded.device, public.presence.device);
$$;
revoke all on function public.touch_presence(text) from public, anon;
grant execute on function public.touch_presence(text) to authenticated;

-- Карточка человека: то же, что раньше, плюс устройство (друзьям и себе).
drop function if exists public.person_card(uuid);
create or replace function public.person_card(p uuid) returns table (
  friends_count int, common_count int, common_ids uuid[], seen_at timestamptz,
  steps_today int, memories_count int, frame text, shape text, device text
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
    (select map_shape from pr),
    case when (select yes from fr) or p = (select id from me) then (select device from public.presence where user_id = p) end
  where not public.is_blocked(p, (select id from me));
$$;
revoke all on function public.person_card(uuid) from public, anon;
grant execute on function public.person_card(uuid) to authenticated;
