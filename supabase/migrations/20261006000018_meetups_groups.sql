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
