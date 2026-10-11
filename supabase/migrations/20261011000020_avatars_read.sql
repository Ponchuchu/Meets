-- Фото профиля не загружалось: загрузка с upsert требует права чтения строки в storage.objects, а политики чтения у бакета не было.
drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects for select to authenticated using (bucket_id = 'avatars');
