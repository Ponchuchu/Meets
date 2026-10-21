// node scripts/spots-sql.mjs > supabase/migrations/<…>_spots.sql — таблица постоянных мест из src/data/attractions.ts.
// Повторный запуск безопасен: новые места добавляются, у старых обновляются описание и точка, а часы и цены,
// которые дописал сборщик, не трогаются.
import { ATTRACTIONS } from '../src/data/attractions.ts';

const q = (v) => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const arr = (a) => (a?.length ? `array[${a.map(q).join(',')}]::text[]` : "'{}'::text[]");
const rows = ATTRACTIONS.map((a) => `  (${[q(a.id), q(a.parent), q(a.name), q(a.kind), a.lat, a.lon, q(a.address), q(a.about), arr(a.tips), !!a.solo, !!a.free,
  a.season ? `array[${a.season.join(',')}]` : 'null', q(a.buy), q(a.info)].join(', ')})`).join(',\n');

console.log(`-- Постоянные места (21 октября): горы, парки, музеи, катки, боулинг, фотозоны и «сходить одному».
-- Часы с перерывами (hours), цены и ссылка Kaspi дописывает сборщик worker/src/spots.ts; приложение читает таблицу всем.
create table if not exists public.spots (
  id text primary key,
  parent_id text references public.spots (id) on delete cascade,
  name text not null,
  kind text not null,
  lat double precision not null,
  lon double precision not null,
  address text,
  about text not null default '',
  tips text[] not null default '{}',
  solo boolean not null default false,
  free boolean not null default false,
  season int[],
  buy_url text,
  info_url text,
  kaspi_url text,
  -- {"1":[["10:00","13:00"],["14:00","22:00"]], … "7":[]}: дни ISO, два интервала — перерыв, [] — выходной.
  hours jsonb,
  price_from int,
  price_note text,
  gis_id text,
  source text not null default 'manual',
  checked_at timestamptz,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.spots enable row level security;
drop policy if exists spots_read on public.spots;
create policy spots_read on public.spots for select using (enabled);
grant select on public.spots to anon, authenticated;

insert into public.spots (id, parent_id, name, kind, lat, lon, address, about, tips, solo, free, season, buy_url, info_url) values
${rows}
on conflict (id) do update set parent_id = excluded.parent_id, name = excluded.name, kind = excluded.kind, lat = excluded.lat, lon = excluded.lon,
  address = excluded.address, about = excluded.about, tips = excluded.tips, solo = excluded.solo, free = excluded.free, season = excluded.season,
  buy_url = coalesce(public.spots.buy_url, excluded.buy_url), info_url = coalesce(public.spots.info_url, excluded.info_url), updated_at = now();`);
