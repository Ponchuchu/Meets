-- Поздний ответ сети не возвращает уже прочитанные сообщения в непрочитанные.
-- Участник может менять только отметку чтения, не chat_id/user_id своего членства.
revoke update on public.chat_members from public, anon, authenticated;
grant update (last_read_at) on public.chat_members to authenticated;

create or replace function public.mark_chat_read(p_chat uuid, p_seen timestamptz)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null or p_seen is null then raise exception 'not-authenticated'; end if;
  update public.chat_members
    set last_read_at = greatest(coalesce(last_read_at, '-infinity'::timestamptz), least(p_seen, now()))
    where chat_id = p_chat and user_id = auth.uid();
  if not found then raise exception 'chat-not-found'; end if;
end;
$$;
revoke execute on function public.mark_chat_read(uuid, timestamptz) from public, anon;
grant execute on function public.mark_chat_read(uuid, timestamptz) to authenticated;
