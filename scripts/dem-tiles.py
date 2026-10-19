# Copernicus GLO-30 → terrain-RGB тайлы 256 px (Mapbox: h = -10000 + (R*65536 + G*256 + B) * 0.1)
import glob, os, sys, numpy as np, mercantile, rasterio
from rasterio.merge import merge
from PIL import Image
src_dir, out = sys.argv[1], sys.argv[2]
W, S, E, N = 76.55, 42.90, 77.40, 43.50
srcs = [rasterio.open(f) for f in sorted(glob.glob(f'{src_dir}/*.tif'))]
arr, tr = merge(srcs, bounds=(W - .02, S - .02, E + .02, N + .02))
dem = arr[0].astype(np.float32)
inv = ~tr
def sample(lon, lat):
    c, r = inv * (lon, lat)
    c = np.clip(c - .5, 0, dem.shape[1] - 2); r = np.clip(r - .5, 0, dem.shape[0] - 2)
    c0 = np.floor(c).astype(int); r0 = np.floor(r).astype(int); fc = c - c0; fr = r - r0
    a = dem[r0, c0]; b = dem[r0, c0 + 1]; cc = dem[r0 + 1, c0]; d = dem[r0 + 1, c0 + 1]
    return (a * (1 - fc) + b * fc) * (1 - fr) + (cc * (1 - fc) + d * fc) * fr
n = 0
for z in range(8, 12):
    for t in mercantile.tiles(W, S, E, N, [z]):
        b = mercantile.bounds(t)
        xs = (np.arange(256) + .5) / 256
        lon = b.west + (b.east - b.west) * xs
        # широта по меркатору: равномерно по y проекции
        y0, y1 = mercantile.xy(b.west, b.north)[1], mercantile.xy(b.west, b.south)[1]
        yy = y0 + (y1 - y0) * xs
        lat = np.degrees(2 * np.arctan(np.exp(yy / 6378137.0)) - np.pi / 2)
        LON, LAT = np.meshgrid(lon, lat)
        h = sample(LON, LAT)
        v = np.round((np.maximum(h, -100) + 10000) * 10).astype(np.int64)
        rgb = np.stack([(v >> 16) & 255, (v >> 8) & 255, v & 255], -1).astype(np.uint8)
        os.makedirs(f'{out}/{z}/{t.x}', exist_ok=True)
        Image.fromarray(rgb, 'RGB').save(f'{out}/{z}/{t.x}/{t.y}.png', optimize=True)
        n += 1
print('tiles', n, 'min/max', float(dem.min()), float(dem.max()))
