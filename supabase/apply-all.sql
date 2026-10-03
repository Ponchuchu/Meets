-- Сгенерировано: npm run db:bundle. Не править руками — правь supabase/migrations/.
-- Supabase → SQL Editor → New query → вставить весь файл → Run.

-- ===== 20260928000001_venues_events.sql =====
-- Этап 0: площадки и события. PostGIS, RLS: читать опубликованное может любой, писать — только команда.
create extension if not exists postgis with schema extensions;

-- Команда (модераторы, админы). Заполняется вручную из дашборда.
create table if not exists public.staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'moderator' check (role in ('moderator', 'admin')),
  created_at timestamptz not null default now()
);
alter table public.staff enable row level security;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid());
$$;

drop policy if exists staff_self_read on public.staff;
create policy staff_self_read on public.staff for select using (user_id = auth.uid());

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  aliases text[] not null default '{}',
  address text,
  district text,
  geog extensions.geography(point, 4326),
  needs_pin boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists venues_geog_idx on public.venues using gist (geog);
alter table public.venues enable row level security;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  title text not null,
  category text not null,
  tags text[] not null default '{}',
  starts_at timestamptz not null,
  ends_at timestamptz,
  is_long boolean not null default false,
  venue_id uuid references public.venues (id) on delete set null,
  address text,
  address_note text,
  price_min integer,
  price_max integer,
  is_free boolean not null default false,
  about text,
  organizer text,
  cover_url text,
  source_url text,
  confidence text,
  status text not null default 'draft' check (status in ('draft', 'published', 'cancelled', 'archived')),
  visibility text not null default 'public' check (visibility in ('public', 'friends')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists events_starts_idx on public.events (starts_at);
create index if not exists events_status_idx on public.events (status);
alter table public.events enable row level security;

-- Чтение: опубликованные публичные события — всем (включая анонимов); команде — всё.
drop policy if exists events_read_published on public.events;
create policy events_read_published on public.events for select
  using ((status = 'published' and visibility = 'public') or public.is_staff());
drop policy if exists events_staff_write on public.events;
create policy events_staff_write on public.events for all
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists venues_read on public.venues;
create policy venues_read on public.venues for select using (true);
drop policy if exists venues_staff_write on public.venues;
create policy venues_staff_write on public.venues for all
  using (public.is_staff()) with check (public.is_staff());

-- Лента для клиента: событие + координаты площадки плоскими полями.
create or replace view public.events_feed with (security_invoker = true) as
select e.id, e.external_id, e.title, e.category, e.tags, e.starts_at, e.ends_at, e.is_long,
       v.name as venue_name, coalesce(e.address, v.address) as address, e.address_note,
       extensions.st_y(v.geog::extensions.geometry) as lat, extensions.st_x(v.geog::extensions.geometry) as lon,
       coalesce(v.needs_pin, true) as needs_pin,
       e.price_min, e.price_max, e.is_free, e.about, e.organizer, e.cover_url, e.source_url, e.visibility
from public.events e
left join public.venues v on v.id = e.venue_id;

grant select on public.events_feed to anon, authenticated;

-- ===== 20260928000002_people_chats.sql =====
-- Этап 8: люди, связи, планы, чаты, вкус, достижения, уведомления, погода. Все таблицы с RLS.
-- Правила видимости — docs/PRODUCT.md «Кто что видит» (клиентская копия — src/people/visibility.ts).

-- ——— Люди ———
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  birth_date date not null check (birth_date <= (current_date - interval '18 years')),
  photo_url text,
  handle text unique,
  about text,
  instagram text,
  plans_visible text not null default 'friends' check (plans_visible in ('all', 'friends', 'nobody')),
  who_can_write text not null default 'common' check (who_can_write in ('all', 'friends', 'common')),
  achievements_visible text not null default 'friends' check (achievements_visible in ('me', 'friends', 'all')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create table if not exists public.start_answers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  interests text[] not null check (cardinality(interests) >= 3),
  times text[] not null default '{}',
  with_who text not null default 'friends',
  budget text not null default 'mid',
  updated_at timestamptz not null default now()
);
alter table public.start_answers enable row level security;

create table if not exists public.friendships (
  a uuid not null references auth.users (id) on delete cascade,
  b uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (a, b),
  check (a < b)
);
alter table public.friendships enable row level security;

create table if not exists public.friend_requests (
  from_id uuid not null references auth.users (id) on delete cascade,
  to_id uuid not null references auth.users (id) on delete cascade,
  note text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  primary key (from_id, to_id)
);
alter table public.friend_requests enable row level security;

create table if not exists public.blocks (
  blocker uuid not null references auth.users (id) on delete cascade,
  blocked uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked)
);
alter table public.blocks enable row level security;

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null references auth.users (id) on delete cascade,
  target uuid not null references auth.users (id) on delete cascade,
  reason text not null,
  message_id uuid,
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;

create or replace function public.is_friend(x uuid, y uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.friendships where a = least(x, y) and b = greatest(x, y));
$$;

