-- FIX3 Ф3: на карте нажимаются только торговые центры, где почти всегда есть события (решение владельца 20 октября).
-- Точки — из справочника мест Overture (places); часы — обычные для ТРЦ Алматы. Повторное применение обновляет данные.
insert into public.venues (name, kind, address, hours, geog, needs_pin, geo_source) values
  ('Dostyk Plaza', 'mall', 'пр. Достык, 111, уг. ул. Жолдасбекова', '10:00–22:00', extensions.st_setsrid(extensions.st_makepoint(76.95683, 43.23339), 4326)::extensions.geography, false, 'overture'),
  ('MEGA Alma-Ata', 'mall', 'ул. Розыбакиева, 247А', '10:00–22:00', extensions.st_setsrid(extensions.st_makepoint(76.89234, 43.20247), 4326)::extensions.geography, false, 'overture'),
  ('MEGA Park', 'mall', 'ул. Макатаева, 127/1, уг. пр. Сейфуллина', '10:00–22:00', extensions.st_setsrid(extensions.st_makepoint(76.92977, 43.26418), 4326)::extensions.geography, false, 'overture'),
  ('Esentai Mall', 'mall', 'пр. Аль-Фараби, 77/8', '10:00–22:00', extensions.st_setsrid(extensions.st_makepoint(76.92762, 43.21848), 4326)::extensions.geography, false, 'overture'),
  ('Aport Mall East', 'mall', 'Кульджинский тракт, 106', '10:00–22:00', extensions.st_setsrid(extensions.st_makepoint(77.02384, 43.31526), 4326)::extensions.geography, false, 'overture'),
  ('Aport Mall West', 'mall', 'Ташкентский тракт, 18', '10:00–22:00', extensions.st_setsrid(extensions.st_makepoint(76.82176, 43.23306), 4326)::extensions.geography, false, 'overture')
on conflict (name) do update set kind = excluded.kind, address = excluded.address, hours = coalesce(public.venues.hours, excluded.hours),
  geog = excluded.geog, needs_pin = false, geo_source = excluded.geo_source;

-- FIX3 Ф4: событие с адресом само находит точку по справочнику адресов (match_address), если у площадки точки нет,
-- она «примерная» или стоит в центре города по умолчанию. Срабатывает при добавлении и смене адреса; старые — разово ниже.
create or replace function public.point_from_address(ev uuid) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare e public.events; v public.venues; m record; venue uuid;
begin
  select * into e from public.events where id = ev;
  if not found or e.visibility <> 'public' or coalesce(length(trim(e.address)), 0) < 3 then return false; end if;
  select * into v from public.venues where id = e.venue_id;
  if v.id is not null and v.geog is not null and not v.needs_pin
     and not st_dwithin(v.geog, st_makepoint(76.8897, 43.2389)::geography, 30) then return false; end if;
  select * into m from public.match_address(e.address);
  if m.lat is null then return false; end if;
  insert into public.venues(name, address, geog, needs_pin, geo_source)
    values (coalesce(v.name, e.title) || ' · ' || m.label, m.label, st_setsrid(st_makepoint(m.lon, m.lat), 4326)::geography, false, 'addresses')
    on conflict (name) do update set geog = excluded.geog, needs_pin = false returning id into venue;
  update public.events set venue_id = venue, flags = array_remove(flags, 'needs_pin') where id = ev;
  return true;
end $$;
revoke all on function public.point_from_address(uuid) from public, anon, authenticated;

create or replace function public.events_point_from_address() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.point_from_address(new.id);
  return null;
end $$;
drop trigger if exists events_point_from_address on public.events;
create trigger events_point_from_address after insert or update of address, venue_id on public.events
  for each row when (pg_trigger_depth() < 1) execute function public.events_point_from_address();

select public.point_from_address(e.id) from public.events e
  where e.visibility = 'public' and e.status in ('draft', 'published') and not e.rejected
    and coalesce(e.ends_at, e.starts_at + interval '3 hours') > now();
