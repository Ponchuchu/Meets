-- Надёжные заявки в друзья, права сообщений и индексы. Применить до обновления приложения.
begin;

create index if not exists messages_chat_recent_idx on public.messages(chat_id, created_at desc, id desc);
create index if not exists friendships_by_b on public.friendships(b, a);
create index if not exists friend_requests_incoming on public.friend_requests(to_id, status);
create index if not exists chat_members_by_user on public.chat_members(user_id, chat_id);
drop policy if exists messages_update_own on public.messages;
create policy messages_update_own on public.messages for update to authenticated
  using (author_id = auth.uid() and public.is_chat_member(chat_id))
  with check (author_id = auth.uid() and public.is_chat_member(chat_id));

drop policy if exists friend_requests_cancel on public.friend_requests;
create policy friend_requests_cancel on public.friend_requests for delete to authenticated
  using (from_id = auth.uid() and status = 'pending');
-- Получатель меняет только статус; нельзя подменить отправителя или адресата принятой заявки.
revoke update on public.friend_requests from authenticated;
grant update(status) on public.friend_requests to authenticated;

create or replace function public.send_friend_request(other uuid, request_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'auth-required'; end if;
  if other is null or other = me then raise exception 'invalid-recipient'; end if;
  if public.is_blocked(me, other) then raise exception 'blocked'; end if;
  -- Одновременные встречные заявки обрабатываются одной транзакцией за другой.
  perform pg_advisory_xact_lock(hashtextextended(least(me, other)::text || greatest(me, other)::text, 0));
  if public.is_friend(me, other) then return; end if;
  insert into public.friend_requests(from_id, to_id, note, status)
    values (me, other, left(request_note, 500), 'pending')
    on conflict (from_id, to_id) do update set note = excluded.note, status = 'pending', created_at = now();
  if exists(select 1 from public.friend_requests where from_id = other and to_id = me and status = 'pending') then
    update public.friend_requests set status = 'accepted'
      where (from_id = me and to_id = other) or (from_id = other and to_id = me);
  end if;
end $$;
revoke all on function public.send_friend_request(uuid, text) from public, anon;
grant execute on function public.send_friend_request(uuid, text) to authenticated;

-- Списки обновляются через Realtime; при отсутствии публикации клиент использует сверку раз в минуту.
do $$
declare t text;
begin
  if exists(select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['friendships','friend_requests','chat_members','messages'] loop
      if not exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
commit;
