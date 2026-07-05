#!/usr/bin/env python3
"""Convert BBMP tree census KML to compact JS data for browser visualization."""

import xml.etree.ElementTree as ET
import json
import sys

# Run this script from the repo root: python convert.py
KML_PATH = 'data/bbmp_tree_census_july2025.kml'
OUT_PATH  = 'trees_data.js'

def parse_kml(filename):
    species_index  = {}
    species_list   = []
    species_counts = []
    # Grouped by species: groups[i] = flat [lat0,lng0,lat1,lng1,...] for species i
    groups = []

    current_name   = None
    current_coords = None
    processed      = 0

    context = ET.iterparse(filename, events=('end',))
    for _, elem in context:
        tag = elem.tag.split('}', 1)[-1] if '}' in elem.tag else elem.tag

        if tag == 'SimpleData' and elem.get('name') == 'TreeName':
            if elem.text:
                current_name = elem.text.strip()

        elif tag == 'coordinates' and elem.text:
            parts = elem.text.strip().split(',')
            if len(parts) >= 2:
                try:
                    lng = float(parts[0])
                    lat = float(parts[1])
                    current_coords = (round(lat, 5), round(lng, 5))
                except ValueError:
                    pass

        elif tag == 'Placemark':
            if current_name and current_coords:
                if current_name not in species_index:
                    species_index[current_name] = len(species_list)
                    species_list.append(current_name)
                    species_counts.append(0)
                    groups.append([])

                sid = species_index[current_name]
                species_counts[sid] += 1
                lat, lng = current_coords
                groups[sid].append(lat)
                groups[sid].append(lng)

                processed += 1
                if processed % 100_000 == 0:
                    print(f'  {processed:,} trees...', flush=True)

            current_name   = None
            current_coords = None
            elem.clear()

    return species_list, species_counts, groups


print('Parsing KML — this takes ~2 min...')
species, counts, groups = parse_kml(KML_PATH)
print(f'Done. {len(species)} species, {sum(counts):,} trees.')

print('Writing trees_data.js...')
payload = {'s': species, 'c': counts, 'g': groups}
js = 'window.TREE_DATA=' + json.dumps(payload, separators=(',', ':')) + ';'

with open(OUT_PATH, 'w') as f:
    f.write(js)

size_mb = len(js) / 1024 / 1024
print(f'Written {OUT_PATH}  ({size_mb:.1f} MB)')
