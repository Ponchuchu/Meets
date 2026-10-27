-- Название площадки из поста, пока точка не найдена: по нему сборщик сам привяжет карточку к месту (27 окт.).
alter table public.events add column if not exists venue_hint text;
