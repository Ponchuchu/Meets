-- Поиск событий ИИ раз в сутки (Gemini CLI, .github/workflows/search.yml, worker/src/search.ts).
-- Всё найденное идёт только в «Согласование»: источник без доверия, сам на карту не публикует.
alter table public.sources drop constraint if exists sources_kind_check;
alter table public.sources add constraint sources_kind_check
  check (kind in ('telegram', 'site', 'search', 'threads', 'manual', 'user'));

insert into public.sources (kind, handle, title, note, trusted, auto_publish, enabled) values
  ('search', 'gemini', 'Поиск · Gemini', 'раз в сутки ищет события в интернете; картинка — со страницы события', false, false, true)
on conflict (kind, handle) do nothing;