create or replace function public.is_blocked(x uuid, y uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks where (blocker = x and blocked = y) or (blocker = y and blocked = x));
$$;

-- Принятая заявка создаёт дружбу.
create or replace function public.accept_friend_request() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'accepted' and old.status <> 'accepted' then
    insert into public.friendships (a, b) values (least(new.from_id, new.to_id), greatest(new.from_id, new.to_id)) on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists friend_request_accepted on public.friend_requests;
create trigger friend_request_accepted after update on public.friend_requests for each row execute function public.accept_friend_request();

-- Профиль (фото, о себе, интересы) видят все, кроме заблокированных.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (not public.is_blocked(auth.uid(), id));
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists start_answers_self on public.start_answers;
create policy start_answers_self on public.start_answers for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists friendships_read on public.friendships;
create policy friendships_read on public.friendships for select using (auth.uid() in (a, b));
drop policy if exists friendships_delete on public.friendships;
create policy friendships_delete on public.friendships for delete using (auth.uid() in (a, b));

drop policy if exists friend_requests_rw on public.friend_requests;
create policy friend_requests_rw on public.friend_requests for select using (auth.uid() in (from_id, to_id));
drop policy if exists friend_requests_insert on public.friend_requests;
create policy friend_requests_insert on public.friend_requests for insert with check (from_id = auth.uid() and not public.is_blocked(from_id, to_id));
drop policy if exists friend_requests_answer on public.friend_requests;
create policy friend_requests_answer on public.friend_requests for update using (to_id = auth.uid());

drop policy if exists blocks_self on public.blocks;
create policy blocks_self on public.blocks for all using (blocker = auth.uid()) with check (blocker = auth.uid());
drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert with check (reporter = auth.uid());

-- ——— Мой значок и геолокация: только последняя точка, истории нет ———
create table if not exists public.marker_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  speed_mode text not null default 'exact' check (speed_mode in ('exact', 'approx', 'simple', 'off')),
  status text check (char_length(status) <= 24),
  ring text not null default 'blue',
  inside text not null default 'photo',
  invisible boolean not null default false,
  share_until timestamptz,
  home_geog extensions.geography(point, 4326) -- зона дома 300 м, никому не видна
);
alter table public.marker_settings enable row level security;
drop policy if exists marker_self on public.marker_settings;
create policy marker_self on public.marker_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.locations_last (
  user_id uuid primary key references auth.users (id) on delete cascade,
  geog extensions.geography(point, 4326) not null,
  speed real,
  heading real,
  updated_at timestamptz not null default now()
);
alter table public.locations_last enable row level security;
drop policy if exists locations_self on public.locations_last;
create policy locations_self on public.locations_last for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Друзьям — точка друга, если он не невидимка и не в зоне дома; точность ~50 м.
create or replace function public.friend_locations()
returns table (user_id uuid, lat double precision, lon double precision, speed real, heading real, updated_at timestamptz)
language sql stable security definer set search_path = public, extensions as $$
  select l.user_id,
         round((st_y(l.geog::geometry) / 0.00045)::numeric) * 0.00045,
         round((st_x(l.geog::geometry) / 0.0006)::numeric) * 0.0006,
         case when m.speed_mode = 'off' then null else l.speed end,
         l.heading, l.updated_at
  from public.locations_last l
  join public.marker_settings m on m.user_id = l.user_id
  where public.is_friend(auth.uid(), l.user_id)
    and not m.invisible
    and (m.home_geog is null or not st_dwithin(l.geog, m.home_geog, 300));
$$;
grant execute on function public.friend_locations() to authenticated;

-- ——— Планы и события ———
create table if not exists public.attendance (
  user_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  status text not null check (status in ('going', 'saved', 'skipped', 'arrived', 'cancelled')),
  at timestamptz not null default now(),
  primary key (user_id, event_id)
);
alter table public.attendance enable row level security;
drop policy if exists attendance_self on public.attendance;
create policy attendance_self on public.attendance for all using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Мои планы видят друзья (если я не запретил).
drop policy if exists attendance_friends on public.attendance;
create policy attendance_friends on public.attendance for select using (
  status in ('going', 'arrived') and public.is_friend(auth.uid(), user_id)
  and exists (select 1 from public.profiles p where p.id = user_id and p.plans_visible <> 'nobody')
);

