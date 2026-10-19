# Данные для карты — что проверили (20 октября)

Ссылки от Данила, коротко: что это, можно ли брать и как подписывать. Карта уже показывает дома
(контуры в 2D, объёмом в 3D) из слоя `building` в Mapbox Streets v8 — внутри это данные OpenStreetMap,
поэтому внизу карты теперь видна подпись «© Mapbox © OpenStreetMap».

| Источник | Что даёт | Лицензия и подпись | Как используем |
|---|---|---|---|
| [data.egov.kz — s_buildings](https://data.egov.kz/datasets/view?index=s_buildings) | Адресный регистр («Мекенжай тіркелімі»): объекты, адреса, права, участки. Владелец — АО «НИТ». Статус «в архиве», обновлён 19.10.2026 | На странице лицензия не указана. API — только с ключом из «Кабинета разработчика», без ключа ответ 403 | Сверка адресов мест и событий. Координат и этажности на странице не видно, поэтому для 3D он не подходит. Нужен ключ → `KEYS.md` |
| [Copernicus DEM](https://registry.opendata.aws/copernicus-dem/) | Рельеф: GLO-30 (30 м, покрытие неполное), GLO-90 (90 м, весь мир). Файлы COG в S3 `copernicus-dem-30m` / `-90m`, eu-central-1 | Лицензия Copernicus, бесплатно. Подпись: «Copernicus DEM, accessed <дата> from registry.opendata.aws/copernicus-dem» | Горы на юге Алматы: отмывка и рельеф вместо нынешних горизонталей. Это делается один раз, в воркере |
| [Overture Places](https://docs.overturemaps.org/guides/places/) | Места: ТРЦ, кафе, кино, парки, с категориями | У каждого источника своя: CDLA-Permissive 2.0 (Meta, Microsoft…), Apache 2.0 (Foursquare), CC0 (AllThePlaces). [Подписи](https://docs.overturemaps.org/attribution/) | Наполнить таблицу `venues` местами Алматы (сейчас там только ТРЦ). Карточка места уже готова |
| Overture Buildings | Контуры домов с высотами | ODbL: «© OpenStreetMap contributors, Overture Maps Foundation» | Если Mapbox будет мало — точнее высоты для 3D |
| [OpenMapTiles](https://openmaptiles.org/) | Свои векторные тайлы из OSM (дороги, дома, подписи) | «© OpenMapTiles © OpenStreetMap contributors» | Замена тайлов Mapbox своим сервером, когда упрёмся в его лимиты. Наш стиль `src/map/style.ts` переносится почти без правок |
| [OSM copyright](https://www.openstreetmap.org/copyright) | Правила подписи | Подпись «© OpenStreetMap contributors» должна быть видна на карте | Сделано: плашка внизу карты |

## Что дальше (по порядку, если Данил согласен)

1. **Места из Overture** → `venues`: скрипт в воркере, только Алматы, только нужные категории.
2. **Рельеф Copernicus** → тайлы отмывки для гор (готовые файлы в Storage, карта их только показывает).
3. **Свои тайлы OpenMapTiles** — только если Mapbox станет дорогим: это отдельный сервер.
