-- Адреса в одном виде (26 октября, просьба владельца): «проспект Абая, 120».
-- В справочнике (OpenStreetMap + Overture) одни дома записаны по-русски, другие только по-казахски
-- («Абай даңғылы, 120» — а русского «Абая, 120» не было), русские — вразнобой: «просп. Абая», «Райымбека проспект»,
-- «Алматы, улица Толе Би». Теперь у каждой улицы одно русское название:
--   1) казахская улица берёт название русской улицы с той же основой поблизости («Абай даңғылы» → «проспект Абая»);
--   2) нет такой — переводим по правилам: тип улицы по-русски, буквы — русские, фамилии — в родительном падеже
--      («Нұрпейісов көшесі» → «улица Нурпейисова»);
--   3) дубли одного дома (та же улица и номер ближе 40 м) удаляются.
-- Исходное написание остаётся в street_src: поиск по-казахски по-прежнему находит дом (norm_addr сводит оба языка).

alter table public.addresses add column if not exists street_src text;
update public.addresses set street_src = street where street_src is null;

create or replace function public.kz_letters(t text) returns text
language sql immutable parallel safe as $$
  select translate(t, 'ӘәҒғҚқҢңӨөҰұҮүҺһІі', 'АаГгКкНнОоУуУуХхИи')
$$;

-- Тип улицы по-русски (из русского, казахского или сокращения); null — не указан.
create or replace function public.street_type_ru(s text) returns text
language sql immutable parallel safe as $$
  select case
    when l ~ '(^|[\s,])(тас жолы|шоссе)([\s,.]|$)' then 'шоссе'
    when l ~ '(^|[\s,])(даңғыл жолы|тракт)([\s,.]|$)' then 'тракт'
    when l ~ '(^|[\s,])(проспект|просп\.?|пр-т|пр\.|даңғылы|дангылы)([\s,]|$)' then 'проспект'
    when l ~ '(^|[\s,])(микрорайон|мкр\.?|мкрн\.?|(шағын|шагын|ықшам) ауданы|ш\.а\.?)([\s,]|$)' then 'микрорайон'
    when l ~ '(^|[\s,])(переулок|пер\.|тұйығы|тупик)([\s,]|$)' then 'переулок'
    when l ~ '(^|[\s,])(бульвар|б-р|желекжолы)([\s,]|$)' then 'бульвар'
    when l ~ '(^|[\s,])(площадь|пл\.|алаңы)([\s,]|$)' then 'площадь'
    when l ~ '(^|[\s,])(набережная|наб\.)([\s,]|$)' then 'набережная'
    when l ~ '(^|[\s,])(проезд|өтпе жолы)([\s,]|$)' then 'проезд'
    when l ~ '(^|[\s,])(трасса)([\s,]|$)' then 'трасса'
    when l ~ '(^|[\s,])(аллея)([\s,]|$)' then 'аллея'
    when l ~ '(^|[\s,])(улица|ул\.?|көшесі|кошеси|көш\.?)([\s,]|$)' then 'улица'
    when l ~ '(^|[\s,])уица([\s,]|$)' then 'улица'
  end
  from (select lower(coalesce(s, '')) l) x
$$;

-- Название без типа, города и мусора: «​Алматы, просп. Абая» → «Абая».
create or replace function public.street_name_part(s text) returns text
language sql immutable parallel safe as $$
  select btrim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
    regexp_replace(coalesce(s, ''), '[​‌‍﻿]', '', 'g'),
    '^\s*(г\.?\s*)?(Алматы|Алма-Ата)\s*,?\s*|\s*,\s*(г\.?\s*)?(Алматы|Алма-Ата)\s*$', '', 'gi'),
    '(^|[\s,])(тас жолы|даңғыл жолы|шоссе|тракт|проспект|просп\.?|пр-т|пр\.|даңғылы|дангылы|микрорайон|мкрн\.?|мкр\.?|шағын ауданы|шагын ауданы|ықшам ауданы|ш\.а\.?|переулок|пер\.|тұйығы|тупик|бульвар|б-р|желекжолы|площадь|пл\.|алаңы|набережная|наб\.|проезд|өтпе жолы|трасса|аллея|улица|уица|ул\.?|көшесі|кошеси|көш\.?)(?=[\s,]|$)', ' ', 'gi'),
    '\s*,\s*', ' ', 'g'), '\s+', ' ', 'g'), ' .,-')
