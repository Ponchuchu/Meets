-- «Кто-то пытался войти в твой аккаунт» (FIX5): неудачная попытка входа запоминает, чей это аккаунт и с какого устройства,
-- и попадает в ленту уведомлений владельца. Номер телефона по-прежнему хранится только хэшем.
alter table public.alpha_attempts add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.alpha_attempts add column if not exists user_agent text;
create index if not exists alpha_attempts_user on public.alpha_attempts (user_id, at desc) where user_id is not null;

-- Чей номер: только для функции входа (service role), людям не доступно.
create or replace function public.user_id_by_phone(p text) returns uuid
language sql stable security definer set search_path = public, auth as $$
  select id from auth.users where phone = ltrim(p, '+') or phone = p limit 1
$$;
revoke all on function public.user_id_by_phone(text) from public, anon, authenticated;
grant execute on function public.user_id_by_phone(text) to service_role;

-- Лента уведомлений теперь показывает и неудачные попытки входа.
create or replace function public.my_activity()
returns table (kind text, at timestamptz, person_id uuid, person_name text, person_photo text, event_id uuid, event_title text, detail text)
language sql stable security definer set search_path = public, auth as $$
  with me as (select auth.uid() as id)
  select * from (
    select 'friend_request'::text as kind, r.created_at as at, r.from_id as person_id, p.name as person_name, p.photo_url as person_photo, null::uuid as event_id, null::text as event_title, r.note as detail
      from public.friend_requests r join public.profiles p on p.id = r.from_id, me
      where r.to_id = me.id and r.status = 'pending'
    union all
    select 'friend_added', f.created_at, case when f.a = me.id then f.b else f.a end, p.name, p.photo_url, null, null, null
      from public.friendships f, me, public.profiles p
      where me.id in (f.a, f.b) and p.id = case when f.a = me.id then f.b else f.a end and f.created_at > now() - interval '60 days'
    union all
    select 'invite', i.created_at, i.from_id, p.name, p.photo_url, i.event_id, e.title, i.answer
      from public.invites i join public.profiles p on p.id = i.from_id left join public.events e on e.id = i.event_id, me
      where i.to_id = me.id and i.created_at > now() - interval '60 days'
    union all
    select 'invite_answer', i.created_at, i.to_id, p.name, p.photo_url, i.event_id, e.title, i.answer
      from public.invites i join public.profiles p on p.id = i.to_id left join public.events e on e.id = i.event_id, me
      where i.from_id = me.id and i.answer is not null and i.created_at > now() - interval '60 days'
    union all
    select 'push_' || n.kind, n.sent_at,
      case when n.kind in ('sticker', 'friendNear') then n.about end,
      case when n.kind in ('sticker', 'friendNear') then (select name from public.profiles where id = n.about) end,
      case when n.kind in ('sticker', 'friendNear') then (select photo_url from public.profiles where id = n.about) end,
      case when n.kind in ('reminder', 'cancelled') then n.about end,
      case when n.kind in ('reminder', 'cancelled') then (select title from public.events where id = n.about) end,
      null
      from public.notification_log n, me
      where n.user_id = me.id and n.kind in ('sticker', 'friendNear', 'reminder', 'cancelled', 'dailyFeed', 'weekend') and n.sent_at > now() - interval '30 days'
    union all
    select 'login', s.created_at, null, null, null, null, null, coalesce(s.user_agent, '')
      from auth.sessions s, me
      where s.user_id = me.id and s.created_at > now() - interval '60 days'
    union all
    select 'login_failed', a.at, null, null, null, null, null, coalesce(a.user_agent, '')
      from public.alpha_attempts a, me
      where a.user_id = me.id and a.ok = false and a.at > now() - interval '30 days'
  ) x
  where auth.uid() is not null
  order by 2 desc
  limit 120
$$;
revoke all on function public.my_activity() from public, anon;
grant execute on function public.my_activity() to authenticated;
