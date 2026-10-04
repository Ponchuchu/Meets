-- Маршрут (кэш ответов TomTom на 10 минут) и бамп (ожидание пары ±1,5 с, 100 м). Пишут только функции.
create table if not exists public.route_cache (
  key text primary key,
  payload jsonb not null,
  at timestamptz not null default now()
);
alter table public.route_cache enable row level security;

create table if not exists public.bump_pending (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null,
  point extensions.geography(point, 4326) not null,
  matched_with uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists bump_pending_at_idx on public.bump_pending (at);
alter table public.bump_pending enable row level security;

-- Пара для бампа: другой человек, удар в пределах 1,5 с и 100 м, ещё не сопоставлен.
create or replace function public.bump_match(me uuid, pending uuid) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare mine public.bump_pending; other public.bump_pending;
begin
  select * into mine from public.bump_pending where id = pending and user_id = me;
  if mine.id is null then return null; end if;
  if mine.matched_with is not null then return mine.matched_with; end if;
  select * into other from public.bump_pending p
   where p.user_id <> me and p.matched_with is null
     and abs(extract(epoch from (p.at - mine.at))) <= 1.5
     and st_dwithin(p.point, mine.point, 100)
   order by abs(extract(epoch from (p.at - mine.at))) limit 1 for update skip locked;
  if other.id is null then return null; end if;
  update public.bump_pending set matched_with = other.user_id where id = mine.id;
  update public.bump_pending set matched_with = me where id = other.id;
  insert into public.bumps (a, b, point) values (me, other.user_id, mine.point);
  if not public.is_friend(me, other.user_id) then
    insert into public.friendships (a, b) values (least(me, other.user_id), greatest(me, other.user_id)) on conflict do nothing;
  end if;
  perform public.award(me, 'first-bump', 50, 'first', 'first-bump');
  perform public.award(other.user_id, 'first-bump', 50, 'first', 'first-bump');
  return other.user_id;
end $$;
revoke execute on function public.bump_match(uuid, uuid) from public, anon, authenticated;

select cron.unschedule(jobname) from cron.job where jobname = 'bump-pending-cleanup';
select cron.schedule('bump-pending-cleanup', '*/30 * * * *', $$delete from public.bump_pending where created_at < now() - interval '1 hour'; delete from public.route_cache where at < now() - interval '1 hour'$$);
