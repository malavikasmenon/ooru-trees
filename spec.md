# Ooru Trees — Technical Design Specification

> This document describes the system **as built**. For a narrative walkthrough
> of the data flow and module layout, see [ARCHITECTURE.md](ARCHITECTURE.md).
> An earlier, more ambitious version of this spec (vector tiles, ward/health
> filtering, popups, statistics) has been superseded — those ideas now live in
> §17 Future Extensions.

## 1. Objective

An interactive visualization of the BBMP Tree Census that lets users:

- View recorded trees across Bengaluru on a map.
- Filter the map by species (single or multiple).
- Search species by common or scientific name.
- Toggle species labels between common and scientific names.

The application is **read-only** with infrequent data updates, making it
well suited to a fully static architecture — no backend, no build step.

## 2. Design Goals

### Functional

- Interactive map of Bengaluru.
- Bengaluru highlighted while the area outside is dimmed.
- Smooth pan/zoom.
- Fast species filtering.
- Species colored by a genus → color map (flower/fruit-inspired).

### Non-functional

- No backend API required; static files only.
- GPU-accelerated rendering.
- CDN cacheable.
- Fast first paint: the species panel is usable before any tree data loads.
- Only the selected species' coordinates are downloaded (lazy loading).
- Easily regenerated from a new KML.

## 3. High-Level Architecture

``` text
                       Static host (Netlify)

        ┌────────────────────────────────────────┐
        │ index.html                             │
        │ data/index.js      (species + counts)  │
        │ data/boundary.js   (BBMP polygon)      │
        │ data/s_0.js … s_N.js  (per-species)    │
        │ web/*.js  (ES modules)                 │
        └────────────────────────────────────────┘
                          │
                          ▼
                  Browser Application
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
     TreeStore        MapLibre GL       FilterPanel
        │                 │                 │
        └─────────────────┼─────────────────┘
                          ▼
                    GPU Rendering
```

## 4. Data Pipeline

``` text
BBMP KML  (~426 MB, gitignored, never served)
 ↓  convert.py — stream-parse, group coords by species
trees_data.js  (single intermediate JSON blob)
 ↓  split_data.py
 ├─ data/index.js            species names + counts (~8 KB)
 ├─ data/s_0.js … s_N.js     per-species coords, base64 Float32Array
 └─ data/boundary.js         BBMP boundary polygon
```

- `convert.py` uses `ElementTree.iterparse` to stream the large KML,
  rounding coordinates to 5 decimal places (~1 m).
- `split_data.py` packs each species' coordinates as a `Float32Array`
  (`[lat0..latN, lng0..lngN]`) and base64-encodes it — far smaller and
  faster to parse than JSON decimals.
- The boundary is fetched separately (see §5).

The KML is treated as source data and is never served directly.

## 5. Data Sources

### Tree Dataset

`data/index.js` exposes:

``` javascript
window.TREE_INDEX = {
  s: ["Mangifera Indica L.", ...],   // species (scientific) names
  c: [12345, ...]                    // per-species counts
}
```

Each `data/s_<i>.js` lazily populates one slot:

``` javascript
window.SD[i] = { n: "Mangifera Indica L.", d: "<base64 Float32Array>" }
```

Decoded into parallel `lats` / `lngs` `Float32Array`s at load time.

### Common Names

`web/data/common_names.js` maps scientific → common name for the label
toggle and search. Names without a mapping fall back to the scientific name.

### Bengaluru Boundary

`data/boundary.js` is a single GeoJSON Polygon (OSM relation 7902476, the
BBMP administrative boundary), fetched by `scripts/fetch_boundary.py`.
Used for the city outline and the "outside" dimming mask.

## 6. Browser Architecture

``` text
web/
├── app.js                 entry point; owns the map + lazy loader
├── stores/TreeStore.js    reactive state (selected species, data cache)
├── layers/trees.js        color map, base64 decode, GeoJSON, layer add/remove
├── components/FilterPanel  species list, search, name toggle
└── data/common_names.js   scientific → common name lookup
```

## 7. TreeStore

The TreeStore is the single source of truth for selection and cached data.
It is a plain object with a `Set` of subscribers.

