-- Вызов функций из базы: ждём до 20 с, а не 5 (холодный старт Edge Function + внешний API погоды).
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
    body := body,
    timeout_milliseconds := 20000
  );
end;
$$;
revoke execute on function public.call_function(text, jsonb) from public, anon, authenticated;
