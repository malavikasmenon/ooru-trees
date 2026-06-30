import { TreeStore }                                        from './stores/TreeStore.js';
import { decodeSpecies, toGeoJSON, flowerColor,
         addTreeLayer, removeTreeLayer }                    from './layers/trees.js';
import { buildFilterPanel }                                 from './components/FilterPanel.js';

// ── Globals set by data/index.js and data/boundary.js ────────────────────
const TREE_INDEX     = window.TREE_INDEX;
const BLORE_BOUNDARY = window.BLORE_BOUNDARY;

// Slot array for lazy-loaded species base64 strings (set by data/s_N.js)
window.SD = new Array(TREE_INDEX.s.length).fill(null);

const spColors = TREE_INDEX.s.map(flowerColor);

// ── Species data loader ───────────────────────────────────────────────────
function loadSpeciesData(sid) {
  const cached = TreeStore.getData(sid);
  if (cached) return Promise.resolve(cached);
  if (TreeStore.pendingLoads[sid]) return TreeStore.pendingLoads[sid];

  TreeStore.pendingLoads[sid] = new Promise(resolve => {
    if (window.SD[sid] !== null) {
      const data = decodeSpecies(window.SD[sid], TREE_INDEX.s[sid]);
      TreeStore.setData(sid, data);
      delete TreeStore.pendingLoads[sid];
      resolve(data);
      return;
    }
    const script   = document.createElement('script');
    script.src     = `data/s_${sid}.js?v=2`;
    script.onload  = () => {
      const data = decodeSpecies(window.SD[sid], TREE_INDEX.s[sid]);
      TreeStore.setData(sid, data);
      delete TreeStore.pendingLoads[sid];
      resolve(data);
    };
    script.onerror = () => {
      delete TreeStore.pendingLoads[sid];
      resolve(null);
    };
    document.head.appendChild(script);
  });

  return TreeStore.pendingLoads[sid];
}

// ── Boundary helpers ──────────────────────────────────────────────────────
function signedArea(ring) {
  let a = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % n];
    a += (x2 - x1) * (y2 + y1);
  }
  return a;
}

function asHoleRing(ring) {
  // Interior rings (holes) must be CW per RFC 7946; positive signed area = CCW
  return signedArea(ring) > 0 ? [...ring].reverse() : ring;
}

function addBoundaryLayers(map) {
  if (!BLORE_BOUNDARY) return;

  const outerRing = [[-180,-90],[180,-90],[180,90],[-180,90],[-180,-90]];
  const bloreRing = asHoleRing(BLORE_BOUNDARY.coordinates[0]);

  map.addSource('outside-mask', {
    type: 'geojson',
    data: {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [outerRing, bloreRing] },
      properties: null,
    },
  });

  map.addLayer({
    id:     'outside-mask',
    type:   'fill',
    source: 'outside-mask',
    paint:  { 'fill-color': '#f5f0ea', 'fill-opacity': 0.75 },
  });

  map.addSource('boundary-outline', {
    type: 'geojson',
    data: BLORE_BOUNDARY,
  });

  map.addLayer({
    id:     'boundary-outline',
    type:   'line',
    source: 'boundary-outline',
    paint:  { 'line-color': '#aaa', 'line-width': 1.5, 'line-dasharray': [3, 3] },
  });
}

// ── MapLibre GL JS map ────────────────────────────────────────────────────
const map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    glyphs:  'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      'carto-light': {
        type:        'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
          'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
          'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
          'https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        ],
        tileSize:    256,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/">CARTO</a>',
        maxzoom:     19,
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#f5f0ea' } },
      { id: 'carto-light', type: 'raster', source: 'carto-light' },
    ],
  },
  center:           [77.5946, 12.9716],
  zoom:             11,
  minZoom:          9,
  maxZoom:          18,
  attributionControl: false,
});

map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

// ── Species panel: populate immediately, independent of map load ──────────
buildFilterPanel(TREE_INDEX);

// ── Layer sync: only runs after MapLibre is ready ─────────────────────────
let prevSelected = new Set();

async function syncLayers(store) {
  const next = store.filters.species;
  const loadingDot = document.getElementById('loading-dot');

  for (const sid of prevSelected) {
    if (!next.has(sid)) removeTreeLayer(map, sid);
  }

  const toLoad = [...next].filter(sid => !prevSelected.has(sid));

  if (toLoad.length) {
    loadingDot.classList.add('active');
    document.getElementById('foot-text').textContent = 'Loading…';
    document.getElementById('foot-count').textContent = '';
  }

  await Promise.all(toLoad.map(async sid => {
    const data = await loadSpeciesData(sid);
    if (!data) return;
    if (!store.filters.species.has(sid)) return;
    const geojson = toGeoJSON(data.lats, data.lngs, data.n);
    addTreeLayer(map, sid, geojson, spColors[sid]);
  }));

  loadingDot.classList.remove('active');
  prevSelected = new Set(next);
}

map.on('load', () => {
  addBoundaryLayers(map);
  // Sync any species the user selected before the map finished loading
  syncLayers(TreeStore);
  TreeStore.subscribe(syncLayers);
});
