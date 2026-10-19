# Рельеф Алматы — terrain-RGB

Тайлы 256 px, z8–11, область 76.55–77.40 в. д., 42.90–43.50 с. ш. Высота: `-10000 + (R·65536 + G·256 + B) · 0,1` м.
Источник: Copernicus DEM GLO-30 (accessed 2026-10-20 from https://registry.opendata.aws/copernicus-dem), © DLR e.V. 2010–2014 and © Airbus Defence and Space GmbH 2014–2018, provided under COPERNICUS by the European Union and ESA.
Пересобрать: `python scripts/dem-tiles.py <папка с GLO-30 .tif> data/terrain` (нужны rasterio, numpy, pillow, mercantile).
Карта берёт тайлы через jsDelivr (`src/map/style.ts`, `TERRAIN_TILES`).
