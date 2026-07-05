# Architecture

## Overview

Ooru Trees is a static site — no server, no build step. All processing happens offline (Python scripts), and the output is a folder of pre-computed JS files served directly to the browser.

---

## Data Pipeline (run once, offline)

```
BBMP KML (~426 MB)
      │
      ▼
 convert.py
      │  Streams the KML with iterparse, groups coordinates by species.
      │  Outputs a single monolithic JS file.
      ▼
 trees_data.js (~80 MB)
      │  window.TREE_DATA = { s: [species...], c: [counts...], g: [[lat,lng,...], ...] }
      │
      ▼
 split_data.py
      │
      ├─► data/index.js (~15 KB)
      │       window.TREE_INDEX = { s: [species names], c: [counts] }
      │       Loaded on every page visit; drives the species list UI.
      │
      ├─► data/s_0.js … data/s_235.js  (one per species, ~1–50 KB each)
      │       window.SD[i] = { n: "Species Name", d: "<base64>" }
      │       Coordinates packed as Float32Array (lats block + lngs block),
      │       then base64-encoded. Much smaller than JSON decimals.
      │       Lazy-loaded only when the user selects that species.
      │
      └─► data/boundary.js (~30 KB)
              window.BLORE_BOUNDARY = GeoJSON Polygon
              Fetched from Nominatim (OSM) once; cached as a static file.
```

`trees_data.js` is a transient intermediate — not committed or served.

---

## Browser App (static, no bundler)

```
index.html
├── <script src="data/index.js">       ← species names + counts, always loaded
├── <script src="data/boundary.js">    ← BBMP boundary polygon
├── <script src="maplibre-gl.js">      ← CDN, WebGL map renderer
└── <script type="module" src="web/app.js">
```

### Module structure

```
web/
├── app.js               Entry point. Owns the MapLibre map instance,
│                        wires stores → layers, handles lazy script injection.
│
├── stores/
│   └── TreeStore.js     Tiny reactive store. Holds selected species set.
│                        Components call TreeStore.toggleSpecies(id);
│                        app.js subscribes to re-render layers on change.
│
├── layers/
│   └── trees.js         MapLibre layer helpers.
│                        decodeSpecies() — base64 → Float32Array → lat/lng arrays
│                        toGeoJSON()     — lat/lng arrays → GeoJSON FeatureCollection
│                        addTreeLayer()  / removeTreeLayer()
│                        flowerColor()   — deterministic color per species name
│
├── components/
│   └── FilterPanel.js   Builds the species list DOM from TREE_INDEX.
│                        Handles search, common/scientific name toggle,
│                        calls TreeStore on click.
│
└── data/
    └── common_names.js  Lookup map: scientific name → common name.
```

### Lazy loading flow

1. Page load: `data/index.js` and `data/boundary.js` are loaded synchronously (small).
2. `FilterPanel` renders all species immediately from `window.TREE_INDEX`.
3. User selects a species → `TreeStore` updates → `app.js` `syncLayers()` fires.
4. `app.js` injects `<script src="data/s_N.js">` dynamically; on load, decodes the base64 coords and adds a MapLibre circle layer.
5. Deselecting removes the layer; the decoded data stays cached in `TreeStore` for instant re-selection.

---

## Deployment

Static files only. `data/` + `web/` + `index.html` → Netlify (or any static host).
The raw KML and intermediate `trees_data.js` are not deployed.
