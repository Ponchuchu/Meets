-- Демо-люди и чаты макета в настоящей базе (этап 8). Применяется после миграций: `npm run db:seed-demo`.
-- Люди — отдельные аккаунты без входа (почта @demo.ryadom). Фото — ключи встроенных картинок приложения.
-- Подключить себя: `npm run db:seed-demo -- +77071234567` — друзья, заявки и чаты как в макете.

create or replace function public.demo_id(key text) returns uuid language sql immutable as $$
  select md5('ryadom-demo-' || key)::uuid
$$;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
select public.demo_id(k), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', k || '@demo.ryadom', '', now(), now() - interval '30 days', now(), '{"provider":"email"}', '{}'
from unnest(array['igor', 'denis', 'anton', 'timur', 'ainura', 'erlan', 'mira', 'sasha', 'nurlan']) as k
on conflict (id) do nothing;

insert into public.profiles (id, name, birth_date, photo_url, handle, about, plans_visible, who_can_write, achievements_visible)
values
  (public.demo_id('igor'),   'Игорь',  date '2001-03-14', 'igor',   'igor',   'Джаз, горы и кофе у окна', 'all', 'common', 'all'),
  (public.demo_id('denis'),  'Денис',  date '1998-07-02', 'denis',  'denis',  'Катаюсь по городу, ищу выставки', 'friends', 'common', 'friends'),
  (public.demo_id('anton'),  'Антон',  date '1997-11-20', 'anton',  'anton',  'Музеи и настолки', 'friends', 'common', 'friends'),
  (public.demo_id('timur'),  'Тимур',  date '1999-05-09', null,     'timur',  'Велосипед по выходным', 'friends', 'common', 'friends'),
  (public.demo_id('ainura'), 'Айнура', date '1997-02-11', 'ainura', 'ainura', 'Стендап и хорошая компания', 'all', 'common', 'all'),
  (public.demo_id('erlan'),  'Ерлан',  date '1999-01-25', null,     'erlan',  'Настолки по средам', 'friends', 'common', 'friends'),
  (public.demo_id('mira'),   'Мира',   date '2004-04-04', null,     'mira',   'Лекции и кино', 'friends', 'common', 'friends'),
  (public.demo_id('sasha'),  'Саша',   date '2000-09-30', null,     'sasha',  'Бегаю по средам', 'friends', 'common', 'friends'),
  (public.demo_id('nurlan'), 'Нурлан', date '1996-06-18', null,     'nurlan', 'Горы', 'friends', 'common', 'friends')
on conflict (id) do nothing;

-- Друзья и чаты макета для настоящего аккаунта. Время сообщений — сегодня по Алматы.
create or replace function public.demo_connect(me uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  today timestamptz := date_trunc('day', now() at time zone 'Asia/Almaty') at time zone 'Asia/Almaty';
  f text;
  c_igor uuid := md5('ryadom-demo-chat-igor-' || me)::uuid;
  c_ainura uuid := md5('ryadom-demo-chat-ainura-' || me)::uuid;
  c_jazz uuid := md5('ryadom-demo-chat-jazz-' || me)::uuid;
  c_games uuid := md5('ryadom-demo-chat-games-' || me)::uuid;
  poll_id uuid := md5('ryadom-demo-poll-' || me)::uuid;
begin
  foreach f in array array['igor', 'denis', 'anton', 'timur'] loop
    insert into friendships (a, b) values (least(me, demo_id(f)), greatest(me, demo_id(f))) on conflict do nothing;
  end loop;
  insert into friend_requests (from_id, to_id, note) values
    (demo_id('erlan'), me, 'познакомились на настолках'),
    (demo_id('mira'), me, '2 общих друга')
  on conflict do nothing;

  insert into chats (id, kind, meet_point) values
    (c_igor, 'direct', null),
    (c_ainura, 'direct', null),
    (c_jazz, 'event', 'Вход во двор с Панфилова, 19:15'),
    (c_games, 'event', 'Антикафе, 2 этаж, звонок «Игротека», 19:50')
  on conflict (id) do nothing;
  insert into chat_members (chat_id, user_id) values
    (c_igor, me), (c_igor, demo_id('igor')),
    (c_ainura, me), (c_ainura, demo_id('ainura')),
    (c_jazz, me), (c_jazz, demo_id('sasha')), (c_jazz, demo_id('igor')), (c_jazz, demo_id('denis')), (c_jazz, demo_id('ainura')), (c_jazz, demo_id('erlan')), (c_jazz, demo_id('mira')),
    (c_games, me), (c_games, demo_id('erlan'))
  on conflict do nothing;

  if not exists (select 1 from messages where chat_id = c_igor) then
    insert into messages (chat_id, author_id, kind, body, media_path, duration_s, created_at) values
      (c_igor, me, 'sticker', 'ТЫ ГДЕ?', null, null, today + interval '17 hours 50 minutes'),
      (c_igor, demo_id('igor'), 'voice', null, null, 9, today + interval '17 hours 51 minutes'),
      (c_igor, demo_id('igor'), 'photo', 'Я тут, у окна', 'igor1', null, today + interval '17 hours 53 minutes'),
      (c_igor, demo_id('igor'), 'text', 'Го! Встретимся у арки в 19:15', null, null, today + interval '17 hours 56 minutes'),
      (c_igor, demo_id('igor'), 'text', 'Ты уже выходишь?', null, null, today + interval '18 hours 10 minutes'),
      (c_ainura, me, 'text', 'Увидел, что ты ищешь компанию на стендап в пятницу. Я тоже хотел — пойдём вместе?', null, null, today + interval '11 hours 4 minutes'),
      (c_ainura, demo_id('ainura'), 'voice', null, null, 14, today + interval '11 hours 5 minutes'),
      (c_ainura, demo_id('ainura'), 'text', 'Давай! Возьму нам места поближе к сцене', null, null, today + interval '11 hours 5 minutes 30 seconds'),
      (c_ainura, me, 'circle', null, 'krug', 7, today + interval '11 hours 6 minutes'),
      (c_ainura, demo_id('ainura'), 'video', 'С прошлого микрофона, будет смешно', 'hike', 21, today + interval '11 hours 8 minutes'),
      (c_jazz, null, 'system', 'АЙНУРА ПРИСОЕДИНИЛАСЬ', null, null, today + interval '17 hours 30 minutes'),
      (c_jazz, demo_id('sasha'), 'text', 'Займу столик у сцены, нас уже четверо', null, null, today + interval '17 hours 41 minutes'),
      (c_jazz, demo_id('igor'), 'text', 'Буду в 19:20, чуть опоздаю', null, null, today + interval '17 hours 52 minutes'),
      (c_jazz, me, 'text', 'Я впервые, буду у входа в зелёной куртке', null, null, today + interval '18 hours 4 minutes'),
      (c_games, demo_id('erlan'), 'text', 'Кто берёт Каркассон?', null, null, today + interval '17 hours 40 minutes');
    insert into messages (id, chat_id, author_id, kind, body, created_at)
      values (poll_id, c_jazz, demo_id('sasha'), 'poll', 'Куда после?', today + interval '17 hours 58 minutes');
    insert into polls (message_id, question, options)
      values (poll_id, 'Куда после?', array['Гулять по Панфилова', 'Кофе рядом', 'Домой, завтра работа']);
  end if;
end;
$$;
revoke execute on function public.demo_connect(uuid) from public, anon, authenticated;