$$;

-- Казахское название → русское по правилам: буквы, родительный падеж фамилий и имён перед ними.
-- «Нұрпейісов» → «Нурпейисова», «Қаныш Сәтбаев» → «Каныша Сатбаева», «Сүйінбай» → «Суйинбая»; «Дала», «Байтұрсынұлы» — как есть.
create or replace function public.kz_name_ru(name text) returns text
language plpgsql immutable parallel safe as $$
declare
  w text[] := regexp_split_to_array(public.kz_letters(btrim(name)), '\s+');
  n int := coalesce(array_length(w, 1), 0);
  i int;
begin
  if n = 0 then return ''; end if;
  if w[n] ~* '(ов|ев|ин|ын)$' then
    w[n] := w[n] || 'а';
    for i in 1 .. n - 1 loop
      if w[i] ~* '[бвгджзклмнпрстфхцчшщ]$' then w[i] := w[i] || 'а';
      elsif w[i] ~* 'й$' then w[i] := regexp_replace(w[i], 'й$', 'я');
      end if;
    end loop;
  elsif n = 1 and w[1] ~* '[ае]й$' then
    w[1] := regexp_replace(w[1], 'й$', 'я');
  elsif n = 1 and w[1] ~* '[^аеиоуыэюя]ль$' then
    w[1] := regexp_replace(w[1], 'ь$', 'я');
  end if;
  return array_to_string(w, ' ');
end
$$;

-- Русское название улицы целиком: «проспект Абая». Казахское без русской пары — по правилам kz_name_ru.
create or replace function public.street_ru(s text) returns text
language sql immutable parallel safe as $$
  with p as (
    select public.street_name_part(s) nm, coalesce(public.street_type_ru(s), 'улица') t,
      (s ~ '[ӘәҒғҚқҢңӨөҰұҮүҺһІі]' or s ~* '(көшесі|даңғылы|ауданы|тұйығы|алаңы|жолы)') kz
  )
  -- Садовые товарищества и жилые комплексы («СТ Домостроитель») — без слова «улица».
  select case when nm = '' then btrim(s)
    when public.street_type_ru(s) is null and nm ~ '^(СТ|ДНТ|ПК|ЖК|СНТ|КХ)\s' then nm else
    t || ' ' || upper(left(n2, 1)) || substr(n2, 2) end
  from p, lateral (select case when kz then public.kz_name_ru(nm) else nm end n2) x
$$;

-- Известные улицы, которые по правилам не вывести (другое русское название).
create table if not exists public.street_known (kz text primary key, ru text not null);
alter table public.street_known enable row level security;
insert into public.street_known (kz, ru) values
  ('Құлжа даңғыл жолы', 'Кульджинский тракт'), ('Сүйінбай даңғылы', 'проспект Суюнбая'),
  ('Әл-Фараби даңғылы', 'проспект аль-Фараби'), ('Қаныш Сәтбаев көшесі', 'улица Сатпаева'), ('Сәтбаев көшесі', 'улица Сатпаева'),
  ('Әуезов көшесі', 'улица Ауэзова'), ('Мұқанов көшесі', 'улица Муканова'), ('Байтұрсынұлы көшесі', 'улица Байтурсынова'),
  ('Панфилов көшесі', 'улица Панфилова'), ('Жібек Жолы даңғылы', 'проспект Жибек Жолы'), ('Төле Би көшесі', 'улица Толе би'),
  ('Абылай хан даңғылы', 'проспект Абылай хана'), ('Бөкейханов көшесі', 'улица Букейханова'), ('Тұрғыт Озал көшесі', 'улица Тургута Озала'),
  ('Тұрғыт Озалы көшесі', 'улица Тургута Озала'), ('Иырай Жақаев көшесі', 'улица Ибрая Жакаева'), ('Әзірбайжан Мәмбетов көшесі', 'улица Азербайжана Мамбетова'),
  ('Латиф Хамиди көшесі', 'улица Латифа Хамиди'), ('Луганский көшесі', 'улица Луганского'), ('Радостовец көшесі', 'улица Радостовца'),
  ('Райымбек Сейтметов көшесі', 'улица Райымбека Сейтметова'), ('Фарида Шарипова көшесі', 'улица Фариды Шариповой'), ('Ақшағыл көшесі', 'улица Акшагыл'),
  ('Желтоқсан көшесі', 'улица Желтоксан'), ('Науаи көшесі', 'улица Навои'), ('Абдулла Розыбақиев көшесі', 'улица Розыбакиева'), ('Наурызбай батыр көшесі', 'улица Наурызбай батыра'), ('Наурызбай Батыр көшесі', 'улица Наурызбай батыра')
