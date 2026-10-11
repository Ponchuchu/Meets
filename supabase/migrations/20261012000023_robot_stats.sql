-- Итоги запуска поиска для панели разработчика: что прочитано с каждого сайта, что отсеяно, сколько новых карточек и какого качества
-- (с фото, с точкой, с ценой), разбор Telegram. Пишет воркер (worker/src/runstats.ts), читает панель «Ивенты».
alter table public.robot_runs add column if not exists stats jsonb;
comment on column public.robot_runs.stats is 'Итоги запуска: sources, outside, merged, kept, queue{added,published,duplicates,...}, telegram[], ai{...}';
