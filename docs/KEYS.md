# Ключи и доступы

## Уже есть

| Что | Где лежит |
|---|---|
| Mapbox, публичный токен | `config/public-keys.json` → `mapboxPublicToken` |
| Supabase, адрес проекта и публичный ключ | `config/public-keys.json` → `supabaseUrl`, `supabaseProjectRef`, `supabasePublishableKey` |
| Настоящие события Алматы на октябрь | `data/seed/events-almaty.json` (33 события, координаты уже проставлены) |
| Таблицы `venues`, `events` в Supabase | Созданы 28.09.2026, 33 события загружены. Приложение читает их с публичным ключом |

Публичные ключи безопасно хранить в репозитории: они и так попадают в приложение. Доступ к данным в Supabase ограничивают правила RLS.

## Состояние на 30.09

- Все таблицы созданы (владелец выполнил `apply-all.sql` в SQL Editor), функции `weather`, `deck`, `notify` загружены, `CRON_SECRET` и секреты Vault заданы — погода обновляется раз в час, расписание пушей работает.
- Токен Supabase лежит в облачной среде как API credential: Claude применяет миграции и загружает функции сам (`npm run db:migrate`, `npm run functions:deploy`).
- Осталось: вход по телефону (SMS-шлюз), ключи пушей (FCM/APNs), включить источники в `/admin`.

## Этап 8: бэкенд написан, но ещё не включён в базе (история)

28.09 Management API перестал принимать токен из чата (ответ 401 — токен, видимо, уже отозван). Поэтому всё для людей, чатов и пушей лежит в репозитории, но в Supabase ещё не применено. Приложение работает как раньше: события — из базы, остальное — демо.

Когда появится доступ (пункт 2 ниже — токен как API credential), Claude сам выполнит шаги 1–3. Если захочешь сам — нужны Node и терминал в папке проекта:

1. **Таблицы и правила доступа:** `SUPABASE_ACCESS_TOKEN=<токен> npm run db:migrate`. Создаст людей, друзей, чаты, сообщения, планы, вкус, значки, пуши, погоду, хранилище фото и расписание задач. Все миграции проверены на Postgres 16.
2. **Демо-люди и чаты макета:** `SUPABASE_ACCESS_TOKEN=<токен> npm run db:seed-demo`. Чтобы твой аккаунт сразу получил друзей и чаты как в макете, сначала войди в приложение по телефону, потом добавь номер в команду: `npm run db:seed-demo -- +77071234567`.
3. **Серверные функции** (погода, колода «Для тебя», пуши). Нужен вход в Supabase CLI: `npx supabase login`, затем `npm run functions:deploy`.
4. **Секрет для расписания.** Придумай длинный случайный пароль (например, из менеджера паролей) и положи его в два места:
   - Supabase → Edge Functions → **Secrets** → `CRON_SECRET` = пароль;
   - Supabase → SQL Editor, выполни:
     ```sql
     select vault.create_secret('https://xkpchsommtilristiesu.supabase.co', 'project_url');
     select vault.create_secret('<тот же пароль>', 'cron_secret');
     ```
   Без этого база не будет звать функции: погода останется демо, пуши не уйдут. Ничего не сломается.
5. **Вход по телефону.** Supabase → Authentication → Sign In / Providers → **Phone** → включить. Для SMS в Казахстан нужен шлюз (Mobizon.kz или SMSC.kz, см. «Понадобится позже») и Send SMS Hook. Пока шлюза нет, приложение пускает с демо-кодом 4821, но такой вход живёт только на телефоне, в базу он не попадает.

## Этап 9: сборщик событий и админка

1. **Миграция** `20260928000004_pipeline.sql` применится той же командой `npm run db:migrate` (источники, сырые посты, очередь, модерация, архив).
2. **Секреты сборщика** — GitHub → репозиторий → Settings → Secrets and variables → Actions → **New repository secret**:
   - `SUPABASE_SECRET_KEY` — Supabase → Project Settings → API Keys → Secret key (`sb_secret_…`);
   - `ANTHROPIC_API_KEY` — console.anthropic.com → API Keys. Без него сборщик разбирает посты простыми правилами и ничего не публикует сам.
   Пока секретов нет, сборщик каждые 2 часа делает демо-прогон и ничего не пишет.
