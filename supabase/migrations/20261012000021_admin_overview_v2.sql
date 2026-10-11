-- Панель разработчика v2: в сводку добавлены «что требует внимания» — последний запуск поиска, ошибки, пустые поля у событий,
-- старые черновики. Всё считается одним запросом, только для команды.
create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'new_24h', (select count(*) from public.profiles where created_at > now() - interval '24 hours'),
    'new_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'online_24h', (select count(*) from public.locations_last where updated_at > now() - interval '24 hours'),
    'sharing_now', (select count(*) from public.locations_last where updated_at > now() - interval '15 minutes'),
    'friendships', (select count(*) from public.friendships),
    'chats', (select count(*) from public.chats),
    'messages_24h', (select count(*) from public.messages where created_at > now() - interval '24 hours'),
    'going', (select count(*) from public.attendance where status = 'going'),
    'meetups', (select count(*) from public.events where visibility = 'friends'),
    'events_published', (select count(*) from public.events where status = 'published' and visibility = 'public'),
    'events_upcoming', (select count(*) from public.events where status = 'published' and visibility = 'public' and coalesce(ends_at, starts_at + interval '3 hours') > now()),
    'events_draft', (select count(*) from public.events where status = 'draft' and not rejected),
    'drafts_stale', (select count(*) from public.events where status = 'draft' and not rejected and coalesce(ends_at, starts_at + interval '3 hours') < now()),
    'events_no_price', (select count(*) from public.events where status = 'published' and visibility = 'public' and coalesce(ends_at, starts_at + interval '3 hours') > now() and not is_free and price_min is null),
    'events_no_place', (select count(*) from public.events e left join public.venues v on v.id = e.venue_id where e.status = 'published' and e.visibility = 'public' and coalesce(e.ends_at, e.starts_at + interval '3 hours') > now() and (v.geog is null or v.needs_pin)),
    'events_no_cover', (select count(*) from public.events where status = 'published' and visibility = 'public' and coalesce(ends_at, starts_at + interval '3 hours') > now() and cover_url is null),
    'runs_failed_24h', (select count(*) from public.robot_runs where status = 'failed' and started_at > now() - interval '24 hours'),
    'last_run', (select jsonb_build_object('status', status, 'found', found, 'queued', queued, 'at', coalesce(finished_at, started_at), 'params', params,
                   'error', (select l.text from public.robot_log l where l.run_id = rr.id and l.level = 'error' order by l.at desc limit 1))
                 from public.robot_runs rr order by started_at desc limit 1),
    'top_cats', coalesce((select jsonb_agg(x) from (select category, count(*) n from public.events where status = 'published' and visibility = 'public' group by 1 order by 2 desc limit 5) x), '[]'::jsonb)
  ) into r;
  return r;
end $$;
revoke execute on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;
