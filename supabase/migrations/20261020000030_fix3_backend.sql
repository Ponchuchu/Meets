-- FIX3 Ф0: ошибки с телефона (поиск причин вылетов) и рамки без жёсткого списка в базе.
-- Зависит от 20261012000027_phone_feedback.sql. Повторное применение безопасно.
begin;

-- Ошибки приложения: телефон кладёт сюда текст падения при следующем запуске. Читает только команда.
create table if not exists public.client_errors (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  at timestamptz not null default now(),
  fatal boolean not null default false,
  screen text check (length(screen) <= 120),
  message text not null check (length(message) <= 2000),
  stack text check (length(stack) <= 8000),
  app_version text check (length(app_version) <= 40),
  platform text check (length(platform) <= 20)
);
create index if not exists client_errors_at on public.client_errors(at desc);
alter table public.client_errors enable row level security;
drop policy if exists client_errors_insert on public.client_errors;
create policy client_errors_insert on public.client_errors for insert to authenticated
  with check (user_id is null or user_id = auth.uid());
drop policy if exists client_errors_staff on public.client_errors;
create policy client_errors_staff on public.client_errors for select to authenticated using (public.is_staff());
grant insert on public.client_errors to authenticated;
grant usage on sequence public.client_errors_id_seq to authenticated;
grant select on public.client_errors to authenticated;

-- Рамки: список живёт в приложении, база проверяет только уровень. Новые рамки — строкой в frame_levels.
create table if not exists public.frame_levels (code text primary key, level integer not null default 1);
alter table public.frame_levels enable row level security;
drop policy if exists frame_levels_read on public.frame_levels;
create policy frame_levels_read on public.frame_levels for select using (true);
grant select on public.frame_levels to anon, authenticated;
insert into public.frame_levels(code, level) values
  ('classic',1),('sunset',2),('forest',3),('violet',7),
  ('almaty-apples',1),('tulips',1),('alatau',2),('dusk',3),('starry-night',5),('ornament',7),
  ('bubble',1),('drop',1),('neon',2),('aurora',3),('cosmos',4),('tesla',5),('lava',6),('crown',8)
on conflict (code) do update set level = excluded.level;

alter table public.profiles drop constraint if exists profiles_map_frame_check;
alter table public.profiles add constraint profiles_map_frame_check check (map_frame ~ '^[a-z0-9-]{2,32}$');

create or replace function public.check_map_frame() returns trigger
language plpgsql security definer set search_path = public as $$
declare lvl integer; required integer;
begin
  if tg_op = 'UPDATE' then
    if new.map_frame is not distinct from old.map_frame and new.map_trail is not distinct from old.map_trail then
      return new;
    end if;
  end if;
  select level into required from public.frame_levels where code = new.map_frame;
  if required is null then raise exception 'frame-unknown'; end if;
  if new.map_trail = 'comet' then required := greatest(required, 3); end if;
  select level into lvl from public.user_level where user_id = new.id;
  if coalesce(lvl, 1) < required then raise exception 'frame-locked'; end if;
  return new;
end $$;
drop trigger if exists check_map_frame on public.profiles;
create trigger check_map_frame before insert or update of map_frame, map_trail on public.profiles
  for each row execute function public.check_map_frame();

commit;
