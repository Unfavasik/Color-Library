const colors = Array.isArray(window.COLOR_DATA) ? window.COLOR_DATA : [];
const featuredOrder = new Map(['#F0F8FF', '#FAEBD7', '#00FFFF', '#7FFFD4', '#F0FFFF', '#F5F5DC'].map((hex, index) => [hex, index]));
const categories = ['All', 'Red', 'Pink', 'Purple', 'Indigo', 'Blue', 'Cyan', 'Teal', 'Green', 'Yellow', 'Orange', 'Brown', 'Gray', 'Black', 'White'];
const state = { query: '', category: 'All', sort: 'source', visible: 36, selected: '#3B82F6', favorites: new Set() };
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function hexToRgb(hex) {
  const value = hex.replace('#', '').trim();
  if (!/^[0-9a-f]{6}$/i.test(value)) return null;
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
}
function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2; const d = max - min;
  if (d) { s = l > .5 ? d / (2 - max - min) : d / (max + min); switch (max) { case r: h = (g - b) / d + (g < b ? 6 : 0); break; case g: h = (b - r) / d + 2; break; default: h = (r - g) / d + 4; } h /= 6; }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}
function formatRgb(rgb) { return rgb.join(', '); }
function classify(hex) {
  const rgb = hexToRgb(hex); if (!rgb) return 'Gray';
  const [h, s, l] = rgbToHsl(rgb);
  if (s < 9) return l < 10 ? 'Black' : l > 92 ? 'White' : 'Gray';
  if (h < 12 || h >= 345) return 'Red'; if (h < 42) return 'Orange'; if (h < 68) return 'Yellow';
  if (h < 88) return 'Green'; if (h < 165) return 'Teal'; if (h < 195) return 'Cyan'; if (h < 218) return 'Blue'; if (h < 245) return 'Indigo'; if (h < 285) return 'Purple'; if (h < 345) return 'Pink'; return 'Red';
}
function getHsl(hex) { const rgb = hexToRgb(hex); return rgb ? rgbToHsl(rgb) : [0, 0, 50]; }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char])); }
function copyText(value) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(value);
  const input = document.createElement('textarea'); input.value = value; input.style.position = 'fixed'; input.style.opacity = '0'; document.body.appendChild(input); input.select(); document.execCommand('copy'); input.remove(); return Promise.resolve();
}
function showToast(message = 'Copied to clipboard') { const toast = $('#toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove('show'), 1600); }
function cardTemplate(color) {
  const [r, g, b] = hexToRgb(color.hex) || [0, 0, 0];
  const favorite = state.favorites.has(color.hex);
  return `<article class="color-card"><div class="color-block" style="background:${color.hex}"></div><div class="color-card-body"><h3 class="color-card-name" title="${escapeHtml(color.name)}">${escapeHtml(color.name)}</h3><div class="color-card-line"><strong>${color.hex}</strong><button class="card-copy" data-copy="${color.hex}" aria-label="Copy ${color.hex}"><svg viewBox="0 0 24 24" fill="none"><rect x="8" y="8" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke="currentColor" stroke-width="1.7"/></svg></button></div><div class="color-card-line"><span>RGB</span><strong>${r}, ${g}, ${b}</strong></div></div></article>`;
}
function filteredColors() {
  const query = state.query.trim().toLowerCase();
  let list = colors.filter((color) => (!query || color.name.toLowerCase().includes(query) || color.hex.toLowerCase().includes(query)) && (state.category === 'All' || classify(color.hex) === state.category));
  list.sort((a, b) => state.sort === 'source' ? colors.indexOf(a) - colors.indexOf(b) : state.sort === 'name' ? ((featuredOrder.has(a.hex) ? featuredOrder.get(a.hex) : 999) - (featuredOrder.has(b.hex) ? featuredOrder.get(b.hex) : 999) || a.name.localeCompare(b.name)) : state.sort === 'light' ? getHsl(a.hex)[2] - getHsl(b.hex)[2] : getHsl(a.hex)[0] - getHsl(b.hex)[0]);
  return list;
}
function renderFilters() { $('#filters').innerHTML = categories.map((category) => `<button class="filter-button ${category === state.category ? 'active' : ''}" data-category="${category}">${category}</button>`).join(''); }
function renderGrid() {
  const list = filteredColors(); const visible = list.slice(0, state.visible);
  $('#color-grid').innerHTML = visible.length ? visible.map(cardTemplate).join('') : '<div class="empty-state">No colors found. Try another name, HEX code, or category.</div>';
  $('#count-badge').textContent = `${list.length} Colors`;
  $('#load-more').style.display = visible.length < list.length ? 'inline-block' : 'none';
}
function render() { renderFilters(); renderGrid(); }
function setQuery(value) { state.query = value; state.visible = 36; $('#hero-search').value = value; $('#global-search').value = value; renderGrid(); }
function updatePicker(hex) {
  const rgb = hexToRgb(hex); if (!rgb) return;
  const normalized = '#' + hex.replace('#', '').toUpperCase(); state.selected = normalized;
  const [h, s, l] = rgbToHsl(rgb);
  $('#hex-value').value = normalized; $('#rgb-value').value = formatRgb(rgb); $('#hsl-value').value = `${h}, ${s}%, ${l}%`; $('#hue-slider').value = h;
  $('#swatch-preview').style.background = normalized; $('#color-stage').style.background = `linear-gradient(to bottom, transparent, #000), linear-gradient(to right, #fff, hsl(${h} ${s}% ${Math.max(l, 50)}%))`;
  const match = colors.find((color) => color.hex === normalized); $('#selected-name').textContent = match ? match.name : (normalized === '#3B82F6' ? 'Cornflower Blue' : 'Custom Color');
}

$('#filters').addEventListener('click', (event) => { const button = event.target.closest('[data-category]'); if (!button) return; state.category = button.dataset.category; state.visible = 36; render(); });
$('#color-grid').addEventListener('click', (event) => { const button = event.target.closest('[data-copy]'); if (!button) return; copyText(button.dataset.copy).then(() => showToast(`${button.dataset.copy} copied`)); });
$('#load-more').addEventListener('click', () => { state.visible += 36; renderGrid(); });
$('#sort-select').addEventListener('change', (event) => { state.sort = event.target.value; state.visible = 36; renderGrid(); });
$('#hero-search').addEventListener('input', (event) => setQuery(event.target.value));
$('#global-search').addEventListener('input', (event) => setQuery(event.target.value));
$$('[data-popular]').forEach((button) => button.addEventListener('click', () => { setQuery(button.dataset.popular); $('#colors').scrollIntoView({ behavior: 'smooth' }); }));
$('#view-all').addEventListener('click', () => { setQuery(''); $('#colors').scrollIntoView({ behavior: 'smooth' }); });
$('#random-color').addEventListener('click', () => { const color = colors[Math.floor(Math.random() * colors.length)]; updatePicker(color.hex); showToast(`${color.name} selected`); });
$('#copy-selected').addEventListener('click', () => copyText(state.selected).then(() => showToast(`${state.selected} copied`)));
$$('[data-copy-target]').forEach((button) => button.addEventListener('click', () => { const input = document.getElementById(button.dataset.copyTarget); copyText(input.value).then(() => showToast(`${input.value} copied`)); }));
$('#hex-value').addEventListener('change', (event) => updatePicker(event.target.value));
$('#hue-slider').addEventListener('input', (event) => { const hue = event.target.value; updatePicker('#' + hslToHex(Number(hue), 91, 60)); });
$('#favorite-toggle').addEventListener('click', () => { state.favorites.has(state.selected) ? state.favorites.delete(state.selected) : state.favorites.add(state.selected); $('#favorite-toggle').classList.toggle('is-favorite', state.favorites.has(state.selected)); showToast(state.favorites.has(state.selected) ? 'Color saved' : 'Color removed'); });
$('#theme-toggle').addEventListener('click', () => showToast('Light mode is active in this preview'));
document.addEventListener('keydown', (event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); $('#global-search').focus(); } });
function hslToHex(h, s, l) { s /= 100; l /= 100; const k = (n) => (n + h / 30) % 12; const a = s * Math.min(l, 1 - l); const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return [f(0), f(8), f(4)].map((value) => Math.round(255 * value).toString(16).padStart(2, '0')).join('').toUpperCase(); }
render(); updatePicker('#3B82F6');
