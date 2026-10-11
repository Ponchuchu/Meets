-- Панель разработчика: «Все события» — переименовать, поменять фото, снять с карты, удалить.
-- Удаление «мягкое»: событие уходит в архив с пометкой rejected, чтобы поиск не вернул его снова,
-- а планы и чаты людей, которые уже на него записались, не пропали.
alter table public.events add column if not exists orig_title text;

create or replace function public.staff_rename_event(ev uuid, new_title text)
returns void language plpgsql security definer set search_path = public as $$
declare t text := btrim(coalesce(new_title, ''));
begin
  if not public.is_staff() then raise exception 'staff-only'; end if;
  if char_length(t) < 2 or char_length(t) > 120 then raise exception 'bad-title'; end if;
  update events set orig_title = coalesce(orig_title, title), title = t, updated_at = now() where id = ev;
end;
$$;
grant execute on function public.staff_rename_event(uuid, text) to authenticated;

create or replace function public.staff_event_action(ev uuid, action text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'staff-only'; end if;
  if action = 'unpublish' then
    update events set status = 'draft', published_at = null, updated_at = now() where id = ev and visibility = 'public';
  elsif action = 'delete' then
    update events set status = 'archived', rejected = true, updated_at = now() where id = ev and visibility = 'public';
  else
    raise exception 'unknown-action';
  end if;
end;
$$;
grant execute on function public.staff_event_action(uuid, text) to authenticated;

-- Фото события от сотрудника: кладёт и заменяет только staff, читают все (бакет публичный).
drop policy if exists covers_staff_write on storage.objects;
create policy covers_staff_write on storage.objects for insert to authenticated with check (bucket_id = 'covers' and public.is_staff());
drop policy if exists covers_staff_update on storage.objects;
create policy covers_staff_update on storage.objects for update to authenticated using (bucket_id = 'covers' and public.is_staff());