create table if not exists public.company_requests (
  user_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  moods text[] not null default '{}' check (cardinality(moods) <= 8),
  visibility text not null default 'all' check (visibility in ('all', 'fof')),
  note text check (char_length(note) <= 80),
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);
alter table public.company_requests enable row level security;
drop policy if exists company_self on public.company_requests;
create policy company_self on public.company_requests for all using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Видно, пока событие не началось: всем (all) или друзьям друзей (fof); друзьям и идущим — всегда.
drop policy if exists company_read on public.company_requests;
create policy company_read on public.company_requests for select using (
  not public.is_blocked(auth.uid(), user_id)
  and exists (select 1 from public.events e where e.id = event_id and e.starts_at > now())
  and (visibility = 'all' or public.is_friend(auth.uid(), user_id)
       or exists (select 1 from public.friendships f1 join public.friendships f2
                  on (f2.a in (f1.a, f1.b) or f2.b in (f1.a, f1.b))
                  where auth.uid() in (f1.a, f1.b) and user_id in (f2.a, f2.b)))
);

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references auth.users (id) on delete cascade,
  to_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid references public.events (id) on delete cascade,
  own_place text, -- «своё»: кофе, прогулка, ужин
  answer text check (answer in ('yes', 'no')),
  created_at timestamptz not null default now()
);
alter table public.invites enable row level security;
drop policy if exists invites_rw on public.invites;
create policy invites_rw on public.invites for select using (auth.uid() in (from_id, to_id));
drop policy if exists invites_insert on public.invites;
create policy invites_insert on public.invites for insert with check (from_id = auth.uid() and public.is_friend(from_id, to_id));
drop policy if exists invites_answer on public.invites;
create policy invites_answer on public.invites for update using (to_id = auth.uid());

-- Встречи = события с visibility = 'friends' и created_by; гости и «кто что принесёт».
create table if not exists public.meetup_guests (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  accepted boolean,
  plus_one text,
  primary key (event_id, user_id)
);
alter table public.meetup_guests enable row level security;
create table if not exists public.meetup_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  title text not null,
  taken_by uuid references auth.users (id) on delete set null
);
alter table public.meetup_items enable row level security;

create or replace function public.is_meetup_member(ev uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.events e where e.id = ev and e.created_by = auth.uid())
      or exists (select 1 from public.meetup_guests g where g.event_id = ev and g.user_id = auth.uid());
$$;
drop policy if exists meetup_guests_rw on public.meetup_guests;
create policy meetup_guests_rw on public.meetup_guests for all using (public.is_meetup_member(event_id)) with check (public.is_meetup_member(event_id));
drop policy if exists meetup_items_rw on public.meetup_items;
create policy meetup_items_rw on public.meetup_items for all using (public.is_meetup_member(event_id)) with check (public.is_meetup_member(event_id));

-- Встречи «для друзей» видят только гости и автор; адрес — только принявшие (адрес в отдельной колонке ниже).
drop policy if exists events_meetups_read on public.events;
create policy events_meetups_read on public.events for select using (visibility = 'friends' and public.is_meetup_member(id));
drop policy if exists events_meetups_write on public.events;
create policy events_meetups_write on public.events for insert with check (created_by = auth.uid() and visibility = 'friends' and status = 'published');

-- ——— Чаты ———
create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('direct', 'event')),
  event_id uuid references public.events (id) on delete cascade,
  meet_point text,
  closes_at timestamptz, -- событие + 48 часов
  created_at timestamptz not null default now()
);
alter table public.chats enable row level security;

