-- Источники 2.0 (26 октября, решение владельца): ИИ-поиск по интернету выключен, всё собирает скрипт.
-- Instagram-страницы читаем через API Facebook (Business Discovery, секреты IG_TOKEN и IG_USER_ID в Supabase).
-- У источника есть папка (Афиши, Площадки, Театры…), своё место по умолчанию (для страницы площадки) и счётчики для панели.

alter table public.sources add column if not exists folder text not null default 'other';
alter table public.sources drop constraint if exists sources_folder_check;
alter table public.sources add constraint sources_folder_check
  check (folder in ('afisha', 'venue', 'mall', 'hike', 'theatre', 'music', 'standup', 'art', 'cinema', 'sport', 'community', 'kids', 'city', 'other'));
-- Место по умолчанию: страница площадки почти никогда не пишет свой адрес в посте.
alter table public.sources add column if not exists venue_name text;
-- Что вернул последний сбор: { ok_at, error, posts, events, dups, junk, name, followers, avatar, last_post_at }.
alter table public.sources add column if not exists stats jsonb not null default '{}';

-- Медиа события: [{ type: 'image' | 'video', url, poster? }] — фото и видео из поста (копии в хранилище event-media).
alter table public.events add column if not exists media jsonb not null default '[]';
alter table public.raw_posts add column if not exists media jsonb not null default '[]';
alter table public.raw_posts drop constraint if exists raw_posts_class_check;
alter table public.raw_posts add constraint raw_posts_class_check
  check (class in ('event', 'ad', 'meme', 'not_almaty', 'duplicate', 'cancel', 'unclear', 'past'));

-- Публичное хранилище для фото и видео событий (копии из Instagram: ссылки Instagram живут несколько дней).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-media', 'event-media', true, 31457280, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Неработающие афиши (ни одного события за всё время) и ИИ-поиск — удаляем. Кино теперь берём со страниц кинотеатров в Instagram.
-- Уже найденные события остаются (source_id станет пустым).
delete from public.sources where kind = 'search'
  or (kind = 'site' and handle in ('chaplin.kz', 'kino.kz', 'kinopark.kz/ru/movies/today', 'ticketon.kz/almaty/cinema',
    'kz.kinoafisha.info/almaty/cinema', 'lyubimiigorod.ru/almaty/cinema', 'afisha.yandex.kz/almaty/cinema',
    'onvibe.me/almaty', 'gorodzovet.ru/almaty', 'inform.kz', 'gov.kz/memleket/entities/almaty', 'kino.kz/ru/concert'));

update public.sources set folder = 'afisha' where kind in ('site', 'telegram', 'threads') and folder = 'other';

