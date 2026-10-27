-- Язык события и перевод (27 октября, просьба владельца): казахские карточки сборщик переводит на русский,
-- оригинал остаётся рядом — «Показать оригинал». lang: ru | kk | en (пусто — ещё не определён).
alter table public.events add column if not exists lang text;
alter table public.events add column if not exists orig_about text;

-- Витрина: те же колонки, что были, и в конце — язык и оригинал (create or replace допускает только добавление в конец).
create or replace view public.events_live with (security_invoker = true) as
select e.id, e.external_id, e.title, e.category, e.tags, e.starts_at, e.ends_at, e.is_long,
       v.id as venue_id, v.name as venue_name, v.kind as venue_kind,
       coalesce(e.address, v.address) as address, e.address_note,
       st_y(v.geog::geometry) as lat, st_x(v.geog::geometry) as lon, coalesce(v.needs_pin, true) as needs_pin,
       e.price_min, e.price_max, e.is_free, e.about, e.organizer, e.cover_url, e.source_url, e.visibility, e.status, e.created_by,
       e.sessions, e.media, e.lang, e.orig_title, e.orig_about
from public.events e left join public.venues v on v.id = e.venue_id
where e.status = 'published';
