# Bengaluru Tree Explorer -- Technical Design Specification

## 1. Objective

Build an interactive visualization platform for the Bengaluru Tree
Census that allows users to:

-   View all recorded trees in Bengaluru.
-   Filter trees by species, ward, health, height, etc.
-   Search for individual trees.
-   Visualize tree distribution on an OpenStreetMap basemap.
-   Support future visualizations such as charts, ward summaries, and
    environmental datasets.

The application is **read-only**, with infrequent data updates, making
it suitable for a static architecture.

## 2. Design Goals

### Functional

-   Interactive map of Bengaluru.
-   Bengaluru highlighted while the outside is dimmed.
-   Smooth pan/zoom.
-   Fast filtering.
-   Tree selection and popups.
-   Extensible architecture.

### Non-functional

-   No backend API required.
-   GPU-accelerated rendering.
-   CDN cacheable.
-   Responsive with 100k--1M trees.
-   Easily regenerated from a new KMZ.

## 3. High-Level Architecture

``` text
                           Static CDN
          (Cloudflare R2 / S3 / GitHub Pages)

        ┌────────────────────────────────────────┐
        │ boundary.geojson                       │
        │ metadata.json                          │
        │ vector tiles (.pbf)                    │
        └────────────────────────────────────────┘
                          │
                          ▼
                  Browser Application
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
     TreeStore        MapLibre GL       UI Components
        │                 │                 │
        └─────────────────┼─────────────────┘
                          ▼
                    GPU Rendering
```

## 4. Data Pipeline

``` text
KMZ
 ↓
Extract KML
 ↓
Convert → GeoJSON
 ↓
Normalize Attributes
 ↓
Generate Vector Tiles
 ↓
Upload to CDN
```

The KMZ is treated as source data and is never served directly.

## 5. Data Sources

### Tree Dataset

Each feature contains:

``` json
{
  "id": 12345,
  "species": "Neem",
  "common_name": "Neem",
  "ward": "Mahadevapura",
  "height": 8.4,
  "girth": 56,
  "health": "Good",
  "geometry": "Point"
}
```

### Bengaluru Boundary

Separate GeoJSON used for: - City outline - Viewport restriction -
Outside mask

### Metadata

Contains filter values such as species, wards, and summary statistics.

## 6. Browser Architecture

``` text
Application
├── TreeStore
├── Map
├── Filters
└── Statistics
```

## 7. TreeStore

The TreeStore is the single source of truth.

Responsibilities: - Current filters - Current viewport - Selected tree -
Loaded/cached tiles - Statistics

Example:

``` javascript
TreeStore = {
  filters: {
    species: null,
    ward: null,
    health: null
  },
  selectedTree: null,
  loadedTiles: new Set(),
  statistics: {}
}
```

## 8. Map Module

Rendering engine: **MapLibre GL JS**

Responsibilities: - OpenStreetMap basemap - Tree rendering - Boundary
rendering - Outside mask - Popups

## 9. Layer Order

``` text
Selected Tree
↓
Tree Layer
↓
Boundary Outline
↓
Outside Mask
↓
OpenStreetMap
```

## 10. Rendering

Tree layer:

``` javascript
map.addLayer({
  id: "trees",
  type: "circle",
  source: "trees",
  "source-layer": "trees",
  paint: {
    "circle-radius": 3,
    "circle-color": "#2E8B57"
  }
});
```

Outside mask is implemented as an inverse polygon.

## 11. Data Notes

The raw census dataset includes an "Others" category for trees where the
species could not be identified. These are excluded from the species list
(so users cannot filter by them) but are included in the total tree count
shown in the header badge.

## 12. Filtering

``` javascript
map.setFilter("trees", [
  "==",
  ["get", "species"],
  "Neem"
]);
```

Multiple filters can be combined using `all`.

## 12. User Interaction Flow

``` text
User selects filter
        ↓
TreeStore updates
        ↓
Map filter updates
        ↓
Statistics update
        ↓
Sidebar refresh
        ↓
Map redraw
```

## 13. Navigation

-   Restrict panning to Bengaluru.
-   Outside region remains visible but dimmed.

## 14. Performance Strategy

-   GPU rendering with MapLibre.
-   Vector tiles instead of a single GeoJSON.
-   CDN caching.
-   Browser caches downloaded tiles.

## 15. Statistics Module

Consumes TreeStore and provides: - Species counts - Ward counts -
Average height - Health distribution

## 16. Search Module

``` text
Search
 ↓
TreeStore
 ↓
Highlight Tree
 ↓
Fly To
 ↓
Popup
```

## 17. Future Extensions

-   Parks
-   Lakes
-   Heritage Trees
-   Metro
-   Air quality
-   Rainfall
-   Heatmaps
-   Clustering

Each dataset becomes a new vector tile source and map layer.

## 18. Project Structure

``` text
project/
├── data/
│   ├── raw/
│   ├── processed/
│   └── tiles/
├── scripts/
├── web/
│   ├── stores/
│   ├── components/
│   └── layers/
└── README.md
```

## 19. Final Recommendation

-   **Rendering:** MapLibre GL JS
-   **Basemap:** OpenStreetMap
-   **Data:** Mapbox Vector Tiles (MVT)
-   **Boundary:** GeoJSON inverse mask
-   **State:** TreeStore
-   **Hosting:** Static CDN

This architecture is scalable, serverless, and well suited to a public
Bengaluru Tree Explorer.
