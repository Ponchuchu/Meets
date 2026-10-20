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

-- ===== 20261004000009_covers.sql =====
-- Обложки событий: картинка со страницы события, а если её нет — иллюстрация от ИИ после одобрения
-- (worker/src/covers.ts). Публичный бакет covers; cover_ai — приложение подписывает «иллюстрация».
insert into storage.buckets (id, name, public) values ('covers', 'covers', true) on conflict (id) do nothing;
alter table public.events add column if not exists cover_ai boolean not null default false;

-- ===== 20261005000010_alpha_v6.sql =====
-- Альфа v6 (docs/ALPHA.md А0, docs/V6.md §12): кто видит, места, точки, бамп, очки и значки, голосовые и кружки,
-- робот поиска, переключатели панели. Повторяемая: if not exists / drop … if exists.

-- ——— ТРЦ и кино ———
alter table public.venues add column if not exists kind text not null default 'place';
alter table public.venues add column if not exists hours text;
alter table public.venues add column if not exists cover_url text;
alter table public.venues drop constraint if exists venues_kind_check;
alter table public.venues add constraint venues_kind_check check (kind in ('place', 'mall', 'cinema', 'park', 'bar', 'cafe'));

create table if not exists public.cinema_films (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  age text,
  poster_url text,
  duration_min int,
  source_url text,
  created_at timestamptz not null default now()
);
create table if not exists public.cinema_sessions (
  id uuid primary key default gen_random_uuid(),
  film_id uuid not null references public.cinema_films (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  starts_at timestamptz not null,
  hall text,
  format text,
  price_from int,
  buy_url text
);
create index if not exists cinema_sessions_venue_idx on public.cinema_sessions (venue_id, starts_at);
alter table public.cinema_films enable row level security;
alter table public.cinema_sessions enable row level security;
drop policy if exists cinema_films_read on public.cinema_films;
create policy cinema_films_read on public.cinema_films for select using (true);
drop policy if exists cinema_sessions_read on public.cinema_sessions;
create policy cinema_sessions_read on public.cinema_sessions for select using (true);

-- ——— Настройки профиля: любой переключатель из V6 §8.3 — пара ключ/значение ———
create table if not exists public.profile_settings (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null check (char_length(key) <= 48),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.profile_settings enable row level security;
drop policy if exists profile_settings_self on public.profile_settings;
create policy profile_settings_self on public.profile_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ——— Кто видит, где я ———
create table if not exists public.visibility (
  user_id uuid primary key references auth.users (id) on delete cascade,
  mode text not null default 'all' check (mode in ('all', 'except', 'only')),
  list uuid[] not null default '{}',
  invisible_until timestamptz,
  district_only boolean not null default false,
  statuses boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.visibility enable row level security;
drop policy if exists visibility_self on public.visibility;
create policy visibility_self on public.visibility for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Видит ли viewer точку owner: друзья, не в чёрном списке, по режиму «все / кроме / только», не невидимка.
create or replace function public.can_see_location(viewer uuid, owner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select viewer is not null and owner is not null and viewer <> owner
    and public.is_friend(viewer, owner)
    and not public.is_blocked(viewer, owner)
    and coalesce((
      select (v.invisible_until is null or v.invisible_until < now())
        and case v.mode when 'all' then true when 'except' then not (viewer = any (v.list)) else viewer = any (v.list) end
      from public.visibility v where v.user_id = owner
    ), true)
    and not coalesce((select m.invisible from public.marker_settings m where m.user_id = owner), false);
$$;
grant execute on function public.can_see_location(uuid, uuid) to authenticated;

-- ——— Мои места ———
create table if not exists public.user_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('home', 'work', 'study', 'gym', 'dacha', 'other')),
  title text,
  point extensions.geography(point, 4326) not null,
  days int[] not null default '{}',
  auto boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.user_places enable row level security;
drop policy if exists user_places_self on public.user_places;
create policy user_places_self on public.user_places for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ——— История точек (14 дней): статусы, хвост, «Где я был» ———
create table if not exists public.location_points (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now(),
  point extensions.geography(point, 4326) not null,
  speed real,
  heading real,
  accuracy real
);
create index if not exists location_points_user_idx on public.location_points (user_id, at desc);
alter table public.location_points enable row level security;
drop policy if exists location_points_self on public.location_points;
create policy location_points_self on public.location_points for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Последняя точка: владелец пишет, друзья читают по can_see_location (Realtime Postgres Changes тоже идёт через RLS).
alter table public.locations_last add column if not exists accuracy real;
alter table public.locations_last add column if not exists district text;
alter table public.locations_last add column if not exists status text;
drop policy if exists locations_friends_read on public.locations_last;
create policy locations_friends_read on public.locations_last for select using (public.can_see_location(auth.uid(), user_id));

-- Хвост: последние 4 точки друга за 10 минут.
create or replace function public.friend_trail(friend uuid)
returns table (lat double precision, lon double precision, at timestamptz)
language sql stable security definer set search_path = public, extensions as $$
  select st_y(p.point::geometry), st_x(p.point::geometry), p.at
  from public.location_points p
  where p.user_id = friend and public.can_see_location(auth.uid(), friend) and p.at > now() - interval '10 minutes'
    and not coalesce((select v.district_only from public.visibility v where v.user_id = friend), false)
  order by p.at desc limit 4;
$$;
grant execute on function public.friend_trail(uuid) to authenticated;

-- Точки друзей для карты: по can_see_location; «только район» — без координат, только район.
drop function if exists public.friend_locations();
create or replace function public.friend_locations()
returns table (user_id uuid, lat double precision, lon double precision, speed real, heading real, updated_at timestamptz, district text, status text)
language sql stable security definer set search_path = public, extensions as $$
  select l.user_id,
         case when coalesce(v.district_only, false) then null else st_y(l.geog::geometry) end,
         case when coalesce(v.district_only, false) then null else st_x(l.geog::geometry) end,
         case when coalesce(v.district_only, false) then null else l.speed end,
         l.heading, l.updated_at, l.district,
         case when coalesce(v.statuses, true) then l.status else null end
  from public.locations_last l
  left join public.visibility v on v.user_id = l.user_id
  where public.can_see_location(auth.uid(), l.user_id);
$$;
grant execute on function public.friend_locations() to authenticated;

-- ——— «Где я был» ———
create table if not exists public.explore_cells (
  user_id uuid not null references auth.users (id) on delete cascade,
  h3 text not null,
  first_at timestamptz not null default now(),
  primary key (user_id, h3)
);
alter table public.explore_cells enable row level security;
drop policy if exists explore_cells_self on public.explore_cells;
create policy explore_cells_self on public.explore_cells for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ——— Бамп ———
create table if not exists public.bumps (
  id uuid primary key default gen_random_uuid(),
  a uuid not null references auth.users (id) on delete cascade,
  b uuid references auth.users (id) on delete cascade,
  at timestamptz not null default now(),
  point extensions.geography(point, 4326)
);
create index if not exists bumps_at_idx on public.bumps (at desc);
alter table public.bumps enable row level security;
drop policy if exists bumps_read on public.bumps;
create policy bumps_read on public.bumps for select using (a = auth.uid() or b = auth.uid());

-- ——— Очки, уровень, награды, значки (начисляет только сервер) ———
create table if not exists public.points_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now(),
  kind text not null,
  points int not null,
  ref text
);
create unique index if not exists points_ledger_once on public.points_ledger (user_id, kind, ref);
alter table public.points_ledger enable row level security;
drop policy if exists points_self_read on public.points_ledger;
create policy points_self_read on public.points_ledger for select using (user_id = auth.uid());

create or replace view public.user_level with (security_invoker = true) as
  select user_id, sum(points)::int as points,
         case when sum(points) < 10000 then 1 + (sum(points) / 1000)::int else 11 + ((sum(points) - 10000) / 1500)::int end as level
  from public.points_ledger group by user_id;
grant select on public.user_level to authenticated;

create table if not exists public.rewards (
  code text primary key,
  kind text not null check (kind in ('frame', 'dot', 'trail')),
  level int not null,
  title text not null
);
create table if not exists public.user_rewards (
  user_id uuid not null references auth.users (id) on delete cascade,
  code text not null references public.rewards (code) on delete cascade,
  equipped boolean not null default false,
  primary key (user_id, code)
);
alter table public.rewards enable row level security;
alter table public.user_rewards enable row level security;
drop policy if exists rewards_read on public.rewards;
create policy rewards_read on public.rewards for select using (true);
drop policy if exists user_rewards_read on public.user_rewards;
create policy user_rewards_read on public.user_rewards for select using (user_id = auth.uid() or public.is_friend(auth.uid(), user_id));
drop policy if exists user_rewards_equip on public.user_rewards;
create policy user_rewards_equip on public.user_rewards for update using (user_id = auth.uid()) with check (user_id = auth.uid());

insert into public.rewards (code, kind, level, title) values
  ('frame-plain', 'frame', 1, 'Белая'), ('frame-sand', 'frame', 4, 'Песок'), ('frame-fire', 'frame', 8, 'Огонёк'), ('frame-night', 'frame', 12, 'Ночь'),
  ('dot-plain', 'dot', 1, 'Обычная'), ('dot-ring', 'dot', 3, 'Кольцо'), ('dot-star', 'dot', 6, 'Звезда'), ('dot-comet', 'dot', 10, 'Комета'),
  ('trail-ink', 'trail', 1, 'Чернила'), ('trail-sand', 'trail', 2, 'Песок'), ('trail-sea', 'trail', 5, 'Море'), ('trail-sunset', 'trail', 7, 'Закат'), ('trail-mountain', 'trail', 9, 'Горы')
on conflict (code) do nothing;

-- Значки альфы (V6 §8.6, ALPHA А6).
insert into public.badges (id, name, goal, how) values
  ('first-bump', 'Первый бамп', 1, 'Стукнись телефонами с другом'),
  ('call-friend', 'Позови друга', 1, 'Позови друга на событие, и он скажет «Иду»'),
  ('night-city', 'Ночь в городе', 1, 'Сходи на событие после 22:00'),
  ('walker', 'Пешеход', 10, 'Пройди 10 км пешком по дороге на события')
on conflict (id) do nothing;

-- Начислить очки и продвинуть значок (только сервер: security definer, вызывают функции и триггеры).
create or replace function public.award(who uuid, what text, pts int, refkey text, badge text default null, step int default 1)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.points_ledger (user_id, kind, points, ref) values (who, what, pts, refkey) on conflict do nothing;
  if badge is not null then
    insert into public.user_badges (user_id, badge_id, progress) values (who, badge, step)
    on conflict (user_id, badge_id) do update set progress = public.user_badges.progress + excluded.progress;
    update public.user_badges ub set got_at = now()
      from public.badges b where ub.user_id = who and ub.badge_id = badge and b.id = badge and ub.got_at is null and ub.progress >= b.goal;
  end if;
end $$;
revoke execute on function public.award(uuid, text, int, text, text, int) from public, anon, authenticated;

-- Новая дружба: +20 обоим.
create or replace function public.on_friendship_points() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.award(new.a, 'friend', 20, new.b::text);
  perform public.award(new.b, 'friend', 20, new.a::text);
  return new;
end $$;
drop trigger if exists friendship_points on public.friendships;
create trigger friendship_points after insert on public.friendships for each row execute function public.on_friendship_points();

-- ——— Сообщения: голосовые и кружки ———
alter table public.messages add column if not exists media_url text;
alter table public.messages add column if not exists duration_ms int;
alter table public.messages add column if not exists waveform smallint[];
alter table public.messages add column if not exists reply_to uuid references public.messages (id) on delete set null;
alter table public.messages add column if not exists deleted_for uuid[] not null default '{}';
alter table public.messages add column if not exists event_id uuid references public.events (id) on delete set null;
drop policy if exists messages_update_own on public.messages;
create policy messages_update_own on public.messages for update using (public.is_chat_member(chat_id)) with check (public.is_chat_member(chat_id));

-- ——— Робот поиска и панель разработчика (только staff) ———
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff s where s.user_id = auth.uid());
$$;
grant execute on function public.is_staff() to authenticated;

create table if not exists public.robot_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed', 'cancelled')),
  params jsonb not null default '{}',
  found int not null default 0,
  verified int not null default 0,
  queued int not null default 0,
  tokens int not null default 0,
  cancel boolean not null default false,
  started_by uuid references auth.users (id) on delete set null
);
create table if not exists public.robot_log (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.robot_runs (id) on delete cascade,
  at timestamptz not null default now(),
  level text not null default 'info' check (level in ('info', 'ok', 'warn', 'error')),
  text text not null
);
create index if not exists robot_log_run_idx on public.robot_log (run_id, at);
create table if not exists public.robot_schedule (
  task text primary key check (task in ('search', 'covers')),
  repeat text not null default 'daily' check (repeat in ('daily', 'weekly', 'hours')),
  days int[] not null default '{1,2,3,4,5,6,0}',
  time text not null default '09:00',
  every_hours int,
  paused boolean not null default true,
  last_run_at timestamptz
);
create table if not exists public.search_topics (
  id text primary key,
  title text not null,
  prompt text not null,
  enabled boolean not null default true
);
create table if not exists public.app_flags (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.robot_runs enable row level security;
alter table public.robot_log enable row level security;
alter table public.robot_schedule enable row level security;
alter table public.search_topics enable row level security;
alter table public.app_flags enable row level security;
drop policy if exists robot_runs_staff on public.robot_runs;
create policy robot_runs_staff on public.robot_runs for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists robot_log_staff on public.robot_log;
create policy robot_log_staff on public.robot_log for select using (public.is_staff());
drop policy if exists robot_schedule_staff on public.robot_schedule;
create policy robot_schedule_staff on public.robot_schedule for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists search_topics_staff on public.search_topics;
create policy search_topics_staff on public.search_topics for all using (public.is_staff()) with check (public.is_staff());
-- Флаги читают все (например, «alpha_login»), меняет только команда.
drop policy if exists app_flags_read on public.app_flags;
create policy app_flags_read on public.app_flags for select using (true);
drop policy if exists app_flags_staff on public.app_flags;
create policy app_flags_staff on public.app_flags for all using (public.is_staff()) with check (public.is_staff());

insert into public.app_flags (key, value) values
  ('alpha_login', 'true'), ('robot_paused', 'true'), ('covers_paused', 'true'), ('auto_publish', 'false')
on conflict (key) do nothing;
insert into public.robot_schedule (task, repeat, time, paused) values ('search', 'daily', '09:00', true), ('covers', 'daily', '10:00', true)
on conflict (task) do nothing;
insert into public.search_topics (id, title, prompt) values
  ('concerts', 'Концерты', 'концерты и живая музыка в Алматы'),
  ('standup', 'Стендап', 'стендап, открытые микрофоны, импровизация в Алматы'),
  ('art', 'Выставки', 'выставки, музеи, галереи в Алматы'),
  ('outdoor', 'Горы и город', 'походы, прогулки, городские события на улице в Алматы'),
  ('games', 'Настолки и квизы', 'настольные игры, квизы, мафия в Алматы'),
  ('food', 'Еда и маркеты', 'маркеты, фестивали еды, ярмарки в Алматы')
on conflict (id) do nothing;

-- Модерация из панели: staff видит и меняет черновики событий.
drop policy if exists events_staff_all on public.events;
create policy events_staff_all on public.events for all using (public.is_staff()) with check (public.is_staff());

-- ——— Хранилища: голосовые, кружки, обложки, аватарки ———
insert into storage.buckets (id, name, public) values
  ('voice', 'voice', false), ('circles', 'circles', false), ('covers', 'covers', true), ('avatars', 'avatars', true)
on conflict (id) do nothing;
-- Голосовые и кружки: путь «<chat_id>/<файл>», читать и писать — участникам чата.
drop policy if exists chat_media_read on storage.objects;
create policy chat_media_read on storage.objects for select to authenticated using (
  bucket_id in ('voice', 'circles') and public.is_chat_member((storage.foldername(name))[1]::uuid)
);
drop policy if exists chat_media_write on storage.objects;
create policy chat_media_write on storage.objects for insert to authenticated with check (
  bucket_id in ('voice', 'circles') and public.is_chat_member((storage.foldername(name))[1]::uuid)
);
-- Аватарки: путь «<user_id>/…», пишет только владелец.
drop policy if exists avatars_write on storage.objects;
create policy avatars_write on storage.objects for insert to authenticated with check (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects for update to authenticated using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);

-- ——— Realtime ———
do $$ begin alter publication supabase_realtime add table public.locations_last; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.robot_log; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.robot_runs; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.invites; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.events; exception when duplicate_object then null; end $$;

-- Broadcast каналов v6: «locations:<user>» — читать по can_see_location, «chat:<id>» — участникам («печатает…»),
-- «robot:<run>» — команде.
drop policy if exists v6_broadcast_write on realtime.messages;
create policy v6_broadcast_write on realtime.messages for insert to authenticated with check (
  realtime.topic() = 'locations:' || auth.uid()::text
  or (realtime.topic() like 'chat:%' and public.is_chat_member(substr(realtime.topic(), 6)::uuid))
);
drop policy if exists v6_broadcast_read on realtime.messages;
create policy v6_broadcast_read on realtime.messages for select to authenticated using (
  (realtime.topic() like 'locations:%' and public.can_see_location(auth.uid(), substr(realtime.topic(), 11)::uuid))
  or (realtime.topic() like 'chat:%' and public.is_chat_member(substr(realtime.topic(), 6)::uuid))
  or (realtime.topic() like 'robot:%' and public.is_staff())
);

-- ——— Уборка: история точек 14 дней ———
select cron.unschedule(jobname) from cron.job where jobname = 'location-points-retention';
select cron.schedule('location-points-retention', '40 23 * * *', $$delete from public.location_points where at < now() - interval '14 days'$$);

-- ===== 20261005000011_alpha_login.sql =====
-- Вход тестеров альфы без SMS (docs/ALPHA.md §1): попытки для лимита «5 за 10 минут на номер».
-- Номера тестеров здесь не хранятся — только в секрете функции ALPHA_TESTERS.
create table if not exists public.alpha_attempts (
  id bigint generated always as identity primary key,
  phone_hash text not null,
  at timestamptz not null default now(),
  ok boolean not null default false
);
create index if not exists alpha_attempts_idx on public.alpha_attempts (phone_hash, at desc);
alter table public.alpha_attempts enable row level security; -- без политик: пишет и читает только функция

-- В v6 дата рождения при входе не спрашивается.
alter table public.profiles alter column birth_date drop not null;

-- Читать профили — по старой политике profiles_read (кроме чёрного списка), писать свой — profiles_self.
drop policy if exists profiles_read_v6 on public.profiles;
drop policy if exists profiles_write_v6 on public.profiles;

-- ===== 20261005000012_route_bump.sql =====
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

-- ===== 20261005000013_robot_tick.sql =====
-- Расписание робота решает Supabase, а не GitHub (V6 §10.3): раз в 5 минут — robot-tick.
select cron.unschedule(jobname) from cron.job where jobname = 'robot-tick';
select cron.schedule('robot-tick', '*/5 * * * *', $$select public.call_function('robot-tick')$$);

-- ===== 20261005000014_events_live.sql =====
-- Карта и Рекомендации альфы: только одобренные события (у команды в events_feed видны и черновики).
create or replace view public.events_live with (security_invoker = true) as
select e.id, e.external_id, e.title, e.category, e.tags, e.starts_at, e.ends_at, e.is_long,
       v.id as venue_id, v.name as venue_name, v.kind as venue_kind,
       coalesce(e.address, v.address) as address, e.address_note,
       st_y(v.geog::geometry) as lat, st_x(v.geog::geometry) as lon,
       coalesce(v.needs_pin, true) as needs_pin,
       e.price_min, e.price_max, e.is_free, e.about, e.organizer, e.cover_url, e.source_url, e.visibility, e.status
from public.events e
left join public.venues v on v.id = e.venue_id
where e.status = 'published';
grant select on public.events_live to anon, authenticated;

-- Сколько человек идёт (число — не список, его видят все).
create or replace function public.event_going_counts(ids uuid[])
returns table (event_id uuid, going int, looking int)
language sql stable security definer set search_path = public as $$
  select e.id,
         (select count(*) from public.attendance a where a.event_id = e.id and a.status in ('going', 'arrived'))::int,
         (select count(*) from public.company_requests c where c.event_id = e.id)::int
  from unnest(ids) as e(id);
$$;
grant execute on function public.event_going_counts(uuid[]) to authenticated;

-- ===== 20261005000015_location_privacy.sql =====
-- Альфа А2: друзья видят точку только через friend_locations() и Broadcast — без прямого чтения таблицы
-- (иначе «только район» и огрубление до ~50 м обходились бы запросом к locations_last).
drop policy if exists locations_friends_read on public.locations_last;

drop function if exists public.friend_locations();
create or replace function public.friend_locations()
returns table (user_id uuid, lat double precision, lon double precision, speed real, heading real, updated_at timestamptz, district text, status text)
language sql stable security definer set search_path = public, extensions as $$
  select l.user_id,
         case when coalesce(v.district_only, false) then null else round(st_y(l.geog::geometry) / 0.00045) * 0.00045 end,
         case when coalesce(v.district_only, false) then null else round(st_x(l.geog::geometry) / 0.0006) * 0.0006 end,
         case when coalesce(v.district_only, false) then null else l.speed end,
         l.heading, l.updated_at, l.district,
         case when coalesce(v.statuses, true) then l.status else null end
  from public.locations_last l
  left join public.visibility v on v.user_id = l.user_id
  where public.can_see_location(auth.uid(), l.user_id);
$$;
grant execute on function public.friend_locations() to authenticated;

-- Хвост тоже огрублён.
create or replace function public.friend_trail(friend uuid)
returns table (lat double precision, lon double precision, at timestamptz)
language sql stable security definer set search_path = public, extensions as $$
  select round(st_y(p.point::geometry) / 0.00045) * 0.00045, round(st_x(p.point::geometry) / 0.0006) * 0.0006, p.at
  from public.location_points p
  where p.user_id = friend and public.can_see_location(auth.uid(), friend) and p.at > now() - interval '10 minutes'
    and not coalesce((select v.district_only from public.visibility v where v.user_id = friend), false)
  order by p.at desc limit 4;
$$;
grant execute on function public.friend_trail(uuid) to authenticated;

-- ===== 20261005000016_geocode.sql =====
-- FIX1 И2 п.8: точка каждого события по адресу. Геокодер (Edge Function geocode) пишет точку площадки
-- и откуда она: mapbox / manual (поставил разработчик) / seed. Не нашлось — needs_pin, событие ждёт точку в панели.
alter table public.venues add column if not exists geo_source text;
update public.venues set geo_source = 'seed' where geo_source is null and geog is not null and not needs_pin;

-- «Поставить точку» в панели — источник manual.
create or replace function public.mark_manual_pin() returns trigger
language plpgsql as $$
begin
  if new.geog is distinct from old.geog and not new.needs_pin and new.geo_source is not distinct from old.geo_source then
    new.geo_source := 'manual';
  end if;
  return new;
end;
$$;
drop trigger if exists venues_manual_pin on public.venues;
create trigger venues_manual_pin before update on public.venues for each row execute function public.mark_manual_pin();

-- ===== 20261005000017_traffic_score.sql =====
-- FIX1 И2 п.13: балл пробок Алматы 1–10 (своя формула по TomTom Flow Segment Data), пересчёт раз в 10 минут.
create table if not exists public.traffic_score (
  id int primary key default 1 check (id = 1),
  score int not null,
  ratio double precision not null,
  points jsonb not null default '[]',
  at timestamptz not null default now()
);
alter table public.traffic_score enable row level security;
drop policy if exists traffic_score_read on public.traffic_score;
create policy traffic_score_read on public.traffic_score for select to authenticated using (true);

select cron.unschedule('traffic-score') where exists (select 1 from cron.job where jobname = 'traffic-score');
select cron.schedule('traffic-score', '*/10 * * * *', $$select public.call_function('traffic-score')$$);

-- ===== 20261006000018_meetups_groups.sql =====
-- Встреча и приглашения создаются одной транзакцией; точный домашний адрес приватен.
create table if not exists public.meetup_locations (
  event_id uuid primary key references public.events(id) on delete cascade,
  address text not null, lat double precision not null, lon double precision not null
);
alter table public.meetup_locations add column if not exists details jsonb not null default '{}';
alter table public.meetup_locations enable row level security;
drop policy if exists meetup_location_read on public.meetup_locations;
create policy meetup_location_read on public.meetup_locations for select to authenticated using (
  exists(select 1 from public.events e where e.id = event_id and e.created_by = auth.uid())
  or exists(select 1 from public.meetup_guests g where g.event_id = meetup_locations.event_id and g.user_id = auth.uid() and g.accepted)
);
grant select on public.meetup_locations to authenticated;

create or replace function public.create_friend_meetup(payload jsonb) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  who uuid := auth.uid(); ev uuid; target uuid; chat uuid; key text;
  guests uuid[]; starts timestamptz; lat double precision; lon double precision;
begin
  if who is null then raise exception 'auth'; end if;
  key := 'meetup:' || who::text || ':' || (payload->>'request_key');
  if payload->>'request_key' is null then raise exception 'request-key'; end if;
  perform pg_advisory_xact_lock(hashtextextended(key, 0));
  select id into ev from public.events where external_id = key;
  if ev is not null then return ev; end if;
  guests := array(select distinct jsonb_array_elements_text(payload->'invited')::uuid);
  starts := (payload->>'starts_at')::timestamptz;
  lat := (payload->>'lat')::double precision; lon := (payload->>'lon')::double precision;
  if starts is null or lat is null or lon is null or payload->>'title' is null or payload->>'address' is null or length(trim(payload->>'title')) not between 1 and 60 or length(trim(payload->>'address')) < 3
    or starts <= now() or lat not between -90 and 90 or lon not between -180 and 180
    or cardinality(guests) not between 1 and 30 then raise exception 'invalid-meetup'; end if;
  foreach target in array guests loop
    if not public.is_friend(who, target) or target = who then raise exception 'friends-only'; end if;
  end loop;
  insert into public.events(external_id,title,category,starts_at,ends_at,address,address_note,about,organizer,is_free,status,visibility,created_by)
    values(key,trim(payload->>'title'),payload->>'category',starts,starts + interval '3 hours','Место встречи',
      'Точный адрес откроется после принятия приглашения',payload->>'about','Встреча друзей',true,'published','friends',who) returning id into ev;
  insert into public.meetup_locations(event_id,address,lat,lon,details) values(ev,payload->>'address',lat,lon,coalesce(payload->'details','{}'));
  insert into public.attendance(user_id,event_id,status) values(who,ev,'going');
  foreach target in array guests loop
    insert into public.meetup_guests(event_id,user_id) values(ev,target);
    insert into public.invites(from_id,to_id,event_id) values(who,target,ev);
    chat := public.open_direct_chat(target);
    insert into public.messages(chat_id,author_id,kind,body,event_id) values(chat,who,'invite',payload->>'title',ev);
  end loop;
  return ev;
end $$;
revoke all on function public.create_friend_meetup(jsonb) from public;
grant execute on function public.create_friend_meetup(jsonb) to authenticated;

create or replace function public.accept_meetup_invite() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.meetup_guests set accepted = coalesce(new.answer = 'yes',false) where event_id = new.event_id and user_id = new.to_id;
  if new.answer='yes' and old.answer is distinct from 'yes' and old.event_id is not null then
    perform public.award(old.from_id,'invitation',20,old.event_id::text||':'||old.to_id::text,'call-friend');
  end if;
  return new;
end $$;
drop trigger if exists meetup_invite_answer on public.invites;
create trigger meetup_invite_answer after update of answer on public.invites for each row execute function public.accept_meetup_invite();

alter table public.chats drop constraint if exists chats_kind_check;
alter table public.chats add constraint chats_kind_check check(kind in ('direct','event','group'));
alter table public.chats add column if not exists title text;
create or replace function public.create_friend_group(group_title text, friends uuid[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare who uuid := auth.uid(); chat uuid; target uuid;
begin
  if who is null then raise exception 'auth'; end if;
  friends := array(select distinct unnest(friends));
  if group_title is null or length(trim(group_title)) not between 1 and 60 or cardinality(friends) not between 1 and 30 then raise exception 'invalid-group'; end if;
  foreach target in array friends loop
    if target = who or not public.is_friend(who,target) then raise exception 'friends-only'; end if;
  end loop;
  insert into public.chats(kind,title) values('group',trim(group_title)) returning id into chat;
  insert into public.chat_members(chat_id,user_id) values(chat,who);
  insert into public.chat_members(chat_id,user_id) select chat,unnest(friends);
  return chat;
end $$;
revoke all on function public.create_friend_group(text,uuid[]) from public;
grant execute on function public.create_friend_group(text,uuid[]) to authenticated;

-- Сброс вкуса доступен самому человеку и сотруднику, не удаляет его планы.
create or replace function public.reset_user_taste(target_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or (auth.uid() <> target_user and not public.is_staff()) then raise exception 'forbidden'; end if;
  delete from public.signals where user_id = target_user;
  delete from public.attendance where user_id = target_user and status = 'skipped';
end $$;
revoke all on function public.reset_user_taste(uuid) from public;
grant execute on function public.reset_user_taste(uuid) to authenticated;

-- Координаты своих мест в форме, которую PostgREST читает без разбора WKB.
create or replace view public.user_places_points with (security_invoker=true) as
  select id,user_id,kind,title,auto,extensions.st_y(point::extensions.geometry) as lat,extensions.st_x(point::extensions.geometry) as lon from public.user_places;
grant select on public.user_places_points to authenticated;

-- Повторное начисление одного достижения не увеличивает значок.
create or replace function public.award(who uuid, what text, pts int, refkey text, badge text default null, step int default 1)
returns void language plpgsql security definer set search_path=public as $$
begin
  insert into public.points_ledger(user_id,kind,points,ref) values(who,what,pts,refkey) on conflict do nothing;
  if not found then return; end if;
  if badge is not null then
    insert into public.user_badges(user_id,badge_id,progress) values(who,badge,step)
      on conflict(user_id,badge_id) do update set progress=public.user_badges.progress+excluded.progress;
    update public.user_badges ub set got_at=now() from public.badges b
      where ub.user_id=who and ub.badge_id=badge and b.id=badge and ub.got_at is null and ub.progress>=b.goal;
  end if;
end $$;
revoke execute on function public.award(uuid,text,int,text,text,int) from public,anon,authenticated;

insert into public.badges(id,name,goal,how) values('first','Первый шаг',1,'Отметься «Я на месте» на событии'),('explorer','Исследователь',25,'Открой 25 новых клеток города') on conflict(id) do nothing;
create or replace function public.award_explore_cell() returns trigger
language plpgsql security definer set search_path=public as $$
begin perform public.award(new.user_id,'explore',5,new.h3,'explorer');return new;end $$;
drop trigger if exists award_explore on public.explore_cells;
create trigger award_explore after insert on public.explore_cells for each row execute function public.award_explore_cell();
create or replace function public.award_arrival() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.status='arrived' then
    perform public.award(new.user_id,'arrival',30,new.event_id::text,'first');
    if exists(select 1 from public.events where id=new.event_id and extract(hour from starts_at at time zone 'Asia/Almaty')>=22) then perform public.award(new.user_id,'night-event',10,new.event_id::text,'night-city');end if;
  end if;
  return new;
end $$;
drop trigger if exists award_arrived on public.attendance;
create trigger award_arrived after insert or update of status on public.attendance for each row execute function public.award_arrival();

-- ===== 20261011000019_admin_overview.sql =====
-- Панель разработчика, вкладка «Аналитика»: сводка по людям одним запросом. Только команда.
create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'new_24h', (select count(*) from public.profiles where created_at > now() - interval '24 hours'),
    'new_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'online_24h', (select count(*) from public.locations_last where updated_at > now() - interval '24 hours'),
    'sharing_now', (select count(*) from public.locations_last where updated_at > now() - interval '15 minutes'),
    'friendships', (select count(*) from public.friendships),
    'chats', (select count(*) from public.chats),
    'messages_24h', (select count(*) from public.messages where created_at > now() - interval '24 hours'),
    'going', (select count(*) from public.attendance where status = 'going'),
    'meetups', (select count(*) from public.events where visibility = 'friends'),
    'events_published', (select count(*) from public.events where status = 'published' and visibility = 'public'),
    'events_draft', (select count(*) from public.events where status = 'draft'),
    'events_no_price', (select count(*) from public.events where status = 'published' and visibility = 'public' and not is_free and price_min is null),
    'events_no_place', (select count(*) from public.events where status = 'published' and visibility = 'public' and venue_id is null and address is null),
    'top_cats', coalesce((select jsonb_agg(x) from (select category, count(*) n from public.events where status = 'published' and visibility = 'public' group by 1 order by 2 desc limit 5) x), '[]'::jsonb)
  ) into r;
  return r;
end $$;
revoke execute on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;

-- ===== 20261011000020_avatars_read.sql =====
-- Фото профиля не загружалось: загрузка с upsert требует права чтения строки в storage.objects, а политики чтения у бакета не было.
drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects for select to authenticated using (bucket_id = 'avatars');

-- ===== 20261012000021_admin_overview_v2.sql =====
-- Панель разработчика v2: в сводку добавлены «что требует внимания» — последний запуск поиска, ошибки, пустые поля у событий,
-- старые черновики. Всё считается одним запросом, только для команды.
-- FIX3: колонки robot_runs с префиксом rr. — иначе found совпадает с переменной PL/pgSQL FOUND и запрос падает.
create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'new_24h', (select count(*) from public.profiles where created_at > now() - interval '24 hours'),
    'new_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'online_24h', (select count(*) from public.locations_last where updated_at > now() - interval '24 hours'),
    'sharing_now', (select count(*) from public.locations_last where updated_at > now() - interval '15 minutes'),
    'friendships', (select count(*) from public.friendships),
    'chats', (select count(*) from public.chats),
    'messages_24h', (select count(*) from public.messages where created_at > now() - interval '24 hours'),
    'going', (select count(*) from public.attendance where status = 'going'),
    'meetups', (select count(*) from public.events where visibility = 'friends'),
    'events_published', (select count(*) from public.events where status = 'published' and visibility = 'public'),
    'events_upcoming', (select count(*) from public.events where status = 'published' and visibility = 'public' and coalesce(ends_at, starts_at + interval '3 hours') > now()),
    'events_draft', (select count(*) from public.events where status = 'draft' and not rejected),
    'drafts_stale', (select count(*) from public.events where status = 'draft' and not rejected and coalesce(ends_at, starts_at + interval '3 hours') < now()),
    'events_no_price', (select count(*) from public.events where status = 'published' and visibility = 'public' and coalesce(ends_at, starts_at + interval '3 hours') > now() and not is_free and price_min is null),
    'events_no_place', (select count(*) from public.events e left join public.venues v on v.id = e.venue_id where e.status = 'published' and e.visibility = 'public' and coalesce(e.ends_at, e.starts_at + interval '3 hours') > now() and (v.geog is null or v.needs_pin)),
    'events_no_cover', (select count(*) from public.events where status = 'published' and visibility = 'public' and coalesce(ends_at, starts_at + interval '3 hours') > now() and cover_url is null),
    'runs_failed_24h', (select count(*) from public.robot_runs where status = 'failed' and started_at > now() - interval '24 hours'),
    'last_run', (select jsonb_build_object('status', rr.status, 'found', rr.found, 'queued', rr.queued, 'at', coalesce(rr.finished_at, rr.started_at), 'params', rr.params,
                   'error', (select l.text from public.robot_log l where l.run_id = rr.id and l.level = 'error' order by l.at desc limit 1))
                 from public.robot_runs rr order by rr.started_at desc limit 1),
    'top_cats', coalesce((select jsonb_agg(x) from (select category, count(*) n from public.events where status = 'published' and visibility = 'public' group by 1 order by 2 desc limit 5) x), '[]'::jsonb)
  ) into r;
  return r;
end $$;
revoke execute on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;

-- ===== 20261012000022_admin_events_manage.sql =====
-- Панель разработчика: «Все события» — переименовать, поменять фото, снять с карты, удалить.
-- Удаление «мягкое»: событие уходит в архив с пометкой rejected, чтобы поиск не вернул его снова,
-- а планы и чаты людей, которые уже на него записались, не пропали.
alter table public.events add column if not exists orig_title text;

create or replace function public.staff_rename_event(ev uuid, new_title text)
returns void language plpgsql security definer set search_path = public as $$
declare t text := btrim(coalesce(new_title, ''));
begin
  if not public.is_staff() then raise exception 'staff-only'; end if;
  if char_length(t) < 2 or char_length(t) > 120 then raise exception 'bad-title'; end if;
  update events set orig_title = coalesce(orig_title, title), title = t, updated_at = now() where id = ev;
end;
$$;
grant execute on function public.staff_rename_event(uuid, text) to authenticated;

create or replace function public.staff_event_action(ev uuid, action text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'staff-only'; end if;
  if action = 'unpublish' then
    update events set status = 'draft', published_at = null, updated_at = now() where id = ev and visibility = 'public';
  elsif action = 'delete' then
    update events set status = 'archived', rejected = true, updated_at = now() where id = ev and visibility = 'public';
  else
    raise exception 'unknown-action';
  end if;
end;
$$;
grant execute on function public.staff_event_action(uuid, text) to authenticated;

-- Фото события от сотрудника: кладёт и заменяет только staff, читают все (бакет публичный).
drop policy if exists covers_staff_write on storage.objects;
create policy covers_staff_write on storage.objects for insert to authenticated with check (bucket_id = 'covers' and public.is_staff());
drop policy if exists covers_staff_update on storage.objects;
create policy covers_staff_update on storage.objects for update to authenticated using (bucket_id = 'covers' and public.is_staff());

-- ===== 20261012000023_robot_stats.sql =====
-- Итоги запуска поиска для панели разработчика: что прочитано с каждого сайта, что отсеяно, сколько новых карточек и какого качества
-- (с фото, с точкой, с ценой), разбор Telegram. Пишет воркер (worker/src/runstats.ts), читает панель «Ивенты».
alter table public.robot_runs add column if not exists stats jsonb;
comment on column public.robot_runs.stats is 'Итоги запуска: sources, outside, merged, kept, queue{added,published,duplicates,...}, telegram[], ai{...}';

-- ===== 20261012000024_review_fixes.sql =====
-- Переименование касается только публичной афиши, частные встречи не меняем.
create or replace function public.staff_rename_event(ev uuid, new_title text)
returns void language plpgsql security definer set search_path = public as $$
declare t text := btrim(coalesce(new_title, ''));
begin
  if not public.is_staff() then raise exception 'staff-only'; end if;
  if char_length(t) < 2 or char_length(t) > 120 then raise exception 'bad-title'; end if;
  update public.events set orig_title = coalesce(orig_title, title), title = t, updated_at = now()
    where id = ev and visibility = 'public';
  if not found then raise exception 'public-event-not-found'; end if;
end;
$$;
revoke execute on function public.staff_rename_event(uuid, text) from public, anon;
grant execute on function public.staff_rename_event(uuid, text) to authenticated;

-- Карта остаётся на events_live. Планы могут показать снятое событие его участнику.
-- security_invoker сохраняет существующие правила доступа events, attendance и venues.
create or replace view public.events_for_plans with (security_invoker = true) as
select e.id, e.external_id, e.title, e.category, e.tags, e.starts_at, e.ends_at, e.is_long,
       v.id as venue_id, v.name as venue_name, v.kind as venue_kind,
       coalesce(e.address, v.address) as address, e.address_note,
       st_y(v.geog::geometry) as lat, st_x(v.geog::geometry) as lon,
       coalesce(v.needs_pin, true) as needs_pin,
       e.price_min, e.price_max, e.is_free, e.about, e.organizer, e.cover_url, e.source_url,
       e.visibility, e.status
from public.events e
left join public.venues v on v.id = e.venue_id
where e.status = 'published'
   or (e.visibility = 'public' and exists (
     select 1 from public.attendance a
     where a.event_id = e.id and a.user_id = auth.uid() and a.status in ('going', 'arrived')
   ));
revoke all on public.events_for_plans from public, anon;
grant select on public.events_for_plans to authenticated;

-- ===== 20261012000025_cinema_sources.sql =====
-- Киноафиши добавлены в настройки. Пока не проверен настоящий формат сайтов,
-- сбор выключен: нельзя выдавать неподтверждённое расписание за готовое.
insert into public.sources (kind, handle, title, trusted, auto_publish, enabled)
values
  ('site', 'chaplin.kz', 'Chaplin · кино', false, false, false),
  ('site', 'kino.kz', 'Kino.kz · кино', false, false, false),
  ('site', 'ticketon.kz/almaty/cinema', 'Ticketon · кино', false, false, false),
  ('site', 'kinopark.kz/ru/movies/today', 'Kinopark · кино', false, false, false),
  ('site', 'kz.kinoafisha.info/almaty/cinema', 'Киноафиша · Алматы', false, false, false),
  ('site', 'afisha.yandex.kz/almaty/cinema', 'Яндекс · кино', false, false, false),
  ('site', 'lyubimiigorod.ru/almaty/cinema', 'Любимый город · кино', false, false, false)
on conflict (kind, handle) do nothing;

-- ===== 20261012000026_chat_read.sql =====
-- Поздний ответ сети не возвращает уже прочитанные сообщения в непрочитанные.
-- Участник может менять только отметку чтения, не chat_id/user_id своего членства.
revoke update on public.chat_members from public, anon, authenticated;
grant update (last_read_at) on public.chat_members to authenticated;

create or replace function public.mark_chat_read(p_chat uuid, p_seen timestamptz)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null or p_seen is null then raise exception 'not-authenticated'; end if;
  update public.chat_members
    set last_read_at = greatest(coalesce(last_read_at, '-infinity'::timestamptz), least(p_seen, now()))
    where chat_id = p_chat and user_id = auth.uid();
  if not found then raise exception 'chat-not-found'; end if;
end;
$$;
revoke execute on function public.mark_chat_read(uuid, timestamptz) from public, anon;
grant execute on function public.mark_chat_read(uuid, timestamptz) to authenticated;

-- ===== 20261012000027_phone_feedback.sql =====
-- 12 октября: шаги, персональная дата посещения, перенос своей встречи, быстрый список чатов.
create table if not exists public.daily_steps (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null, steps integer not null check(steps between 0 and 100000),
  updated_at timestamptz not null default now(), primary key(user_id,day)
);
alter table public.daily_steps enable row level security;
drop policy if exists daily_steps_read on public.daily_steps;
create policy daily_steps_read on public.daily_steps for select to authenticated using(user_id=auth.uid());
grant select on public.daily_steps to authenticated;

create or replace function public.record_daily_steps(step_day date, step_count integer) returns integer
language plpgsql security definer set search_path=public as $$
declare who uuid:=auth.uid(); count_now integer;
begin
  if who is null then raise exception 'auth'; end if;
  if step_day<>(now() at time zone 'Asia/Almaty')::date or step_count not between 0 and 100000 or step_count is null then raise exception 'invalid-steps'; end if;
  insert into public.daily_steps(user_id,day,steps) values(who,step_day,step_count)
    on conflict(user_id,day) do update set steps=greatest(daily_steps.steps,excluded.steps),updated_at=now() returning steps into count_now;
  if count_now>=3000 then perform public.award(who,'steps',10,step_day::text||':3000'); end if;
  if count_now>=6000 then perform public.award(who,'steps',20,step_day::text||':6000'); end if;
  if count_now>=10000 then perform public.award(who,'steps',30,step_day::text||':10000'); end if;
  return count_now;
end $$;
revoke all on function public.record_daily_steps(date,integer) from public;
grant execute on function public.record_daily_steps(date,integer) to authenticated;

alter table public.attendance add column if not exists visit_at timestamptz;
create or replace function public.choose_event_visit(event uuid, visit timestamptz) returns void
language plpgsql security definer set search_path=public as $$
declare e public.events;
begin
  if auth.uid() is null then raise exception 'auth'; end if;
  select * into e from public.events where id=event and status='published' and (visibility='public' or created_by=auth.uid() or exists(select 1 from public.meetup_guests g where g.event_id=event and g.user_id=auth.uid()));
  if not found then raise exception 'event-unavailable'; end if;
  if visit is null or visit<greatest(e.starts_at,now()) or visit>=coalesce(e.ends_at,e.starts_at+interval '2 hours') then raise exception 'invalid-visit'; end if;
  insert into public.attendance(user_id,event_id,status,visit_at) values(auth.uid(),event,'going',visit)
    on conflict(user_id,event_id) do update set status='going',visit_at=excluded.visit_at;
end $$;
revoke all on function public.choose_event_visit(uuid,timestamptz) from public;
grant execute on function public.choose_event_visit(uuid,timestamptz) to authenticated;

create or replace function public.reschedule_meetup(event uuid, new_start timestamptz) returns void
language plpgsql security definer set search_path=public as $$
declare e public.events; finish timestamptz;
begin
  if auth.uid() is null then raise exception 'auth'; end if;
  select * into e from public.events where id=event and created_by=auth.uid() and exists(select 1 from public.meetup_locations l where l.event_id=event) for update;
  if not found then raise exception 'not-owner'; end if;
  if new_start is null or new_start<=now() or new_start>now()+interval '92 days' then raise exception 'invalid-start'; end if;
  finish:=new_start+greatest(coalesce(e.ends_at-e.starts_at,interval '3 hours'),interval '1 minute');
  update public.events set starts_at=new_start,ends_at=finish,updated_at=now() where id=event;
  update public.attendance set visit_at=new_start where event_id=event and visit_at is not null;
  insert into public.messages(chat_id,author_id,kind,body,event_id)
    select distinct m.chat_id,auth.uid(),'system','Встреча перенесена на '||to_char(new_start at time zone 'Asia/Almaty','DD.MM HH24:MI'),event
    from public.messages m where m.event_id=event and exists(select 1 from public.chat_members c where c.chat_id=m.chat_id and c.user_id=auth.uid());
end $$;
revoke all on function public.reschedule_meetup(uuid,timestamptz) from public;
grant execute on function public.reschedule_meetup(uuid,timestamptz) to authenticated;

create index if not exists messages_chat_recent_idx on public.messages(chat_id,created_at desc,id desc);
create or replace function public.my_chat_summaries() returns table(chat_id uuid, author_id uuid, body text, kind text, created_at timestamptz, unread bigint)
language sql stable security invoker set search_path=public as $$
  select c.chat_id,m.author_id,m.body,m.kind,m.created_at,
    (select count(*) from public.messages u where u.chat_id=c.chat_id and u.author_id<>auth.uid() and (c.last_read_at is null or u.created_at>c.last_read_at))
  from public.chat_members c left join lateral (
    select author_id,body,kind,created_at from public.messages where chat_id=c.chat_id order by created_at desc,id desc limit 1
  ) m on true where c.user_id=auth.uid();
$$;
revoke all on function public.my_chat_summaries() from public;
grant execute on function public.my_chat_summaries() to authenticated;

alter table public.profiles add column if not exists map_frame text not null default 'classic' check(map_frame in ('classic','sunset','forest','violet'));

-- Владелец встречи доступен клиенту; остальные колонки view не меняются.
create or replace view public.events_live with(security_invoker=true) as
select e.id,e.external_id,e.title,e.category,e.tags,e.starts_at,e.ends_at,e.is_long,
       v.id as venue_id,v.name as venue_name,v.kind as venue_kind,
       coalesce(e.address,v.address) as address,e.address_note,
       extensions.st_y(v.geog::extensions.geometry) as lat,extensions.st_x(v.geog::extensions.geometry) as lon,
       coalesce(v.needs_pin,true) as needs_pin,
       e.price_min,e.price_max,e.is_free,e.about,e.organizer,e.cover_url,e.source_url,e.visibility,e.status,e.created_by
from public.events e left join public.venues v on v.id=e.venue_id where e.status='published';

alter table public.profiles add column if not exists map_trail text not null default 'dots' check(map_trail in ('none','dots','comet'));

create or replace function public.check_map_frame() returns trigger
language plpgsql security definer set search_path=public as $$
declare lvl integer; required integer;
begin
  if new.map_frame is not distinct from old.map_frame and new.map_trail is not distinct from old.map_trail then return new; end if;
  required:=case new.map_frame when 'sunset' then 2 when 'forest' then 3 when 'violet' then 7 else 1 end;
  if new.map_trail='comet' then required:=greatest(required,3); end if;
  select level into lvl from public.user_level where user_id=new.id;
  if coalesce(lvl,1)<required then raise exception 'frame-locked'; end if;
  return new;
end $$;
drop trigger if exists check_map_frame on public.profiles;
create trigger check_map_frame before update of map_frame,map_trail on public.profiles for each row execute function public.check_map_frame();

create or replace function public.due_event_reminders(from_at timestamptz,to_at timestamptz)
returns table(user_id uuid,event_id uuid,title text)
language sql stable security definer set search_path=public as $$
  select a.user_id,a.event_id,e.title from public.attendance a join public.events e on e.id=a.event_id
  where a.status='going' and e.status='published' and coalesce(a.visit_at,e.starts_at)>=from_at and coalesce(a.visit_at,e.starts_at)<to_at;
$$;
revoke all on function public.due_event_reminders(timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.due_event_reminders(timestamptz,timestamptz) to service_role;

-- Повтор запроса после потери сети не дублирует сообщение.
alter table public.messages add column if not exists client_key text;
create unique index if not exists messages_client_key_once on public.messages(author_id,client_key) where client_key is not null;
create or replace function public.send_chat_message(chat uuid,client text,message_body text,message_kind text default 'text',media text default null,duration integer default null,event uuid default null) returns uuid
language plpgsql security invoker set search_path=public as $$
declare result uuid;
begin
  if auth.uid() is null or client is null or length(client) not between 1 and 160 then raise exception 'invalid-message'; end if;
  insert into public.messages(chat_id,author_id,kind,body,media_path,duration_s,event_id,client_key)
    values(chat,auth.uid(),message_kind,message_body,media,duration,event,client)
    on conflict(author_id,client_key) where client_key is not null do nothing returning id into result;
  if result is null then select id into result from public.messages where author_id=auth.uid() and client_key=client and chat_id=chat; end if;
  if result is null then raise exception 'client-key-conflict'; end if;
  return result;
end $$;
revoke all on function public.send_chat_message(uuid,text,text,text,text,integer,uuid) from public;
grant execute on function public.send_chat_message(uuid,text,text,text,text,integer,uuid) to authenticated;

-- Адреса уже опубликованных карточек: отдельная операция только для команды/воркера.
create or replace function public.repair_event_point(event uuid,latitude double precision,longitude double precision) returns void
language plpgsql security definer set search_path=public,extensions as $$
declare e public.events; v public.venues; venue uuid;
begin
  if coalesce(auth.role(),'')<>'service_role' and not public.is_staff() then raise exception 'staff-only'; end if;
  if latitude is null or longitude is null or latitude not between 43.05 and 43.40 or longitude not between 76.70 and 77.20 then raise exception 'outside-almaty'; end if;
  select * into e from public.events where id=event and visibility='public' and status in ('draft','published') for update;
  if not found or e.address is null or length(trim(e.address))<3 then raise exception 'no-public-address'; end if;
  select * into v from public.venues where id=e.venue_id;
  insert into public.venues(name,address,geog,needs_pin)
    values(coalesce(v.name,e.title)||' · '||e.address,e.address,st_setsrid(st_makepoint(longitude,latitude),4326)::geography,false)
    on conflict(name) do update set address=excluded.address,geog=excluded.geog,needs_pin=false returning id into venue;
  update public.events set venue_id=venue,flags=array_remove(flags,'needs_pin'),updated_at=now() where id=event;
end $$;
revoke all on function public.repair_event_point(uuid,double precision,double precision) from public;
grant execute on function public.repair_event_point(uuid,double precision,double precision) to authenticated,service_role;

-- ===== 20261020000024_reliability.sql =====
-- Надёжные заявки в друзья, права сообщений и индексы. Применить до обновления приложения.
begin;

create index if not exists messages_chat_recent_idx on public.messages(chat_id, created_at desc, id desc);
create index if not exists friendships_by_b on public.friendships(b, a);
create index if not exists friend_requests_incoming on public.friend_requests(to_id, status);
create index if not exists chat_members_by_user on public.chat_members(user_id, chat_id);
drop policy if exists messages_update_own on public.messages;
create policy messages_update_own on public.messages for update to authenticated
  using (author_id = auth.uid() and public.is_chat_member(chat_id))
  with check (author_id = auth.uid() and public.is_chat_member(chat_id));

drop policy if exists friend_requests_cancel on public.friend_requests;
create policy friend_requests_cancel on public.friend_requests for delete to authenticated
  using (from_id = auth.uid() and status = 'pending');
-- Получатель меняет только статус; нельзя подменить отправителя или адресата принятой заявки.
revoke update on public.friend_requests from authenticated;
grant update(status) on public.friend_requests to authenticated;

create or replace function public.send_friend_request(other uuid, request_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'auth-required'; end if;
  if other is null or other = me then raise exception 'invalid-recipient'; end if;
  if public.is_blocked(me, other) then raise exception 'blocked'; end if;
  -- Одновременные встречные заявки обрабатываются одной транзакцией за другой.
  perform pg_advisory_xact_lock(hashtextextended(least(me, other)::text || greatest(me, other)::text, 0));
  if public.is_friend(me, other) then return; end if;
  insert into public.friend_requests(from_id, to_id, note, status)
    values (me, other, left(request_note, 500), 'pending')
    on conflict (from_id, to_id) do update set note = excluded.note, status = 'pending', created_at = now();
  if exists(select 1 from public.friend_requests where from_id = other and to_id = me and status = 'pending') then
    update public.friend_requests set status = 'accepted'
      where (from_id = me and to_id = other) or (from_id = other and to_id = me);
  end if;
end $$;
revoke all on function public.send_friend_request(uuid, text) from public, anon;
grant execute on function public.send_friend_request(uuid, text) to authenticated;

-- Списки обновляются через Realtime; при отсутствии публикации клиент использует сверку раз в минуту.
do $$
declare t text;
begin
  if exists(select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['friendships','friend_requests','chat_members','messages'] loop
      if not exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
commit;

-- ===== 20261020000028_places_addresses.sql =====
-- Места из Overture и справочник адресов Алматы (OpenStreetMap + Overture), docs/MAP-DATA.md.
-- Адрес из карточки события («ул. Жандосова 1/1», «Жандосов көшесі, 1/1») находит свою точку:
-- нормализуем одинаково на записи и на запросе, ищем по триграммам с поправкой на близость.

create extension if not exists pg_trgm with schema extensions;

-- «Достық даңғылы 42» и «пр. Достык, 42» → «достык 42». Казахские буквы → русские, слова-типы улиц — прочь,
-- окончания имён — тоже: «Жандосова» (рус.) и «Жандосов көшесі» (каз.) → «жандосов», «Абая» и «Абай» → «аба».
create or replace function public.norm_addr(t text) returns text
language sql immutable parallel safe as $$
  select btrim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
    -- скобки, этаж, офис, квартира — не часть адреса дома
    regexp_replace(regexp_replace(translate(lower(coalesce(t, '')), 'ёәөүұқғңһі', 'еаоуукгнхи'),
      '\([^)]*\)', ' ', 'g'), '(\d+\s*-?\s*(этаж|эт)\.?|(офис|оф|кв|каб|кабинет|блок|вход|подъезд)\.?\s*[0-9а-яa-z/-]+)', ' ', 'g'),
    '(^|[^а-яa-z0-9])(г|город|алматы|алма-ата|улица|ул|көшесі|кошеси|көш|кош|проспект|пр-т|пр|просп|даңғылы|дангылы|даң|микрорайон|мкр|мкрн|шағын ауданы|шагын ауданы|ш\.а|переулок|пер|бульвар|б-р|шоссе|площадь|пл|тас жолы|набережная|наб|к)(?=[^а-яa-z0-9]|$)\.?', ' ', 'g'),
    '[^а-яa-z0-9/]+', ' ', 'g'),
    '([а-я]{3,}?)(а|я|й)(?= |$)', '\1', 'g'),
    '\s+', ' ', 'g'))
$$;

-- Тип улицы — чтобы «проспект Абая 10» (= «Абай даңғылы 10», центр) не путался с «улица Абая 10» в пригороде.
create or replace function public.addr_type(t text) returns text
language sql immutable parallel safe as $$
  select case
    when t ~* '(^|[^а-яәөүұқғңһі])(проспект|пр-т|пр|просп|даңғылы|дангылы|даң)([^а-яәөүұқғңһі]|$)' then 'пр'
    when t ~* '(^|[^а-яәөүұқғңһі])(микрорайон|мкр|мкрн|шағын ауданы|шагын ауданы|ш\.а)([^а-яәөүұқғңһі]|$)' then 'мкр'
    when t ~* '(^|[^а-яәөүұқғңһі])(бульвар|б-р|желекжолы)([^а-яәөүұқғңһі]|$)' then 'бул'
    when t ~* '(^|[^а-яәөүұқғңһі])(переулок|пер|тұйық көшесі)([^а-яәөүұқғңһі]|$)' then 'пер'
    when t ~* '(^|[^а-яәөүұқғңһі])(улица|ул|көшесі|кошеси|көш)([^а-яәөүұқғңһі]|$)' then 'ул'
  end
$$;

create table if not exists public.addresses (
  id bigserial primary key,
  street text not null,
  house text not null,
  label text not null,
  norm text generated always as (public.norm_addr(street || ' ' || house)) stored,
  geog extensions.geography(point, 4326) not null,
  source text not null check (source in ('osm', 'overture'))
);
-- Одинаковые улицы бывают в разных районах — уникальности по норме нет; дубли одного дома (ближе 80 м) чистит загрузчик.
create index if not exists addresses_norm_idx on public.addresses (norm);
create index if not exists addresses_norm_trgm on public.addresses using gin (norm extensions.gin_trgm_ops);
create index if not exists addresses_geog_idx on public.addresses using gist (geog);
alter table public.addresses enable row level security;
drop policy if exists addresses_read on public.addresses;
create policy addresses_read on public.addresses for select to anon, authenticated using (true);

create table if not exists public.places (
  id text primary key,
  name text not null,
  kind text not null,
  category text,
  address text,
  geog extensions.geography(point, 4326) not null,
  confidence real not null default 0,
  source text not null default 'overture',
  updated_at timestamptz not null default now()
);
create index if not exists places_geog_idx on public.places using gist (geog);
create index if not exists places_name_trgm on public.places using gin (lower(name) extensions.gin_trgm_ops);
alter table public.places enable row level security;
drop policy if exists places_read on public.places;
create policy places_read on public.places for select to anon, authenticated using (true);

-- Подсказки адреса: похожие по тексту, при равенстве — ближе к точке (если есть).
create or replace function public.suggest_address(q text, near_lat double precision default null, near_lon double precision default null, lim int default 6)
returns table (label text, street text, house text, lat double precision, lon double precision, score real)
language sql stable security invoker set search_path = public, extensions as $$
  with n as (select public.norm_addr(q) as v)
  select a.label, a.street, a.house, extensions.st_y(a.geog::extensions.geometry), extensions.st_x(a.geog::extensions.geometry),
    extensions.similarity(a.norm, n.v)::real as score
  from public.addresses a, n
  where length(n.v) >= 3 and a.norm operator(extensions.%) n.v
  order by (a.norm = n.v) desc,
    extensions.similarity(a.norm, n.v) desc,
    coalesce(public.addr_type(q) = public.addr_type(a.label), false) desc,
    -- Рядом с точкой, а без точки — ближе к центру города (события в основном там).
    extensions.st_distance(a.geog, extensions.st_makepoint(coalesce(near_lon, 76.9286), coalesce(near_lat, 43.2567))::extensions.geography)
  limit least(greatest(lim, 1), 20)
$$;

-- Лучшее совпадение для сборщика событий: только уверенное (дом совпадает, похожесть ≥ 0,5).
create or replace function public.match_address(q text)
returns table (label text, lat double precision, lon double precision, score real)
language sql stable security invoker set search_path = public, extensions as $$
  select s.label, s.lat, s.lon, s.score from public.suggest_address(q, null, null, 3) with ordinality s(label, street, house, lat, lon, score, i)
  where s.score >= 0.5 and (regexp_match(public.norm_addr(q), '(\d+[а-яa-z]?(/\d+[а-яa-z]?)?)\s*$'))[1] = s.house
     or s.score >= 0.95
  order by s.i limit 1
$$;

-- Места в видимой области карты (с 15-го масштаба), не больше lim — дёшево для телефона.
create or replace function public.places_in_view(w double precision, s double precision, e double precision, n double precision, lim int default 150)
returns table (id text, name text, kind text, category text, address text, lat double precision, lon double precision)
language sql stable security invoker set search_path = public, extensions as $$
  select p.id, p.name, p.kind, p.category, p.address, extensions.st_y(p.geog::extensions.geometry), extensions.st_x(p.geog::extensions.geometry)
  from public.places p
  where p.geog operator(extensions.&&) extensions.st_makeenvelope(w, s, e, n, 4326)::extensions.geography
  order by p.confidence desc
  limit least(greatest(lim, 1), 300)
$$;

-- Поиск мест по названию («Куда сходить?»).
create or replace function public.search_places(q text, lim int default 12)
returns table (id text, name text, kind text, category text, address text, lat double precision, lon double precision)
language sql stable security invoker set search_path = public, extensions as $$
  select p.id, p.name, p.kind, p.category, p.address, extensions.st_y(p.geog::extensions.geometry), extensions.st_x(p.geog::extensions.geometry)
  from public.places p
  where length(q) >= 2 and (lower(p.name) like '%' || lower(q) || '%' or lower(p.name) operator(extensions.%) lower(q))
  order by (lower(p.name) like lower(q) || '%') desc, extensions.similarity(lower(p.name), lower(q)) desc, p.confidence desc
  limit least(greatest(lim, 1), 30)
$$;

grant execute on function public.norm_addr(text), public.addr_type(text), public.suggest_address(text, double precision, double precision, int), public.match_address(text),
  public.places_in_view(double precision, double precision, double precision, double precision, int), public.search_places(text, int) to anon, authenticated;

-- Адрес под точкой («как в доставке»): ближайший дом в 60 м.
create or replace function public.nearest_address(lat double precision, lon double precision)
returns table (label text, dist real)
language sql stable security invoker set search_path = public, extensions as $$
  select a.label, extensions.st_distance(a.geog, p.g)::real
  from public.addresses a, (select extensions.st_makepoint(lon, lat)::extensions.geography g) p
  where extensions.st_dwithin(a.geog, p.g, 60)
  order by a.geog operator(extensions.<->) p.g limit 1
$$;
grant execute on function public.nearest_address(double precision, double precision) to anon, authenticated;

-- ===== 20261020000029_illustrated_frames.sql =====
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

-- ===== 20261020000030_fix3_backend.sql =====
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

-- ===== 20261020000031_malls.sql =====
-- FIX3 Ф3: на карте нажимаются только торговые центры, где почти всегда есть события (решение владельца 20 октября).
-- Точки — из справочника мест Overture (places); часы — обычные для ТРЦ Алматы. Повторное применение обновляет данные.
insert into public.venues (name, kind, address, hours, geog, needs_pin, geo_source) values
  ('Dostyk Plaza', 'mall', 'пр. Достык, 111, уг. ул. Жолдасбекова', '10:00–22:00', extensions.st_setsrid(extensions.st_makepoint(76.95683, 43.23339), 4326)::extensions.geography, false, 'overture'),
  ('MEGA Alma-Ata', 'mall', 'ул. Розыбакиева, 247А', '10:00–22:00', extensions.st_setsrid(extensions.st_makepoint(76.89234, 43.20247), 4326)::extensions.geography, false, 'overture'),
  ('MEGA Park', 'mall', 'ул. Макатаева, 127/1, уг. пр. Сейфуллина', '10:00–22:00', extensions.st_setsrid(extensions.st_makepoint(76.92977, 43.26418), 4326)::extensions.geography, false, 'overture'),
  ('Esentai Mall', 'mall', 'пр. Аль-Фараби, 77/8', '10:00–22:00', extensions.st_setsrid(extensions.st_makepoint(76.92762, 43.21848), 4326)::extensions.geography, false, 'overture'),
  ('Aport Mall East', 'mall', 'Кульджинский тракт, 106', '10:00–22:00', extensions.st_setsrid(extensions.st_makepoint(77.02384, 43.31526), 4326)::extensions.geography, false, 'overture'),
  ('Aport Mall West', 'mall', 'Ташкентский тракт, 18', '10:00–22:00', extensions.st_setsrid(extensions.st_makepoint(76.82176, 43.23306), 4326)::extensions.geography, false, 'overture')
on conflict (name) do update set kind = excluded.kind, address = excluded.address, hours = coalesce(public.venues.hours, excluded.hours),
  geog = excluded.geog, needs_pin = false, geo_source = excluded.geo_source;

-- FIX3 Ф4: событие с адресом само находит точку по справочнику адресов (match_address), если у площадки точки нет,
-- она «примерная» или стоит в центре города по умолчанию. Срабатывает при добавлении и смене адреса; старые — разово ниже.
create or replace function public.point_from_address(ev uuid) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare e public.events; v public.venues; m record; venue uuid;
begin
  select * into e from public.events where id = ev;
  if not found or e.visibility <> 'public' or coalesce(length(trim(e.address)), 0) < 3 then return false; end if;
  select * into v from public.venues where id = e.venue_id;
  if v.id is not null and v.geog is not null and not v.needs_pin
     and not st_dwithin(v.geog, st_makepoint(76.8897, 43.2389)::geography, 30) then return false; end if;
  select * into m from public.match_address(e.address);
  if m.lat is null then return false; end if;
  insert into public.venues(name, address, geog, needs_pin, geo_source)
    values (coalesce(v.name, e.title) || ' · ' || m.label, m.label, st_setsrid(st_makepoint(m.lon, m.lat), 4326)::geography, false, 'addresses')
    on conflict (name) do update set geog = excluded.geog, needs_pin = false returning id into venue;
  update public.events set venue_id = venue, flags = array_remove(flags, 'needs_pin') where id = ev;
  return true;
end $$;
revoke all on function public.point_from_address(uuid) from public, anon, authenticated;

create or replace function public.events_point_from_address() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.point_from_address(new.id);
  return null;
end $$;
drop trigger if exists events_point_from_address on public.events;
create trigger events_point_from_address after insert or update of address, venue_id on public.events
  for each row when (pg_trigger_depth() < 1) execute function public.events_point_from_address();

select public.point_from_address(e.id) from public.events e
  where e.visibility = 'public' and e.status in ('draft', 'published') and not e.rejected
    and coalesce(e.ends_at, e.starts_at + interval '3 hours') > now();