on conflict (kz) do update set ru = excluded.ru;

-- Соответствие «как записано → как правильно» для всех улиц справочника.
create table if not exists public.street_map (src text primary key, ru text not null, how text not null);
alter table public.street_map enable row level security;
truncate public.street_map;
with s as (
  select street_src src, public.norm_addr(street_src) k, public.street_type_ru(street_src) t,
    (street_src ~ '[ӘәҒғҚқҢңӨөҰұҮүҺһІі]' or street_src ~* '(көшесі|даңғылы|ауданы|тұйығы|алаңы|жолы)') kz,
    extensions.st_centroid(extensions.st_collect(geog::extensions.geometry))::extensions.geography c, count(*) n
  from public.addresses group by street_src
),
ru as (select s.*, public.street_ru(src) canon from s where not kz),
-- Одно написание на основу и тип: самое частое («просп. Абая» и «проспект Абая» → «проспект Абая»).
best as (
  select distinct on (k, tt) k, tt, canon from (
    select k, coalesce(t, 'улица') tt, canon, sum(n) over (partition by k, coalesce(t, 'улица'), canon) w from ru) x
  order by k, tt, w desc, canon
),
ru_final as (select ru.src, coalesce(b.canon, ru.canon) canon, ru.k, ru.t, ru.c from ru left join best b on b.k = ru.k and b.tt = coalesce(ru.t, 'улица')),
kz_match as (
  select distinct on (s.src) s.src, r.canon
  from s join ru_final r on r.k = s.k and extensions.st_dwithin(s.c, r.c, 4000)
  where s.kz
  order by s.src, (coalesce(s.t, 'улица') = coalesce(r.t, 'улица')) desc, extensions.st_distance(s.c, r.c)
)
insert into public.street_map (src, ru, how)
select src, canon, 'ru' from ru_final
union all
select s.src, coalesce(kn.ru, m.canon, public.street_ru(s.src)), case when kn.ru is not null then 'known' when m.canon is not null then 'near' else 'rule' end
from s left join public.street_known kn on kn.kz = s.src left join kz_match m on m.src = s.src
where s.kz;

update public.street_map set ru = 'проспект аль-Фараби' where ru ~* '^проспект ал[ь]?-?\s?фараби$';

update public.addresses a set street = m.ru, label = m.ru || ', ' || a.house
from public.street_map m where m.src = a.street_src and (a.street is distinct from m.ru or a.label is distinct from m.ru || ', ' || a.house);

-- Дубли одного дома после перевода: та же улица и номер ближе 40 м — оставляем первую запись (OpenStreetMap раньше Overture).
delete from public.addresses d using public.addresses k
where d.norm = k.norm and d.id > k.id and extensions.st_dwithin(d.geog, k.geog, 40);

grant execute on function public.kz_letters(text), public.street_type_ru(text), public.street_name_part(text), public.kz_name_ru(text), public.street_ru(text) to anon, authenticated;

