-- «Мои места» (21 октября): адрес хранится отдельно от названия — раньше выбор адреса затирал название.
alter table public.user_places add column if not exists address text;
create or replace view public.user_places_points with (security_invoker=true) as
  select id,user_id,kind,title,auto,extensions.st_y(point::extensions.geometry) as lat,extensions.st_x(point::extensions.geometry) as lon,address from public.user_places;
grant select on public.user_places_points to authenticated;
