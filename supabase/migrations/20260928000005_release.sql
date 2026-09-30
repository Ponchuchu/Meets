-- Этап 10: удаление аккаунта (App Store 5.1.1) и события аналитики (RECOMMENDATIONS.md, раздел 6).

-- Удалить себя: свои сообщения и загруженные файлы стираем явно, остальное (профиль, друзья, планы,
-- точки, сигналы, токены) — каскадом от строки auth.users.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'auth-required'; end if;
  delete from public.messages where author_id = me;
  delete from storage.objects where owner = me;
  delete from auth.users where id = me;
end;
$$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Аналитика: минимальные события без текста и координат. Писать может любой вошедший — только свои,
-- читать — только команда. Хранится 180 дней.
create table if not exists public.analytics_events (
  id bigserial primary key,
  user_id uuid references auth.users (id) on delete cascade,
  device_id text not null,
  name text not null check (name in ('feed_open', 'card_shown', 'go', 'skip', 'undo', 'cancel_plan', 'arrived', 'event_open', 'chat_sent')),
  event_id text,
  at timestamptz not null default now()
);
create index if not exists analytics_events_at_idx on public.analytics_events (at);
alter table public.analytics_events enable row level security;
drop policy if exists analytics_insert on public.analytics_events;
create policy analytics_insert on public.analytics_events for insert to authenticated with check (user_id = auth.uid());
drop policy if exists analytics_staff_read on public.analytics_events;
create policy analytics_staff_read on public.analytics_events for select using (public.is_staff());

select cron.unschedule(jobname) from cron.job where jobname = 'analytics-retention';
select cron.schedule('analytics-retention', '20 23 * * *', $$delete from public.analytics_events where at < now() - interval '180 days'$$);
