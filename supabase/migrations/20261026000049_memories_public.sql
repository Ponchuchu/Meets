-- Воспоминания для всех (26 октября): по желанию человека альбомы видят и те, кто не в друзьях,
-- — по ним проще познакомиться. По умолчанию выключено; заблокированным не видно никогда.
alter table public.profiles add column if not exists memories_public boolean not null default false;

create or replace function public.can_see_memories(owner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select owner = auth.uid() or (not public.is_blocked(auth.uid(), owner) and (
    (public.is_friend(auth.uid(), owner) and coalesce((select memories_visible from public.profiles where id = owner), false))
    or coalesce((select memories_public from public.profiles where id = owner), false)
  ));
$$;
