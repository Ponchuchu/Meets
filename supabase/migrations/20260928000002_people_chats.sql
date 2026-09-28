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

-- Друзьям — точка друга, только если он делится, не невидимка и не в зоне дома; точность ~50 м.
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
    and m.share_until is not null and m.share_until > now()
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
  moods text[] not null default '{}' check (cardinality(moods) <= 2),
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
alter table if exists realtime.messages enable row level security;
drop policy if exists loc_broadcast_write on realtime.messages;
create policy loc_broadcast_write on realtime.messages for insert to authenticated with check (
  realtime.topic() = 'loc:' || auth.uid()::text
);
drop policy if exists loc_broadcast_read on realtime.messages;
create policy loc_broadcast_read on realtime.messages for select to authenticated using (
  realtime.topic() like 'loc:%'
  and public.is_friend(auth.uid(), substr(realtime.topic(), 5)::uuid)
);