-- Страницы Instagram, проверенные 26 октября: бизнес-аккаунты Алматы, которые публикуют даты событий.
insert into public.sources (kind, handle, title, folder, venue_name, trusted, auto_publish, enabled) values
  ('instagram', 'sxodim', 'Sxodim', 'afisha', null, false, false, true),
  ('instagram', 'kuda.almaty', 'Куда пойти в Алматы', 'afisha', null, false, false, true),
  ('instagram', 'afisha_almaty', 'Женская афиша Алматы', 'afisha', null, false, false, true),
  ('instagram', 'akimat_almaty', 'Акимат Алматы', 'city', null, false, false, true),
  ('instagram', 'idemsbaby_almaty', 'Афиша для детей', 'kids', null, false, false, true),
  ('instagram', 'almatyarena', 'Almaty Arena', 'venue', 'Almaty Arena', true, true, true),
  ('instagram', 'dostykplaza', 'Dostyk Plaza', 'mall', 'Dostyk Plaza', true, false, true),
  ('instagram', 'forum_almaty', 'Forum Mall', 'mall', 'Forum', true, false, true),
  ('instagram', 'mega_center', 'MEGA Alma-Ata', 'mall', 'MEGA Alma-Ata', true, false, true),
  ('instagram', 'moskva_metropolitan', 'Moskva Metropolitan', 'mall', 'ТРЦ Moskva Metropolitan', true, false, true),
  ('instagram', 'trk_adk', 'ТРК ADK', 'mall', 'ТРК ADK', true, false, true),
  ('instagram', 'almatymallkz', 'Almaty Mall', 'mall', 'ТРЦ Almaty Mall', true, false, true),
  ('instagram', 'aportmall_east', 'Aport Mall East', 'mall', 'Aport Mall East', true, false, true),
  ('instagram', 'mart_almaty', 'ТРЦ MART', 'mall', 'ТРЦ MART', true, false, true),
  ('instagram', 'esentai.mall', 'Esentai Mall', 'mall', 'Esentai Mall', true, false, true),
  ('instagram', 'dom36kz', 'Дом на Барибаева', 'venue', 'Дом на Барибаева', true, false, true),
  ('instagram', 'ala.space', 'ALA Space', 'venue', 'ALA Space', true, false, true),
  ('instagram', 'kumanobar', 'Kumano', 'music', 'Kumano', true, false, true),
  ('instagram', 'spotlight.ala', 'Spotlight', 'music', 'Spotlight', true, false, true),
  ('instagram', 'thetheater_almaty', 'The Theater', 'music', 'The Theater', false, false, true),
  ('instagram', 'teatralka.almaty', 'Театралка', 'music', 'Театралка', false, false, true),
  ('instagram', 'dair_ard', 'Dair Ard', 'music', null, false, false, true),
  ('instagram', 'lermontov.theatre', 'Театр Лермонтова', 'theatre', 'Театр им. Лермонтова', true, true, true),
  ('instagram', 'total_theater', 'Тотальный театр', 'theatre', 'Тотальный театр', true, true, true),
  ('instagram', 'satstheatre_almaty', 'Театр Наталии Сац', 'theatre', 'Театр Наталии Сац', true, true, true),
  ('instagram', 'artishock_theatre', 'Театр ARTиШОК', 'theatre', 'Театр ARTиШОК', true, true, true),
  ('instagram', 'almaty.theatre', 'Almaty Theatre', 'theatre', 'Almaty Theatre', true, true, true),
  ('instagram', 'stages.kz', 'Театр Stages', 'theatre', 'Театр Stages', true, false, true),
  ('instagram', '2act_theatre', 'Театр 2act', 'theatre', 'Театр 2act', true, false, true),
  ('instagram', 'teatronkz', 'ТеатРон', 'theatre', 'ТеатРон', true, false, true),
  ('instagram', 'central.standup.almaty', 'Central Stand-up Club', 'standup', 'Central Stand-up Club', true, true, true),
  ('instagram', 'punch.standupclub', 'Punch Stand-Up Club', 'standup', 'Punch Stand Up Club', true, true, true),
  ('instagram', 'standupcamp', 'Stand Up Camp', 'standup', null, false, false, true),
  ('instagram', 'improv.kz', 'Импровизация SixHumor', 'standup', null, false, false, true),
  ('instagram', 'almatymuseumofarts', 'Almaty Museum of Arts', 'art', 'Almaty Museum of Arts', true, true, true),
  ('instagram', 'esentaigallery', 'Esentai Gallery', 'art', 'Esentai Gallery', true, true, true),
  ('instagram', 'aspangallery', 'Aspan Gallery', 'art', 'Aspan Gallery', true, false, true),
  ('instagram', 'chaplincinemas', 'Chaplin Cinemas', 'cinema', null, false, false, true),
  ('instagram', 'kinopark_kz', 'Kinopark', 'cinema', null, false, false, true),
  ('instagram', 'kino.kz', 'Kino.kz', 'cinema', null, false, false, true),
  ('instagram', 'open_cinema_almaty', 'Кинотеатр на крыше', 'cinema', 'Open Cinema Almaty', true, false, true),
  ('instagram', 'vkuskino.kz', 'Вкус кино', 'cinema', null, false, false, true),
  ('instagram', 'almatymarathon', 'Almaty Marathon', 'sport', null, false, false, true),
  ('instagram', 'trcalmaty', 'Tiger Running Club', 'sport', null, false, false, true),
  ('instagram', 'gornie_ludi', 'Горные люди', 'hike', null, false, false, true),
  ('instagram', 'gorny_club_almaty', 'Горный клуб Алматы', 'hike', null, false, false, true),
  ('instagram', 'monte_almaty', 'Monte · походы в горы', 'hike', null, false, false, true),
  ('instagram', 'kudaidem.kz', 'Kudaidem · походы', 'hike', null, false, false, true),
  ('instagram', 'turclub.kz', 'Спортивные туристы Казахстана', 'hike', null, false, false, true),
  ('instagram', 'fst.alma.ata', 'Клуб туристов «Романтик»', 'hike', null, false, false, true),
  ('instagram', 'club_marcopolo', 'Турклуб «Марко Поло»', 'hike', null, false, false, true),
  ('instagram', 'kazmountclub', 'Казахстанский горный клуб', 'hike', null, false, false, true),
  ('instagram', 'quizplease_almaty', 'Квиз, плиз!', 'community', null, false, false, true),
  ('instagram', 'zabylirifmy_kz', 'Забыли рифму', 'community', null, false, false, true),
  ('instagram', 'psy.meet.kz', 'Клуб любителей психологии', 'community', null, false, false, true),
  ('instagram', 'batylbol_almaty', 'Батыл бол! Разговорный клуб', 'community', null, false, false, true),
  ('instagram', 'minglecafe.kz', 'Mingle Speaking Club', 'community', null, false, false, true),
  ('instagram', 'junta.kz', 'Книжный клуб «Хунта»', 'community', null, false, false, true),
  ('instagram', 'green__submarine', 'Экоуроки и эковстречи', 'community', null, false, false, true)
on conflict (kind, handle) do update set folder = excluded.folder, title = excluded.title, venue_name = coalesce(public.sources.venue_name, excluded.venue_name);

update public.sources set folder = 'venue', venue_name = 'Almaty Arena' where kind = 'instagram' and handle = 'almatyarena';

-- Отчёт по источникам для панели: сколько событий дал каждый, сколько сейчас на карте и ждёт проверки.
create or replace function public.source_report() returns table (
  id uuid, events_total int, events_live int, drafts int, events_week int, posts_week int
) language sql stable security definer set search_path = public as $$
  select s.id,
    (select count(*)::int from events e where e.source_id = s.id),
    (select count(*)::int from events e where e.source_id = s.id and e.status = 'published' and coalesce(e.ends_at, e.starts_at + interval '3 hours') > now()),
    (select count(*)::int from events e where e.source_id = s.id and e.status = 'draft' and not e.rejected),
    (select count(*)::int from events e where e.source_id = s.id and e.created_at > now() - interval '7 days'),
    (select count(*)::int from raw_posts p where p.source_id = s.id and p.created_at > now() - interval '7 days')
  from sources s
  where public.is_staff() and s.kind <> 'user';
$$;
revoke execute on function public.source_report() from public, anon;
grant execute on function public.source_report() to authenticated;
