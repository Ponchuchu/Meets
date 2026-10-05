-- FIX1 И2 п.8: точка каждого события по адресу. Геокодер (Edge Function geocode) пишет точку площадки
-- и откуда она: mapbox / manual (поставил разработчик) / seed. Не нашлось — needs_pin, событие ждёт точку в панели.
alter table public.venues add column if not exists geo_source text;
update public.venues set geo_source = 'seed' where geo_source is null and geog is not null and not needs_pin;

-- «Поставить точку» в панели — источник manual.
create or replace function public.mark_manual_pin() returns trigger
language plpgsql as $$
begin
  if new.geog is distinct from old.geog and not new.needs_pin and new.geo_source is not distinct from old.geo_source then
    new.geo_source := 'manual';
  end if;
  return new;
end;
$$;
drop trigger if exists venues_manual_pin on public.venues;
create trigger venues_manual_pin before update on public.venues for each row execute function public.mark_manual_pin();
