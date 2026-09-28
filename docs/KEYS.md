# Ключи и доступы

## Уже есть

| Что | Где лежит |
|---|---|
| Mapbox, публичный токен | `config/public-keys.json` → `mapboxPublicToken` |
| Supabase, адрес проекта и публичный ключ | `config/public-keys.json` → `supabaseUrl`, `supabaseProjectRef`, `supabasePublishableKey` |
| Настоящие события Алматы на октябрь | `data/seed/events-almaty.json` (33 события, координаты проставить при импорте) |

Публичные ключи безопасно хранить в репозитории: они и так попадают в приложение. Доступ к данным в Supabase ограничивают правила RLS.

## Что владелец делает сам (один раз)

Все настройки — в облачной среде Claude Code:
1. claude.ai/code.
2. Над полем ввода — значок облака с названием среды (обычно «Default»).
3. Наведи на среду и нажми шестерёнку.

После изменения настроек **начни новую сессию**: запущенная сессия читает настройки только при старте.

1. **Доступ в интернет.**
   - «Network access» → **Custom**.
   - В «Allowed domains» вставь:
     ```
     *.supabase.co
     api.supabase.com
     api.mapbox.com
     events.mapbox.com
     *.tiles.mapbox.com
     nominatim.openstreetmap.org
     api.open-meteo.com
     ```
   - Поставь галочку «Also include default list of common package managers» и сохрани.
2. **Токен Supabase для создания таблиц.**
   - Открой supabase.com/dashboard/account/tokens → **Generate new token** → скопируй.
   - В той же настройке среды: **API credentials** → **Add credential**:
     - Name — `Supabase`;
     - Allowed websites — `api.supabase.com`;
     - заголовок `Authorization`, префикс `Bearer`, значение — токен;
   - **Connect**.

   Так Claude сможет создавать таблицы, но сам токен не увидит.

## Чего нельзя делать

- **Секретный ключ Supabase** (`sb_secret_…`), пароль базы и токены **не класть** в репозиторий и в код.
- Секретный ключ понадобится только на этапе 9, для сборщика событий. Тогда его нужно будет положить в GitHub → Settings → Secrets and variables → Actions под именем `SUPABASE_SECRET_KEY`.
- Если секретный ключ случайно попал куда-то публично — перевыпусти его в Supabase → Project Settings → API Keys.

## Понадобится позже

| Что | Зачем | Где взять | Куда положить |
|---|---|---|---|
| Ключ Anthropic API | ИИ-разбор постов и афиш (этап 9) | console.anthropic.com → API Keys | Секреты GitHub Actions (`ANTHROPIC_API_KEY`) |
| Google Cloud OAuth | Вход через Google | console.cloud.google.com → Credentials | Supabase → Auth → Providers → Google |
| Apple Developer ($99/год) | Вход через Apple, App Store | developer.apple.com | Supabase → Auth → Apple; EAS |
| Google Play Console ($25) | Публикация в Google Play | play.google.com/console | EAS |
| Аккаунт Expo | Сборки для телефона, пуши | expo.dev | Токен `EXPO_TOKEN` — в переменные облачной среды |
| SMS-шлюз (Mobizon.kz или SMSC.kz) | Коды по SMS | Договор, имя отправителя, шаблон OTP | Секреты Supabase |
