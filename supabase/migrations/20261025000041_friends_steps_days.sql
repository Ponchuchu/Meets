-- Шаги друзей по дням (FIX5): рейтинг за любой день или неделю, до 5 недель назад. Видимость — как у friends_steps.
create or replace function public.friends_steps_days(from_day date, to_day date)
returns table (user_id uuid, name text, photo_url text, map_frame text, map_shape text, day date, steps integer, me boolean)
language sql stable security definer set search_path = public as $$
  with people as (
    select auth.uid() as id
    union
    select case when f.a = auth.uid() then f.b else f.a end from public.friendships f where auth.uid() in (f.a, f.b)
  )
  select p.id, p.name, p.photo_url, p.map_frame, p.map_shape, s.day, coalesce(s.steps, 0), p.id = auth.uid()
  from people x join public.profiles p on p.id = x.id
  left join public.daily_steps s on s.user_id = p.id and s.day between from_day and to_day
  where auth.uid() is not null and to_day >= from_day and to_day - from_day <= 31
    and (p.id = auth.uid() or (p.steps_visible and not public.is_blocked(auth.uid(), p.id)))
$$;
revoke all on function public.friends_steps_days(date, date) from public, anon;
grant execute on function public.friends_steps_days(date, date) to authenticated;