create table if not exists public.chat_members (
  chat_id uuid not null references public.chats (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (chat_id, user_id)
);
alter table public.chat_members enable row level security;

create or replace function public.is_chat_member(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.chat_members m where m.chat_id = c and m.user_id = auth.uid());
$$;

drop policy if exists chats_read on public.chats;
create policy chats_read on public.chats for select using (public.is_chat_member(id));
drop policy if exists chat_members_read on public.chat_members;
create policy chat_members_read on public.chat_members for select using (public.is_chat_member(chat_id));
drop policy if exists chat_members_self on public.chat_members;
create policy chat_members_self on public.chat_members for update using (user_id = auth.uid());

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('text', 'photo', 'video', 'voice', 'circle', 'sticker', 'invite', 'poll', 'system')),
  body text,
  media_path text, -- Storage: bucket media, приватный
  duration_s int,
  invite_id uuid references public.invites (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists messages_chat_idx on public.messages (chat_id, created_at);
alter table public.messages enable row level security;
drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages for select using (public.is_chat_member(chat_id) and not public.is_blocked(auth.uid(), author_id));
-- Писать: участник, чат не закрыт; незнакомым — правила в функции can_write (лимиты, 24 часа, общее событие).
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert with check (
  author_id = auth.uid() and public.is_chat_member(chat_id)
  and exists (select 1 from public.chats c where c.id = chat_id and (c.closes_at is null or c.closes_at > now()))
);

create table if not exists public.polls (
  message_id uuid primary key references public.messages (id) on delete cascade,
  question text not null,
  options text[] not null
);
alter table public.polls enable row level security;
create table if not exists public.poll_votes (
  message_id uuid not null references public.polls (message_id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  option int not null,
  primary key (message_id, user_id)
);
alter table public.poll_votes enable row level security;
drop policy if exists polls_read on public.polls;
create policy polls_read on public.polls for select using (exists (select 1 from public.messages m where m.id = message_id and public.is_chat_member(m.chat_id)));
drop policy if exists poll_votes_rw on public.poll_votes;
create policy poll_votes_rw on public.poll_votes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists poll_votes_read on public.poll_votes;
create policy poll_votes_read on public.poll_votes for select using (exists (select 1 from public.messages m where m.id = message_id and public.is_chat_member(m.chat_id)));

-- Личный чат с незнакомым: общее событие, человек разрешил, ≤ 10 новых в день, аккаунт старше 24 часов.
create or replace function public.open_direct_chat(other uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  existing uuid;
  created int;
  allows text;
  new_chat uuid;
begin
  if public.is_blocked(me, other) then raise exception 'blocked'; end if;
  select c.id into existing from public.chats c
    join public.chat_members a on a.chat_id = c.id and a.user_id = me
    join public.chat_members b on b.chat_id = c.id and b.user_id = other
    where c.kind = 'direct' limit 1;
  if existing is not null then return existing; end if;
  if not public.is_friend(me, other) then
    select who_can_write into allows from public.profiles where id = other;
    if allows = 'friends' then raise exception 'not-allowed'; end if;
    if allows = 'common' and not exists (
      select 1 from public.attendance x join public.attendance y on x.event_id = y.event_id
      where x.user_id = me and y.user_id = other and x.status in ('going', 'arrived') and y.status in ('going', 'arrived')
      union select 1 from public.company_requests r where r.user_id = other and exists (select 1 from public.attendance z where z.user_id = me and z.event_id = r.event_id)
    ) then raise exception 'no-common-event'; end if;
    if (select created_at from auth.users where id = me) > now() - interval '24 hours' then raise exception 'new-account'; end if;
    select count(*) into created from public.chat_members m join public.chats c on c.id = m.chat_id
      where m.user_id = me and c.kind = 'direct' and m.joined_at > now() - interval '1 day';
    if created >= 10 then raise exception 'daily-limit'; end if;
  end if;
  insert into public.chats (kind) values ('direct') returning id into new_chat;
  insert into public.chat_members (chat_id, user_id) values (new_chat, me), (new_chat, other);
  return new_chat;
end $$;
grant execute on function public.open_direct_chat(uuid) to authenticated;

-- ——— Вкус и сигналы (видит только команда и сервер) ———
create table if not exists public.taste (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tags jsonb not null default '{}',
  time_grid jsonb not null default '[]',
  price_ceiling int,
  company_pref real,
  start_answers jsonb,
  updated_at timestamptz not null default now()
);
alter table public.taste enable row level security;
drop policy if exists taste_staff on public.taste;
create policy taste_staff on public.taste for select using (public.is_staff());

create table if not exists public.signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  kind text not null,
  weight real not null,
  created_at timestamptz not null default now()
);
create index if not exists signals_user_idx on public.signals (user_id, created_at desc);
alter table public.signals enable row level security;
-- Писать свои сигналы можно, читать — только команде; «Вернуть» удаляет свой сигнал целиком.
drop policy if exists signals_insert on public.signals;
create policy signals_insert on public.signals for insert with check (user_id = auth.uid());
drop policy if exists signals_delete on public.signals;
create policy signals_delete on public.signals for delete using (user_id = auth.uid());
drop policy if exists signals_staff on public.signals;
create policy signals_staff on public.signals for select using (public.is_staff());

-- ——— Достижения ———
create table if not exists public.visited_cells (
  user_id uuid not null references auth.users (id) on delete cascade,
  h3 text not null,
  city text not null default 'almaty',
  first_at timestamptz not null default now(),
  primary key (user_id, h3)
);
alter table public.visited_cells enable row level security;
create table if not exists public.badges (id text primary key, name text not null, goal int not null, how text not null);
alter table public.badges enable row level security;
create table if not exists public.user_badges (
  user_id uuid not null references auth.users (id) on delete cascade,
  badge_id text not null references public.badges (id),
  progress int not null default 0,
  got_at timestamptz,
  primary key (user_id, badge_id)
);
alter table public.user_badges enable row level security;
create table if not exists public.cities_visited (
  user_id uuid not null references auth.users (id) on delete cascade,
  city text not null,
  country text not null,
  first_at timestamptz not null default now(),
  primary key (user_id, city)
);
alter table public.cities_visited enable row level security;

create or replace function public.can_see_achievements(owner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select owner = auth.uid() or exists (select 1 from public.profiles p where p.id = owner and (
    p.achievements_visible = 'all' or (p.achievements_visible = 'friends' and public.is_friend(auth.uid(), owner))));
$$;
drop policy if exists badges_read on public.badges;
create policy badges_read on public.badges for select using (true);
drop policy if exists cells_rw on public.visited_cells;
create policy cells_rw on public.visited_cells for select using (public.can_see_achievements(user_id));
drop policy if exists cells_insert on public.visited_cells;
create policy cells_insert on public.visited_cells for insert with check (user_id = auth.uid());
drop policy if exists user_badges_read on public.user_badges;
create policy user_badges_read on public.user_badges for select using (public.can_see_achievements(user_id));
drop policy if exists cities_read on public.cities_visited;
create policy cities_read on public.cities_visited for select using (public.can_see_achievements(user_id));

-- ——— Уведомления ———
create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null,
  updated_at timestamptz not null default now()
);
alter table public.push_tokens enable row level security;
drop policy if exists push_self on public.push_tokens;
create policy push_self on public.push_tokens for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.notification_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  friend_near boolean not null default true,
  interest_near boolean not null default true,
  remind_2h boolean not null default true,
  messages boolean not null default true,
  weekend boolean not null default false
);
alter table public.notification_prefs enable row level security;
drop policy if exists notif_self on public.notification_prefs;
create policy notif_self on public.notification_prefs for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.notification_log (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  about uuid,
  sent_at timestamptz not null default now()
);
create index if not exists notification_log_idx on public.notification_log (user_id, sent_at desc);
alter table public.notification_log enable row level security; -- только сервер (service role)

-- ——— Погода: кэш Open-Meteo, обновляет Edge Function weather раз в час ———
create table if not exists public.weather_cache (
  city text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.weather_cache enable row level security;
drop policy if exists weather_read on public.weather_cache;
create policy weather_read on public.weather_cache for select using (true);

-- ——— Медиа чатов: приватный бакет, подписанные ссылки ———
insert into storage.buckets (id, name, public) values ('media', 'media', false) on conflict (id) do nothing;
drop policy if exists media_member_read on storage.objects;
create policy media_member_read on storage.objects for select using (
  bucket_id = 'media' and public.is_chat_member(((storage.foldername(name))[1])::uuid)
);
drop policy if exists media_member_write on storage.objects;
create policy media_member_write on storage.objects for insert with check (
  bucket_id = 'media' and public.is_chat_member(((storage.foldername(name))[1])::uuid) and owner = auth.uid()
);

-- Realtime: сообщения чатов (Postgres Changes). Геолокация друзей — Broadcast по приватным каналам.
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; end $$;

-- Broadcast геолокации: канал «loc:<id>». Писать — только в свой, читать — только друзьям владельца.
-- RLS на realtime.messages Supabase включает сам (таблица принадлежит ему — alter из SQL Editor запрещён).
drop policy if exists loc_broadcast_write on realtime.messages;
create policy loc_broadcast_write on realtime.messages for insert to authenticated with check (
  realtime.topic() = 'loc:' || auth.uid()::text
);
drop policy if exists loc_broadcast_read on realtime.messages;
create policy loc_broadcast_read on realtime.messages for select to authenticated using (
  realtime.topic() like 'loc:%'
  and public.is_friend(auth.uid(), substr(realtime.topic(), 5)::uuid)
);

-- ===== 20260928000003_jobs.sql =====
-- Этап 8: фоновые задачи. pg_cron дёргает Edge Functions, триггер на сообщения — пуши.
-- Нужны два секрета в Vault (один раз, см. docs/KEYS.md): project_url и cron_secret (тот же, что CRON_SECRET у функций).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Вызов Edge Function с общим секретом из Vault. Без секретов — тихо ничего не делает.
create or replace function public.call_function(fn text, body jsonb default '{}') returns void
language plpgsql security definer set search_path = public as $$
declare
  base text;
  key text;
begin
  select decrypted_secret into base from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into key from vault.decrypted_secrets where name = 'cron_secret';
  if base is null or key is null then return; end if;
  perform net.http_post(
    url := base || '/functions/v1/' || fn,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', key),
    body := body
  );
end;
$$;
revoke execute on function public.call_function(text, jsonb) from public, anon, authenticated;

-- Новое сообщение → пуш получателям (правила частоты считает функция notify).
create or replace function public.on_message_push() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.call_function('notify', jsonb_build_object('type', 'message', 'message_id', new.id));
  return new;
end;
$$;
drop trigger if exists messages_push on public.messages;
create trigger messages_push after insert on public.messages for each row execute function public.on_message_push();

-- «Друг рядом с событием»: друг делится точкой и в 200 м от события, куда я иду сегодня.
create or replace function public.friend_near_candidates()
returns table (recipient uuid, friend_id uuid, friend_name text, event_id uuid, event_title text, meters double precision)
language sql stable security definer set search_path = public, extensions as $$
  select a.user_id, l.user_id, p.name, e.id, e.title, st_distance(l.geog, v.geog)
  from public.attendance a
  join public.events e on e.id = a.event_id
  join public.venues v on v.id = e.venue_id
  join public.locations_last l on public.is_friend(a.user_id, l.user_id)
  join public.marker_settings m on m.user_id = l.user_id
  join public.profiles p on p.id = l.user_id
  where a.status = 'going'
    and e.starts_at between now() - interval '1 hour' and now() + interval '6 hours'
    and l.updated_at > now() - interval '15 minutes'
    and not m.invisible
    and v.geog is not null and st_dwithin(l.geog, v.geog, 200)
    and not exists (select 1 from public.attendance x where x.user_id = l.user_id and x.event_id = e.id and x.status = 'going');
$$;
revoke execute on function public.friend_near_candidates() from public, anon, authenticated;

-- Расписание (UTC; Алматы = UTC+5).
select cron.unschedule(jobname) from cron.job where jobname in ('weather-hourly', 'push-reminders', 'push-friend-near', 'push-daily-feed', 'push-weekend');
select cron.schedule('weather-hourly', '7 * * * *', $$select public.call_function('weather')$$);
select cron.schedule('push-reminders', '*/10 * * * *', $$select public.call_function('notify', '{"type":"job","job":"reminders"}')$$);
select cron.schedule('push-friend-near', '*/10 * * * *', $$select public.call_function('notify', '{"type":"job","job":"friendNear"}')$$);
select cron.schedule('push-daily-feed', '0 5 * * *', $$select public.call_function('notify', '{"type":"job","job":"dailyFeed"}')$$);
select cron.schedule('push-weekend', '0 13 * * 4', $$select public.call_function('notify', '{"type":"job","job":"weekend"}')$$);

-- ===== 20260928000004_pipeline.sql =====
-- Этап 9: как события попадают на карту (docs/PIPELINE.md). Источники, сырые посты, черновики,
-- предложения пользователей, модерация, отмены и архив.

-- ——— Источники: команда добавляет один раз ———
create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('telegram', 'site', 'threads', 'manual', 'user')),
  handle text not null,             -- «afisha_almaty», ссылка на раздел
  title text not null,              -- «Telegram · @afisha_almaty»
  note text,                        -- «канал читается целиком»
  trusted boolean not null default false,
  auto_publish boolean not null default false, -- публиковать сразу при уверенности 95%+
  enabled boolean not null default true,
  cursor text,                      -- последний прочитанный пост
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  unique (kind, handle)
);
alter table public.sources enable row level security;
drop policy if exists sources_staff on public.sources;
create policy sources_staff on public.sources for all using (public.is_staff()) with check (public.is_staff());