3. **Команда для админки.** Войди в приложение, потом в Supabase → SQL Editor:
   ```sql
   insert into public.staff (user_id, role) select id, 'admin' from auth.users where phone = '77071234567';
   ```
   (свой номер без «+»). После этого `/admin` в web-версии показывает настоящую очередь, иначе — демо макета.
4. **Источники** в базе выключены, пока нет юридической проверки (`TECH.md`, «Источники»). Включить Telegram-канал — переключатель «собирать» в `/admin` → «Источники».

## Этап 10: сборки для телефона

Порядок и все команды — `docs/STORE.md`. Коротко, что нужно от тебя:
1. Аккаунт **expo.dev** → `npx eas login` и `npx eas init` (или дай мне `EXPO_TOKEN` в переменные облачной среды — соберу сам).
2. **Apple Developer** ($99/год): в App Store Connect создать приложение `kz.ryadom.app`, включить Sign in with Apple. В Supabase → Authentication → Providers → **Apple** включить и указать Bundle ID `kz.ryadom.app`.
3. **Google Play Console** ($25): создать приложение, пройти закрытый тест (12 тестеров, 14 дней).
4. **Пуши:** ключ FCM v1 (Firebase → Project settings → Service accounts) и APNs-ключ — загрузить в expo.dev → Credentials.
5. Если сборка Android/iOS попросит токен загрузки Mapbox — account.mapbox.com → **Create token** со скоупом `DOWNLOADS:READ`, положить в expo.dev → Secrets как `RNMAPBOX_MAPS_DOWNLOAD_TOKEN`.
6. Миграция `20260928000005_release.sql` (удаление аккаунта, аналитика) применится той же командой `npm run db:migrate`.

## Сделай сейчас: перевыпусти токен Supabase

Токен Supabase (`sbp_…`) был отправлен в чат. Им создали таблицы, в репозиторий он не попал. Но токен даёт полный доступ к проекту, поэтому его лучше заменить:
1. supabase.com/dashboard/account/tokens → у старого токена **Revoke**.
2. **Generate new token** → положи новый в настройки среды (пункт 2 ниже), **не в чат**.

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
     exp.host
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
- Секретный ключ нужен только сборщику событий: GitHub → Settings → Secrets and variables → Actions, имя `SUPABASE_SECRET_KEY` (см. «Этап 9»).
- Если секретный ключ случайно попал куда-то публично — перевыпусти его в Supabase → Project Settings → API Keys.

## Mapbox: сделать до публикации

Карта уже работает с токеном из `config/public-keys.json`. Перед публичным запуском ограничь токен, чтобы им не пользовались чужие сайты:
1. account.mapbox.com → **Tokens** → токен `pk.…` → **URL restrictions**: адрес сайта (web-версии), когда он появится.
2. Для телефонов ограничение по bundle id (`kz.ryadom.app`) добавим вместе со сборкой в этапе 10.

## Понадобится позже

| Что | Зачем | Где взять | Куда положить |
|---|---|---|---|
| Google Cloud OAuth | Вход через Google | console.cloud.google.com → Credentials: клиенты Web, iOS, Android | Supabase → Auth → Providers → Google (Client IDs). Приложение уже умеет входить по id-токену; кнопку подключим к нативному входу вместе со сборкой (этап 10) |
| Apple Developer ($99/год) | Вход через Apple, App Store | developer.apple.com | Supabase → Auth → Apple; EAS |
| Google Play Console ($25) | Публикация в Google Play | play.google.com/console | EAS |
| Аккаунт Expo | Сборки для телефона, пуши | expo.dev | Токен `EXPO_TOKEN` — в переменные облачной среды. Для пушей: projectId проекта EAS (этап 10), ключи FCM v1 (Android) и APNs (iOS) — в expo.dev → Credentials. `EXPO_ACCESS_TOKEN` (если включишь защиту пушей) — в Supabase → Edge Functions → Secrets |
| SMS-шлюз (Mobizon.kz или SMSC.kz) | Коды по SMS | Договор, имя отправителя, шаблон OTP | Ключ шлюза — Supabase → Edge Functions → Secrets; функцию Send SMS Hook добавлю, когда будет договор |

## APK для Android (поставить приложение на свой телефон)

