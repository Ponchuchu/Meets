-- Постоянные места (21 октября): горы, парки, музеи, катки, боулинг, фотозоны и «сходить одному».
-- Часы с перерывами (hours), цены и ссылка Kaspi дописывает сборщик worker/src/spots.ts; приложение читает таблицу всем.
create table if not exists public.spots (
  id text primary key,
  parent_id text references public.spots (id) on delete cascade,
  name text not null,
  kind text not null,
  lat double precision not null,
  lon double precision not null,
  address text,
  about text not null default '',
  tips text[] not null default '{}',
  solo boolean not null default false,
  free boolean not null default false,
  season int[],
  buy_url text,
  info_url text,
  kaspi_url text,
  -- {"1":[["10:00","13:00"],["14:00","22:00"]], … "7":[]}: дни ISO, два интервала — перерыв, [] — выходной.
  hours jsonb,
  price_from int,
  price_note text,
  gis_id text,
  source text not null default 'manual',
  checked_at timestamptz,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.spots enable row level security;
drop policy if exists spots_read on public.spots;
create policy spots_read on public.spots for select using (enabled);
grant select on public.spots to anon, authenticated;

insert into public.spots (id, parent_id, name, kind, lat, lon, address, about, tips, solo, free, season, buy_url, info_url) values
  ('shymbulak', null, 'Шымбулак', 'ski', 43.12786, 77.08092, 'ул. Горная, 640', 'Горнолыжный курорт: трассы, гондола с Медеу, виды на 3200 м', array['Одному — на кресельной канатке до Талгарского перевала: тишина и облака под ногами','Наверху холоднее на 10–15 градусов — возьми куртку и летом']::text[], true, false, array[11,4], 'https://shymbulak.com', 'https://shymbulak.com'),
  ('shymbulak-pass', 'shymbulak', 'Талгарский перевал, 3200 м', 'view', 43.11294, 77.11521, null, 'Верхняя точка канатки: ледник, облака, панорама', '{}'::text[], false, false, null, null, null),
  ('shymbulak-swing', 'shymbulak', 'Качели у Шымбулака', 'photo', 43.12766, 77.0808, null, 'Качели над ущельем — самый узнаваемый кадр в горах', '{}'::text[], false, true, null, null, null),
  ('medeu', null, 'Медеу', 'skate', 43.15755, 77.05856, 'ул. Горная, 465', 'Высокогорный каток под открытым небом, плотина и тропы в горы', array['На каток можно одному — прокат коньков на месте','Вне сезона — лестница к плотине и вид на ущелье, это бесплатно']::text[], true, false, array[11,3], null, null),
  ('medeu-dam', 'medeu', 'Плотина и лестница', 'view', 43.15755, 77.05856, null, 'Длинная лестница к плотине над Медеу: тренировка и лучший вид на ущелье', '{}'::text[], false, true, null, null, null),
  ('medeu-gondola', 'medeu', 'Гондола Медеу — Шымбулак', 'cable', 43.16306, 77.05164, null, 'Канатная дорога в горы, работает круглый год', '{}'::text[], false, false, null, null, null),
  ('tabagan', null, 'Табаган', 'ski', 43.2146, 77.09642, null, 'Горнолыжная база и зона отдыха в Талгарском ущелье', '{}'::text[], false, false, array[12,3], null, null),
  ('oi-qaragai', null, 'Пейнтбол Ой-Карагай', 'paintball', 43.22729, 77.14919, null, 'Пейнтбол в лесу ущелья Ой-Карагай', '{}'::text[], false, false, null, null, null),
  ('koktobe', null, 'Кок-Тобе', 'cable', 43.24242, 76.95908, 'пр. Достык, 104А', 'Канатка на гору: смотровая, аттракционы, кафе и огни города вечером', array['Одному лучше всего к закату: подняться на канатке и смотреть, как зажигается город','Обратно можно пешком по тропе — 30–40 минут вниз']::text[], true, false, null, 'https://koktobe.com', 'https://koktobe.com'),
  ('koktobe-view', 'koktobe', 'Смотровая площадка', 'view', 43.2339, 76.9759, null, 'Весь город и горы в одном кадре, вечером — огни', '{}'::text[], false, true, null, null, null),
  ('koktobe-beatles', 'koktobe', 'Памятник The Beatles', 'photo', 43.2339, 76.9759, null, 'Четвёрка на скамейке — можно сесть рядом и сфотографироваться', '{}'::text[], false, true, null, null, null),
  ('koktobe-rides', 'koktobe', 'Аттракционы и колесо', 'wheel', 43.2339, 76.9759, null, 'Колесо обозрения на вершине, горки и тир', '{}'::text[], false, false, null, null, null),
  ('panfilov-park', null, 'Парк 28 панфиловцев', 'park', 43.25883, 76.95413, 'ул. Гоголя, 40', 'Старый парк в центре: Вознесенский собор, аллеи, кофе с собой', array['Утром в выходные тихо и красиво','Рядом Зелёный базар — можно зайти за фруктами']::text[], true, true, null, null, null),
  ('gorky-park', null, 'Центральный парк', 'park', 43.26128, 76.96327, 'ул. Гоголя, 1', 'Большой парк с озером, лодками и аттракционами', array['Лодку можно взять и одному','Вечером на набережной уличные музыканты']::text[], true, true, null, null, null),
  ('president-park', null, 'Парк Первого Президента', 'park', 43.19366, 76.88679, null, 'Фонтаны и вид на горы — лучшая прогулка на закате', array['Лучший свет за час до заката: горы розовые','Летом по вечерам работают поющие фонтаны']::text[], true, true, null, null, null),
  ('botanic', null, 'Главный ботанический сад', 'garden', 43.22689, 76.92887, 'ул. Тимирязева, 36д', 'Тихие аллеи, оранжерея и пруды посреди города', array['Идеально, чтобы побыть одному: людей мало, телефон можно убрать']::text[], true, false, null, null, null),
  ('terrenkur', null, 'Терренкур', 'park', 43.22375, 76.96713, 'за пр. Достык', 'Прогулочная тропа вдоль реки к горам', array['Можно идти час в сторону гор и вернуться — маршрут сам ведёт']::text[], true, true, null, null, null),
  ('arbat', null, 'Арбат', 'photo', 43.2614, 76.945, 'ул. Жибек Жолы', 'Пешеходная улица: музыканты, художники, вечерний свет', '{}'::text[], true, true, null, null, null),
  ('republic-sq', null, 'Площадь Республики', 'photo', 43.2381, 76.9454, null, 'Монумент Независимости и горы за ним', '{}'::text[], false, true, null, null, null),
  ('kasteev', null, 'Музей искусств им. Кастеева', 'museum', 43.23593, 76.9187, null, 'Казахское и мировое искусство — спокойный вечер наедине с картинами', array['Возьми аудиогид — с ним интереснее, чем в компании']::text[], true, false, null, null, null),
  ('central-museum', null, 'Центральный государственный музей', 'museum', 43.23582, 76.94966, 'мкр. Самал-1, 44', 'История Казахстана от саков до наших дней', '{}'::text[], true, false, null, null, null),
  ('museum-of-arts', null, 'Almaty Museum of Arts', 'museum', 43.22699, 76.94903, null, 'Новый музей современного искусства', array['Кафе при музее — хорошее место посидеть с книгой']::text[], true, false, null, null, null),
  ('zoo', null, 'Алматинский зоопарк', 'zoo', 43.26342, 76.97471, 'ул. Есенберлина, 166', 'Зоопарк рядом с Центральным парком', '{}'::text[], true, false, null, null, null),
  ('happy-eye', null, 'Колесо Happy Eye', 'wheel', 43.20108, 76.89373, 'ул. Розыбакиева, 273', 'Колесо обозрения с видом на горы и город', '{}'::text[], true, false, null, null, null),
  ('octopus', null, 'Аквапарк «Осьминог»', 'aqua', 43.26234, 76.97124, 'Парк Горького, ул. Гоголя, 1', 'Летний аквапарк в Центральном парке', '{}'::text[], false, false, array[6,8], null, null),
  ('gorilla', null, 'Gorilla Zipline', 'zipline', 43.21041, 76.93334, 'пр. аль-Фараби, 128/В', 'Зиплайн и верёвочный парк', '{}'::text[], false, false, null, null, null),
  ('zhailjau', null, 'Гольф-клуб «Жайляу»', 'golf', 43.18163, 76.87844, 'мкр. Мирас, 188', 'Поле для гольфа с видом на горы', '{}'::text[], false, false, array[4,10], null, null),
  ('family-bowling', null, 'Family Bowling', 'bowling', 43.22803, 76.85302, 'ул. Улугбека, 57', 'Боулинг и семейный парк развлечений', '{}'::text[], false, false, null, null, null),
  ('madison', null, 'Боулинг «Мэдисон»', 'bowling', 43.23915, 76.93348, 'ТРК «Форум», пр. Сейфуллина, 617', 'Боулинг и караоке', '{}'::text[], false, false, null, null, null),
  ('bastau', null, 'Bowling Bastau', 'bowling', 43.2507, 76.92062, 'ул. Шагабутдинова, 109а', 'Боулинг в центре', '{}'::text[], false, false, null, null, null),
  ('krapiva', null, 'Боулинг «Крапива»', 'bowling', 43.23988, 76.85767, '1-й мкр., 12', 'Боулинг и бар', '{}'::text[], false, false, null, null, null),
  ('kango', null, 'Батутный парк Kango', 'trampoline', 43.20263, 76.8909, 'MEGA, ул. Розыбакиева, 247А', 'Батуты, поролоновая яма, ниндзя-полоса', '{}'::text[], false, false, null, null, null),
  ('gravity', null, 'Батутный парк «Гравитация»', 'trampoline', 43.23671, 76.84572, 'ул. Кабдолова, 1', 'Батутный парк', '{}'::text[], false, false, null, null, null),
  ('cozyrock', null, 'CozyRock', 'climb', 43.2419, 76.87749, 'ул. Брусиловского, 167', 'Скалодром: болдеринг и трассы', array['На болдеринг приходят по одному — с соседями по стене знакомишься сам собой']::text[], true, false, null, null, null),
  ('questoria', null, 'Questoria', 'quest', 43.22185, 76.90236, 'ул. Жарокова, 210Б', 'Квесты в реальности', '{}'::text[], false, false, null, null, null),
  ('rift-vr', null, 'Rift VR Park', 'vr', 43.20918, 76.95374, null, 'Виртуальная реальность для компании', '{}'::text[], false, false, null, null, null)
on conflict (id) do update set parent_id = excluded.parent_id, name = excluded.name, kind = excluded.kind, lat = excluded.lat, lon = excluded.lon,
  address = excluded.address, about = excluded.about, tips = excluded.tips, solo = excluded.solo, free = excluded.free, season = excluded.season,
  buy_url = coalesce(public.spots.buy_url, excluded.buy_url), info_url = coalesce(public.spots.info_url, excluded.info_url), updated_at = now();