-- ——— Сырые посты: краткая выжимка и ссылка, картинки — только адреса ———
create table if not exists public.raw_posts (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.sources (id) on delete cascade,
  external_id text not null,
  url text,
  text text,
  images text[] not null default '{}',
  posted_at timestamptz,
  class text check (class in ('event', 'ad', 'meme', 'not_almaty', 'duplicate', 'cancel')),
  event_id uuid references public.events (id) on delete set null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (source_id, external_id)
);
alter table public.raw_posts enable row level security;
drop policy if exists raw_posts_staff on public.raw_posts;
create policy raw_posts_staff on public.raw_posts for select using (public.is_staff());

-- ——— Черновики: поля модерации в events ———
alter table public.events add column if not exists source_id uuid references public.sources (id) on delete set null;
alter table public.events add column if not exists ai_confidence real;
alter table public.events add column if not exists flags text[] not null default '{}'; -- needs_pin, check_price
alter table public.events add column if not exists suggested_by uuid references auth.users (id) on delete set null;
alter table public.events add column if not exists published_at timestamptz;
alter table public.events add column if not exists cancelled_at timestamptz;
alter table public.events add column if not exists rejected boolean not null default false;
create index if not exists events_queue_idx on public.events (status, created_at) where status = 'draft' and not rejected;

