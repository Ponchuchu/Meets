-- Редактирование сообщений (21 октября): свой текст можно исправить в течение 48 часов, у сообщения пометка «изменено».
-- Остальные поля после отправки не меняются никем; удаление «у себя» (deleted_for) работает как раньше.
alter table public.messages add column if not exists edited_at timestamptz;

create or replace function public.messages_guard_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.chat_id is distinct from old.chat_id or new.author_id is distinct from old.author_id
     or new.kind is distinct from old.kind or new.created_at is distinct from old.created_at
     or new.media_path is distinct from old.media_path then
    raise exception 'message-readonly' using errcode = '42501';
  end if;
  if new.body is distinct from old.body then
    if old.author_id is distinct from auth.uid() or old.kind <> 'text' then
      raise exception 'message-edit-forbidden' using errcode = '42501';
    end if;
    if old.created_at < now() - interval '48 hours' then
      raise exception 'message-edit-too-late' using errcode = '42501';
    end if;
    if coalesce(btrim(new.body), '') = '' then
      raise exception 'message-edit-empty' using errcode = '22023';
    end if;
    new.body := left(new.body, 4000);
    new.edited_at := now();
  else
    new.edited_at := old.edited_at;
  end if;
  return new;
end $$;

drop trigger if exists messages_guard_update on public.messages;
create trigger messages_guard_update before update on public.messages
  for each row execute function public.messages_guard_update();
