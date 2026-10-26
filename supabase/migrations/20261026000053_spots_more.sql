-- Места: фото у нас в хранилище, всё про Кок-Тобе, аквапарк в Aport Mall West, зиплайн у Медеу, часы и шаг времени (26 октября).
-- Фото Викисклада телефоны не получали (Wikimedia отвечает 429/403 приложениям): сборщик копирует их в event-media/spots/…
-- photo_src — откуда брать (Викисклад), photos — готовые копии; ig — страница места в Instagram (оттуда тоже фото).
-- mall — в каком ТРЦ место (аквапарк — в Aport Mall West): карточка ТРЦ показывает его с фото.
-- step_min — шаг выбора времени (колесо как на iPhone показывает только реальные времена: 12:00, 12:30…).
alter table public.spots add column if not exists photos text[] not null default '{}';
alter table public.spots add column if not exists photo_src text[] not null default '{}';
alter table public.spots add column if not exists ig text;
alter table public.spots add column if not exists mall text;
alter table public.spots add column if not exists step_min int not null default 30 check (step_min between 5 and 240);

-- Кок-Тобе: часы канатной дороги и аттракционов (koktobe.com, октябрь 2026): пн, ср, чт 10–23, вт 13–23 (утром обслуживание), пт–вс 10–24.
update public.spots set hours = '{"1":[["10:00","23:00"]],"2":[["13:00","23:00"]],"3":[["10:00","23:00"]],"4":[["10:00","23:00"]],"5":[["10:00","24:00"]],"6":[["10:00","24:00"]],"7":[["10:00","24:00"]]}'::jsonb,
  price_from = 6000, price_note = 'канатка: 6 000 ₸ в одну сторону, 10 000 ₸ туда и обратно, детям 6–12 лет — 3 000 / 5 000 ₸', checked_at = now()
where id = 'koktobe';
update public.spots set name = 'Парк аттракционов', kind = 'fun', about = 'Горки, автодром, тир и детские карусели на вершине' where id = 'koktobe-rides';
insert into public.spots (id, parent_id, name, kind, lat, lon, about, solo, free, step_min) values
  ('koktobe-wheel', 'koktobe', 'Колесо обозрения', 'wheel', 43.23395, 76.97585, 'Закрытые кабинки над городом: весь Алматы и горы', true, false, 15),
  ('koktobe-rope', 'koktobe', 'Верёвочный парк', 'climb', 43.23380, 76.97560, 'Трассы на высоте среди деревьев, со страховкой', false, false, 30),
  ('koktobe-coaster', 'koktobe', 'Fast Coaster', 'fun', 43.23400, 76.97620, 'Горка-бобслей по склону горы', false, false, 15),
  ('koktobe-zoo', 'koktobe', 'Контактный зоопарк', 'zoo', 43.23370, 76.97600, 'Козы, кролики и птицы — можно покормить', false, false, 30)
on conflict (id) do update set parent_id = excluded.parent_id, name = excluded.name, kind = excluded.kind, about = excluded.about, step_min = excluded.step_min;
update public.spots set hours = (select hours from public.spots where id = 'koktobe') where parent_id = 'koktobe' and kind in ('wheel', 'fun', 'climb', 'zoo');

-- Gorilla Zipline: на трамплинах «Сункар» (пн, чт–вс 12–20, 10 000 ₸) и у станции гондолы Медеу (ежедневно 12–17:30, кроме вт; 4 500 ₸ в будни, 6 500 ₸ в выходные).
update public.spots set name = 'Gorilla Zipline · Сункар', address = 'проспект Аль-Фараби, 128/8 (трамплины «Сункар»)', about = 'Спуск по тросу над трамплинами — сидя или лёжа, и прыжок rope jumping',
  hours = '{"1":[["12:00","20:00"]],"2":[],"3":[],"4":[["12:00","20:00"]],"5":[["12:00","20:00"]],"6":[["12:00","20:00"]],"7":[["12:00","20:00"]]}'::jsonb, price_from = 10000, price_note = 'спуск — 10 000 ₸; с 16 лет или ростом от 140 см', step_min = 30, checked_at = now()
where id = 'gorilla';
insert into public.spots (id, name, kind, lat, lon, address, about, hours, price_from, price_note, step_min, checked_at) values
  ('gorilla-medeu', 'Gorilla Zipline · Медеу', 'zipline', 43.16306, 77.05164, 'улица Керей и Жанибек хандар, 640/1 (станция гондолы Медеу)', 'Зиплайн над ущельем у катка Медеу',
   '{"1":[["12:00","17:30"]],"2":[],"3":[["12:00","17:30"]],"4":[["12:00","17:30"]],"5":[["12:00","17:30"]],"6":[["12:00","17:30"]],"7":[["12:00","17:30"]]}'::jsonb, 4500, 'в будни 4 500 ₸, в выходные 6 500 ₸', 30, now())
on conflict (id) do update set hours = excluded.hours, price_from = excluded.price_from, price_note = excluded.price_note;