-- Адрес события или площадки по частям: улица, дом и заметка («2 этаж», «офис 405»); город и площадка отбрасываются.
create or replace function public.addr_parts(a text, out street text, out house text, out note text)
language plpgsql immutable parallel safe as $$
declare t text; notes text[] := '{}'; m text[];
begin
  if a is null or btrim(a) = '' then return; end if;
  t := regexp_replace(a, '[​﻿]', '', 'g');
  for m in select regexp_matches(t, '\(([^)]*)\)', 'g') loop notes := notes || btrim(m[1]); end loop;
  t := regexp_replace(t, '\([^)]*\)', ' ', 'g');
  t := regexp_replace(t, ',?\s*(г\.?\s*)?(Алматы|Алма-Ата)(\s*,\s*Казахстан)?\s*$', '', 'i');
  t := regexp_replace(t, '^\s*(г\.?\s*)?(Алматы|Алма-Ата)\s*,\s*', '', 'i');
  for m in select regexp_matches(t, '[,.]?\s*(\d+\s*-?\s*(?:й\s*)?(?:этаж|эт\.?)|(?:офис|оф\.|кв\.|каб\.|кабинет|зал|блок|вход|подъезд)\s*[^,]*)', 'gi') loop notes := notes || btrim(m[1]); end loop;
  t := regexp_replace(t, '[,.]?\s*(\d+\s*-?\s*(й\s*)?(этаж|эт\.?)|(офис|оф\.|кв\.|каб\.|кабинет|зал|блок|вход|подъезд)\s*[^,]*)', '', 'gi');
  t := btrim(regexp_replace(t, '\s+', ' ', 'g'), ' ,.');
  note := nullif(array_to_string(notes, ', '), '');
  m := regexp_match(t, '^(.*?)[,\s]+(\d+\s?[а-яa-z]?(?:\s?/\s?\d+[а-яa-z]?)?(?:\s?к\.?\s?\d+[а-яa-z]?)?)$', 'i');
  if m is null or m[1] !~* '[а-яa-zәғқңөұүһі]' then street := t; return; end if;
  -- «Джаз-клуб, ул. Жандосова» — площадку отбрасываем.
  street := coalesce((select p from unnest(string_to_array(m[1], ',')) p where p ~* '(^|\s)(ул|улица|пр|пр-т|проспект|просп|мкр|микрорайон|пер|переулок|б-р|бульвар|пл|площадь|наб|шоссе|көш|көшесі|даңғылы|к)\.?(\s|$)' limit 1),
    (string_to_array(m[1], ','))[array_length(string_to_array(m[1], ','), 1)]);
  street := btrim(regexp_replace(regexp_replace(street, '(ул|пр|пр-т|просп|мкр|мкрн|пер|пл|наб)\.(?=\S)', '\1. ', 'gi'), '\s+к\.?$', ' көшесі', 'i'));
  house := regexp_replace(regexp_replace(m[2], '\s+', '', 'g'), 'к(\d)', ' к\1', 'i');
end
$$;

-- Адрес в одном виде, улица — как в справочнике: «улица Тулебаева, 38А». Без дома («в центре») — как было.
create or replace function public.addr_ru(a text) returns text
language plpgsql stable parallel safe set search_path = public, extensions as $$
declare p record; c text; known text;
begin
  select * into p from public.addr_parts(a);
  if p.street is null or p.house is null then return a; end if;
  c := public.street_ru(p.street);
  select ru into known from public.street_map m
    where public.norm_addr(m.ru) = public.norm_addr(c) and coalesce(public.street_type_ru(m.ru), 'улица') = coalesce(public.street_type_ru(c), 'улица')
    group by ru order by count(*) desc limit 1;
  return coalesce(known, c) || ', ' || p.house;
end
$$;

update public.events set address_note = coalesce(address_note, (public.addr_parts(address)).note), address = public.addr_ru(address)
where address is not null and public.addr_ru(address) is distinct from address;
update public.venues set address = public.addr_ru(address) where address is not null and public.addr_ru(address) is distinct from address;

grant execute on function public.addr_parts(text), public.addr_ru(text) to anon, authenticated;
