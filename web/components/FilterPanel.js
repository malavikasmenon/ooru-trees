import { TreeStore }  from '../stores/TreeStore.js';
import { flowerColor } from '../layers/trees.js';

export function buildFilterPanel(treeIndex) {
  const { s, c } = treeIndex;

  const allItems = s
    .map((name, sid) => ({ sid, name, count: c[sid], color: flowerColor(name) }))
    .filter(it => it.name !== 'Others')
    .sort((a, b) => b.count - a.count);

  const totalTrees = allItems.reduce((sum, it) => sum + it.count, 0);
  document.getElementById('hdr-badge').textContent =
    `${allItems.length} species · ${totalTrees.toLocaleString('en-IN')} trees`;

  const listEl   = document.getElementById('species-list');
  const searchEl = document.getElementById('search');

  function renderList(items) {
    listEl.innerHTML = '';
    for (const { sid, name, count, color } of items) {
      const div = document.createElement('div');
      div.className   = 'sp-item' + (TreeStore.filters.species.has(sid) ? ' selected' : '');
      div.dataset.sid = sid;
      div.innerHTML   = `
        <div class="swatch" style="background:${color}"></div>
        <span class="sp-name">${name}</span>
        <span class="sp-count">${count.toLocaleString('en-IN')}</span>
        <span class="sp-check">✓</span>`;
      div.addEventListener('click', () => TreeStore.toggleSpecies(sid));
      listEl.appendChild(div);
    }
  }

  function visibleItems() {
    const q = searchEl.value.trim().toLowerCase();
    return q ? allItems.filter(it => it.name.toLowerCase().includes(q)) : allItems;
  }

  searchEl.addEventListener('input', () => renderList(visibleItems()));

  document.getElementById('btn-clear').addEventListener('click', () => TreeStore.clearFilters());

  TreeStore.subscribe(() => {
    renderList(visibleItems());
    updateFooter(treeIndex);
  });

  renderList(allItems);
  updateFooter(treeIndex);
}

function updateFooter(treeIndex) {
  const { s, c }  = treeIndex;
  const sel       = TreeStore.filters.species;
  const footText  = document.getElementById('foot-text');
  const footCount = document.getElementById('foot-count');
  const footLeft  = document.getElementById('footer-left');

  if (!sel.size) {
    footText.textContent  = 'Select a species to begin';
    footCount.textContent = '';
    footLeft.textContent  = 'Select species from the panel →';
    return;
  }

  let total = 0;
  sel.forEach(sid => { total += c[sid]; });
  const label = sel.size === 1 ? s[[...sel][0]] : `${sel.size} species`;

  footText.textContent  = label;
  footCount.textContent = `${total.toLocaleString('en-IN')} trees`;
  footLeft.textContent  = `${total.toLocaleString('en-IN')} trees · ${label}`;
}
