-- FIX3, просьба владельца 20 октября (вечер): форма аватарки отдельно от рамки; рейтинг шагов среди друзей и соревнования.
-- Шаги друзей видны только друзьям и только если человек не выключил «Показывать мои шаги друзьям».
begin;

-- ——— Форма аватарки (любая рамка + любая форма) ———
alter table public.profiles add column if not exists map_shape text not null default 'auto';
alter table public.profiles drop constraint if exists profiles_map_shape_check;
alter table public.profiles add constraint profiles_map_shape_check
  check (map_shape in ('auto', 'circle', 'squircle', 'blob', 'heart', 'hex', 'star', 'flower', 'drop'));
alter table public.profiles add column if not exists steps_visible boolean not null default true;

-- ——— Рейтинг: я и друзья, шаги сегодня и за неделю (с понедельника, по Алматы) ———
create or replace function public.friends_steps()
returns table (user_id uuid, name text, photo_url text, map_frame text, map_shape text, today integer, week integer, me boolean)
language sql stable security definer set search_path = public as $$
  with d as (select (now() at time zone 'Asia/Almaty')::date as today),
  w as (select today, today - (extract(isodow from today)::int - 1) as monday from d),
  people as (
    select auth.uid() as id
    union
    select case when f.a = auth.uid() then f.b else f.a end from public.friendships f where auth.uid() in (f.a, f.b)
  )
  select p.id, p.name, p.photo_url, p.map_frame, p.map_shape,
    coalesce((select s.steps from public.daily_steps s where s.user_id = p.id and s.day = w.today), 0),
    coalesce((select sum(s.steps)::int from public.daily_steps s where s.user_id = p.id and s.day between w.monday and w.today), 0),
    p.id = auth.uid()
  from people x join public.profiles p on p.id = x.id, w
  where auth.uid() is not null and (p.id = auth.uid() or (p.steps_visible and not public.is_blocked(auth.uid(), p.id)))
  order by 7 desc, 6 desc
$$;
revoke all on function public.friends_steps() from public, anon;
grant execute on function public.friends_steps() to authenticated;

-- ——— Соревнования: «кто больше за N дней» или «кто первым дойдёт до цели» ———
create table if not exists public.step_challenges (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(title) between 1 and 80),
  kind text not null default 'most' check (kind in ('most', 'goal')),
  goal integer check (goal is null or goal between 1000 and 1000000),
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on - starts_on <= 31)
);
create table if not exists public.step_challenge_members (
  challenge_id uuid not null references public.step_challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'joined', 'declined')),
  primary key (challenge_id, user_id)
);
create index if not exists step_challenge_members_user on public.step_challenge_members(user_id);
alter table public.step_challenges enable row level security;
alter table public.step_challenge_members enable row level security;
-- Проверка участия через security definer — иначе политика на той же таблице уходит в рекурсию.
create or replace function public.in_step_challenge(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.step_challenge_members m where m.challenge_id = c and m.user_id = auth.uid());
$$;
drop policy if exists step_challenges_read on public.step_challenges;
create policy step_challenges_read on public.step_challenges for select to authenticated using (public.in_step_challenge(step_challenges.id));
drop policy if exists step_challenge_members_read on public.step_challenge_members;
create policy step_challenge_members_read on public.step_challenge_members for select to authenticated using (public.in_step_challenge(step_challenge_members.challenge_id));
grant select on public.step_challenges, public.step_challenge_members to authenticated;

-- Создать: только с друзьями, до 10 человек, от 1 до 31 дня. Создатель сразу участвует.
create or replace function public.create_step_challenge(friends uuid[], days integer, challenge_kind text default 'most', target integer default null, challenge_title text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); cid uuid; start date := (now() at time zone 'Asia/Almaty')::date; f uuid;
begin
  if me is null then raise exception 'auth'; end if;
  if coalesce(cardinality(friends), 0) not between 1 and 10 then raise exception 'friends-1-10'; end if;
  if days not between 1 and 31 then raise exception 'days-1-31'; end if;
  if challenge_kind = 'goal' and target is null then raise exception 'goal-required'; end if;
  insert into public.step_challenges(created_by, title, kind, goal, starts_on, ends_on)
    values (me, coalesce(nullif(trim(challenge_title), ''), case when challenge_kind = 'goal' then 'Кто первым пройдёт ' || target || ' шагов' else 'Кто больше за ' || days || ' дн.' end),
            challenge_kind, case when challenge_kind = 'goal' then target end, start, start + days - 1)
    returning id into cid;
  insert into public.step_challenge_members(challenge_id, user_id, status) values (cid, me, 'joined');
  foreach f in array friends loop
    if f <> me and public.is_friend(me, f) and not public.is_blocked(me, f) then
      insert into public.step_challenge_members(challenge_id, user_id) values (cid, f) on conflict do nothing;
    end if;
  end loop;
  return cid;
end $$;
revoke all on function public.create_step_challenge(uuid[], integer, text, integer, text) from public, anon;
grant execute on function public.create_step_challenge(uuid[], integer, text, integer, text) to authenticated;

create or replace function public.answer_step_challenge(challenge uuid, accept boolean) returns void
language sql security definer set search_path = public as $$
  update public.step_challenge_members set status = case when accept then 'joined' else 'declined' end
  where challenge_id = challenge and user_id = auth.uid();
$$;
revoke all on function public.answer_step_challenge(uuid, boolean) from public, anon;
grant execute on function public.answer_step_challenge(uuid, boolean) to authenticated;

-- Мои соревнования и таблица участников (шаги за дни соревнования).
create or replace function public.my_step_challenges()
returns table (id uuid, title text, kind text, goal integer, starts_on date, ends_on date, created_by uuid, my_status text,
               user_id uuid, name text, photo_url text, status text, steps integer)
language sql stable security definer set search_path = public as $$
  select c.id, c.title, c.kind, c.goal, c.starts_on, c.ends_on, c.created_by, mine.status,
    p.id, p.name, p.photo_url, m.status,
    coalesce((select sum(s.steps)::int from public.daily_steps s where s.user_id = m.user_id and s.day between c.starts_on and c.ends_on), 0)
  from public.step_challenge_members mine
  join public.step_challenges c on c.id = mine.challenge_id
  join public.step_challenge_members m on m.challenge_id = c.id and m.status <> 'declined'
  join public.profiles p on p.id = m.user_id
  where mine.user_id = auth.uid() and mine.status <> 'declined' and c.ends_on >= (now() at time zone 'Asia/Almaty')::date - 14
  order by c.ends_on desc, c.id, 13 desc
$$;
revoke all on function public.my_step_challenges() from public, anon;
grant execute on function public.my_step_challenges() to authenticated;

commit;