-- Аквапарк Hawaii & Miami — в Aport Mall West (Ташкентский тракт, 17к): ежедневно 10–22, в среду с 12; весь день — 13 940 ₸, детский — 8 090 ₸ (июнь 2026).
insert into public.spots (id, name, kind, lat, lon, address, about, hours, price_from, price_note, mall, step_min, checked_at)
select 'hawaii-miami', 'Аквапарк Hawaii & Miami', 'aqua', v.lat, v.lon, 'Ташкентский тракт, 17к (Aport Mall West)', 'Круглый год: горки, волновой бассейн, тёплые бассейны и летняя зона Miami Sunrise',
  '{"1":[["10:00","22:00"]],"2":[["10:00","22:00"]],"3":[["12:00","22:00"]],"4":[["10:00","22:00"]],"5":[["10:00","22:00"]],"6":[["10:00","22:00"]],"7":[["10:00","22:00"]]}'::jsonb,
  13940, 'на весь день; детский — 8 090 ₸', 'Aport Mall West', 60, now()
from public.venues_points v where v.name = 'Aport Mall West'
on conflict (id) do update set hours = excluded.hours, price_from = excluded.price_from, price_note = excluded.price_note, mall = excluded.mall;
update public.spots set mall = 'MEGA Alma-Ata' where id = 'kango';
update public.spots set mall = 'Forum' where id = 'madison';
update public.spots set step_min = 60 where kind in ('park', 'garden', 'view', 'museum', 'gallery', 'zoo', 'ski', 'skate') and step_min = 30;

-- Фото с Викисклада (копирует сборщик).
update public.spots set photo_src = array['https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Shymbulak_mountain_in_February_2024_09.jpg/960px-Shymbulak_mountain_in_February_2024_09.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Chimbulak_automne.JPG/960px-Chimbulak_automne.JPG', 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Shymbulak_Alatau_mountains_in_Almaty.jpg/960px-Shymbulak_Alatau_mountains_in_Almaty.jpg'] where id = 'shymbulak';
update public.spots set photo_src = array['https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Medeu_Skating_Rink_in_Almaty_Kazakhstan.jpg/960px-Medeu_Skating_Rink_in_Almaty_Kazakhstan.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/Medeu-_4.jpg/960px-Medeu-_4.jpg'] where id = 'medeu';
update public.spots set photo_src = array['https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Big_Almaty_Lake_(Bolshaya_Almatinka)%2C_Almaty_region%2C_Kazakhstan._October_2007.jpg/960px-Big_Almaty_Lake_(Bolshaya_Almatinka)%2C_Almaty_region%2C_Kazakhstan._October_2007.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Big_Almaty_Lake_from_pass.jpg/960px-Big_Almaty_Lake_from_pass.jpg'] where id = 'bao';
update public.spots set photo_src = array['https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/%D0%90%D0%BB%D0%BC%D0%B0%D1%82%D1%8B%2C_%D0%9A%D0%BE%D0%BA-%D0%A2%D0%BE%D0%B1%D0%B5_%D1%81%D0%B2%D0%B5%D1%80%D1%85%D1%83.jpg/960px-%D0%90%D0%BB%D0%BC%D0%B0%D1%82%D1%8B%2C_%D0%9A%D0%BE%D0%BA-%D0%A2%D0%BE%D0%B1%D0%B5_%D1%81%D0%B2%D0%B5%D1%80%D1%85%D1%83.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Almaty_Skyline_from_the_K%C3%B6k_T%C3%B6be_hill.jpg/960px-Almaty_Skyline_from_the_K%C3%B6k_T%C3%B6be_hill.jpg'] where id = 'koktobe';
update public.spots set photo_src = array['https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/%D0%90%D0%BB%D0%BC%D0%B0%D1%82%D1%8B%2C_%D0%BF%D0%B0%D1%80%D0%BA_28_%D0%BF%D0%B0%D0%BD%D1%84%D0%B8%D0%BB%D0%BE%D0%B2%D1%86%D0%B5%D0%B2_%D1%81%D0%B2%D0%B5%D1%80%D1%85%D1%83_(2).jpg/960px-%D0%90%D0%BB%D0%BC%D0%B0%D1%82%D1%8B%2C_%D0%BF%D0%B0%D1%80%D0%BA_28_%D0%BF%D0%B0%D0%BD%D1%84%D0%B8%D0%BB%D0%BE%D0%B2%D1%86%D0%B5%D0%B2_%D1%81%D0%B2%D0%B5%D1%80%D1%85%D1%83_(2).jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Zenkov_Cathedral_Winter.jpg/960px-Zenkov_Cathedral_Winter.jpg'] where id = 'panfilov-park';
update public.spots set photo_src = array['https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/View_of_Kok_Tobe_from_Terrenkur.jpg/960px-View_of_Kok_Tobe_from_Terrenkur.jpg', 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/The_Esentay_with_the_Almaty_Towers_(AP4M2507_1PS)_(29050959892).jpg/960px-The_Esentay_with_the_Almaty_Towers_(AP4M2507_1PS)_(29050959892).jpg'] where id = 'terrenkur';
