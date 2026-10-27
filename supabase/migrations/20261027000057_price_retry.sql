alter table public.events add column if not exists price_checked_at timestamptz;
comment on column public.events.price_checked_at is 'Last missing-price retry; rotate 20 upcoming cards, retry after 24h';
-- Verified public profile: https://www.instagram.com/medeu_official/
update public.spots set ig = 'medeu_official' where id = 'medeu' and ig is null;