``` javascript
TreeStore = {
  filters: { species: new Set() },   // selected species ids
  dataCache: {},                     // sid → decoded { lats, lngs, n }
  pendingLoads: {},                  // sid → in-flight Promise
}
```

Responsibilities:

- Current species selection.
- Decoded per-species data cache (so re-selecting is instant).
- De-duplicating concurrent loads via `pendingLoads`.
- Notifying subscribers (`app.js` syncs map layers; `FilterPanel` re-renders).

## 8. Map Module

Rendering engine: **MapLibre GL JS**. Basemap: **OpenFreeMap** (positron
style), which serves OpenStreetMap-based vector tiles.

Responsibilities:

- Basemap with dimmed labels.
- Per-species tree circle layers.
- Boundary outline.
- Outside mask.

## 9. Layer Order (bottom → top)

``` text
OpenFreeMap basemap
↓
Outside mask (inverse polygon, dims everything beyond BBMP)
↓
Boundary outline (dashed)
↓
Tree layers (one circle layer per selected species)
```

## 10. Rendering

Each selected species is added as its own `circle` layer with a
zoom-interpolated radius and a genus-derived color:

``` javascript
map.addLayer({
  id: `layer-trees-${sid}`,
  type: "circle",
  source: `trees-${sid}`,
  paint: {
    "circle-radius": ["interpolate", ["linear"], ["zoom"],
                      10, 2, 13, 3, 15, 5, 17, 8],
    "circle-color": color,
    "circle-opacity": 0.85,
  }
});
```

The outside mask is an inverse polygon: a full-world outer ring with the
BBMP boundary as an interior hole, filled with a translucent color.

## 11. Data Notes

The raw census dataset includes an "Others" category for trees whose species
could not be identified. These are excluded from the species list (users
cannot filter by them) but are included in the total tree count shown in the
header badge.

## 12. Filtering

Filtering is additive by species selection. Selecting a species loads its
data file (if not cached) and adds a layer; deselecting removes the layer.
There is no server round-trip — all filtering is client-side layer add/remove.

## 13. Navigation

- `minZoom` / `maxZoom` constrain how far the user can zoom.
- The area outside BBMP remains visible but is dimmed by the outside mask.

## 14. Performance Strategy

- GPU rendering with MapLibre.
- Per-species lazy loading — only selected species are downloaded.
- Coordinates packed as base64 `Float32Array` (compact, fast to parse).
- Static files are CDN- and browser-cacheable.

## 15. Search

The species panel search matches the query against both the scientific name
and the common name, filtering the list in place. (There is currently no
"fly to individual tree" behavior — search operates on the species list.)

## 16. Color Model

Species are colored by genus via a lookup in `layers/trees.js`, with shades
chosen to evoke the tree's real-world appearance — flower color where
distinctive (e.g. Jacaranda purple, Gulmohar red), otherwise fruit color
(e.g. Jamun purple) or cream for white-flowered species. Unmapped genera fall
back to a default green.

## 17. Future Extensions

Not yet implemented — candidate directions:

- Additional attributes (ward, health, height, girth) and filters for them.
- Individual-tree selection with popups and search→fly-to.
- Statistics module (species/ward counts, averages, distributions).
- Migration to vector tiles (MVT) if the per-species approach hits limits.
- Extra layers: parks, lakes, heritage trees, metro, air quality, heatmaps,
  clustering.

## 18. Project Structure

``` text
ooru-trees/
├── convert.py              KML → trees_data.js
├── split_data.py           trees_data.js → data/*
├── scripts/
│   └── fetch_boundary.py   OSM relation → data/boundary.js
├── data/                   generated: index.js, boundary.js, s_*.js
├── web/
│   ├── app.js
│   ├── stores/
│   ├── components/
│   ├── layers/
│   └── data/
├── index.html
├── ARCHITECTURE.md
├── README.md
└── spec.md
```

## 19. Summary

- **Rendering:** MapLibre GL JS
- **Basemap:** OpenFreeMap (OpenStreetMap data)
- **Tree data:** per-species base64 `Float32Array`, lazy-loaded
- **Boundary:** GeoJSON inverse mask
- **State:** TreeStore
- **Hosting:** static (Netlify)

Serverless, cacheable, and regenerable from a new KML.
