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