-- ——— Предложения пользователей: в ту же очередь, статус draft ———
create or replace function public.suggest_event(
  p_title text, p_category text, p_starts_at timestamptz, p_ends_at timestamptz,
  p_place text, p_price text, p_about text, p_source_url text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  src uuid;
  ev uuid;
  today int;
begin
  if me is null then raise exception 'auth-required'; end if;
  select count(*) into today from events where suggested_by = me and created_at > now() - interval '1 day';
  if today >= 5 then raise exception 'too-many-suggestions'; end if;
  insert into sources (kind, handle, title) values ('user', 'app', 'Предложил пользователь')
    on conflict (kind, handle) do update set title = excluded.title returning id into src;
  insert into events (title, category, starts_at, ends_at, address, about, source_url, status, source_id, suggested_by, flags, is_free, created_by)
  values (
    left(p_title, 120), p_category, p_starts_at, p_ends_at, left(p_place, 200), left(p_about, 1000), p_source_url, 'draft', src, me,
    array['needs_pin'] || case when p_price is not null and p_price !~* '^\s*(бесплатно|0)\s*$' then array['check_price'] else '{}'::text[] end,
    p_price is null or p_price ~* '^\s*(бесплатно|0)\s*$', me
  ) returning id into ev;
  return ev;
end;
$$;
grant execute on function public.suggest_event(text, text, timestamptz, timestamptz, text, text, text, text) to authenticated;

-- ——— Модерация: одно действие — одна функция, только команда ———
create or replace function public.moderate_event(ev uuid, action text, lat double precision default null, lon double precision default null)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v uuid;
begin
  if not public.is_staff() then raise exception 'staff-only'; end if;
  if action = 'publish' then
    update events set status = 'published', published_at = now(), updated_at = now() where id = ev;
  elsif action = 'reject' then
    update events set rejected = true, updated_at = now() where id = ev;
  elsif action = 'pin' then
    if lat is null or lon is null then raise exception 'pin-needs-point'; end if;
    select venue_id into v from events where id = ev;
    if v is null then
      insert into venues (name, address, geog)
      select coalesce(nullif(e.address, ''), e.title) || ' · ' || left(e.id::text, 6), e.address, st_setsrid(st_makepoint(lon, lat), 4326)::geography
      from events e where e.id = ev
      returning id into v;
      update events set venue_id = v where id = ev;
    else
      update venues set geog = st_setsrid(st_makepoint(lon, lat), 4326)::geography, needs_pin = false where id = v;
    end if;
    update events set flags = array_remove(flags, 'needs_pin'), updated_at = now() where id = ev;
  elsif action = 'cancel' then
    update events set status = 'cancelled', cancelled_at = now(), updated_at = now() where id = ev;
    perform public.call_function('notify', jsonb_build_object('type', 'cancelled', 'event_id', ev));
  else
    raise exception 'unknown-action';
  end if;
end;
$$;
grant execute on function public.moderate_event(uuid, text, double precision, double precision) to authenticated;

-- Счётчики для шапки админки: ждут, на карте, отсеял ИИ (за 7 дней).
create or replace function public.moderation_stats()
returns table (waiting bigint, on_map bigint, filtered bigint, last_run timestamptz)
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from events where status = 'draft' and not rejected),
    (select count(*) from events where status = 'published' and coalesce(ends_at, starts_at + interval '3 hours') > now()),
    (select count(*) from raw_posts where class in ('ad', 'meme', 'not_almaty', 'duplicate') and created_at > now() - interval '7 days'),
    (select max(last_run_at) from sources)
  where public.is_staff();