Один раз:
1. Зарегистрируйся на **expo.dev** (бесплатно).
2. expo.dev → аватар справа вверху → **Account settings** → **Access tokens** → **Create token**. Назови, например, `github`, скопируй токен.
3. GitHub → репозиторий `ryadom` → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**. Имя: `EXPO_TOKEN`, значение — токен. Сохранить. (Токен никому не пересылай, в чат тоже.)

Каждый раз, когда хочешь свежую версию:
1. GitHub → **Actions** → слева **Android APK** → справа **Run workflow** → зелёная **Run workflow**.
2. Через 15–20 минут на expo.dev → проект **ryadom** → **Builds** появится сборка. Открой её **на телефоне** и нажми **Install** (или скачай APK).
3. Android спросит разрешение «установка из неизвестных источников» — разреши для браузера.

Карта Mapbox в APK настоящая. Если сборка упадёт — напиши мне, посмотрю лог.

## Без токена Supabase: таблицы одной вставкой

Если не хочешь давать токен, таблицы можно создать руками за минуту:
1. Открой файл `supabase/apply-all.sql` на GitHub → кнопка **Copy raw file**.
2. Supabase → **SQL Editor** → **New query** → вставь → **Run**.
Файл можно запускать повторно — ничего не сломается. После этого заработают сборщик событий, друзья, чаты, погода и пуши на сервере.

## Сборщик событий: Kimi и новые источники

- **Kimi** (секрет GitHub `KIMI`) разбирает посты, если нет `ANTHROPIC_API_KEY`: отделяет события от рекламы, акций и мемов, заполняет карточку. Модель выбирается сама (самая новая K3/K2 в аккаунте), можно задать `KIMI_MODEL`. Ключ Anthropic из облачной среды Claude сюда не попадает — сборщик живёт в GitHub Actions.
- **Sxodim.com** («Куда сходить») — добавлен источником, но **выключен**. Включить: `/admin` → «Источники». Перед этим стоит прочитать условия сайта (правило из `TECH.md`: источники — после проверки).
- **Threads** (@promoclub.almaty и другие) — страницы Threads не отдают посты без официального доступа. Нужно приложение в Meta for Developers с доступом к Threads API (keyword search) — это отдельная заявка, пока отложено. Реклама и акции оттуда всё равно отсеиваются разбором.
- Другие кандидаты: Ticketon (закрыт от роботов — только через партнёрский API), Kaspi Билеты, Telegram-каналы афиш — Telegram сборщик уже читает, достаточно добавить канал в `/admin`.

## Погода

Ключ не нужен: Open-Meteo бесплатный и без регистрации (погода «сейчас» на карте и прогноз).

## Поиск событий ИИ раз в сутки (Gemini API)

Каждый день в 08:40 по Алматы GitHub сам запускает поиск: Gemini с поиском Google ищет события по 6 разделам одновременно, наш код открывает каждую найденную страницу и проверяет её (ссылка живая, на ней есть название; дата — из разметки страницы; картинка — со страницы). Готовые карточки — в «Согласование», сами на карту не идут. Весь запуск — обычно 1–2 минуты.

1. aistudio.google.com → Get API key → создать ключ (бесплатно).
2. GitHub → репозиторий → Settings → Secrets and variables → Actions → секрет `GEMINI_API_KEY`.
3. Проверить: Actions → search → Run workflow. В конце — файл `search-…` с тем, что нашлось, а в логе шага поиска — сколько нашёл ИИ, сколько прошло проверку и сколько потрачено токенов.

Модель можно поменять переменной `GEMINI_MODEL` (вкладка Variables), по умолчанию `gemini-3.8-flash`. Бесплатно — до 5 000 поисков Google в месяц; один запуск — около 10–20 поисков.

Ещё нужно один раз применить в базе `supabase/migrations/20261004000008_search.sql` (или весь `supabase/apply-all.sql`): он добавляет источник «Поиск · Gemini».

## Обложки событий

