-- Обложки событий: картинка со страницы события, а если её нет — иллюстрация от ИИ после одобрения
-- (worker/src/covers.ts). Публичный бакет covers; cover_ai — приложение подписывает «иллюстрация».
insert into storage.buckets (id, name, public) values ('covers', 'covers', true) on conflict (id) do nothing;
alter table public.events add column if not exists cover_ai boolean not null default false;