$$;
grant execute on function public.moderation_stats() to authenticated;

-- ——— Архив и хроника ———
-- Закончившиеся события уходят в архив через 48 часов (чат события живёт столько же).
create or replace function public.archive_finished() returns int
language sql security definer set search_path = public as $$
  with done as (
    update events set status = 'archived', updated_at = now()
    where status = 'published' and coalesce(ends_at, starts_at + interval '3 hours') < now() - interval '48 hours'
    returning 1
  )
  select count(*)::int from done;
$$;
revoke execute on function public.archive_finished() from public, anon, authenticated;

-- Кто отметился на событии, видит его и в архиве, и после отмены — для хроники профиля.
drop policy if exists events_attended_read on public.events;
create policy events_attended_read on public.events for select using (
  exists (select 1 from public.attendance a where a.event_id = id and a.user_id = auth.uid() and a.status in ('going', 'arrived'))
);

-- Хроника профиля: где я отметился «Я на месте».
create or replace view public.my_timeline with (security_invoker = true) as
select e.id as event_id, e.title, e.category, e.starts_at, a.at as arrived_at, v.name as venue_name
from public.attendance a
join public.events e on e.id = a.event_id
left join public.venues v on v.id = e.venue_id
where a.user_id = auth.uid() and a.status = 'arrived';
grant select on public.my_timeline to authenticated;

-- ——— Для админки «Рекомендации»: вкус и сигналы человека видит только команда ———
drop policy if exists signals_staff_read on public.signals;
create policy signals_staff_read on public.signals for select using (public.is_staff());
drop policy if exists start_answers_staff_read on public.start_answers;
create policy start_answers_staff_read on public.start_answers for select using (public.is_staff());
drop policy if exists taste_staff_write on public.taste;
create policy taste_staff_write on public.taste for delete using (public.is_staff());

-- ——— Расписание: архив раз в сутки (04:10 по Алматы) ———
select cron.unschedule(jobname) from cron.job where jobname = 'archive-finished';
select cron.schedule('archive-finished', '10 23 * * *', $$select public.archive_finished()$$);

-- Стартовые источники из макета (выключены, пока нет юридической проверки — см. TECH.md «Источники»).
insert into public.sources (kind, handle, title, note, trusted, enabled) values
  ('telegram', 'afisha_almaty', 'Telegram · @afisha_almaty', 'канал читается целиком', false, false),
  ('site', 'afisha.yandex.kz/almaty', 'Яндекс Афиша · Алматы', 'ссылка на раздел города', true, false),
  ('threads', 'almaty.weekend', 'Threads · @almaty.weekend', 'посты и картинки-афиши', false, false),
  ('manual', 'admin', 'Добавлено вручную', null, true, true)
on conflict (kind, handle) do nothing;

-- Пуш команде после сбора: «7 событий ждут проверки». Зовёт воркер (ключ service role).
create or replace function public.notify_staff() returns void
language plpgsql security definer set search_path = public as $$
declare n bigint;
begin
  select count(*) into n from events where status = 'draft' and not rejected;
  if n > 0 then perform public.call_function('notify', jsonb_build_object('type', 'staff', 'count', n)); end if;
end;
$$;
revoke execute on function public.notify_staff() from public, anon, authenticated;
grant execute on function public.notify_staff() to service_role;

