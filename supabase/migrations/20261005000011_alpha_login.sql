-- Вход тестеров альфы без SMS (docs/ALPHA.md §1): попытки для лимита «5 за 10 минут на номер».
-- Номера тестеров здесь не хранятся — только в секрете функции ALPHA_TESTERS.
create table if not exists public.alpha_attempts (
  id bigint generated always as identity primary key,
  phone_hash text not null,
  at timestamptz not null default now(),
  ok boolean not null default false
);
create index if not exists alpha_attempts_idx on public.alpha_attempts (phone_hash, at desc);
alter table public.alpha_attempts enable row level security; -- без политик: пишет и читает только функция

-- В v6 дата рождения при входе не спрашивается.
alter table public.profiles alter column birth_date drop not null;

-- Читать профили — по старой политике profiles_read (кроме чёрного списка), писать свой — profiles_self.
drop policy if exists profiles_read_v6 on public.profiles;
drop policy if exists profiles_write_v6 on public.profiles;
