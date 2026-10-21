-- Зависит от 20261012000027_phone_feedback.sql. Сохраняет прежние id и выбор профилей.
begin;

alter table public.profiles drop constraint if exists profiles_map_frame_check;
alter table public.profiles add constraint profiles_map_frame_check check (map_frame in (
  'classic', 'sunset', 'forest', 'violet',
  'almaty-apples', 'tulips', 'alatau', 'dusk', 'starry-night', 'ornament'
));

create or replace function public.check_map_frame() returns trigger
language plpgsql security definer set search_path = public as $$
declare lvl integer; required integer;
begin
  if tg_op = 'UPDATE' then
    if new.map_frame is not distinct from old.map_frame and new.map_trail is not distinct from old.map_trail then
      return new;
    end if;
  end if;
  required := case new.map_frame
    when 'sunset' then 2 when 'forest' then 3 when 'violet' then 7
    when 'alatau' then 2 when 'dusk' then 3 when 'starry-night' then 5 when 'ornament' then 7
    else 1 end;
  if new.map_trail = 'comet' then required := greatest(required, 3); end if;
  select level into lvl from public.user_level where user_id = new.id;
  if coalesce(lvl, 1) < required then raise exception 'frame-locked'; end if;
  return new;
end $$;

drop trigger if exists check_map_frame on public.profiles;
create trigger check_map_frame before insert or update of map_frame, map_trail on public.profiles
  for each row execute function public.check_map_frame();

commit;
