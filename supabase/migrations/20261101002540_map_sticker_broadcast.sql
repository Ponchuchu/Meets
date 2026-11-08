-- Стикеры карты живут в отдельном приватном канале и не создают сообщений чата.
-- Формат: map-sticker:<отправитель>:<получатель>. Сравнение строк не приводит
-- произвольный topic к UUID и не создаёт ошибок на других каналах.
drop policy if exists map_sticker_read on realtime.messages;
create policy map_sticker_read on realtime.messages for select to authenticated using (
  realtime.messages.extension = 'broadcast'
  and realtime.topic() ~ '^map-sticker:[0-9a-f-]{36}:[0-9a-f-]{36}$'
  and (auth.uid()::text = split_part(realtime.topic(), ':', 2) or auth.uid()::text = split_part(realtime.topic(), ':', 3))
  and exists (
    select 1 from public.friendships f
    where ((f.a::text = split_part(realtime.topic(), ':', 2) and f.b::text = split_part(realtime.topic(), ':', 3))
       or (f.b::text = split_part(realtime.topic(), ':', 2) and f.a::text = split_part(realtime.topic(), ':', 3)))
      and not public.is_blocked(f.a, f.b)
  )
);

drop policy if exists map_sticker_write on realtime.messages;
create policy map_sticker_write on realtime.messages for insert to authenticated with check (
  realtime.messages.extension = 'broadcast'
  and realtime.topic() ~ '^map-sticker:[0-9a-f-]{36}:[0-9a-f-]{36}$'
  and auth.uid()::text = split_part(realtime.topic(), ':', 2)
  and exists (
    select 1 from public.friendships f
    where ((f.a::text = split_part(realtime.topic(), ':', 2) and f.b::text = split_part(realtime.topic(), ':', 3))
       or (f.b::text = split_part(realtime.topic(), ':', 2) and f.a::text = split_part(realtime.topic(), ':', 3)))
      and not public.is_blocked(f.a, f.b)
  )
);
