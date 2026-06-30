#!/usr/bin/env python3
"""
Fetch the real BBMP administrative boundary from Overpass API and write to data/boundary.js.
Run this once to get the accurate boundary, or to refresh it.
"""

import json, urllib.request, urllib.parse, os

OUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'boundary.js')

# OSM relation 7902476 = Bengaluru city (admin_level 7) — the BBMP boundary
QUERY = '[out:json][timeout:60];relation(7902476);out geom;'

def fetch():
    print('Fetching BBMP boundary from Overpass API…')
    url = 'https://overpass-api.de/api/interpreter?' + urllib.parse.urlencode({'data': QUERY})
    req = urllib.request.Request(url, headers={'User-Agent': 'ooru-trees/1.0 (educational)', 'Accept': 'application/json'})
    return json.loads(urllib.request.urlopen(req, timeout=90).read())

def chain_ways(ways):
    """Chain a list of [(lon,lat)…] way segments into a single closed ring."""
    if not ways:
        return []
    result    = list(ways[0])
    remaining = list(ways[1:])
    while remaining:
        last = result[-1]
        matched = False
        for i, way in enumerate(remaining):
            if abs(way[0][0] - last[0]) < 1e-7 and abs(way[0][1] - last[1]) < 1e-7:
                result.extend(way[1:])
                remaining.pop(i)
                matched = True
                break
            elif abs(way[-1][0] - last[0]) < 1e-7 and abs(way[-1][1] - last[1]) < 1e-7:
                result.extend(reversed(way[:-1]))
                remaining.pop(i)
                matched = True
                break
        if not matched:
            remaining.pop(0)
    if result and (abs(result[0][0] - result[-1][0]) > 1e-7 or abs(result[0][1] - result[-1][1]) > 1e-7):
        result.append(result[0])
    return result

def build_polygon(relation):
    outer_ways = []
    for member in relation.get('members', []):
        if member['type'] == 'way' and member.get('role', 'outer') in ('outer', ''):
            geom = member.get('geometry', [])
            if geom:
                outer_ways.append([(p['lon'], p['lat']) for p in geom])
    return chain_ways(outer_ways)

result   = fetch()
elements = [e for e in result['elements'] if e['type'] == 'relation']
if not elements:
    raise RuntimeError('No relation found in Overpass response')

relation = elements[0]
ring     = build_polygon(relation)
print(f'  Got {len(ring)} points')

boundary = {'type': 'Polygon', 'coordinates': [ring]}
with open(OUT_PATH, 'w') as f:
    f.write('window.BLORE_BOUNDARY=' + json.dumps(boundary, separators=(',', ':')) + ';')
print(f'  Written to {OUT_PATH}')