-- Площадки с координатами плоскими полями — для воркера (поиск по алиасам) и админки.
create or replace view public.venues_points with (security_invoker = true) as
select id, name, aliases, address, needs_pin,
       extensions.st_y(geog::extensions.geometry) as lat, extensions.st_x(geog::extensions.geometry) as lon
from public.venues;
grant select on public.venues_points to anon, authenticated;

-- Отмена от сборщика: источник с доверием — сразу и с пушем тем, кто собирался; иначе — флаг модератору.
create or replace function public.worker_cancel(ev uuid, sure boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if sure then
    update events set status = 'cancelled', cancelled_at = now(), updated_at = now() where id = ev and status = 'published';
    if found then perform public.call_function('notify', jsonb_build_object('type', 'cancelled', 'event_id', ev)); end if;
  else
    update events set flags = array_append(array_remove(flags, 'cancel_reported'), 'cancel_reported'), updated_at = now() where id = ev;
  end if;
end;
$$;
revoke execute on function public.worker_cancel(uuid, boolean) from public, anon, authenticated;
grant execute on function public.worker_cancel(uuid, boolean) to service_role;

-- ===== 20260928000005_release.sql =====
-- Этап 10: удаление аккаунта (App Store 5.1.1) и события аналитики (RECOMMENDATIONS.md, раздел 6).

-- Удалить себя: свои сообщения и загруженные файлы стираем явно, остальное (профиль, друзья, планы,
-- точки, сигналы, токены) — каскадом от строки auth.users.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'auth-required'; end if;
  delete from public.messages where author_id = me;
  delete from storage.objects where owner = me;
  delete from auth.users where id = me;
end;
$$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Аналитика: минимальные события без текста и координат. Писать может любой вошедший — только свои,
-- читать — только команда. Хранится 180 дней.
create table if not exists public.analytics_events (
  id bigserial primary key,
  user_id uuid references auth.users (id) on delete cascade,
  device_id text not null,
  name text not null check (name in ('feed_open', 'card_shown', 'go', 'skip', 'undo', 'cancel_plan', 'arrived', 'event_open', 'chat_sent')),
  event_id text,
  at timestamptz not null default now()
);
create index if not exists analytics_events_at_idx on public.analytics_events (at);
alter table public.analytics_events enable row level security;
drop policy if exists analytics_insert on public.analytics_events;
create policy analytics_insert on public.analytics_events for insert to authenticated with check (user_id = auth.uid());
drop policy if exists analytics_staff_read on public.analytics_events;
create policy analytics_staff_read on public.analytics_events for select using (public.is_staff());

select cron.unschedule(jobname) from cron.job where jobname = 'analytics-retention';
select cron.schedule('analytics-retention', '20 23 * * *', $$delete from public.analytics_events where at < now() - interval '180 days'$$);

-- ===== 20260930000006_sources.sql =====
-- Новые источники событий (выключены: включить переключателем в /admin → «Источники» после проверки условий сайта).
-- sxodim.com — «Куда сходить» по Алматы: страницы событий с разметкой schema.org, читает worker/src/sites.ts.
-- Threads @promoclub.almaty — много рекламы и акций; читать можно только через официальный Threads API (нужно приложение Meta).
insert into public.sources (kind, handle, title, note, trusted, enabled) values
  ('site', 'sxodim.com/almaty', 'Sxodim · Куда сходить в Алматы', 'страницы событий, разметка schema.org', false, false),
  ('threads', 'promoclub.almaty', 'Threads · @promoclub.almaty', 'в основном реклама и акции; бесплатные события — в модерацию', false, false)
on conflict (kind, handle) do nothing;

-- ===== 20260930000007_call_timeout.sql =====
-- Вызов функций из базы: ждём до 20 с, а не 5 (холодный старт Edge Function + внешний API погоды).
create or replace function public.call_function(fn text, body jsonb default '{}') returns void
language plpgsql security definer set search_path = public as $$
declare
  base text;
  key text;
begin
  select decrypted_secret into base from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into key from vault.decrypted_secrets where name = 'cron_secret';
  if base is null or key is null then return; end if;
  perform net.http_post(
    url := base || '/functions/v1/' || fn,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', key),
    body := body,
    timeout_milliseconds := 20000
  );
end;
$$;
revoke execute on function public.call_function(text, jsonb) from public, anon, authenticated;

-- ===== 20261004000008_search.sql =====
-- Поиск событий ИИ раз в сутки (Gemini CLI, .github/workflows/search.yml, worker/src/search.ts).
-- Всё найденное идёт только в «Согласование»: источник без доверия, сам на карту не публикует.
alter table public.sources drop constraint if exists sources_kind_check;
alter table public.sources add constraint sources_kind_check
  check (kind in ('telegram', 'site', 'search', 'threads', 'manual', 'user'));

insert into public.sources (kind, handle, title, note, trusted, auto_publish, enabled) values
  ('search', 'gemini', 'Поиск · Gemini', 'раз в сутки ищет события в интернете; картинка — со страницы события', false, false, true)
on conflict (kind, handle) do nothing;
