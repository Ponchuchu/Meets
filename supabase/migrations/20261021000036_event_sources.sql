-- Новые источники афиши (21 октября, список владельца). Сбор включён, но не «доверенные» и без автопубликации:
-- всё найденное идёт на согласование, пока не убедимся, что сайт размечает события правильно.
-- Сайты-афиши читает код по разметке schema.org Event (worker/src/eventSites.ts); «Казинформ» и акимат — подборки
-- и городские праздники, их разбирает ИИ (только когда в запуске включён ИИ).
insert into public.sources (kind, handle, title, trusted, auto_publish, enabled)
values
  ('site', 'onvibe.me/almaty', 'OnVibe · Алматы', false, false, true),
  ('site', 'topbilet.kz', 'Topbilet · концерты и шоу', false, false, true),
  ('site', 'portalbilet.kz', 'Portalbilet · концерты и фестивали', false, false, true),
  ('site', 'gorodzovet.ru/almaty', 'Город зовёт · Алматы', false, false, true),
  ('site', 'kino.kz/ru/concert', 'Kino.kz · концерты', false, false, true),
  ('site', 'inform.kz', 'Казинформ · куда сходить в выходные', false, false, true),
  ('site', 'gov.kz/memleket/entities/almaty', 'Акимат Алматы · городские праздники', false, false, true)
on conflict (kind, handle) do nothing;
