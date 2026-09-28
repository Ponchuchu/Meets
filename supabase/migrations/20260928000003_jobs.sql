-- Этап 8: фоновые задачи. pg_cron дёргает Edge Functions, триггер на сообщения — пуши.
-- Нужны два секрета в Vault (один раз, см. docs/KEYS.md): project_url и cron_secret (тот же, что CRON_SECRET у функций).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Вызов Edge Function с общим секретом из Vault. Без секретов — тихо ничего не делает.
create or replace function public.call_function(fn text, body jsonb default '{}') returns void
language plpgsql security definer set search_path = public as $$
declare
  base text;
  key text;
begin
  select decrypted_secret into base from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into key from vault.decrypted_secrets where name = 'cron_secret';
  if base is null or key is null then return; end if;
  perform net.http_post(
    url := base || '/functions/v1/' || fn,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', key),
    body := body
  );
end;
$$;
revoke execute on function public.call_function(text, jsonb) from public, anon, authenticated;

-- Новое сообщение → пуш получателям (правила частоты считает функция notify).
create or replace function public.on_message_push() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.call_function('notify', jsonb_build_object('type', 'message', 'message_id', new.id));
  return new;
end;
$$;
drop trigger if exists messages_push on public.messages;
create trigger messages_push after insert on public.messages for each row execute function public.on_message_push();

-- «Друг рядом с событием»: друг делится точкой и в 200 м от события, куда я иду сегодня.
create or replace function public.friend_near_candidates()
returns table (recipient uuid, friend_id uuid, friend_name text, event_id uuid, event_title text, meters double precision)
language sql stable security definer set search_path = public, extensions as $$
  select a.user_id, l.user_id, p.name, e.id, e.title, st_distance(l.geog, v.geog)
  from public.attendance a
  join public.events e on e.id = a.event_id
  join public.venues v on v.id = e.venue_id
  join public.locations_last l on public.is_friend(a.user_id, l.user_id)
  join public.marker_settings m on m.user_id = l.user_id
  join public.profiles p on p.id = l.user_id
  where a.status = 'going'
    and e.starts_at between now() - interval '1 hour' and now() + interval '6 hours'
    and l.updated_at > now() - interval '15 minutes'
    and not m.invisible and m.share_until > now()
    and v.geog is not null and st_dwithin(l.geog, v.geog, 200)
    and not exists (select 1 from public.attendance x where x.user_id = l.user_id and x.event_id = e.id and x.status = 'going');
$$;
revoke execute on function public.friend_near_candidates() from public, anon, authenticated;

-- Расписание (UTC; Алматы = UTC+5).
select cron.unschedule(jobname) from cron.job where jobname in ('weather-hourly', 'push-reminders', 'push-friend-near', 'push-daily-feed', 'push-weekend');
select cron.schedule('weather-hourly', '7 * * * *', $$select public.call_function('weather')$$);
select cron.schedule('push-reminders', '*/10 * * * *', $$select public.call_function('notify', '{"type":"job","job":"reminders"}')$$);
select cron.schedule('push-friend-near', '*/10 * * * *', $$select public.call_function('notify', '{"type":"job","job":"friendNear"}')$$);
select cron.schedule('push-daily-feed', '0 5 * * *', $$select public.call_function('notify', '{"type":"job","job":"dailyFeed"}')$$);
select cron.schedule('push-weekend', '0 13 * * 4', $$select public.call_function('notify', '{"type":"job","job":"weekend"}')$$);
