export const GENUS_COLOR = {
  TABEBUIA:'#e91e8c', LAGERSTROEMIA:'#e91e8c', BAUHINIA:'#c2185b',
  PONGAMIA:'#9575cd', SAMANEA:'#f48fb1', PLUMERIA:'#ff4081',
  MUNTINGIA:'#e53935', AVERRHOA:'#ab47bc',
  DELONIX:'#e53935', SPATHODEA:'#f4511e', SARACA:'#fb8c00',
  GREVILLEA:'#ef6c00', CALLISTEMON:'#c62828',
  PELTOPHORUM:'#f9a825', MARKHAMIA:'#f9a825', ACACIA:'#fbc02d',
  CASSIA:'#fdd835', THESPESIA:'#f9a825', MICHELIA:'#ff8f00',
  PTEROCARPUS:'#ffa000', ADENANTHERA:'#e53935', ALBIZIA:'#bcaaa4',
  JACARANDA:'#7b1fa2', MAJIDEA:'#ef6c00',
  MILLINGTONIA:'#bcaaa4', WRIGHTIA:'#bcaaa4', MIMUSOPS:'#ef6c00',
  LEUCAENA:'#bcaaa4', ALSTONIA:'#bcaaa4', TERMINALIA:'#8d8741',
  SWIETENIA:'#bcaaa4', MANGIFERA:'#8d8741', TECTONA:'#8d8741',
  SYZYGIUM:'#6a1b9a', EUCALYPTUS:'#bcaaa4',
  COCOS:'#66bb6a', ROYSTONEA:'#66bb6a', PTYCHOSPERMA:'#66bb6a',
  CARYOTA:'#66bb6a', LIVISTONA:'#66bb6a', HYDRISTELE:'#66bb6a',
  FICUS:'#43a047', ARTOCARPUS:'#66bb6a', AZADIRACHTA:'#9ccc65',
  ANACARDIUM:'#81c784', SIMAROUBA:'#aed581', ARAUCARIA:'#66bb6a',
  ANNONA:'#81c784', AEGLE:'#aed581', AILANTHUS:'#81c784',
  ALEURITES:'#81c784', APHANAMIXIS:'#81c784', NEOLOMARCKIA:'#ef6c00',
};

export function flowerColor(name) {
  if (!name || name === 'Others') return '#9e9e9e';
  return GENUS_COLOR[name.toUpperCase().split(/\s+/)[0]] || '#66bb6a';
}

// Decode a species slot: { n: "Species Name", d: "BASE64" }
// Verifies the embedded name matches what the index says, warns on mismatch.
export function decodeSpecies(slot, expectedName) {
  if (!slot || typeof slot !== 'object') {
    console.error('decodeSpecies: unexpected slot format', slot);
    return null;
  }
  if (expectedName && slot.n !== expectedName) {
    console.warn(`Species name mismatch: file says "${slot.n}", index says "${expectedName}"`);
  }
  const bin = atob(slot.d);
  const buf = new ArrayBuffer(bin.length);
  const u8  = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const n = bin.length >> 3;
  return {
    lats: new Float32Array(buf, 0,     n),
    lngs: new Float32Array(buf, n * 4, n),
    n,
  };
}

// Build a single-feature MultiPoint GeoJSON — much cheaper than N Point features
export function toGeoJSON(lats, lngs, n) {
  const coords = new Array(n);
  for (let i = 0; i < n; i++) coords[i] = [lngs[i], lats[i]];
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'MultiPoint', coordinates: coords },
      properties: null,
    }],
  };
}

export function addTreeLayer(map, sid, geojson, color) {
  const sourceId = `trees-${sid}`;
  const layerId  = `layer-trees-${sid}`;

  if (map.getSource(sourceId)) {
    map.getSource(sourceId).setData(geojson);
  } else {
    map.addSource(sourceId, { type: 'geojson', data: geojson });
  }

  if (!map.getLayer(layerId)) {
    map.addLayer({
      id:     layerId,
      type:   'circle',
      source: sourceId,
      paint: {
        'circle-radius': [
          'interpolate', ['linear'], ['zoom'],
          10, 2,
          13, 3,
          15, 5,
          17, 8,
        ],
        'circle-color':        color,
        'circle-opacity':      0.85,
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 14, 0, 16, 0.5],
        'circle-stroke-color': '#fff',
      },
    });
  }
}

export function removeTreeLayer(map, sid) {
  const layerId  = `layer-trees-${sid}`;
  const sourceId = `trees-${sid}`;
  if (map.getLayer(layerId))  map.removeLayer(layerId);
  if (map.getSource(sourceId)) map.removeSource(sourceId);
}
