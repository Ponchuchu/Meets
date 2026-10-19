-- Места из Overture и справочник адресов Алматы (OpenStreetMap + Overture), docs/MAP-DATA.md.
-- Адрес из карточки события («ул. Жандосова 1/1», «Жандосов көшесі, 1/1») находит свою точку:
-- нормализуем одинаково на записи и на запросе, ищем по триграммам с поправкой на близость.

create extension if not exists pg_trgm with schema extensions;

-- «Достық даңғылы 42» и «пр. Достык, 42» → «достык 42». Казахские буквы → русские, слова-типы улиц — прочь,
-- окончания имён — тоже: «Жандосова» (рус.) и «Жандосов көшесі» (каз.) → «жандосов», «Абая» и «Абай» → «аба».
create or replace function public.norm_addr(t text) returns text
language sql immutable parallel safe as $$
  select btrim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
    -- скобки, этаж, офис, квартира — не часть адреса дома
    regexp_replace(regexp_replace(translate(lower(coalesce(t, '')), 'ёәөүұқғңһі', 'еаоуукгнхи'),
      '\([^)]*\)', ' ', 'g'), '(\d+\s*-?\s*(этаж|эт)\.?|(офис|оф|кв|каб|кабинет|блок|вход|подъезд)\.?\s*[0-9а-яa-z/-]+)', ' ', 'g'),
    '(^|[^а-яa-z0-9])(г|город|алматы|алма-ата|улица|ул|көшесі|кошеси|көш|кош|проспект|пр-т|пр|просп|даңғылы|дангылы|даң|микрорайон|мкр|мкрн|шағын ауданы|шагын ауданы|ш\.а|переулок|пер|бульвар|б-р|шоссе|площадь|пл|тас жолы|набережная|наб|к)(?=[^а-яa-z0-9]|$)\.?', ' ', 'g'),
    '[^а-яa-z0-9/]+', ' ', 'g'),
    '([а-я]{3,}?)(а|я|й)(?= |$)', '\1', 'g'),
    '\s+', ' ', 'g'))
$$;

-- Тип улицы — чтобы «проспект Абая 10» (= «Абай даңғылы 10», центр) не путался с «улица Абая 10» в пригороде.
create or replace function public.addr_type(t text) returns text
language sql immutable parallel safe as $$
  select case
    when t ~* '(^|[^а-яәөүұқғңһі])(проспект|пр-т|пр|просп|даңғылы|дангылы|даң)([^а-яәөүұқғңһі]|$)' then 'пр'
    when t ~* '(^|[^а-яәөүұқғңһі])(микрорайон|мкр|мкрн|шағын ауданы|шагын ауданы|ш\.а)([^а-яәөүұқғңһі]|$)' then 'мкр'
    when t ~* '(^|[^а-яәөүұқғңһі])(бульвар|б-р|желекжолы)([^а-яәөүұқғңһі]|$)' then 'бул'
    when t ~* '(^|[^а-яәөүұқғңһі])(переулок|пер|тұйық көшесі)([^а-яәөүұқғңһі]|$)' then 'пер'
    when t ~* '(^|[^а-яәөүұқғңһі])(улица|ул|көшесі|кошеси|көш)([^а-яәөүұқғңһі]|$)' then 'ул'
  end
$$;

create table if not exists public.addresses (
  id bigserial primary key,
  street text not null,
  house text not null,
  label text not null,
  norm text generated always as (public.norm_addr(street || ' ' || house)) stored,
  geog extensions.geography(point, 4326) not null,
  source text not null check (source in ('osm', 'overture'))
);
-- Одинаковые улицы бывают в разных районах — уникальности по норме нет; дубли одного дома (ближе 80 м) чистит загрузчик.
create index if not exists addresses_norm_idx on public.addresses (norm);
create index if not exists addresses_norm_trgm on public.addresses using gin (norm extensions.gin_trgm_ops);
create index if not exists addresses_geog_idx on public.addresses using gist (geog);
alter table public.addresses enable row level security;
drop policy if exists addresses_read on public.addresses;
create policy addresses_read on public.addresses for select to anon, authenticated using (true);

create table if not exists public.places (
  id text primary key,
  name text not null,
  kind text not null,
  category text,
  address text,
  geog extensions.geography(point, 4326) not null,
  confidence real not null default 0,
  source text not null default 'overture',
  updated_at timestamptz not null default now()
);
create index if not exists places_geog_idx on public.places using gist (geog);
create index if not exists places_name_trgm on public.places using gin (lower(name) extensions.gin_trgm_ops);
alter table public.places enable row level security;
drop policy if exists places_read on public.places;
create policy places_read on public.places for select to anon, authenticated using (true);

