# Адреса Алматы → public.addresses: OSM (addr:street + addr:housenumber) и адреса мест Overture. Повторный запуск безопасен.
import glob, json, os, re, subprocess, sys, duckdb
data = sys.argv[1]
rows = {}
def add(street, house, lat, lon, src):
    street = re.sub(r'\s+', ' ', (street or '').strip(' ,.'))
    house = re.sub(r'\s+', '', (house or '').strip(' ,.')).lower()
    if not street or not house or len(house) > 12 or not re.search(r'\d', house): return
    if not (43.0 < lat < 43.5 and 76.6 < lon < 77.3): return
    rows.setdefault((street.lower(), house), (street, house, lat, lon, src))
n = 0
for f in sorted(glob.glob(f'{data}/osm_*.json')):
    if f.endswith('osm_addr.json'): continue
    try: els = json.load(open(f))['elements']
    except Exception: continue
    for e in els:
        t = e.get('tags', {})
        lat = e.get('lat') or (e.get('center') or {}).get('lat'); lon = e.get('lon') or (e.get('center') or {}).get('lon')
        if lat is None: continue
        st = t.get('addr:street') or t.get('addr:place')
        for h in re.split(r'[;,]', t.get('addr:housenumber', '')):
            add(st, h, lat, lon, 'osm'); n += 1
print('osm raw', n, 'unique', len(rows))
c = duckdb.connect()
for (ff, wkt) in c.execute(f"select addresses[1].freeform, wkt from '{data}/places.parquet' where len(addresses)>0").fetchall():
    m = re.match(r'POINT \(([-\d.]+) ([-\d.]+)\)', wkt or ''); ff = (ff or '').strip(' ,')
    hm = re.search(r'(?:^|[\s,])(\d+[а-яa-z]?(?:/\d+[а-яa-z]?)?)\s*$', ff, re.I)
    if m and hm: add(ff[:hm.start(1)].strip(' ,'), hm[1], float(m[2]), float(m[1]), 'overture')
print('total unique', len(rows))
q = lambda s: "'" + s.replace("'", "''") + "'"
vals = list(rows.values())
for i in range(0, len(vals), 3000):
    v = ','.join(f"({q(s)},{q(h)},{q(s + ', ' + h)},extensions.st_makepoint({lon},{lat})::extensions.geography,{q(src)})" for s, h, lat, lon, src in vals[i:i + 3000])
    r = subprocess.run(['curl', '-sS', '-m', '180', '-X', 'POST', 'https://api.supabase.com/v1/projects/xkpchsommtilristiesu/database/query', '-H', 'Authorization: Bearer ' + os.environ.get('SUPABASE_ACCESS_TOKEN', ''), '-H', 'Content-Type: application/json', '--data-binary', '@-'],
                       input=json.dumps({'query': f'insert into public.addresses (street,house,label,geog,source) values {v}'}), capture_output=True, text=True)
    if not r.stdout.startswith('['): print('ERR', r.stdout[:300]); break
    print('ok', min(i + 3000, len(vals)), flush=True)
