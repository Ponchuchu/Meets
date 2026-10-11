-- Панель разработчика, вкладка «Аналитика»: сводка по людям одним запросом. Только команда.
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
    'events_draft', (select count(*) from public.events where status = 'draft'),
    'events_no_price', (select count(*) from public.events where status = 'published' and visibility = 'public' and not is_free and price_min is null),
    'events_no_place', (select count(*) from public.events where status = 'published' and visibility = 'public' and venue_id is null and address is null),
    'top_cats', coalesce((select jsonb_agg(x) from (select category, count(*) n from public.events where status = 'published' and visibility = 'public' group by 1 order by 2 desc limit 5) x), '[]'::jsonb)
  ) into r;
  return r;
end $$;
revoke execute on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;
