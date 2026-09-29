# рядом.

Куда пойти сегодня — и с кем. Карта событий и афиша Алматы:

- свайпы «Для тебя»;
- друзья на карте;
- «ищу компанию»;
- чаты с фото, видео, кружками и голосовыми;
- профиль с картой открытого города.

**Статус:** приложение собирается по этапам из [`docs/ROADMAP.md`](docs/ROADMAP.md). Скриншоты готовых экранов — в [`docs/progress/`](docs/progress).

## Где что лежит

| Путь | Что там |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Правила для Claude Code: как работать над проектом |
| [`docs/PRODUCT.md`](docs/PRODUCT.md) | Как работает продукт: вкладки, жесты, правила, приватность |
| [`docs/SCREENS.md`](docs/SCREENS.md) | Все экраны макета и куда они ведут |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Цвета, шрифты, компоненты, анимации |
| [`docs/RECOMMENDATIONS.md`](docs/RECOMMENDATIONS.md) | Как «Для тебя» подбирает карточки (видит только команда) |
| [`docs/PIPELINE.md`](docs/PIPELINE.md) | Как события попадают на карту, админка |
| [`docs/TECH.md`](docs/TECH.md) | Стек, сервисы и API, модель данных |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Этапы сборки с галочками |
| [`design/png/`](design/png) | Картинки всех экранов макета |
| [`design/screens/`](design/screens) | Исходники макета (HTML) |
| [`design/assets/`](design/assets) | Фото для демо-данных |
| [`data/seed/events-almaty.json`](data/seed/events-almaty.json) | 33 настоящих события Алматы на октябрь 2026 |
| [`config/public-keys.json`](config/public-keys.json) | Публичные ключи: Mapbox, Supabase |
| [`docs/KEYS.md`](docs/KEYS.md) | Какие ключи есть и что настроить владельцу |

## Запуск

Нужен Node.js 22.

```bash
npm install
npm run web          # web-версия в браузере
npm start            # Expo: телефон (для карты и пушей нужен dev build: docs/STORE.md)
```

| Команда | Что делает |
|---|---|
| `npm run typecheck` · `npm run lint` · `npm test` | Проверки (их же запускает GitHub Actions на каждый push) |
| `npm run build:web` | Собрать web-версию в `dist/` |
| `npm run shots -- <этап>` | Скриншоты экранов 390×844 в `docs/progress/<этап>/` |
| `npm run db:migrate` | Применить `supabase/migrations/` через Management API |
| `npm run seed:events` | Проставить координаты событиям (Nominatim) и загрузить их в Supabase |
| `npm run db:seed-demo [-- +7…]` | Демо-люди и чаты макета в базе (с номером — подключить свой аккаунт) |
| `npm run functions:build` · `functions:deploy` | Собрать общий код и выложить Edge Functions (погода, колода, пуши) |
| `npm run worker:demo` | Сборщик событий на примерах постов `worker/fixtures`, без записи в базу |
| `npm run perf` | Замер карты и ленты на «слабом Android» (процессор ×6), после `build:web` |

Админка команды — `/admin` в web-версии. Выпуск в магазины — `docs/STORE.md`. Как работать вдвоём — `CONTRIBUTING.md`.

Приложение работает и без сети: если Supabase недоступен, данные берутся из демо-набора и `data/seed/events-almaty.json`.
Координаты событий: © участники OpenStreetMap (ODbL), геокодер Nominatim.
