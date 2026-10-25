-- Друзья человека (26 октября): по нажатию на «друзья» в профиле — вкладки «Все» и «Общие» (PRODUCT.md: другу видны друзья друга и общие).
-- Другу и себе — весь список, остальным — только общие друзья. Заблокированных не показываем.
create or replace function public.person_friends(p uuid) returns table (
  id uuid, name text, photo_url text, handle text, birth_date date, map_frame text, map_shape text, common boolean
)
language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as id),
  f as (select case when a = p then b else a end as id from public.friendships where a = p or b = p),
  mine as (select case when a = (select id from me) then b else a end as id from public.friendships where a = (select id from me) or b = (select id from me)),
  open as (select public.is_friend(p, (select id from me)) or p = (select id from me) as yes)
  select pr.id, pr.name, pr.photo_url, pr.handle, pr.birth_date, pr.map_frame, pr.map_shape, f.id in (select id from mine)
  from f join public.profiles pr on pr.id = f.id
  where not public.is_blocked(p, (select id from me))
    and not public.is_blocked(f.id, (select id from me))
    and ((select yes from open) or f.id in (select id from mine))
  order by f.id in (select id from mine) desc, pr.name
  limit 500;
$$;
revoke all on function public.person_friends(uuid) from public, anon;
grant execute on function public.person_friends(uuid) to authenticated;
