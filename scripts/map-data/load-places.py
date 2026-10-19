# Overture places (Алматы) → public.places. Только места, куда ходят отдыхать: еда, бары, культура, парки, спорт, достопримечательности.
import duckdb, json, os, sys, subprocess, re
src = sys.argv[1]
c = duckdb.connect()
rows = c.execute(f"""select id, names.primary, taxonomy.primary, taxonomy.hierarchy, addresses[1].freeform, confidence, wkt
  from '{src}' where names.primary is not null and coalesce(operating_status,'open')='open'""").fetchall()
KEEP = {
  'cinema': {'movie_theater', 'drive_in_theater'},
  'culture': {'theatre_venue', 'museum', 'art_gallery', 'cultural_center', 'performing_arts_venue', 'music_venue', 'auditorium', 'opera_and_ballet', 'concert_hall', 'planetarium', 'arts_and_entertainment', 'art_museum', 'history_museum', 'library'},
  'park': {'park', 'national_park', 'zoo', 'amusement_park', 'water_park', 'botanical_garden', 'garden', 'playground', 'dog_park', 'skate_park', 'beach'},
  'sport': {'gym', 'stadium_arena', 'swimming_pool', 'sport_or_fitness_facility', 'yoga_studio', 'dance_studio', 'bowling_alley', 'ice_skating_rink', 'skiing_area', 'ski_resort', 'climbing_gym', 'tennis_court', 'soccer_field', 'sports_and_recreation', 'martial_arts_club', 'golf_course', 'paintball', 'trampoline_park'},
  'sight': {'historic_site', 'monument', 'landmark_and_historical_building', 'memorial_site', 'observation_deck', 'tourist_attraction'},
  'fun': {'arcade', 'pool_billiards', 'escape_room', 'board_game_store', 'casino', 'go_kart_track', 'laser_tag', 'karaoke_venue', 'dance_club'},
  'mall': {'shopping_mall', 'shopping_center', 'department_store'},
}
def kind_of(prim, hier):
    hier = hier or []
    for k, s in KEEP.items():
        if prim in s: return k
    if hier and hier[0] == 'food_and_drink':
        if any(w in prim for w in ('cafe', 'coffee', 'tea', 'dessert', 'bakery', 'ice_cream', 'juice')): return 'cafe'
        if 'alcoholic_beverage_venue' in hier or any(w in prim for w in ('bar', 'pub', 'lounge', 'brewery', 'wine')): return 'bar'
        return 'food'
    return None
out = []
for pid, name, prim, hier, addr, conf, wkt in rows:
    k = kind_of(prim or '', hier)
    if not k or (conf or 0) < 0.5: continue
    m = re.match(r'POINT \(([-\d.]+) ([-\d.]+)\)', wkt or '')
    if not m: continue
    out.append((pid, name.strip()[:120], k, prim, (addr or '').strip(' ,')[:160] or None, float(conf), float(m[1]), float(m[2])))
print('places', len(out), {k: sum(1 for o in out if o[2] == k) for k in set(o[2] for o in out)})
q = lambda s: 'null' if s is None else "'" + s.replace("'", "''") + "'"
def run(sql):
    r = subprocess.run(['curl', '-sS', '-m', '120', '-X', 'POST', 'https://api.supabase.com/v1/projects/xkpchsommtilristiesu/database/query', '-H', 'Authorization: Bearer ' + os.environ.get('SUPABASE_ACCESS_TOKEN', ''),
                        '-H', 'Content-Type: application/json', '--data-binary', '@-'], input=json.dumps({'query': sql}), capture_output=True, text=True)
    if not r.stdout.startswith('['): raise SystemExit(r.stdout[:500] + r.stderr[:300])
for i in range(0, len(out), 1500):
    vals = ','.join(f"({q(a)},{q(b)},{q(k)},{q(p)},{q(ad)},{cf},extensions.st_makepoint({lon},{lat})::extensions.geography)" for a, b, k, p, ad, cf, lon, lat in out[i:i + 1500])
    run(f"""insert into public.places (id,name,kind,category,address,confidence,geog) values {vals}
      on conflict (id) do update set name=excluded.name, kind=excluded.kind, category=excluded.category, address=excluded.address,
      confidence=excluded.confidence, geog=excluded.geog, updated_at=now()""")
    print('ok', i + 1500, flush=True)
