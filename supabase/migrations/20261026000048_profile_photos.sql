-- Несколько фото в профиле (26 октября): главное остаётся в photo_url, ещё до 5 — в photos.
-- Листаются в профиле и на весь экран, как в Telegram. Видит тот же круг, что и главное фото.
alter table public.profiles add column if not exists photos text[] not null default '{}' check (cardinality(photos) <= 5);
