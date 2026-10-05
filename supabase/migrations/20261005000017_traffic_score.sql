-- FIX1 И2 п.13: балл пробок Алматы 1–10 (своя формула по TomTom Flow Segment Data), пересчёт раз в 10 минут.
create table if not exists public.traffic_score (
  id int primary key default 1 check (id = 1),
  score int not null,
  ratio double precision not null,
  points jsonb not null default '[]',
  at timestamptz not null default now()
);
alter table public.traffic_score enable row level security;
drop policy if exists traffic_score_read on public.traffic_score;
create policy traffic_score_read on public.traffic_score for select to authenticated using (true);

select cron.unschedule('traffic-score') where exists (select 1 from cron.job where jobname = 'traffic-score');
select cron.schedule('traffic-score', '*/10 * * * *', $$select public.call_function('traffic-score')$$);
