#!/usr/bin/env python3
"""
Split trees_data.js into per-species lazy-loaded files + fetch BBMP boundary.
Run once after convert.py. Much faster page load: only downloads selected species.
"""

import json, os, struct, base64, urllib.request

os.makedirs('data', exist_ok=True)

# ── 1. Read existing trees_data.js ───────────────────────────────────────
print("Reading trees_data.js…")
with open('trees_data.js') as f:
    content = f.read()
data   = json.loads(content[len('window.TREE_DATA='):-1])
species = data['s']
counts  = data['c']
groups  = data['g']   # groups[i] = [lat0,lng0,lat1,lng1,…]
print(f"  {len(species)} species, {sum(counts):,} trees")

# ── 2. Tiny index file (species names + counts, ~15 KB) ──────────────────
print("Writing data/index.js…")
with open('data/index.js', 'w') as f:
    f.write('window.TREE_INDEX=' +
            json.dumps({'s': species, 'c': counts}, separators=(',', ':')) +
            ';')

# ── 3. Per-species files as base64 Float32Array ───────────────────────────
# Format: [lat0,lat1,…,lng0,lng1,…] packed as float32 → base64
# Much smaller and faster to parse than JSON decimal strings.
print(f"Writing {len(species)} species data files…")

try:
    import numpy as np
    def pack_coords(flat):
        arr  = np.array(flat, dtype=np.float32)
        lats = arr[0::2]; lngs = arr[1::2]
        return base64.b64encode(lats.tobytes() + lngs.tobytes()).decode()
    print("  (using numpy – fast path)")
except ImportError:
    def pack_coords(flat):
        n    = len(flat) // 2
        lats = flat[0::2]; lngs = flat[1::2]
        buf  = struct.pack(f'{n}f', *lats) + struct.pack(f'{n}f', *lngs)
        return base64.b64encode(buf).decode()
    print("  (numpy not found – using struct)")

for i, (flat, name) in enumerate(zip(groups, species)):
    b64 = pack_coords(flat)
    with open(f'data/s_{i}.js', 'w') as f:
        f.write(f'window.SD[{i}]={{"n":{json.dumps(name)},"d":"{b64}"}};')
    if (i + 1) % 60 == 0:
        print(f"  {i + 1}/{len(species)}")
print(f"  All {len(species)} files written.")

# ── 4. Fetch BBMP boundary from Nominatim ────────────────────────────────
FALLBACK = {
    "type": "Polygon",
    "coordinates": [[
        [77.389,12.970],[77.392,12.920],[77.400,12.870],[77.420,12.845],
        [77.445,12.835],[77.480,12.828],[77.520,12.825],[77.560,12.828],
        [77.600,12.832],[77.640,12.838],[77.680,12.850],[77.720,12.867],
        [77.748,12.887],[77.770,12.920],[77.778,12.970],[77.774,13.020],
        [77.762,13.065],[77.740,13.095],[77.706,13.120],[77.670,13.130],
        [77.630,13.135],[77.590,13.138],[77.550,13.132],[77.515,13.122],
        [77.485,13.108],[77.458,13.090],[77.435,13.068],[77.415,13.042],
        [77.400,13.012],[77.389,12.970]
    ]]
}

def simplify_ring(coords, max_pts=500):
    if len(coords) <= max_pts:
        return coords
    step = len(coords) / max_pts
    result = [coords[int(i * step)] for i in range(max_pts)]
    if result[-1] != coords[-1]:
        result.append(coords[-1])
    return result

if os.path.exists('data/boundary.js'):
    print("\ndata/boundary.js already exists — skipping boundary fetch.")
    print("Delete it manually and re-run to refresh the boundary.")
    print("\nDone! Open index.html in your browser.")
    exit(0)

print("\nFetching BBMP boundary from Nominatim…")
boundary = FALLBACK
try:
    url = ('https://nominatim.openstreetmap.org/search'
           '?q=Bruhat+Bengaluru+Mahanagara+Palike'
           '&format=json&polygon_geojson=1&limit=3')
    req = urllib.request.Request(url, headers={
        'User-Agent': 'ooru-trees/1.0 (educational)'
    })
    results = json.loads(urllib.request.urlopen(req, timeout=20).read())

    for r in results:
        gj = r.get('geojson')
        if not gj:
            continue
        if gj['type'] == 'Polygon':
            gj['coordinates'][0] = simplify_ring(gj['coordinates'][0])
            boundary = gj
            print(f"  Polygon with {len(boundary['coordinates'][0])} pts")
            break
        elif gj['type'] == 'MultiPolygon':
            largest = max(gj['coordinates'], key=lambda p: len(p[0]))
            boundary = {'type': 'Polygon',
                        'coordinates': [simplify_ring(largest[0])]}
            print(f"  MultiPolygon → {len(boundary['coordinates'][0])} pts")
            break
except Exception as e:
    print(f"  Nominatim error ({e}) — using hardcoded fallback")

with open('data/boundary.js', 'w') as f:
    f.write('window.BLORE_BOUNDARY=' +
            json.dumps(boundary, separators=(',', ':')) +
            ';')
print("  Saved data/boundary.js")
print("\nDone! Open index.html in your browser.")