- Картинку робот всегда сначала берёт со страницы самого события (og:image, twitter:image, разметка).
- Нет картинки, а событие ты одобрил — каждые 2 часа `.github/workflows/covers.yml` рисует иллюстрацию в стиле «рядом.» (без текста, лиц и логотипов) и кладёт в Supabase Storage, бакет `covers`. В карточке такая картинка помечается как иллюстрация.
- Генерация картинок у Google **платная** (около 0,03–0,07 $ за штуку, модель `gemini-3.1-flash-lite-image`, можно сменить переменной `GEMINI_IMAGE_MODEL`). На бесплатном ключе шаг просто пишет «недоступно», и в приложении остаётся обложка раздела. Чтобы включить: aistudio.google.com → Billing → привязать карту к проекту ключа.
- Один раз примени в базе `supabase/migrations/20261004000009_covers.sql` (бакет `covers` и пометка «иллюстрация»).

## v6: что понадобится (4 октября)

Без этих ключей приложение работает, просто нужная функция спрятана.

| Что | Зачем | Где взять | Куда положить |
|---|---|---|---|
| **TomTom** (бесплатно, 200 тыс. запросов в месяц) | Слой «Пробки» и «+3 мин» в маршруте на машине | developer.tomtom.com → Sign up → Dashboard → **Keys** → скопировать ключ | expo.dev → Secrets: `EXPO_PUBLIC_TOMTOM_KEY` (ключ публичный, но ограничь его в кабинете TomTom по bundle id) |
| **Токен GitHub** для кнопки «Искать сейчас» | Панель разработчика запускает робота поиска | github.com → Settings → Developer settings → Fine-grained tokens → доступ только к `Ponchuchu/ryadom`, право **Actions: Read and write** | Supabase → Edge Functions → Secrets: `GITHUB_DISPATCH_TOKEN`. В репозиторий не класть |
| **2GIS Routing API** (позже, платно) | Номера автобусов в маршруте | Договор с 2ГИС | Секреты Supabase: `DGIS_KEY` |

Код в демо-входе теперь **0000** (было 4821).

## Робот выключен (5 октября)

Поиск событий, обложки и сборщик больше не запускаются сами по расписанию. Код и ключи на месте. Запустить вручную: GitHub → вкладка **Actions** → слева `search` (или `covers`, `worker`) → **Run workflow**. Позже это будет кнопка «Искать сейчас» и расписание в панели разработчика.

## Ключ TomTom в Supabase (5 октября)

Ключ уже лежит в GitHub как `TOPTOP_TOKEN` — для сборки приложения. Для маршрутов с пробками его же нужно положить в Supabase:

1. Открой https://supabase.com/dashboard/project/xkpchsommtilristiesu/functions/secrets
2. **Add new secret**: имя `TomTom_KEY`, значение — тот же ключ TomTom → **Save**. (Сделано 5 октября: секрет называется именно `TomTom_KEY`.)

## Остановки автобусов (по желанию)

GitHub → **Actions** → `buses` → **Run workflow**. Ключи не нужны: робот заберёт остановки с координатами из OpenStreetMap и сам сохранит файл `data/seed/bus-stops-almaty.json`.

## Адреса — Qaida.io (позже, по желанию)

Подсказки адресов и «адрес → координаты» по Казахстану. Регистрация на qaida.io → ключ в кабинете → Supabase secrets как `QAIDA_KEY`.

## Альфа (5 октября): что сделать владельцу

1. **Тестеры.** Номера и коды ты передаёшь Claude Code в сообщении. Он сам положит их в секрет Supabase `ALPHA_TESTERS`. Если не сможет — открой https://supabase.com/dashboard/project/xkpchsommtilristiesu/functions/secrets → **Add new secret** → имя `ALPHA_TESTERS`, значение в виде `+7XXXXXXXXXX:0000,+7YYYYYYYYYY:0000` → **Save**.
2. **Токен для кнопки «Искать сейчас»:** github.com → аватарка → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**: репозиторий только `Ponchuchu/ryadom`, права **Actions: Read and write** → скопировать. Положить в Supabase secrets (ссылка выше) как `GITHUB_DISPATCH_TOKEN`.
3. **Пуши на Android:** console.firebase.google.com → **Add project** «ryadom» → **Project settings** → **Service accounts** → **Generate new private key** (скачается .json). Потом expo.dev → проект ryadom → **Credentials** → Android → **FCM V1 service account key** → загрузить этот файл. Сам файл никому не пересылать.
4. **APK:** GitHub → **Actions** → «Android APK» → **Run workflow**. Через ~20 минут ссылка на APK — в логе. Открыть на телефоне, установить.
