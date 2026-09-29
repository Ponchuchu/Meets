# Как работать вдвоём

Двое разработчиков, две зоны. Экраны получают данные только через `src/data/` с одним интерфейсом (`src/data/types.ts`), поэтому зоны почти не пересекаются. Кто смотрит какие файлы, записано в `.github/CODEOWNERS`: GitHub сам зовёт нужного человека на ревью.

## Зоны

| | А — приложение | Б — данные и сервер |
|---|---|---|
| Папки | `app/`, `src/ui`, `src/components`, `src/theme`, `src/map`, `src/feed`, `src/event`, `src/profile`, `src/chat/ui`, `src/admin/ui`, `src/state`, `app.json`, `eas.json` | `supabase/`, `worker/`, `src/data/*` (кроме `types.ts`), `src/auth`, `src/admin/api.ts`, `src/analytics`, `src/reco`, `src/notify`, `src/server`, `src/chat/rules.ts`, `src/people/visibility.ts` |
| Задачи | баги на экранах, сверка с `design/png`, анимации, доступность, сборки EAS, проверка на телефонах | миграции и RLS, вход, пуши, Realtime, сборщик событий, рекомендации, безопасность, скорость базы |
| Проверка | скриншот 390×844 до и после, `npm run perf` для тяжёлых экранов | тесты логики, миграция на чистой базе, `npm run worker:demo` |

**Общее** (меняется отдельным маленьким PR, ревью обоих):
- `src/data/types.ts` — договор между зонами: какие данные есть и в каком виде. Сначала PR с интерфейсом и заглушкой в `demo.ts`, потом каждый делает свою половину;
- `package.json`, `package-lock.json` — новые зависимости (`npx expo install …` для всего, что связано с Expo);
- `.github/`, CI.

## Как идёт работа

1. **Задача → Issue** (шаблоны «Баг» и «Задача»), метка `app` или `backend`, исполнитель. Доска — GitHub Projects.
2. **Ветка от свежего `main`**: `fix/feed-undo`, `feat/sms-login`, `chore/deps`. Одна задача — одна ветка.
3. **Маленький PR** (лучше до ~400 строк) по шаблону. В описании — `Закрывает #номер`.
4. **CI зелёный** (`typecheck`, `lint`, `test`, `build:web`, свежесть `supabase/functions/_shared/app.js`) и **одобрение второго** — тогда мерж. Способ — «Squash and merge».
5. **Долго живущая ветка** — раз в день подтягивай `main` (`git merge origin/main`), чтобы конфликты были маленькими.

## Правила, которые не нарушаем

- **`main` защищён**: без PR, зелёного CI и одного одобрения туда не попасть (GitHub → Settings → Branches → Add rule для `main`: Require a pull request, Require approvals 1, Require status checks — `check`, Require review from Code Owners).
- **Миграции не правим после применения.** Нужна правка — новый файл `supabase/migrations/<ГГГГММДДччммсс>_что.sql`. Время в имени — своё, так миграции двоих не столкнутся.
- **Изменили `src/reco`, `src/notify`, `src/data/weather.ts` или `src/data/feedRow.ts`** — `npm run functions:build` и закоммитить `supabase/functions/_shared/app.js`.
- **Демо-режим живёт**, пока идёт разработка: А не ждёт сервера, Б не ждёт экранов. В боевых сборках демо-людей и код 4821 выключаем (`EXPO_PUBLIC_DATA_MODE`).
- **Две базы Supabase**: `staging` для разработки, `prod` для людей. Ключи — только в переменных окружения, EAS secrets и секретах GitHub. Секреты в код и в чат не кладём (`docs/KEYS.md`).
- **Приватность** («Кто что видит» в `docs/PRODUCT.md`) проверяется в двух местах: RLS в базе и `src/people/visibility.ts`. Меняешь одно — проверь второе.
- **Тексты интерфейса** — дословно из макета, на «ты». Иконки — линейные, без эмодзи.

## Полезные команды

```bash
npm run typecheck && npm run lint && npm test   # то же, что CI
npm run web                                      # web-версия
npm run shots -- <папка> /route=Имя              # скриншоты 390×844 в docs/progress/<папка>/
npm run db:migrate                               # миграции в Supabase (нужен токен, docs/KEYS.md)
npm run worker:demo                              # сборщик событий на примерах
npm run perf                                     # скорость карты и ленты (после build:web)
```

Метки задач описаны в `.github/labels.yml` и появляются в GitHub после мержа в `main`.
