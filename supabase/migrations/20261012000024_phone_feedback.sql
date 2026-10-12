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
