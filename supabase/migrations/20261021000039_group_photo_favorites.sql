-- Группы с фото (21 октября): участник группы может поставить или сменить фото чата.
alter table public.chats add column if not exists photo_url text;
create or replace function public.set_group_photo(chat uuid, url text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'auth'; end if;
  if not exists (select 1 from public.chat_members m join public.chats c on c.id = m.chat_id where m.chat_id = chat and m.user_id = auth.uid() and c.kind = 'group') then raise exception 'forbidden'; end if;
  if url is not null and url !~ '^https://' then raise exception 'invalid-url'; end if;
  update public.chats set photo_url = url where id = chat;
end $$;
revoke all on function public.set_group_photo(uuid, text) from public;
grant execute on function public.set_group_photo(uuid, text) to authenticated;

-- Избранные места («Мои места»): свой значок у каждого — кофе, вид, спорт…
alter table public.user_places drop constraint if exists user_places_kind_check;
alter table public.user_places add constraint user_places_kind_check
  check (kind in ('home', 'work', 'study', 'gym', 'dacha', 'other', 'fav'));
alter table public.user_places add column if not exists icon text;
create or replace view public.user_places_points with (security_invoker=true) as
  select id,user_id,kind,title,auto,extensions.st_y(point::extensions.geometry) as lat,extensions.st_x(point::extensions.geometry) as lon,address,icon from public.user_places;
grant select on public.user_places_points to authenticated;