-- Подсказки адреса: похожие по тексту, при равенстве — ближе к точке (если есть).
create or replace function public.suggest_address(q text, near_lat double precision default null, near_lon double precision default null, lim int default 6)
returns table (label text, street text, house text, lat double precision, lon double precision, score real)
language sql stable security invoker set search_path = public, extensions as $$
  with n as (select public.norm_addr(q) as v)
  select a.label, a.street, a.house, extensions.st_y(a.geog::extensions.geometry), extensions.st_x(a.geog::extensions.geometry),
    extensions.similarity(a.norm, n.v)::real as score
  from public.addresses a, n
  where length(n.v) >= 3 and a.norm operator(extensions.%) n.v
  order by (a.norm = n.v) desc,
    extensions.similarity(a.norm, n.v) desc,
    coalesce(public.addr_type(q) = public.addr_type(a.label), false) desc,
    -- Рядом с точкой, а без точки — ближе к центру города (события в основном там).
    extensions.st_distance(a.geog, extensions.st_makepoint(coalesce(near_lon, 76.9286), coalesce(near_lat, 43.2567))::extensions.geography)
  limit least(greatest(lim, 1), 20)
$$;

-- Лучшее совпадение для сборщика событий: только уверенное (дом совпадает, похожесть ≥ 0,5).
create or replace function public.match_address(q text)
returns table (label text, lat double precision, lon double precision, score real)
language sql stable security invoker set search_path = public, extensions as $$
  select s.label, s.lat, s.lon, s.score from public.suggest_address(q, null, null, 3) with ordinality s(label, street, house, lat, lon, score, i)
  where s.score >= 0.5 and (regexp_match(public.norm_addr(q), '(\d+[а-яa-z]?(/\d+[а-яa-z]?)?)\s*$'))[1] = s.house
     or s.score >= 0.95
  order by s.i limit 1
$$;

-- Места в видимой области карты (с 15-го масштаба), не больше lim — дёшево для телефона.
create or replace function public.places_in_view(w double precision, s double precision, e double precision, n double precision, lim int default 150)
returns table (id text, name text, kind text, category text, address text, lat double precision, lon double precision)
language sql stable security invoker set search_path = public, extensions as $$
  select p.id, p.name, p.kind, p.category, p.address, extensions.st_y(p.geog::extensions.geometry), extensions.st_x(p.geog::extensions.geometry)
  from public.places p
  where p.geog operator(extensions.&&) extensions.st_makeenvelope(w, s, e, n, 4326)::extensions.geography
  order by p.confidence desc
  limit least(greatest(lim, 1), 300)
$$;

-- Поиск мест по названию («Куда сходить?»).
create or replace function public.search_places(q text, lim int default 12)
returns table (id text, name text, kind text, category text, address text, lat double precision, lon double precision)
language sql stable security invoker set search_path = public, extensions as $$
  select p.id, p.name, p.kind, p.category, p.address, extensions.st_y(p.geog::extensions.geometry), extensions.st_x(p.geog::extensions.geometry)
  from public.places p
  where length(q) >= 2 and (lower(p.name) like '%' || lower(q) || '%' or lower(p.name) operator(extensions.%) lower(q))
  order by (lower(p.name) like lower(q) || '%') desc, extensions.similarity(lower(p.name), lower(q)) desc, p.confidence desc
  limit least(greatest(lim, 1), 30)
$$;

grant execute on function public.norm_addr(text), public.addr_type(text), public.suggest_address(text, double precision, double precision, int), public.match_address(text),
  public.places_in_view(double precision, double precision, double precision, double precision, int), public.search_places(text, int) to anon, authenticated;

-- Адрес под точкой («как в доставке»): ближайший дом в 60 м.
create or replace function public.nearest_address(lat double precision, lon double precision)
returns table (label text, dist real)
language sql stable security invoker set search_path = public, extensions as $$
  select a.label, extensions.st_distance(a.geog, p.g)::real
  from public.addresses a, (select extensions.st_makepoint(lon, lat)::extensions.geography g) p
  where extensions.st_dwithin(a.geog, p.g, 60)
  order by a.geog operator(extensions.<->) p.g limit 1
$$;
grant execute on function public.nearest_address(double precision, double precision) to anon, authenticated;
