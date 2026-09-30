-- Новые источники событий (выключены: включить переключателем в /admin → «Источники» после проверки условий сайта).
-- sxodim.com — «Куда сходить» по Алматы: страницы событий с разметкой schema.org, читает worker/src/sites.ts.
-- Threads @promoclub.almaty — много рекламы и акций; читать можно только через официальный Threads API (нужно приложение Meta).
insert into public.sources (kind, handle, title, note, trusted, enabled) values
  ('site', 'sxodim.com/almaty', 'Sxodim · Куда сходить в Алматы', 'страницы событий, разметка schema.org', false, false),
  ('threads', 'promoclub.almaty', 'Threads · @promoclub.almaty', 'в основном реклама и акции; бесплатные события — в модерацию', false, false)
on conflict (kind, handle) do nothing;
