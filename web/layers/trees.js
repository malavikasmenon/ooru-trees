export const GENUS_COLOR = {
  TABEBUIA:'#e91e8c', LAGERSTROEMIA:'#e91e8c', BAUHINIA:'#c2185b',
  PONGAMIA:'#f48fb1', SAMANEA:'#f8bbd0', PLUMERIA:'#ff80ab',
  MUNTINGIA:'#f8bbd0', AVERRHOA:'#ce93d8',
  DELONIX:'#e53935', SPATHODEA:'#f4511e', SARACA:'#fb8c00',
  GREVILLEA:'#ef6c00', CALLISTEMON:'#c62828',
  PELTOPHORUM:'#f9a825', MARKHAMIA:'#f9a825', ACACIA:'#fbc02d',
  CASSIA:'#fdd835', THESPESIA:'#f9a825', MICHELIA:'#ff8f00',
  PTEROCARPUS:'#ffa000', ADENANTHERA:'#fbc02d', ALBIZIA:'#ffe082',
  JACARANDA:'#7b1fa2', MAJIDEA:'#6a1b9a',
  MILLINGTONIA:'#bbb', WRIGHTIA:'#ccc', MIMUSOPS:'#ccc',
  LEUCAENA:'#ccc', ALSTONIA:'#bbb', TERMINALIA:'#c5cae9',
  SWIETENIA:'#ccc', MANGIFERA:'#ddd8c4', TECTONA:'#c5cae9',
  SYZYGIUM:'#e1bee7', EUCALYPTUS:'#b2dfdb',
  COCOS:'#a5d6a7', ROYSTONEA:'#a5d6a7', PTYCHOSPERMA:'#a5d6a7',
  CARYOTA:'#a5d6a7', LIVISTONA:'#a5d6a7', HYDRISTELE:'#a5d6a7',
  FICUS:'#66bb6a', ARTOCARPUS:'#81c784', AZADIRACHTA:'#c5e1a5',
  ANACARDIUM:'#c8e6c9', SIMAROUBA:'#dcedc8', ARAUCARIA:'#a5d6a7',
  ANNONA:'#c8e6c9', AEGLE:'#dcedc8', AILANTHUS:'#c8e6c9',
  ALEURITES:'#c8e6c9', APHANAMIXIS:'#c8e6c9', NEOLOMARCKIA:'#81c784',
};

export function flowerColor(name) {
  if (!name || name === 'Others') return '#9e9e9e';
  return GENUS_COLOR[name.toUpperCase().split(/\s+/)[0]] || '#81c784';
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
