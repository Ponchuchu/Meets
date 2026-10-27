-- Refresh galleries independently of prices/hours. NULL means never refreshed.
alter table public.spots add column if not exists photos_checked_at timestamptz;
comment on column public.spots.photos_checked_at is 'Last successful photo refresh; worker retries stale galleries weekly';
-- Confirmed by the organizer poster supplied in the phone report, for this occurrence only.
update public.events set price_min = 5000, is_free = false,
 flags = array_remove(flags, 'check_price')
where id = '23aea1be-6b9b-44c1-8f31-e7fae2308007'
  and title = 'Руслан Тай. Импровизационный концерт'
  and starts_at = '2026-11-01T21:30:00+05:00'
  and price_min is null;
