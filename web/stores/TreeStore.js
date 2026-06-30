const _listeners = new Set();

function emit() {
  _listeners.forEach(fn => fn(TreeStore));
}

export const TreeStore = {
  filters: {
    species: new Set(),
  },
  selectedTree: null,
  dataCache: {},
  pendingLoads: {},
  loadedSources: new Set(),

  subscribe(fn) {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },

  toggleSpecies(sid) {
    if (this.filters.species.has(sid)) {
      this.filters.species.delete(sid);
    } else {
      this.filters.species.add(sid);
    }
    emit();
  },

  clearFilters() {
    this.filters.species.clear();
    emit();
  },

  setData(sid, data) {
    this.dataCache[sid] = data;
    this.loadedSources.add(sid);
  },

  getData(sid) {
    return this.dataCache[sid] ?? null;
  },

  isLoaded(sid) {
    return this.loadedSources.has(sid);
  },
};
