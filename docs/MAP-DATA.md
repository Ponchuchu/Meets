# Данные для карты — что проверили (20 октября)

Ссылки от Данила, коротко: что это, можно ли брать и как подписывать. Карта всегда объёмная: дома из слоя `building`
в Mapbox Streets v8 (внутри — OpenStreetMap), горы — из Copernicus DEM. Подписи источников на время тестов скрыты,
включаются перед Google Play (`docs/STORE.md`).

## Что подключено (20 октября)

| Что | Где | Сколько |
|---|---|---|
| Места Overture (кафе, бары, кино, театры, музеи, парки, спорт, достопримечательности, ТРЦ) | таблица `places`; на карте с 15-го масштаба, в поиске адреса | 3 722 |
| Справочник адресов Алматы: OpenStreetMap (`addr:*`) + адреса мест Overture | таблица `addresses`; подсказки адреса, адрес под точкой, сборщик событий | 146 111 |
| Рельеф Copernicus GLO-30 → terrain-RGB z8–11 | `data/terrain` → Storage `terrain` (workflow «terrain», сам запускается после слияния в main) | 58 тайлов, 3 МБ |

Адрес из карточки события находит свою точку так: адрес приводим к одному виду (`norm_addr`: казахские буквы → русские,
«улица/көшесі/пр./даңғылы» убираем, окончания «Жандосова/Жандосов» сводим, скобки и этажи отбрасываем), ищем похожий
по триграммам с тем же номером дома (`match_address`). Тип улицы («проспект Абая» ≠ «улица Абая» в пригороде) и
близость к центру решают спорные случаи. Сборщик (`worker/src/venues.ts`) берёт эту точку первой, потом OpenStreetMap и Mapbox.

Обновить данные: `scripts/map-data/overture.py` (выгрузка мест из S3 Overture по рамке Алматы, нужен duckdb),
`scripts/map-data/load-places.py`, `scripts/map-data/load-addresses.py` (адреса OSM качаются через Overpass по квадратам),
`scripts/dem-tiles.py` (рельеф).

| Источник | Что даёт | Лицензия и подпись | Как используем |
|---|---|---|---|
| [data.egov.kz — s_buildings](https://data.egov.kz/datasets/view?index=s_buildings) | Адресный регистр («Мекенжай тіркелімі»): объекты, адреса, права, участки. Владелец — АО «НИТ». Статус «в архиве», обновлён 19.10.2026 | На странице лицензия не указана. API — только с ключом из «Кабинета разработчика», без ключа ответ 403 | Сверка адресов мест и событий. Координат и этажности на странице не видно, поэтому для 3D он не подходит. Нужен ключ → `KEYS.md` |
| [Copernicus DEM](https://registry.opendata.aws/copernicus-dem/) | Рельеф: GLO-30 (30 м, покрытие неполное), GLO-90 (90 м, весь мир). Файлы COG в S3 `copernicus-dem-30m` / `-90m`, eu-central-1 | Лицензия Copernicus, бесплатно. Подпись: «Copernicus DEM, accessed <дата> from registry.opendata.aws/copernicus-dem» | Горы на юге Алматы: отмывка и рельеф вместо нынешних горизонталей. Это делается один раз, в воркере |
| [Overture Places](https://docs.overturemaps.org/guides/places/) | Места: ТРЦ, кафе, кино, парки, с категориями | У каждого источника своя: CDLA-Permissive 2.0 (Meta, Microsoft…), Apache 2.0 (Foursquare), CC0 (AllThePlaces). [Подписи](https://docs.overturemaps.org/attribution/) | Наполнить таблицу `venues` местами Алматы (сейчас там только ТРЦ). Карточка места уже готова |
| Overture Buildings | Контуры домов с высотами | ODbL: «© OpenStreetMap contributors, Overture Maps Foundation» | Если Mapbox будет мало — точнее высоты для 3D |
| [OpenMapTiles](https://openmaptiles.org/) | Свои векторные тайлы из OSM (дороги, дома, подписи) | «© OpenMapTiles © OpenStreetMap contributors» | Замена тайлов Mapbox своим сервером, когда упрёмся в его лимиты. Наш стиль `src/map/style.ts` переносится почти без правок |
| [OSM copyright](https://www.openstreetmap.org/copyright) | Правила подписи | Подпись «© OpenStreetMap contributors» должна быть видна на карте | Сделано: плашка внизу карты |

## Что дальше

- **Свои тайлы OpenMapTiles** — только если Mapbox станет дорогим: это отдельный сервер.
- **egov (адресный регистр)** — сверка спорных адресов, когда будет ключ (`KEYS.md`).
- Пять квадратов юга города (43.10–43.14) Overpass не отдал (перегрузка) — догрузить тем же скриптом.
