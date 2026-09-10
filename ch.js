// Shield against third-party AdSense TagError when rendered in iframes or zero-width viewports
window.addEventListener('error', function(event) {
  if (event && event.message && (event.message.indexOf('adsbygoogle') !== -1 || event.message.indexOf('availableWidth') !== -1)) {
    if (typeof event.preventDefault === 'function') event.preventDefault();
    return true;
  }
});

const colors = Array.isArray(window.COLOR_DATA) ? window.COLOR_DATA : [];
const featuredOrder = new Map(['#F0F8FF', '#FAEBD7', '#00FFFF', '#7FFFD4', '#F0FFFF', '#F5F5DC'].map((hex, index) => [hex, index]));
const categories = ['All', 'Saved', 'Red', 'Pink', 'Purple', 'Indigo', 'Blue', 'Cyan', 'Teal', 'Green', 'Yellow', 'Orange', 'Brown', 'Gray', 'Black', 'White'];

const FAVORITES_STORAGE_KEY = 'colorLibraryFavorites';
const RECENTLY_VIEWED_STORAGE_KEY = 'colorLibraryRecentlyViewed';

function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.map((hex) => String(hex).trim().toUpperCase()));
    }
  } catch (err) {
    console.warn('Error reading favorites from localStorage:', err);
  }
  return new Set();
}

function saveFavorites() {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...state.favorites]));
  } catch (err) {
    console.warn('Error saving favorites to localStorage:', err);
  }
}

function loadRecentlyViewed() {
  try {
    const raw = localStorage.getItem(RECENTLY_VIEWED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => item && typeof item === 'object' && (item.hex || Array.isArray(item.colors))).slice(0, 5);
    }
  } catch (err) {
    console.warn('Error reading recently viewed from localStorage:', err);
  }
  return [];
}

function saveRecentlyViewed(items) {
  try {
    localStorage.setItem(RECENTLY_VIEWED_STORAGE_KEY, JSON.stringify((items || []).slice(0, 5)));
  } catch (err) {
    console.warn('Error saving recently viewed to localStorage:', err);
  }
}

const state = {
  query: '',
  category: 'All',
  sort: 'source',
  selected: '#3B82F6',
  favorites: loadFavorites(),
  recentlyViewed: loadRecentlyViewed()
};
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

function getHeartSvg(isFav, size = 14) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
}

function cardTemplate(color) {
  const [r, g, b] = hexToRgb(color.hex) || [0, 0, 0];
  const normalizedHex = color.hex.toUpperCase();
  const favorite = state.favorites.has(normalizedHex);
  const colorName = escapeHtml(color.name);
  const ariaLabel = favorite ? `Remove ${colorName} from favorites` : `Add ${colorName} to favorites`;
  const titleText = favorite ? 'Remove from favorites' : 'Add to favorites';

  return `<article class="color-card" data-hex="${normalizedHex}">
    <div class="color-block" style="background:${color.hex}"></div>
    <div class="color-card-body">
      <div class="color-card-header">
        <h3 class="color-card-name" title="${colorName}">${colorName}</h3>
        <button class="card-fav-btn ${favorite ? 'is-fav' : ''}" data-fav="${normalizedHex}" data-name="${colorName}" aria-label="${ariaLabel}" title="${titleText}" type="button">
          ${getHeartSvg(favorite)}
        </button>
      </div>
      <div class="color-card-line">
        <strong>${color.hex}</strong>
        <button class="card-copy" data-copy="${color.hex}" aria-label="Copy ${color.hex}">
          <svg viewBox="0 0 24 24" fill="none"><rect x="8" y="8" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke="currentColor" stroke-width="1.7"/></svg>
        </button>
      </div>
      <div class="color-card-line">
        <span>RGB</span>
        <strong>${r}, ${g}, ${b}</strong>
      </div>
    </div>
  </article>`;
}

function toggleFavorite(hex, name = '') {
  const normalized = String(hex).trim().toUpperCase();
  const willFavorite = !state.favorites.has(normalized);

  if (willFavorite) {
    state.favorites.add(normalized);
  } else {
    state.favorites.delete(normalized);
  }
  saveFavorites();

  const displayName = name || normalized;

  // Update all card favorite buttons matching this hex
  $$(`.card-fav-btn[data-fav="${normalized}"]`).forEach((btn) => {
    btn.classList.toggle('is-fav', willFavorite);
    btn.setAttribute('aria-label', willFavorite ? `Remove ${displayName} from favorites` : `Add ${displayName} to favorites`);
    btn.setAttribute('title', willFavorite ? 'Remove from favorites' : 'Add to favorites');
    btn.innerHTML = getHeartSvg(willFavorite);
    btn.classList.remove('animating');
    void btn.offsetWidth;
    btn.classList.add('animating');
  });

  // Sync color picker swatch preview favorite toggle
  if (state.selected === normalized) {
    const swatchFav = $('#favorite-toggle');
    if (swatchFav) {
      swatchFav.classList.toggle('is-favorite', willFavorite);
      swatchFav.setAttribute('aria-label', willFavorite ? `Remove ${displayName} from favorites` : 'Save color');
    }
  }

  // Update filter buttons to reflect saved count
  renderFilters();

  // If currently in Saved category, re-render grid
  if (state.category === 'Saved') {
    renderGrid();
  }

  showToast(willFavorite ? `Added ${displayName} to favorites` : `Removed ${displayName} from favorites`);
}

function filteredColors() {
  const query = state.query.trim().toLowerCase();
  let list = colors.filter((color) => {
    const matchesQuery = !query || color.name.toLowerCase().includes(query) || color.hex.toLowerCase().includes(query);
    if (!matchesQuery) return false;
    if (state.category === 'All') return true;
    if (state.category === 'Saved') return state.favorites.has(color.hex.toUpperCase());
    return classify(color.hex) === state.category;
  });
  list.sort((a, b) => state.sort === 'source' ? colors.indexOf(a) - colors.indexOf(b) : state.sort === 'name' ? ((featuredOrder.has(a.hex) ? featuredOrder.get(a.hex) : 999) - (featuredOrder.has(b.hex) ? featuredOrder.get(b.hex) : 999) || a.name.localeCompare(b.name)) : state.sort === 'light' ? getHsl(a.hex)[2] - getHsl(b.hex)[2] : getHsl(a.hex)[0] - getHsl(b.hex)[0]);
  return list;
}

function resetSavedColors() {
  if (!state.favorites.size) {
    showToast('No saved colors to reset');
    return;
  }
  const count = state.favorites.size;
  state.favorites.clear();
  saveFavorites();

  // Sync heart buttons on any currently rendered color cards
  $$('.card-fav-btn.is-fav').forEach((btn) => {
    btn.classList.remove('is-fav');
    btn.innerHTML = getHeartSvg(false);
    btn.setAttribute('title', 'Add to favorites');
    btn.setAttribute('aria-label', 'Add to favorites');
  });

  // Sync color picker swatch preview favorite toggle
  const swatchFav = $('#favorite-toggle');
  if (swatchFav) {
    swatchFav.classList.remove('is-favorite');
    swatchFav.setAttribute('aria-label', 'Save color');
  }

  render();
  showToast(`All ${count} saved colors have been unsaved`);
}

function renderFilters() {
  const isSavedCategory = state.category === 'Saved';
  const savedCount = state.favorites.size;

  const buttons = categories.map((category) => {
    if (category === 'Saved') {
      return `<button class="filter-button ${category === state.category ? 'active' : ''} filter-saved" data-category="Saved">♥ Saved <span class="saved-count-pill">(${savedCount})</span></button>`;
    }
    return `<button class="filter-button ${category === state.category ? 'active' : ''}" data-category="${category}">${category}</button>`;
  }).join('');

  const resetBtnHtml = (isSavedCategory && savedCount > 0)
    ? `<button type="button" class="filter-reset-btn" id="filter-reset-saved-btn" title="Unsave all colors" aria-label="Reset all saved colors">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
        <span>Reset</span>
      </button>`
    : '';

  $('#filters').innerHTML = buttons + resetBtnHtml;
}

function renderGrid() {
  const list = filteredColors();
  let emptyMessage = 'No colors found. Try another name, HEX code, or category.';
  if (state.category === 'Saved') {
    if (!state.favorites.size) {
      emptyMessage = 'No saved colors yet. Tap the heart ♡ on any color card to save your favorites here!';
    } else if (state.query) {
      emptyMessage = 'No saved colors match your search query.';
    }
  }

  const bannerWrap = $('#saved-banner-wrap');
  if (bannerWrap) {
    if (state.category === 'Saved' && state.favorites.size > 0) {
      bannerWrap.innerHTML = `
        <div class="saved-header-bar">
          <div class="saved-header-info">
            <span class="saved-header-heart">♥</span>
            <span>You have <strong>${state.favorites.size}</strong> saved ${state.favorites.size === 1 ? 'color' : 'colors'}</span>
          </div>
          <button type="button" class="saved-reset-action-btn" id="catalog-reset-saved-btn" title="Unsave all colors">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            <span>Reset All</span>
          </button>
        </div>
      `;
    } else {
      bannerWrap.innerHTML = '';
    }
  }

  const grid = $('#color-grid');
  grid.innerHTML = list.length ? list.map(cardTemplate).join('') : `<div class="empty-state">${emptyMessage}</div>`;
  $('#count-badge').textContent = `${list.length} Colors`;

  // Animate children using CSS transition on opacity and transform
  requestAnimationFrame(() => {
    void grid.offsetHeight;
    const items = grid.children;
    for (let i = 0; i < items.length; i++) {
      items[i].classList.add('is-visible');
    }
  });
}

const CURATED_PALETTES = [
  { name: 'Sunset Horizon', tag: 'Warm & Vibrant', colors: ['#FF4E50', '#FC913A', '#F9D423', '#EDE574', '#E1F5C4'] },
  { name: 'Nordic Frost', tag: 'Cool Minimalist', colors: ['#2E3440', '#3B4252', '#434C5E', '#88C0D0', '#ECEFF4'] },
  { name: 'Oceanic Depths', tag: 'Deep Blues', colors: ['#03045E', '#023E8A', '#0077B6', '#0096C7', '#48CAE4'] },
  { name: 'Forest Moss', tag: 'Earthy Nature', colors: ['#2D3A27', '#4E6E58', '#8EA89D', '#D1DBCB', '#F1F5F0'] },
  { name: 'Neon Cyberpunk', tag: 'High Contrast', colors: ['#0D0221', '#0F084B', '#26408B', '#A6CFD5', '#C2E7D9'] },
  { name: 'Pastel Dreamscape', tag: 'Soft Pastel', colors: ['#FFB5E8', '#B28DFF', '#85E3FF', '#BFFCC6', '#FFC9DE'] },
  { name: 'Terracotta Warmth', tag: 'Warm Earthy', colors: ['#9A3B3B', '#C08261', '#E2C799', '#F2ECBE', '#FAFAFA'] },
  { name: 'Midnight Jewel', tag: 'Jewel Tones', colors: ['#2E0249', '#570A57', '#A91079', '#F806CC', '#F7D060'] }
];

function addRecentlyViewed(item) {
  if (!item) return;
  const isPalette = item.type === 'palette' || (Array.isArray(item.colors) && item.colors.length > 1);
  const type = isPalette ? 'palette' : 'color';

  let entry;
  if (type === 'color') {
    const rawHex = String(item.hex || '').trim();
    const normalizedHex = '#' + rawHex.replace('#', '').toUpperCase();
    if (!/^#[0-9A-F]{6}$/i.test(normalizedHex)) return;
    const match = colors.find((c) => c.hex.toUpperCase() === normalizedHex);
    const name = item.name || (match ? match.name : (normalizedHex === '#3B82F6' ? 'Cornflower Blue' : 'Custom Color'));
    entry = {
      type: 'color',
      hex: normalizedHex,
      name,
      timestamp: Date.now()
    };
  } else {
    const colorsList = (item.colors || [])
      .map((c) => '#' + String(c).replace('#', '').trim().toUpperCase())
      .filter((c) => /^#[0-9A-F]{6}$/i.test(c));
    if (!colorsList.length) return;
    const title = item.title || item.name || `${colorsList.length}-Color Palette`;
    entry = {
      type: 'palette',
      title,
      colors: colorsList,
      hex: colorsList[0],
      timestamp: Date.now()
    };
  }

  // Deduplicate against existing items in state
  const current = (state.recentlyViewed || []).filter((existing) => {
    if (!existing) return false;
    if (existing.type !== entry.type) return true;
    if (entry.type === 'color') {
      return (existing.hex || '').toUpperCase() !== entry.hex.toUpperCase();
    } else {
      const exStr = (existing.colors || []).join(',').toUpperCase();
      const newStr = entry.colors.join(',').toUpperCase();
      return exStr !== newStr;
    }
  });

  state.recentlyViewed = [entry, ...current].slice(0, 5);
  saveRecentlyViewed(state.recentlyViewed);
  renderRecentlyViewed();
}

function removeRecentlyViewed(index) {
  if (!Array.isArray(state.recentlyViewed) || index < 0 || index >= state.recentlyViewed.length) return;
  const removed = state.recentlyViewed.splice(index, 1);
  saveRecentlyViewed(state.recentlyViewed);
  renderRecentlyViewed();
  if (removed && removed[0]) {
    const label = removed[0].name || removed[0].title || removed[0].hex || 'Item';
    showToast(`Removed "${label}" from recent history`);
  }
}

function clearRecentlyViewed() {
  state.recentlyViewed = [];
  saveRecentlyViewed([]);
  renderRecentlyViewed();
  showToast('Recently viewed history cleared');
}

function renderRecentlyViewed() {
  const grid = $('#recently-viewed-grid');
  const countPill = $('#recently-viewed-count');
  const clearBtn = $('#recently-viewed-clear-btn');
  if (!grid) return;

  const list = state.recentlyViewed || [];
  if (countPill) countPill.textContent = list.length;
  if (clearBtn) clearBtn.style.display = list.length > 0 ? 'inline-flex' : 'none';

  if (!list.length) {
    grid.innerHTML = `
      <div class="recent-empty-card">
        <div class="recent-empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        </div>
        <h4 class="recent-empty-title">No recently viewed colors or palettes yet</h4>
        <p class="recent-empty-desc">Explore colors in the chart, pick custom shades, or discover curated palettes to see your last 5 viewed items here.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = list.map((item, index) => {
    if (item.type === 'color') {
      const displayName = escapeHtml(item.name || item.hex);
      return `
        <div class="recent-card" data-recent-type="color" data-recent-index="${index}" data-hex="${item.hex}" data-name="${displayName}" role="button" tabindex="0" title="Click to inspect ${displayName}">
          <div class="recent-swatch-area">
            <div class="recent-single-swatch" style="background: ${item.hex};"></div>
            <span class="recent-type-badge">Color</span>
            <button type="button" class="recent-delete-btn" data-delete-recent="${index}" aria-label="Remove ${displayName} from recent history" title="Remove">✕</button>
          </div>
          <div class="recent-body">
            <div class="recent-name" title="${displayName}">${displayName}</div>
            <div class="recent-meta-row">
              <span class="recent-hex-badge">${item.hex}</span>
              <button type="button" class="recent-action-btn" data-copy-recent="${item.hex}" title="Copy HEX">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>
                Copy
              </button>
            </div>
          </div>
        </div>
      `;
    } else {
      const paletteColors = item.colors || [item.hex];
      const displayTitle = escapeHtml(item.title || `${paletteColors.length}-Color Palette`);
      const slicesHtml = paletteColors.map((c) => `<div class="recent-palette-slice" style="background: ${c};" title="${c}"></div>`).join('');
      const dotsHtml = paletteColors.slice(0, 5).map((c) => `<span class="recent-dot" style="background: ${c};" title="${c}"></span>`).join('');
      const copyPayload = paletteColors.join(', ');
      return `
        <div class="recent-card" data-recent-type="palette" data-recent-index="${index}" data-colors="${paletteColors.join(',')}" data-title="${displayTitle}" role="button" tabindex="0" title="Click to view palette ${displayTitle}">
          <div class="recent-swatch-area">
            <div class="recent-palette-bar">${slicesHtml}</div>
            <span class="recent-type-badge">Palette</span>
            <button type="button" class="recent-delete-btn" data-delete-recent="${index}" aria-label="Remove ${displayTitle} from recent history" title="Remove">✕</button>
          </div>
          <div class="recent-body">
            <div class="recent-name" title="${displayTitle}">${displayTitle}</div>
            <div class="recent-meta-row">
              <div class="recent-dots-group">${dotsHtml}</div>
              <button type="button" class="recent-action-btn" data-copy-palette="${copyPayload}" title="Copy palette HEX codes">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M4 10h16M4 15h16M10 4v16M15 4v16"/></svg>
                Copy
              </button>
            </div>
          </div>
        </div>
      `;
    }
  }).join('');
}

function openCuratedPalettes() {
  const overlay = $('#palettes-overlay');
  if (overlay) {
    renderCuratedPalettes();
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeCuratedPalettes() {
  const overlay = $('#palettes-overlay');
  if (overlay && overlay.classList.contains('active')) {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
    if (window.location.hash === '#palettes') {
      history.replaceState(null, '', '#home');
      handleRoute();
    }
  }
}

function renderCuratedPalettes() {
  const grid = $('#curated-palettes-grid');
  if (!grid) return;

  grid.innerHTML = CURATED_PALETTES.map((palette, idx) => {
    const stripHtml = palette.colors.map((c) => `<div class="palette-item-strip-slice" style="background: ${c};" title="HEX: ${c} (Click to inspect)" data-single-color="${c}"></div>`).join('');
    const pillsHtml = palette.colors.map((c) => `
      <button type="button" class="palette-item-color-pill" data-single-color="${c}" title="Load ${c} into picker">
        <span class="palette-item-color-pill-dot" style="background: ${c};"></span>
        ${c}
      </button>
    `).join('');

    return `
      <div class="palette-item-card" data-palette-index="${idx}">
        <div class="palette-item-strip">${stripHtml}</div>
        <div class="palette-item-details">
          <div class="palette-item-title-row">
            <span class="palette-item-name">${escapeHtml(palette.name)}</span>
            <span class="palette-item-tag">${escapeHtml(palette.tag)}</span>
          </div>
          <div class="palette-item-colors-row">${pillsHtml}</div>
          <div class="palette-item-actions">
            <button type="button" class="palette-item-btn" data-copy-curated="${palette.colors.join(', ')}">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>
              Copy
            </button>
            <button type="button" class="palette-item-btn primary" data-mix-curated="${idx}">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="12" r="2.5"/><circle cx="12" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/></svg>
              Mix This
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function openColorMixWithColors(hexList) {
  if (!Array.isArray(hexList) || !hexList.length) return;
  const count = Math.max(2, Math.min(5, hexList.length));
  colorMixState.count = count;
  colorMixState.selectedColors = [];
  for (let i = 0; i < count; i++) {
    const hex = hexList[i] || '#3B82F6';
    const match = colors.find((c) => c.hex.toUpperCase() === hex.toUpperCase());
    const name = match ? match.name : findClosestColorName(hex);
    colorMixState.selectedColors[i] = { name, hex };
  }
  updateMixCount(count);
  generateColorMix();
  openColorMix();
}

function render() { renderFilters(); renderGrid(); renderRecentlyViewed(); }
function setQuery(value) { state.query = value; $('#hero-search').value = value; $('#global-search').value = value; renderGrid(); }
function updatePicker(hex) {
  const rgb = hexToRgb(hex); if (!rgb) return;
  const normalized = '#' + hex.replace('#', '').toUpperCase(); state.selected = normalized;
  const [h, s, l] = rgbToHsl(rgb);
  $('#hex-value').value = normalized; $('#rgb-value').value = formatRgb(rgb); $('#hsl-value').value = `${h}, ${s}%, ${l}%`; $('#hue-slider').value = h;
  $('#swatch-preview').style.background = normalized; $('#color-stage').style.background = `linear-gradient(to bottom, transparent, #000), linear-gradient(to right, #fff, hsl(${h} ${s}% ${Math.max(l, 50)}%))`;
  $('#color-stage').style.setProperty('--stage-x', s + '%');
  $('#color-stage').style.setProperty('--stage-y', Math.max(0, Math.min(100, (90 - l) / 0.8)) + '%');
  const match = colors.find((color) => color.hex.toUpperCase() === normalized);
  const colorName = match ? match.name : (normalized === '#3B82F6' ? 'Cornflower Blue' : 'Custom Color');
  $('#selected-name').textContent = colorName;

  const swatchFav = $('#favorite-toggle');
  if (swatchFav) {
    const isFav = state.favorites.has(normalized);
    swatchFav.classList.toggle('is-favorite', isFav);
    swatchFav.setAttribute('aria-label', isFav ? `Remove ${colorName} from favorites` : 'Save color');
  }
}

const on = (selector, event, handler) => {
  const el = $(selector);
  if (el) el.addEventListener(event, handler);
};

on('#filters', 'click', (event) => {
  const resetBtn = event.target.closest('#filter-reset-saved-btn');
  if (resetBtn) {
    event.stopPropagation();
    resetSavedColors();
    return;
  }
  const button = event.target.closest('[data-category]');
  if (!button) return;
  state.category = button.dataset.category;
  render();
});
on('#saved-banner-wrap', 'click', (event) => {
  const resetBtn = event.target.closest('#catalog-reset-saved-btn');
  if (resetBtn) {
    event.stopPropagation();
    resetSavedColors();
  }
});
on('#color-grid', 'click', (event) => {
  const card = event.target.closest('.color-card');
  const favBtn = event.target.closest('[data-fav]');
  if (favBtn) {
    event.stopPropagation();
    toggleFavorite(favBtn.dataset.fav, favBtn.dataset.name);
    addRecentlyViewed({ type: 'color', hex: favBtn.dataset.fav, name: favBtn.dataset.name });
    return;
  }
  const button = event.target.closest('[data-copy]');
  if (button) {
    event.stopPropagation();
    copyText(button.dataset.copy).then(() => showToast(`${button.dataset.copy} copied`));
    const parentCard = button.closest('.color-card');
    const colorName = parentCard ? parentCard.querySelector('.color-name')?.textContent : '';
    addRecentlyViewed({ type: 'color', hex: button.dataset.copy, name: colorName });
    return;
  }
  if (card && card.dataset.hex) {
    updatePicker(card.dataset.hex);
    addRecentlyViewed({ type: 'color', hex: card.dataset.hex, name: card.dataset.name });
    const pickerEl = $('#picker');
    if (pickerEl && window.innerWidth < 768) {
      pickerEl.scrollIntoView({ behavior: 'smooth' });
    }
  }
});
on('#sort-select', 'change', (event) => { state.sort = event.target.value; renderGrid(); });
on('#hero-search', 'input', (event) => setQuery(event.target.value));
on('#global-search', 'input', (event) => setQuery(event.target.value));
$$('[data-popular]').forEach((button) => button.addEventListener('click', () => { setQuery(button.dataset.popular); const target = $('#colors'); if (target) target.scrollIntoView({ behavior: 'smooth' }); }));
const savedFeatureBtn = $('a[href="#saved"]');
if (savedFeatureBtn) {
  savedFeatureBtn.addEventListener('click', (e) => {
    e.preventDefault();
    state.category = 'Saved';
    render();
    const target = $('#colors');
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  });
}
on('#view-all', 'click', () => { setQuery(''); const target = $('#colors'); if (target) target.scrollIntoView({ behavior: 'smooth' }); });
on('#random-color', 'click', () => {
  const color = colors[Math.floor(Math.random() * colors.length)];
  if (color) {
    updatePicker(color.hex);
    addRecentlyViewed({ type: 'color', hex: color.hex, name: color.name });
    showToast(`${color.name} selected`);
  }
});
on('#copy-selected', 'click', () => {
  copyText(state.selected).then(() => {
    const wrapper = $('#copy-selected');
    const progressBar = $('#copy-progress-bar');
    if (!wrapper || wrapper.classList.contains('copied')) return;
    wrapper.classList.add('copied');
    if (progressBar) progressBar.style.width = '100%';
    setTimeout(() => {
      wrapper.classList.remove('copied');
      if (progressBar) progressBar.style.width = '0%';
    }, 1800);
    const colorName = $('#selected-name')?.textContent || '';
    addRecentlyViewed({ type: 'color', hex: state.selected, name: colorName });
  });
});
$$('[data-copy-target]').forEach((button) => button.addEventListener('click', () => {
  const input = document.getElementById(button.dataset.copyTarget);
  if (input) {
    copyText(input.value).then(() => showToast(`${input.value} copied`));
    if (button.dataset.copyTarget === 'hex-value') {
      const colorName = $('#selected-name')?.textContent || '';
      addRecentlyViewed({ type: 'color', hex: input.value, name: colorName });
    }
  }
}));
on('#hex-value', 'change', (event) => {
  updatePicker(event.target.value);
  addRecentlyViewed({ type: 'color', hex: event.target.value });
});
on('#hue-slider', 'input', (event) => { const hue = event.target.value; updatePicker('#' + hslToHex(Number(hue), 91, 60)); });
on('#hue-slider', 'change', () => {
  const colorName = $('#selected-name')?.textContent || '';
  addRecentlyViewed({ type: 'color', hex: state.selected, name: colorName });
});
on('#favorite-toggle', 'click', () => {
  const match = colors.find((c) => c.hex.toUpperCase() === state.selected.toUpperCase());
  const colorName = match ? match.name : state.selected;
  toggleFavorite(state.selected, colorName);
  addRecentlyViewed({ type: 'color', hex: state.selected, name: colorName });
});
on('#theme-toggle', 'click', () => showToast('Light mode is active in this preview'));
document.addEventListener('keydown', (event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); const gs = $('#global-search'); if (gs) gs.focus(); } });

// Recently Viewed event listeners
on('#recently-viewed-clear-btn', 'click', () => {
  clearRecentlyViewed();
});

on('#recently-viewed-grid', 'click', (e) => {
  const deleteBtn = e.target.closest('[data-delete-recent]');
  if (deleteBtn) {
    e.stopPropagation();
    const idx = parseInt(deleteBtn.dataset.deleteRecent, 10);
    removeRecentlyViewed(idx);
    return;
  }

  const copyRecentBtn = e.target.closest('[data-copy-recent]');
  if (copyRecentBtn) {
    e.stopPropagation();
    const hex = copyRecentBtn.dataset.copyRecent;
    copyText(hex).then(() => showToast(`${hex} copied to clipboard`));
    return;
  }

  const copyPaletteBtn = e.target.closest('[data-copy-palette]');
  if (copyPaletteBtn) {
    e.stopPropagation();
    const paletteStr = copyPaletteBtn.dataset.copyPalette;
    copyText(paletteStr).then(() => showToast(`Palette copied to clipboard`));
    return;
  }

  const card = e.target.closest('.recent-card');
  if (!card) return;

  const type = card.dataset.recentType;
  if (type === 'color') {
    const hex = card.dataset.hex;
    if (hex) {
      updatePicker(hex);
      const name = card.dataset.name || hex;
      showToast(`${name} loaded into picker`);
      const picker = $('#picker');
      if (picker) picker.scrollIntoView({ behavior: 'smooth' });
    }
  } else if (type === 'palette') {
    const rawColors = card.dataset.colors;
    if (rawColors) {
      const colorList = rawColors.split(',').map((c) => c.trim()).filter(Boolean);
      openColorMixWithColors(colorList);
    }
  }
});

on('#recently-viewed-grid', 'keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    const card = e.target.closest('.recent-card');
    if (card) {
      e.preventDefault();
      card.click();
    }
  }
});

// Curated Palettes Feature Card & Modal listeners
on('#feature-palettes', 'click', (e) => {
  e.preventDefault();
  openCuratedPalettes();
});

on('#palettes-close-btn', 'click', () => {
  closeCuratedPalettes();
});

on('#palettes-overlay', 'click', (e) => {
  if (e.target === $('#palettes-overlay')) {
    closeCuratedPalettes();
  }
});

on('#curated-palettes-grid', 'click', (e) => {
  const singleColorBtn = e.target.closest('[data-single-color]');
  if (singleColorBtn) {
    e.stopPropagation();
    const hex = singleColorBtn.dataset.singleColor;
    updatePicker(hex);
    const match = colors.find((c) => c.hex.toUpperCase() === hex.toUpperCase());
    const name = match ? match.name : findClosestColorName(hex);
    addRecentlyViewed({ type: 'color', hex, name });
    showToast(`${name} (${hex}) loaded into picker`);
    closeCuratedPalettes();
    const picker = $('#picker');
    if (picker) picker.scrollIntoView({ behavior: 'smooth' });
    return;
  }

  const copyCuratedBtn = e.target.closest('[data-copy-curated]');
  if (copyCuratedBtn) {
    e.stopPropagation();
    const str = copyCuratedBtn.dataset.copyCurated;
    const card = copyCuratedBtn.closest('.palette-item-card');
    const idx = parseInt(card?.dataset?.paletteIndex || '0', 10);
    const pal = CURATED_PALETTES[idx];
    if (pal) {
      addRecentlyViewed({ type: 'palette', title: pal.name, colors: pal.colors });
    }
    copyText(str).then(() => showToast(`Palette copied to clipboard`));
    return;
  }

  const mixCuratedBtn = e.target.closest('[data-mix-curated]');
  if (mixCuratedBtn) {
    e.stopPropagation();
    const idx = parseInt(mixCuratedBtn.dataset.mixCurated, 10);
    const pal = CURATED_PALETTES[idx];
    if (pal) {
      addRecentlyViewed({ type: 'palette', title: pal.name, colors: pal.colors });
      closeCuratedPalettes();
      openColorMixWithColors(pal.colors);
    }
    return;
  }
});

// Recent Nav Anchor Smooth Scroll
on('#nav-recent', 'click', (e) => {
  e.preventDefault();
  const target = $('#recently-viewed');
  if (target) {
    target.scrollIntoView({ behavior: 'smooth' });
  }
});

let isDraggingColorStage = false;
const colorStage = $('#color-stage');
if (colorStage) {
  const handleColorStageEvent = (e) => {
    const rect = colorStage.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    x = Math.max(0, Math.min(x, rect.width));
    y = Math.max(0, Math.min(y, rect.height));
    const xPercent = (x / rect.width) * 100;
    const yPercent = (y / rect.height) * 100;
    colorStage.style.setProperty('--stage-x', xPercent + '%');
    colorStage.style.setProperty('--stage-y', yPercent + '%');
    const hueSlider = $('#hue-slider');
    const hue = hueSlider ? Number(hueSlider.value) || 0 : 0;
    const saturation = Math.round(xPercent);
    const lightness = Math.round(90 - (yPercent * 0.8));
    updatePicker('#' + hslToHex(hue, saturation, lightness));
  };

  colorStage.addEventListener('pointerdown', (e) => {
    isDraggingColorStage = true;
    colorStage.setPointerCapture(e.pointerId);
    handleColorStageEvent(e);
  });
  colorStage.addEventListener('pointermove', (e) => {
    if (isDraggingColorStage) {
      handleColorStageEvent(e);
    }
  });
  const endPointer = (e) => {
    if (isDraggingColorStage) {
      isDraggingColorStage = false;
      try {
        colorStage.releasePointerCapture(e.pointerId);
      } catch (err) {}
      const colorName = $('#selected-name')?.textContent || '';
      addRecentlyViewed({ type: 'color', hex: state.selected, name: colorName });
    }
  };
  colorStage.addEventListener('pointerup', endPointer);
  colorStage.addEventListener('pointercancel', endPointer);
}
function hslToHex(h, s, l) { s /= 100; l /= 100; const k = (n) => (n + h / 30) % 12; const a = s * Math.min(l, 1 - l); const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return [f(0), f(8), f(4)].map((value) => Math.round(255 * value).toString(16).padStart(2, '0')).join('').toUpperCase(); }
render(); updatePicker('#3B82F6');

const pagesData = {
  'privacy-policy': {
    title: 'Privacy Policy',
    content: `<h2>1. Introduction</h2><p>Welcome to Color Library. We are committed to protecting your privacy and ensuring you have a secure, transparent experience while exploring color palettes, CSS gradients, and HTML color codes.</p><h2>2. Information We Collect</h2><p>Color Library does not require user registration or account creation. We do not collect personally identifiable information (PII) such as your name, email address, or phone number.</p><h2>3. How We Use Information</h2><p>Since we do not collect personal information, no user data is shared, sold, or rented to third parties. Any interactions remain strictly confidential and client-side.</p><h2>4. Cookies and Local Storage</h2><p>We use browser local storage solely to save your favorite color selections and UI preferences locally on your device. This data never leaves your browser and can be cleared at any time through your browser settings.</p><h2>5. Analytics and Third-Party Services</h2><p>We do not utilize intrusive tracking cookies or external analytics platforms that monitor your personal browsing habits.</p><h2>6. Data Security</h2><p>Because your saved favorites and preferences are stored exclusively on your local device, no user data is transmitted or stored on external database servers.</p><h2>7. Children's Privacy</h2><p>Color Library is safe for users of all ages. We do not knowingly collect any data from children under the age of 13.</p><h2>8. Your Rights</h2><p>You retain full control over your local data. You may clear your browser storage at any time to remove all saved favorites and preferences instantly.</p><h2>9. Changes to This Privacy Policy</h2><p>We may update this Privacy Policy from time to time to reflect improvements in our platform. Any modifications will be posted directly on this page.</p><h2>10. Contact Us</h2><p>If you have any questions or concerns regarding our privacy practices, please feel free to reach out via our <a href="/contact">Contact / Feedback</a> form.</p>`
  },
  'terms-of-service': {
    title: 'Terms of Service',
    content: `<h2>1. Acceptance of Terms</h2><p>By accessing and using Color Library, you agree to comply with and be bound by these Terms of Service. If you do not agree with any part of these terms, please discontinue use of the website.</p><h2>2. Use of the Website</h2><p>Color Library is provided as a complimentary resource platform for discovering, exploring, copying, and utilizing HTML and CSS color codes, palettes, and gradients for personal and commercial projects.</p><h2>3. Color Information</h2><p>All color values, HEX codes, RGB values, and HSL data are provided for general design reference and inspiration. Display calibration and hardware variations may affect how colors appear on your screen.</p><h2>4. Accuracy Disclaimer</h2><p>While we strive to ensure the utmost accuracy of all color values and metadata, Color Library makes no guarantees regarding the absolute precision or suitability of color codes for specific production or printing requirements.</p><h2>5. Intellectual Property</h2><p>All interface layouts, branding, graphics, typography pairings, and curated color data collections are protected by applicable intellectual property laws. Unauthorized reproduction or scraping is prohibited.</p><h2>6. Acceptable Use</h2><p>Users agree not to misuse the platform, attempt unauthorized access to website infrastructure, or disrupt the normal operation of the service.</p><h2>7. External Links</h2><p>The website may contain references or links to external websites and resources. Color Library assumes no responsibility or liability for the content or practices of third-party sites.</p><h2>8. Limitation of Liability</h2><p>Color Library is provided on an "as is" and "as available" basis without warranties of any kind, either express or implied. We shall not be held liable for any direct or indirect damages arising from the use of this website.</p><h2>9. Changes to Terms</h2><p>We reserve the right to modify or replace these Terms of Service at any time without prior notice. Continued use of the website following any changes constitutes acceptance of those changes.</p><h2>10. Contact</h2><p>If you have any questions concerning these terms, please contact us through our <a href="/contact">Contact / Feedback</a> form.</p>`
  },
  'about': {
    title: 'About Color Library',
    content: `<p>Color Library is a simple web-based resource for discovering, exploring, copying, and using HTML and CSS colors. Designed with speed and minimalism in mind, it empowers creators to find the perfect shade instantly.</p><h2>Key Features &amp; Tools</h2><ul><li><strong>HTML Color Codes:</strong> Comprehensive directory of over 140+ standard color names and HEX values.</li><li><strong>HEX Values:</strong> Instant hex code generation for web styling and CSS rules.</li><li><strong>RGB Values:</strong> Accurate Red, Green, Blue decimal color conversions.</li><li><strong>HSL Values:</strong> Hue, Saturation, and Lightness representation for precise tonal adjustments.</li><li><strong>Color Picker:</strong> Interactive stage with hue slider and real-time swatch preview.</li><li><strong>Color Converter:</strong> Seamless translation between multiple color formats.</li><li><strong>Color Palettes:</strong> Handcrafted color schemes for modern web interfaces.</li><li><strong>Gradients:</strong> Stunning CSS gradient combinations ready to copy and paste.</li><li><strong>Search and Copy Tools:</strong> Lightning-fast filtering and one-click clipboard copying.</li></ul><h2>Our Philosophy</h2><p>We believe color selection should be frictionless, elegant, and lightning-fast. Color Library eliminates clutter so you can focus purely on crafting beautiful digital experiences.</p>`
  },
  'developer': {
    title: 'Developer Details',
    content: `<div style="text-align: center; padding: 10px 0 20px;"><div style="width: 72px; height: 72px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: #fff; font-size: 28px; font-weight: 700; display: flex; align-items: center; justify-content: center; margin: 0 auto 14px; box-shadow: 0 8px 20px rgba(59,130,246,0.25);">DA</div><h3 style="margin: 0 0 4px; font-size: 20px; color: #0f172a;">Dev Asik</h3><p style="margin: 0; color: #64748b; font-size: 14px; font-weight: 600;">Web Developer &amp; Creator</p></div><h4>Project Information</h4><p><strong>Project Name:</strong> Color Library</p><p><strong>Description:</strong> A high-performance, modern color exploration and utility tool built for developers and designers.</p><h4>Technology Stack</h4><ul><li>HTML5 / Semantic Markup</li><li>Modern CSS3 (Tailwind-aligned utility design &amp; custom styling)</li><li>Vanilla JavaScript (ES6+ with reactive state management)</li><li>React / Full-stack Cloud Run environment</li></ul><h4>Connect &amp; Contributions</h4><p>Created with precision and craftsmanship. Maintained under the Color Library workspace.</p>`
  },
  'contact': {
    title: 'Contact & Feedback',
    content: `<p>We value your feedback, feature suggestions, and bug reports. Send us a message below and we will get back to you promptly!</p><form id="contact-form" style="display: flex; flex-direction: column; gap: 14px; margin-top: 16px; max-width: 600px;"><label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600; color: #475569;">Your Name<input type="text" id="contact-name" required placeholder="e.g., Alex Smith" style="height: 44px; padding: 0 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; outline: none; background: #fff;" /></label><label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600; color: #475569;">Email Address<input type="email" id="contact-email" required placeholder="alex@example.com" style="height: 44px; padding: 0 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; outline: none; background: #fff;" /></label><label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600; color: #475569;">Message / Feedback<textarea id="contact-msg" required rows="5" placeholder="Tell us what you think or report an issue..." style="padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; outline: none; font-family: inherit; resize: vertical; background: #fff;"></textarea></label><button type="submit" style="height: 46px; background: #2563eb; color: #fff; font-weight: 600; font-size: 15px; border: 0; border-radius: 8px; cursor: pointer; margin-top: 6px; box-shadow: 0 4px 12px rgba(37,99,235,0.2);">Send Feedback</button></form>`
  }
};
pagesData['privacy'] = pagesData['privacy-policy'];
pagesData['terms'] = pagesData['terms-of-service'];
pagesData['terms-and-conditions'] = pagesData['terms-of-service'];

function openMoreMenu() {
  const overlay = $('#more-overlay');
  if (overlay) overlay.classList.add('open');
}
function closeMoreMenu() {
  const overlay = $('#more-overlay');
  if (overlay) overlay.classList.remove('open');
}
function openContentModal(pageKey) {
  closeMoreMenu();
  const page = pagesData[pageKey];
  if (!page) return;
  $('#content-modal-title').textContent = page.title;
  $('#content-modal-body').innerHTML = page.content;
  const modalOverlay = $('#content-modal-overlay');
  if (modalOverlay) modalOverlay.classList.add('open');

  if (pageKey === 'contact') {
    const form = $('#contact-form');
    if (form) {
      form.onsubmit = (e) => {
        e.preventDefault();
        closeContentModal();
        showToast('Thank you for your feedback!');
      };
    }
  }
}
function closeContentModal() {
  const modalOverlay = $('#content-modal-overlay');
  if (modalOverlay) modalOverlay.classList.remove('open');
}

function navigateHome() {
  closeMoreMenu();
  closeContentModal();
  const colorMixOverlay = $('#color-mix-overlay');
  if (colorMixOverlay && colorMixOverlay.classList.contains('active')) {
    colorMixOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }
  if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
    try {
      history.pushState(null, '', '/');
    } catch (_) {
      window.location.href = '/';
      return;
    }
  } else if (window.location.hash) {
    try {
      history.pushState(null, '', window.location.pathname + window.location.search);
    } catch (_) {
      window.location.hash = '';
    }
  }
  handleRoute();
}

on('#more-link', 'click', (e) => {
  e.preventDefault();
  openMoreMenu();
});
on('#more-close-btn', 'click', closeMoreMenu);
on('#more-overlay', 'click', (e) => {
  if (e.target === $('#more-overlay')) closeMoreMenu();
});

$$('.more-menu-item').forEach((item) => {
  item.addEventListener('click', (e) => {
    const pageKey = item.dataset.page;
    if (pageKey === 'developer') {
      e.preventDefault();
      closeMoreMenu();
      openContentModal('developer');
      return;
    }
    const href = item.getAttribute('href');
    if (href && href.startsWith('/')) {
      e.preventDefault();
      closeMoreMenu();
      if (window.location.pathname !== href) {
        history.pushState(null, '', href);
      }
      handleRoute();
    }
  });
});

$$('.footer-links a, .footer-dev-link').forEach((link) => {
  link.addEventListener('click', (e) => {
    const href = link.getAttribute('href');
    if (href === '#developer') {
      e.preventDefault();
      closeMoreMenu();
      closeContentModal();
      openContentModal('developer');
      return;
    }
    if (href && href.startsWith('/')) {
      e.preventDefault();
      closeMoreMenu();
      closeContentModal();
      if (window.location.pathname !== href) {
        history.pushState(null, '', href);
      }
      handleRoute();
    }
  });
});

document.addEventListener('click', (e) => {
  const backBtn = e.target.closest('.page-back-btn');
  if (backBtn) {
    e.preventDefault();
    navigateHome();
    return;
  }
  const brandLink = e.target.closest('.brand');
  if (brandLink) {
    if (window.location.pathname !== '/' || window.location.hash) {
      e.preventDefault();
      navigateHome();
      return;
    }
  }
  const cleanLink = e.target.closest('a[href^="/"]');
  if (cleanLink && !cleanLink.getAttribute('target') && !cleanLink.getAttribute('download')) {
    const href = cleanLink.getAttribute('href');
    if (['/', '/privacy-policy', '/terms-of-service', '/contact', '/about', '/color-mix'].includes(href)) {
      e.preventDefault();
      closeMoreMenu();
      closeContentModal();
      if (window.location.pathname !== href) {
        history.pushState(null, '', href);
      }
      handleRoute();
    }
  }
});

on('#content-modal-close', 'click', closeContentModal);
on('#content-modal-overlay', 'click', (e) => {
  if (e.target === $('#content-modal-overlay')) closeContentModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeMoreMenu();
    closeContentModal();
    closeColorMix();
    closeMixPicker();
    closeMixSaved();
  }
});

function getActiveRoute() {
  const path = (window.location.pathname || '').replace(/\/+$/, '').toLowerCase();
  const rawHash = (window.location.hash || '').toLowerCase().replace(/^#\/?/, '');
  const decodedHash = decodeURIComponent(rawHash).trim();

  // If someone accessed legacy hash or URL with space / capital letters
  if (path === '/privacy-policy' || path === '/privacy' || path === '/privacy-policy.html' || decodedHash === 'privacy-policy' || decodedHash === 'privacy policy' || decodedHash === 'privacy') {
    if (window.location.hash || path !== '/privacy-policy') {
      try { history.replaceState(null, '', '/privacy-policy'); } catch (_) {}
    }
    return 'privacy-policy';
  }
  if (path === '/terms-of-service' || path === '/terms' || path === '/terms-and-conditions' || path === '/terms-of-service.html' || decodedHash === 'terms-of-service' || decodedHash === 'terms' || decodedHash === 'terms-and-conditions' || decodedHash === 'terms & conditions') {
    if (window.location.hash || path !== '/terms-of-service') {
      try { history.replaceState(null, '', '/terms-of-service'); } catch (_) {}
    }
    return 'terms-of-service';
  }
  if (path === '/contact' || path === '/contact-us' || path === '/contact.html' || decodedHash === 'contact' || decodedHash === 'contact-us') {
    if (window.location.hash || path !== '/contact') {
      try { history.replaceState(null, '', '/contact'); } catch (_) {}
    }
    return 'contact';
  }
  if (path === '/about' || path === '/about-us' || path === '/about.html' || decodedHash === 'about' || decodedHash === 'about-us') {
    if (window.location.hash || path !== '/about') {
      try { history.replaceState(null, '', '/about'); } catch (_) {}
    }
    return 'about';
  }
  if (path === '/color-mix' || path === '/color-mix.html' || path === '/colormix' || decodedHash === 'color-mix' || decodedHash === 'color mix' || decodedHash === 'colormix') {
    if (window.location.hash || path !== '/color-mix') {
      try { history.replaceState(null, '', '/color-mix'); } catch (_) {}
    }
    return 'color-mix';
  }

  const hash = (window.location.hash || '').toLowerCase();
  if (hash === '#color-mix' || path === '/color-mix') return 'color-mix';
  if (hash === '#palettes' || hash === '#palette' || path === '/palettes' || path === '/palette') return 'palettes';
  if (hash === '#recently-viewed' || hash === '#recent' || path === '/recently-viewed' || path === '/recent') return 'recently-viewed';
  if (hash === '#saved' || hash === '#favorites' || path === '/favorites' || path === '/saved') return 'favorites';
  if (hash === '#colors' || hash === '#color-chart' || path === '/color-chart' || path === '/colors') return 'color-chart';
  if (hash === '#tools' || path === '/tools') return 'tools';
  if (hash === '#developer' || path === '/developer') return 'developer';
  return 'home';
}

function handleRoute() {
  const route = getActiveRoute();
  const homeView = $('#home-view');
  const pageView = $('#page-view');
  const pageContent = $('#page-content-body');

  const colorMixOverlay = $('#color-mix-overlay');
  const palettesOverlay = $('#palettes-overlay');

  if (route === 'palettes') {
    if (homeView) homeView.classList.remove('hidden');
    if (pageView) pageView.classList.remove('active');
    document.title = 'Color Palettes — Color Library';
    openCuratedPalettes();
    return;
  } else if (palettesOverlay && palettesOverlay.classList.contains('active')) {
    palettesOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  if (route === 'recently-viewed') {
    if (homeView) homeView.classList.remove('hidden');
    if (pageView) pageView.classList.remove('active');
    document.title = 'Recently Viewed — Color Library';
    const target = $('#recently-viewed');
    if (target) target.scrollIntoView({ behavior: 'smooth' });
    return;
  }

  if (route === 'color-mix') {
    if (homeView) homeView.classList.remove('hidden');
    if (pageView) pageView.classList.remove('active');
    document.title = 'Color Mix — Color Library';
    openColorMix();
    return;
  } else if (colorMixOverlay && colorMixOverlay.classList.contains('active')) {
    colorMixOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  if (route === 'favorites') {
    if (homeView) homeView.classList.remove('hidden');
    if (pageView) pageView.classList.remove('active');
    document.title = 'Favorites — Color Library';
    state.category = 'Saved';
    render();
    const target = $('#colors');
    if (target) target.scrollIntoView({ behavior: 'smooth' });
    return;
  }

  if (route === 'color-chart') {
    if (homeView) homeView.classList.remove('hidden');
    if (pageView) pageView.classList.remove('active');
    document.title = 'Color Chart — HTML Color Codes';
    const target = $('#colors');
    if (target) target.scrollIntoView({ behavior: 'smooth' });
    return;
  }

  if (route === 'tools') {
    if (homeView) homeView.classList.remove('hidden');
    if (pageView) pageView.classList.remove('active');
    document.title = 'Color Tools — Color Library';
    const target = $('#tools');
    if (target) target.scrollIntoView({ behavior: 'smooth' });
    return;
  }

  if (route === 'privacy-policy' || route === 'terms-of-service' || route === 'about' || route === 'contact') {
    closeMoreMenu();
    closeContentModal();
    if (palettesOverlay && palettesOverlay.classList.contains('active')) {
      palettesOverlay.classList.remove('active');
      document.body.style.overflow = '';
    }
    if (colorMixOverlay && colorMixOverlay.classList.contains('active')) {
      colorMixOverlay.classList.remove('active');
      document.body.style.overflow = '';
    }

    if (homeView) homeView.classList.add('hidden');
    if (pageView) pageView.classList.add('active');
    
    const page = pagesData[route] || pagesData['privacy-policy'];
    if (page) {
      document.title = `${page.title} — Color Library`;
    }
    
    if (page && pageContent) {
      pageContent.innerHTML = `
        <a href="/" class="page-back-btn" id="page-back-btn" aria-label="Back to Home">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          Back to Home
        </a>
        <h1>${page.title}</h1>
        ${(route === 'privacy-policy' || route === 'terms-of-service') ? `<div class="page-date">Last updated: September 2, 2026</div>` : ''}
        ${page.content}
        <div class="page-bottom-nav">
          <a href="/" class="page-back-btn" aria-label="Back to Home">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            Back to Home
          </a>
        </div>
      `;

      if (route === 'contact') {
        const contactForm = $('#contact-form');
        if (contactForm) {
          contactForm.onsubmit = (e) => {
            e.preventDefault();
            contactForm.reset();
            showToast('Thank you for your feedback!');
          };
        }
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (route === 'developer') {
    closeMoreMenu();
    if (homeView) homeView.classList.remove('hidden');
    if (pageView) pageView.classList.remove('active');
    openContentModal('developer');
  } else {
    document.title = 'Color Library — HTML Color Codes';
    if (homeView) homeView.classList.remove('hidden');
    if (pageView) pageView.classList.remove('active');
    closeMoreMenu();
    closeContentModal();
    if (window.location.hash === '#home' || window.location.hash === '#top' || !window.location.hash) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}

window.addEventListener('hashchange', handleRoute);
window.addEventListener('popstate', handleRoute);
window.addEventListener('DOMContentLoaded', handleRoute);

// Back to Top Button Logic
const backToTopBtn = $('#back-to-top-btn');
if (backToTopBtn) {
  let lastScrollY = window.scrollY;
  let isTicking = false;

  window.addEventListener('scroll', () => {
    if (!isTicking) {
      window.requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;
        
        if (currentScrollY <= 10) {
          backToTopBtn.classList.remove('show');
        } else if (currentScrollY > 450 && currentScrollY < lastScrollY) {
          // Scrolling up past threshold
          backToTopBtn.classList.add('show');
        } else if (currentScrollY > lastScrollY) {
          // Scrolling down
          backToTopBtn.classList.remove('show');
        }

        lastScrollY = currentScrollY;
        isTicking = false;
      });
      isTicking = true;
    }
  }, { passive: true });

  backToTopBtn.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
    backToTopBtn.classList.remove('show');
  });
}

/* ========================================================
   COLOR MIX MODE FUNCTIONALITY
   ======================================================== */

const SAVED_MIXES_KEY = 'colorLibrarySavedMixes';

const colorMixState = {
  angle: 135,
  stops: [
    { hex: '#3B82F6', pos: 0, name: 'Blue' },
    { hex: '#EC4899', pos: 100, name: 'Pink' }
  ],
  count: 2,
  comboName: null,
  selectedColors: [
    { name: 'Blue', hex: '#3B82F6' },
    { name: 'Pink', hex: '#EC4899' },
    { name: 'Purple', hex: '#8B5CF6' },
    { name: 'Teal', hex: '#14B8A6' },
    { name: 'Amber', hex: '#F59E0B' }
  ],
  currentMix: null,
  history: [],
  historyIndex: -1,
  activeSlotIndex: null,
  pickerCategory: 'All',
  pickerSearch: ''
};

function getSavedMixes() {
  try {
    const raw = localStorage.getItem(SAVED_MIXES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Error reading saved mixes:', err);
    return [];
  }
}

function saveSavedMixes(list) {
  try {
    localStorage.setItem(SAVED_MIXES_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('Error saving mixes:', err);
  }
}

function updateSavedMixesCountBadge() {
  const list = getSavedMixes();
  const badge = $('#color-mix-saved-count');
  if (badge) badge.textContent = list.length;
}

function hslToRgbValues(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255)
  ];
}

function rgbToHexCode(r, g, b) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [clamp(r), clamp(g), clamp(b)].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function findClosestColorName(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 'Custom Color';
  const [r, g, b] = rgb;
  let closestDist = Infinity;
  let closestColor = null;

  for (const c of colors) {
    const cRgb = hexToRgb(c.hex);
    if (!cRgb) continue;
    // Human perception weighted distance
    const dr = r - cRgb[0];
    const dg = g - cRgb[1];
    const db = b - cRgb[2];
    const dist = dr * dr * 2 + dg * dg * 4 + db * db * 3;
    if (dist < closestDist) {
      closestDist = dist;
      closestColor = c;
    }
  }

  if (closestColor) {
    return closestDist === 0 ? closestColor.name : closestColor.name;
  }
  return 'Generated Color';
}

function openColorMix() {
  const overlay = $('#color-mix-overlay');
  if (overlay) {
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    overlay.scrollTop = 0;
    updateSavedMixesCountBadge();
    renderColorStops();
    updateGradientDisplay();
  }
}

function closeColorMix() {
  const overlay = $('#color-mix-overlay');
  if (overlay && overlay.classList.contains('active')) {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
    if (window.location.pathname === '/color-mix') {
      try {
        history.pushState(null, '', '/');
      } catch (_) {
        window.location.href = '/';
        return;
      }
      handleRoute();
    } else if (window.location.hash === '#color-mix') {
      try {
        history.replaceState(null, '', window.location.pathname);
      } catch (_) {}
      handleRoute();
    }
  }
}

function updateGradientDisplay() {
  const stops = colorMixState.stops || [];
  if (stops.length < 2) return;
  const angle = colorMixState.angle || 135;

  const sortedStops = [...stops].sort((a, b) => a.pos - b.pos);
  const stopsCssPart = sortedStops.map(s => `${s.hex.toUpperCase()} ${s.pos}%`).join(', ');
  const gradientCss = `linear-gradient(${angle}deg, ${stopsCssPart})`;

  const stage = $('#mix-gradient-stage');
  if (stage) stage.style.background = gradientCss;

  const hexFlow = $('#mix-stage-hex-flow');
  if (hexFlow) {
    if (sortedStops.length > 2) {
      hexFlow.textContent = `${sortedStops[0].hex.toUpperCase()} • ${sortedStops.length} Colors • ${sortedStops[sortedStops.length - 1].hex.toUpperCase()}`;
    } else {
      hexFlow.textContent = `${sortedStops[0].hex.toUpperCase()} → ${sortedStops[sortedStops.length - 1].hex.toUpperCase()}`;
    }
  }

  const nameEl = $('#mix-stage-color-name');
  if (nameEl) {
    if (colorMixState.comboName) {
      nameEl.textContent = colorMixState.comboName;
    } else {
      const firstName = findClosestColorName(sortedStops[0].hex);
      const lastName = findClosestColorName(sortedStops[sortedStops.length - 1].hex);
      if (sortedStops.length > 2) {
        nameEl.textContent = `${sortedStops.length}-Color ${firstName} & ${lastName} Blend`;
      } else {
        nameEl.textContent = `${firstName} to ${lastName} Blend`;
      }
    }
  }

  const hexValPill = $('#mix-stage-hex-val');
  if (hexValPill) {
    hexValPill.textContent = `${angle}deg`;
  }

  const dotEl = $('#mix-stage-dot');
  if (dotEl) {
    dotEl.style.backgroundColor = sortedStops[0].hex;
  }

  const codeText = $('#mix-css-code-text');
  if (codeText) {
    codeText.textContent = `background: linear-gradient(\n  ${angle}deg, ${stopsCssPart}\n);`;
  }

  // Update angle chips active state
  document.querySelectorAll('.mix-angle-chip').forEach(chip => {
    const chipAngle = parseInt(chip.getAttribute('data-angle'), 10);
    chip.classList.toggle('active', chipAngle === angle);
  });
}

function renderColorStops() {
  const listEl = $('#mix-stops-list');
  if (!listEl) return;

  const stops = colorMixState.stops;

  // Sync mode count selector (2 to 7 colors)
  const countSelect = $('#mix-colors-count-select');
  if (countSelect) {
    countSelect.value = String(Math.max(2, Math.min(7, stops.length)));
  }

  // Update Add Stop button disabled appearance if at max (7)
  const addStopBtn = $('#mix-add-stop-btn');
  if (addStopBtn) {
    if (stops.length >= 7) {
      addStopBtn.classList.add('disabled');
      addStopBtn.title = 'Maximum 7 stops reached';
    } else {
      addStopBtn.classList.remove('disabled');
      addStopBtn.title = 'Add Color Stop';
    }
  }

  listEl.innerHTML = stops.map((stop, idx) => `
    <div class="mix-stop-row" data-stop-index="${idx}">
      <div class="mix-stop-swatch-wrap">
        <span class="mix-stop-swatch" style="background-color: ${stop.hex};"></span>
        <input type="color" class="mix-stop-color-input" value="${stop.hex}" data-color-idx="${idx}" aria-label="Color stop ${idx + 1}" />
      </div>
      <input type="text" class="mix-stop-hex-input" value="${stop.hex.toUpperCase()}" maxlength="7" spellcheck="false" data-hex-idx="${idx}" aria-label="Hex for stop ${idx + 1}" />
      <div class="mix-stop-slider-wrap">
        <input type="range" class="mix-stop-slider" min="0" max="100" value="${stop.pos}" data-slider-idx="${idx}" aria-label="Position for stop ${idx + 1}" />
        <span class="mix-stop-pos-val" id="mix-stop-pos-${idx}">${stop.pos}%</span>
      </div>
      <button type="button" class="mix-stop-del-btn" data-del-idx="${idx}" ${stops.length <= 2 ? 'disabled' : ''} aria-label="Delete stop ${idx + 1}" title="${stops.length <= 2 ? 'Minimum 2 stops required' : 'Delete stop'}">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    </div>
  `).join('');

  // Bind events for color inputs
  listEl.querySelectorAll('.mix-stop-color-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.colorIdx, 10);
      const newHex = e.target.value.toUpperCase();
      colorMixState.stops[idx].hex = newHex;
      const hexInput = listEl.querySelector(`.mix-stop-hex-input[data-hex-idx="${idx}"]`);
      if (hexInput) hexInput.value = newHex;
      const swatch = input.previousElementSibling;
      if (swatch) swatch.style.backgroundColor = newHex;
      updateGradientDisplay();
    });
  });

  // Bind events for hex text inputs
  listEl.querySelectorAll('.mix-stop-hex-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const idx = parseInt(e.target.dataset.hexIdx, 10);
      let val = e.target.value.trim();
      if (!val.startsWith('#')) val = '#' + val;
      if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
        val = val.toUpperCase();
        colorMixState.stops[idx].hex = val;
        e.target.value = val;
        const colorInput = listEl.querySelector(`.mix-stop-color-input[data-color-idx="${idx}"]`);
        if (colorInput) colorInput.value = val;
        const swatch = listEl.querySelector(`[data-stop-index="${idx}"] .mix-stop-swatch`);
        if (swatch) swatch.style.backgroundColor = val;
        updateGradientDisplay();
      } else {
        e.target.value = colorMixState.stops[idx].hex.toUpperCase();
      }
    });
  });

  // Bind events for slider position inputs
  listEl.querySelectorAll('.mix-stop-slider').forEach(slider => {
    slider.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.sliderIdx, 10);
      const pos = parseInt(e.target.value, 10);
      colorMixState.stops[idx].pos = pos;
      const posLabel = $(`#mix-stop-pos-${idx}`);
      if (posLabel) posLabel.textContent = `${pos}%`;
      updateGradientDisplay();
    });
  });

  // Bind events for delete buttons
  listEl.querySelectorAll('.mix-stop-del-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (colorMixState.stops.length <= 2) return;
      const idx = parseInt(btn.dataset.delIdx, 10);
      colorMixState.stops.splice(idx, 1);
      colorMixState.count = colorMixState.stops.length;
      renderColorStops();
      updateGradientDisplay();
      showToast('Stop removed');
    });
  });
}

function setGradientColorCount(newCount) {
  const targetCount = Math.max(2, Math.min(7, parseInt(newCount, 10) || 2));
  colorMixState.count = targetCount;
  const currentCount = colorMixState.stops.length;

  if (targetCount > currentCount) {
    const needed = targetCount - currentCount;
    const existingHexes = new Set(colorMixState.stops.map(s => s.hex.toUpperCase()));
    const candidates = colors.filter(c => !existingHexes.has(c.hex.toUpperCase()));
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);

    for (let i = 0; i < needed; i++) {
      const col = shuffled[i] || colors[Math.floor(Math.random() * colors.length)];
      colorMixState.stops.push({
        hex: col.hex.toUpperCase(),
        pos: 0,
        name: col.name
      });
    }
  } else if (targetCount < currentCount) {
    colorMixState.stops = colorMixState.stops.slice(0, targetCount);
  }

  // Redistribute stops evenly across 0% to 100%
  colorMixState.stops.forEach((stop, idx) => {
    stop.pos = Math.round((idx / (targetCount - 1)) * 100);
  });

  renderColorStops();
  updateGradientDisplay();
  showToast(`✓ Set to ${targetCount} Colors mix mode`);
}

function addGradientStop() {
  if (colorMixState.stops.length >= 7) {
    showToast('Maximum 7 color stops allowed');
    return;
  }
  openMixPicker(null, 'add-stop');
}

function addGradientStopWithColor(color) {
  if (colorMixState.stops.length >= 7) {
    showToast('Maximum 7 color stops allowed');
    return;
  }
  const hex = color.hex.toUpperCase();
  const name = color.name || findClosestColorName(hex);

  // Intelligently position new stop in the largest gap between existing stops
  const currentStops = [...colorMixState.stops].sort((a, b) => a.pos - b.pos);
  let newPos = 50;
  if (currentStops.length === 2) {
    newPos = 50;
  } else if (currentStops.length >= 3) {
    let maxGap = -1;
    let bestPos = 50;
    for (let i = 0; i < currentStops.length - 1; i++) {
      const gap = currentStops[i + 1].pos - currentStops[i].pos;
      if (gap > maxGap) {
        maxGap = gap;
        bestPos = Math.round((currentStops[i].pos + currentStops[i + 1].pos) / 2);
      }
    }
    newPos = bestPos;
  }

  colorMixState.stops.push({
    hex,
    pos: newPos,
    name
  });

  colorMixState.count = colorMixState.stops.length;
  colorMixState.stops.sort((a, b) => a.pos - b.pos);
  renderColorStops();
  updateGradientDisplay();
  showToast(`✓ Added ${name} (${hex}) stop`);
}

// Curated Top 10k Master Color Combinations (Iconic 7-stop ramps from world-class designs)
const WORLD_TOP_MASTER_PALETTES = [
  { name: 'Tokyo Cyberpunk', colors: ['#0D0221', '#541388', '#F72585', '#7209B7', '#3A0CA3', '#4361EE', '#4CC9F0'] },
  { name: 'Sunset Horizon', colors: ['#FF0844', '#FF4E50', '#F9D423', '#F857A6', '#FF5858', '#FF6A00', '#EE0979'] },
  { name: 'Nordic Aurora', colors: ['#0575E6', '#00F260', '#24FE41', '#38EF7D', '#11998E', '#00C9FF', '#92FE9D'] },
  { name: 'Rose Gold Elegance', colors: ['#3D0C11', '#8C1D40', '#C56C86', '#F8A5C2', '#F78FB3', '#F5CD79', '#FFF3EB'] },
  { name: 'Deep Oceanic Abyss', colors: ['#020024', '#090979', '#0072B5', '#00D4FF', '#2BD9FE', '#A0E9FF', '#E2F7FE'] },
  { name: 'Emerald Sanctuary', colors: ['#051F20', '#0B2B26', '#163832', '#235347', '#8EB69B', '#38EF7D', '#DAF1DE'] },
  { name: 'Royal Amethyst & Topaz', colors: ['#2E0854', '#4B1278', '#6A0572', '#AB2A7E', '#D9822B', '#E5A93C', '#FCE38A'] },
  { name: 'California Peach Bloom', colors: ['#FA709A', '#FEE140', '#FFA07A', '#FF6B6B', '#FF7E67', '#FDAC53', '#FEE5A5'] },
  { name: 'Mediterranean Azure', colors: ['#002244', '#005F73', '#0A9396', '#94D2BD', '#E9D8A6', '#EE9B00', '#CA6702'] },
  { name: 'Kyoto Cherry Blossom', colors: ['#355C7D', '#6C5B7B', '#C06C84', '#F67280', '#F8B195', '#FFECCC', '#FFF5EB'] },
  { name: 'Velvet Espresso & Ochre', colors: ['#1A0C08', '#381D14', '#5E3023', '#895737', '#C08552', '#DAB49D', '#F3E9DC'] },
  { name: 'Synthwave Neon Dusk', colors: ['#1B003A', '#49117C', '#8C1F94', '#D43790', '#EC627A', '#F9957F', '#FDD5B1'] },
  { name: 'Matcha Cream & Olive', colors: ['#1E2D24', '#3E5641', '#668066', '#A3B18A', '#DAD7CD', '#F4F1DE', '#FAF9F6'] },
  { name: 'Electric Hyper-Pop', colors: ['#08F7FE', '#09FBD3', '#FE53BB', '#F5D300', '#7122FA', '#FF2A85', '#00E8C6'] },
  { name: 'Opal Holographic Mist', colors: ['#74EBD5', '#9FACE6', '#FFB199', '#FF0844', '#FEE140', '#FA709A', '#B0EDFD'] },
  { name: 'Mystic Indigo Nebula', colors: ['#0A091A', '#201658', '#1D24CA', '#98E4FF', '#FF0080', '#7928CA', '#4318FF'] },
  { name: 'Sahara Terracotta Sun', colors: ['#261108', '#59200B', '#9A3412', '#C2410C', '#EA580C', '#FDBA74', '#FFEDD5'] },
  { name: 'French Riviera Chic', colors: ['#003049', '#D62828', '#F77F00', '#FCBF49', '#EAE2B7', '#5BC0BE', '#3A506B'] },
  { name: 'Midnight Violet Glow', colors: ['#050510', '#100B2B', '#27084A', '#580A77', '#A01A7D', '#E24B6A', '#FF9671'] },
  { name: 'Alpine Glacier Peak', colors: ['#0F1E36', '#1E3A5F', '#2C698D', '#4192A8', '#8ADBE5', '#C7F9CC', '#EDF6F9'] },
  { name: 'Warm Amber & Honey', colors: ['#3A1C00', '#632B00', '#9E4700', '#D97706', '#F59E0B', '#FCD34D', '#FEF3C7'] },
  { name: 'Lavender Haze Twilight', colors: ['#161026', '#2F2052', '#583D72', '#9F5F80', '#FF8474', '#FFC1B6', '#FCEFEF'] },
  { name: 'Cyber Mint & Plum', colors: ['#140152', '#020122', '#22007C', '#49117C', '#00FFC6', '#00BFA5', '#64FFDA'] },
  { name: 'Tuscan Vineyard', colors: ['#1E0F1C', '#421930', '#741D43', '#B22234', '#D46A6A', '#EBB071', '#F5E6CC'] },
  { name: 'Bioluminescent Reef', colors: ['#03071E', '#0A2540', '#0077B6', '#00B4D8', '#48CAE4', '#00F5D4', '#E0FBFC'] },
  { name: 'Golden Hour Radiance', colors: ['#2C0E37', '#621B59', '#A82B69', '#E04E59', '#FF8A50', '#FFC857', '#FFE8B0'] },
  { name: 'Sage Botanical Leaf', colors: ['#1F2421', '#334139', '#536B5E', '#7F9C8B', '#A8C3B1', '#CCE3DE', '#EAF4F4'] },
  { name: 'Crimson Velvet & Noir', colors: ['#0D0208', '#250902', '#38040E', '#640D14', '#800E13', '#AD2831', '#D44D5C'] },
  { name: 'Tropical Lagoon Bliss', colors: ['#004E64', '#00A5CF', '#25A18E', '#7AE582', '#9FFFCB', '#FFD166', '#EF476F'] },
  { name: 'Cupertino Pro Horizon', colors: ['#0F1117', '#1A1D27', '#252D3D', '#3B82F6', '#8B5CF6', '#EC4899', '#F43F5E'] },
  { name: 'Dribbble Curated Velvet', colors: ['#111827', '#1F2937', '#4F46E5', '#7C3AED', '#C026D3', '#DB2777', '#F59E0B'] },
  { name: 'Vogue Haute Glamour', colors: ['#0A0A0A', '#1C1C1C', '#333333', '#555555', '#888888', '#CCCCCC', '#F7F7F7'] },
  { name: 'Cosmic Starlight Halo', colors: ['#03001C', '#301E67', '#5B8FB9', '#B6EADA', '#E3F4F4', '#FFD369', '#EEEEEE'] },
  { name: 'Sunset Sorbet Delight', colors: ['#4A0E4E', '#811762', '#B82376', '#EB4D55', '#FF7F50', '#FFA07A', '#FFE4E1'] },
  { name: 'Nordic Pine & Lichen', colors: ['#0B1D12', '#143621', '#215937', '#388659', '#52AA76', '#8FCDA4', '#D4EEDB'] },
  { name: 'Solar Flare Corona', colors: ['#300000', '#6B0000', '#B30000', '#FF2A00', '#FF7300', '#FFB700', '#FFFF66'] },
  { name: 'Twilight Ocean Mist', colors: ['#061121', '#0E2948', '#174A74', '#2072A1', '#33A3CF', '#68CEEE', '#B4EDFD'] },
  { name: 'Mulberry & Champagne', colors: ['#240024', '#470047', '#730073', '#A81C7E', '#D94B8A', '#F799B5', '#FFF0F5'] },
  { name: 'Sedona Red Rocks', colors: ['#331005', '#5C1D0A', '#8F2F12', '#C4461C', '#E26D3B', '#F19E6E', '#FAD5BC'] },
  { name: 'Starfall Galaxy', colors: ['#080417', '#1A0C38', '#341666', '#5C2499', '#903DD1', '#C471ED', '#F64F59'] }
];

// Procedural archetypes for producing 10,000+ harmonic color ramps
const TOP_10K_ARCHETYPES = [
  { name: 'Sunset Radiance', baseHue: 345, span: 85, satMin: 72, satMax: 94, lightMin: 32, lightMax: 70 },
  { name: 'Nordic Polar Aurora', baseHue: 175, span: 95, satMin: 68, satMax: 92, lightMin: 30, lightMax: 72 },
  { name: 'Tokyo Cyberpunk Neon', baseHue: 275, span: 135, satMin: 78, satMax: 96, lightMin: 24, lightMax: 68 },
  { name: 'Rose Gold & Champagne', baseHue: 340, span: 60, satMin: 55, satMax: 82, lightMin: 28, lightMax: 84 },
  { name: 'Emerald Oasis & Mint', baseHue: 150, span: 70, satMin: 58, satMax: 86, lightMin: 22, lightMax: 74 },
  { name: 'Imperial Amethyst & Gold', baseHue: 280, span: 165, satMin: 70, satMax: 90, lightMin: 25, lightMax: 76 },
  { name: 'California Peach Bloom', baseHue: 15, span: 65, satMin: 72, satMax: 95, lightMin: 45, lightMax: 82 },
  { name: 'Deep Oceanic Abyss', baseHue: 215, span: 55, satMin: 75, satMax: 95, lightMin: 18, lightMax: 72 },
  { name: 'Velvet Espresso & Ochre', baseHue: 25, span: 45, satMin: 45, satMax: 75, lightMin: 16, lightMax: 78 },
  { name: 'Kyoto Pastel Dream', baseHue: 290, span: 90, satMin: 48, satMax: 72, lightMin: 62, lightMax: 88 },
  { name: 'Deep Space Cosmic', baseHue: 245, span: 115, satMin: 70, satMax: 95, lightMin: 14, lightMax: 65 },
  { name: 'Botanical Sage & Olive', baseHue: 95, span: 65, satMin: 35, satMax: 65, lightMin: 24, lightMax: 76 },
  { name: 'Electric Hyper-Pop', baseHue: 185, span: 180, satMin: 85, satMax: 98, lightMin: 42, lightMax: 72 },
  { name: 'Golden Hour Sunbeam', baseHue: 32, span: 50, satMin: 78, satMax: 96, lightMin: 30, lightMax: 78 },
  { name: 'Alpine Glacier & Frost', baseHue: 195, span: 60, satMin: 60, satMax: 85, lightMin: 26, lightMax: 82 },
  { name: 'Vibrant Tropicana', baseHue: 330, span: 125, satMin: 80, satMax: 96, lightMin: 38, lightMax: 74 }
];

function samplePaletteColors(hexList, count) {
  if (count <= 1) return [hexList[0]];
  if (count >= hexList.length) return hexList.slice(0, count);
  const sampled = [];
  const maxIdx = hexList.length - 1;
  for (let i = 0; i < count; i++) {
    const idx = Math.round((i / (count - 1)) * maxIdx);
    sampled.push(hexList[idx]);
  }
  return sampled;
}

function generateProceduralTop10kCombo(count) {
  const archetype = TOP_10K_ARCHETYPES[Math.floor(Math.random() * TOP_10K_ARCHETYPES.length)];
  const comboNumber = Math.floor(Math.random() * 9999) + 1;
  const comboName = `${archetype.name} #${comboNumber.toLocaleString()}`;

  const baseHue = (archetype.baseHue + (Math.random() - 0.5) * 30 + 360) % 360;
  const isReverse = Math.random() > 0.5;

  const hexes = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const progress = isReverse ? (1 - t) : t;
    const hue = (baseHue + progress * archetype.span + 360) % 360;
    const sat = archetype.satMin + Math.random() * (archetype.satMax - archetype.satMin);
    const light = archetype.lightMin + progress * (archetype.lightMax - archetype.lightMin);

    const rgb = hslToRgbValues(hue, sat, light);
    const hex = rgbToHexCode(rgb[0], rgb[1], rgb[2]);
    hexes.push(hex);
  }

  const colors = hexes.map(hex => ({
    hex,
    name: findClosestColorName(hex)
  }));

  return { name: comboName, colors };
}

function getTop10kBestColorCombo(count) {
  // Balance between the curated master palettes and the procedural 10,000+ harmonic engine
  const useCurated = Math.random() < 0.45;
  if (useCurated) {
    const pal = WORLD_TOP_MASTER_PALETTES[Math.floor(Math.random() * WORLD_TOP_MASTER_PALETTES.length)];
    const hexList = (Math.random() > 0.5) ? [...pal.colors].reverse() : [...pal.colors];
    const sampledHexes = samplePaletteColors(hexList, count);
    return {
      name: pal.name,
      colors: sampledHexes.map(hex => ({
        hex: hex.toUpperCase(),
        name: findClosestColorName(hex)
      }))
    };
  }

  return generateProceduralTop10kCombo(count);
}

function randomizeGradient() {
  // Use user-selected mode count (2 to 7), fallback to current stops count
  const count = Math.max(2, Math.min(7, colorMixState.count || colorMixState.stops.length || 2));
  colorMixState.count = count;

  const angles = [45, 90, 135, 180, 225];
  colorMixState.angle = angles[Math.floor(Math.random() * angles.length)];

  // Update angle chip UI
  document.querySelectorAll('.mix-angle-chip').forEach(chip => {
    const chipAngle = parseInt(chip.dataset.angle, 10);
    chip.classList.toggle('active', chipAngle === colorMixState.angle);
  });

  // Pull a world-class color combo from the Top 10k best color combos collection
  const combo = getTop10kBestColorCombo(count);
  colorMixState.comboName = combo.name;

  // Re-generate stops with selected count and even position spacing
  colorMixState.stops = combo.colors.map((col, idx) => ({
    hex: col.hex.toUpperCase(),
    pos: Math.round((idx / (count - 1)) * 100),
    name: col.name
  }));

  renderColorStops();
  updateGradientDisplay();
  showToast(`✨ Top 10k Combo: ${combo.name} (${count} Colors)`);
}

function copyGradientCss() {
  const stops = [...colorMixState.stops].sort((a, b) => a.pos - b.pos);
  const angle = colorMixState.angle || 135;
  const stopsCssPart = stops.map(s => `${s.hex.toUpperCase()} ${s.pos}%`).join(', ');
  const css = `background: linear-gradient(${angle}deg, ${stopsCssPart});`;

  copyText(css).then(() => {
    const btnText = $('#mix-css-copy-btn-text');
    const copyBtn = $('#mix-css-copy-btn');
    if (btnText) btnText.textContent = 'Copied!';
    if (copyBtn) copyBtn.classList.add('copied');
    showToast('✓ CSS gradient copied to clipboard!');

    setTimeout(() => {
      if (btnText) btnText.textContent = 'Copy';
      if (copyBtn) copyBtn.classList.remove('copied');
    }, 2000);
  });
}

function saveCurrentGradient() {
  const stops = [...colorMixState.stops].sort((a, b) => a.pos - b.pos);
  const angle = colorMixState.angle || 135;
  const stopsCssPart = stops.map(s => `${s.hex.toUpperCase()} ${s.pos}%`).join(', ');
  const gradientCss = `linear-gradient(${angle}deg, ${stopsCssPart})`;
  
  let name = colorMixState.comboName;
  if (!name) {
    const firstName = findClosestColorName(stops[0].hex);
    const lastName = findClosestColorName(stops[stops.length - 1].hex);
    name = `${firstName} to ${lastName} Gradient`;
  } else if (!name.toLowerCase().includes('gradient')) {
    name = `${name} Gradient`;
  }

  const item = {
    id: 'gradient_' + Date.now(),
    name,
    angle,
    stops: stops.map(s => ({ ...s })),
    gradientCss,
    hex: stops[0].hex,
    hexes: stops.map(s => s.hex),
    inputHexFlow: `${stops[0].hex.toUpperCase()} → ${stops[stops.length - 1].hex.toUpperCase()}`,
    date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  };

  const list = getSavedMixes();
  list.unshift(item);
  saveSavedMixes(list);
  updateSavedMixesCountBadge();

  const saveBtn = $('#mix-save-gradient-btn');
  if (saveBtn) {
    const origHtml = saveBtn.innerHTML;
    saveBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      <span>Saved!</span>
    `;
    setTimeout(() => {
      saveBtn.innerHTML = origHtml;
    }, 2000);
  }

  showToast(`♥ Saved "${name}" to favorites!`);
}

function updateMixCount(newCount) {
  const count = Math.max(2, Math.min(5, newCount));
  colorMixState.count = count;

  const text = $('#mix-count-text');
  if (text) text.textContent = `${count} Colors`;

  const decBtn = $('#mix-dec-btn');
  const incBtn = $('#mix-inc-btn');
  if (decBtn) decBtn.disabled = count <= 2;
  if (incBtn) incBtn.disabled = count >= 5;

  renderMixSlots();
}

function renderMixSlots() {
  const container = $('#mix-slots-container');
  if (!container) return;

  const count = colorMixState.count;
  let html = '';

  for (let i = 0; i < count; i++) {
    const color = colorMixState.selectedColors[i];
    if (color && color.hex) {
      html += `
        <div class="mix-slot-item" data-slot-index="${i}" role="button" tabindex="0" aria-label="Change Color ${i + 1}: ${escapeHtml(color.name)} ${color.hex}">
          <div class="mix-slot-label-group">
            <span class="mix-slot-num">Color ${i + 1}</span>
            <span class="mix-slot-color-name">${escapeHtml(color.name)}</span>
          </div>
          <div class="mix-slot-pill">
            <span class="mix-slot-swatch" style="background-color: ${color.hex};"></span>
            <span class="mix-slot-hex">${color.hex}</span>
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="mix-slot-item" data-slot-index="${i}" role="button" tabindex="0" aria-label="Select Color ${i + 1}">
          <div class="mix-slot-label-group">
            <span class="mix-slot-num">Color ${i + 1}</span>
            <span class="mix-slot-empty-btn">[ Select Color ]</span>
          </div>
          <div class="mix-slot-pill">
            <span class="mix-slot-swatch" style="background-color: #f1f5f9; border-style: dashed;"></span>
            <span class="mix-slot-hex">#------</span>
          </div>
        </div>
      `;
    }
  }

  container.innerHTML = html;

  container.querySelectorAll('.mix-slot-item').forEach((slot) => {
    slot.addEventListener('click', () => {
      const idx = parseInt(slot.dataset.slotIndex, 10);
      openMixPicker(idx);
    });
    slot.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const idx = parseInt(slot.dataset.slotIndex, 10);
        openMixPicker(idx);
      }
    });
  });

  if (smokyRendererInstance && colorMixState.selectedColors) {
    const c1 = colorMixState.selectedColors[0]?.hex;
    const c2 = colorMixState.selectedColors[1]?.hex || colorMixState.selectedColors[0]?.hex;
    smokyRendererInstance.updateColors(c1, c2);
  }
}

function selectRandomBaseColors() {
  const count = colorMixState.count;
  const combo = getTop10kBestColorCombo(count);

  for (let i = 0; i < count; i++) {
    colorMixState.selectedColors[i] = combo.colors[i];
  }

  renderMixSlots();
  generateColorMix(true);
  showToast(`✨ Top 10k Combo: ${combo.name}`);
}

function generateColorMix(isShuffle = false) {
  const count = colorMixState.count;
  const baseColors = [];

  // Ensure all current slots have a valid color
  for (let i = 0; i < count; i++) {
    let c = colorMixState.selectedColors[i];
    if (!c || !c.hex) {
      const fallback = colors[(i * 37 + 13) % colors.length];
      c = { name: fallback.name, hex: fallback.hex };
      colorMixState.selectedColors[i] = c;
    }
    baseColors.push(c);
  }

  renderMixSlots();

  // 1. Format input HEX flow at top (e.g. #4b6cb7 → #182848)
  const inputHexes = baseColors.map((c) => c.hex.toUpperCase());
  const inputHexFlow = inputHexes.join(' → ');

  // 2. Smooth gradient of the entire result area based on selected input colors
  const gradientCss = `linear-gradient(135deg, ${inputHexes.join(', ')})`;

  // 3. Generate EXACTLY ONE final mixed color from input colors
  const rawWeights = baseColors.map(() => 0.8 + (Math.random() - 0.5) * (isShuffle ? 0.9 : 0.6));
  const weightSum = rawWeights.reduce((a, b) => a + b, 0);
  const weights = rawWeights.map((w) => w / weightSum);

  // Gamma-corrected RGB mixing
  let linR = 0, linG = 0, linB = 0;
  for (let i = 0; i < count; i++) {
    const rgb = hexToRgb(baseColors[i].hex) || [100, 100, 100];
    linR += weights[i] * Math.pow(rgb[0] / 255, 2.2);
    linG += weights[i] * Math.pow(rgb[1] / 255, 2.2);
    linB += weights[i] * Math.pow(rgb[2] / 255, 2.2);
  }
  let r = Math.round(255 * Math.pow(Math.max(0, linR), 1 / 2.2));
  let g = Math.round(255 * Math.pow(Math.max(0, linG), 1 / 2.2));
  let b = Math.round(255 * Math.pow(Math.max(0, linB), 1 / 2.2));

  // Angular hue calculation in HSL space for vibrant preservation
  let sinSum = 0, cosSum = 0;
  let totalSat = 0, totalLight = 0;
  for (let i = 0; i < count; i++) {
    const rgb = hexToRgb(baseColors[i].hex) || [100, 100, 100];
    const [hBase, sBase, lBase] = rgbToHsl(rgb);
    const rad = (hBase * Math.PI) / 180;
    sinSum += weights[i] * Math.sin(rad);
    cosSum += weights[i] * Math.cos(rad);
    totalSat += weights[i] * sBase;
    totalLight += weights[i] * lBase;
  }

  let finalHue = (Math.atan2(sinSum, cosSum) * 180 / Math.PI + 360) % 360;
  // Always apply Hue jitter: non-shuffle ±12°, shuffle ±20°
  const hueJitterRange = isShuffle ? 40 : 24;
  const hueJitter = (Math.random() - 0.5) * hueJitterRange;
  finalHue = (finalHue + hueJitter + 360) % 360;

  // Preserve vibrancy so the single mixed color does not turn to dull gray
  let [, baseS] = rgbToHsl([r, g, b]);
  let finalSat = Math.max(baseS, totalSat * 0.85);
  if (finalSat < 38) {
    finalSat = 38 + Math.random() * 24;
  } else {
    finalSat = Math.max(38, Math.min(92, Math.round(finalSat + (Math.random() - 0.5) * 6)));
  }

  // Lightness calibration for clear visual appeal
  let finalLight = totalLight * 0.9;
  // Always apply Lightness jitter: non-shuffle ±8, shuffle ±14
  const lightJitterRange = isShuffle ? 28 : 16;
  finalLight += (Math.random() - 0.5) * lightJitterRange;
  finalLight = Math.max(25, Math.min(78, Math.round(finalLight)));

  let finalRgb = hslToRgbValues(finalHue, finalSat, finalLight);
  let finalHex = rgbToHexCode(finalRgb[0], finalRgb[1], finalRgb[2]);

  // Safety-net check: if new finalHex matches previous mix, forcibly shift lightness by ±10 to guarantee distinct output
  const previousMix = colorMixState.currentMix || colorMixState.history[colorMixState.historyIndex];
  if (previousMix && previousMix.hex && finalHex.toUpperCase() === previousMix.hex.toUpperCase()) {
    const shiftDirection = finalLight > 60 ? -1 : (finalLight < 40 ? 1 : (Math.random() > 0.5 ? 1 : -1));
    finalLight = Math.max(20, Math.min(82, Math.round(finalLight + shiftDirection * 10)));
    finalRgb = hslToRgbValues(finalHue, finalSat, finalLight);
    finalHex = rgbToHexCode(finalRgb[0], finalRgb[1], finalRgb[2]);
  }

  const finalName = findClosestColorName(finalHex);

  const newMix = {
    id: 'mix_' + Date.now(),
    hex: finalHex,
    name: finalName,
    rgb: finalRgb,
    rgbStr: `${finalRgb[0]}, ${finalRgb[1]}, ${finalRgb[2]}`,
    hsl: [Math.round(finalHue), Math.round(finalSat), Math.round(finalLight)],
    hslStr: `${Math.round(finalHue)}°, ${Math.round(finalSat)}%, ${Math.round(finalLight)}%`,
    inputHexFlow,
    gradientCss,
    baseColors: baseColors.map((c) => ({ name: c.name, hex: c.hex }))
  };

  // Push to history for navigation arrows
  colorMixState.history.push(newMix);
  colorMixState.historyIndex = colorMixState.history.length - 1;
  colorMixState.currentMix = newMix;

  addRecentlyViewed({
    type: 'palette',
    title: `${newMix.name} Mix`,
    colors: baseColors.map((c) => c.hex)
  });

  renderCurrentMixResult();
}

function renderCurrentMixResult() {
  const emptyState = $('#mix-empty-state');
  const resultContainer = $('#mix-result-container');
  const mix = colorMixState.currentMix || colorMixState.history[colorMixState.historyIndex];

  if (!mix) {
    if (emptyState) emptyState.style.display = 'block';
    if (resultContainer) resultContainer.style.display = 'none';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (resultContainer) resultContainer.style.display = 'flex';

  // 1. Smooth gradient background for the entire result area
  const stage = $('#mix-gradient-stage');
  if (stage) {
    stage.style.background = mix.gradientCss;
  }

  // 2. Top HEX flow (e.g. #4b6cb7 → #182848)
  const hexFlow = $('#mix-stage-hex-flow');
  if (hexFlow) {
    hexFlow.textContent = mix.inputHexFlow;
  }

  // Counter indicator (e.g. 1 / 3)
  const counter = $('#mix-stage-counter');
  if (counter) {
    if (colorMixState.history.length > 1) {
      counter.style.display = 'inline-block';
      counter.textContent = `${colorMixState.historyIndex + 1} / ${colorMixState.history.length}`;
    } else {
      counter.style.display = 'none';
    }
  }

  // 3. Navigation Arrows to cycle through single-color results
  const prevBtn = $('#mix-nav-prev');
  const nextBtn = $('#mix-nav-next');
  if (prevBtn) {
    prevBtn.disabled = (colorMixState.historyIndex <= 0);
  }
  if (nextBtn) {
    nextBtn.disabled = (colorMixState.historyIndex >= colorMixState.history.length - 1);
  }

  // 4. Center: Generated Color Name & Single Result Pill
  const nameEl = $('#mix-stage-color-name');
  if (nameEl) {
    nameEl.textContent = mix.name;
  }

  const hexValPill = $('#mix-stage-hex-val');
  if (hexValPill) {
    hexValPill.textContent = mix.hex;
  }

  const dotEl = $('#mix-stage-dot');
  if (dotEl) {
    dotEl.style.backgroundColor = mix.hex;
  }

  // 5. Under Result: HEX, RGB, HSL
  const valHex = $('#mix-val-hex');
  if (valHex) valHex.textContent = mix.hex;

  const valRgb = $('#mix-val-rgb');
  if (valRgb) valRgb.textContent = mix.rgbStr;

  const valHsl = $('#mix-val-hsl');
  if (valHsl) valHsl.textContent = mix.hslStr;

  // 6. Favorite button state
  updateSingleMixFavState(mix.hex);

  // 7. Dynamic random color/gradient on Generate Again button
  const genAgainBtn = $('#mix-generate-again-btn');
  if (genAgainBtn) {
    const vibrantGradients = [
      'linear-gradient(135deg, #8b5cf6, #ec4899)',
      'linear-gradient(135deg, #3b82f6, #06b6d4)',
      'linear-gradient(135deg, #f59e0b, #ef4444)',
      'linear-gradient(135deg, #10b981, #3b82f6)',
      'linear-gradient(135deg, #ec4899, #f97316)',
      'linear-gradient(135deg, #6366f1, #a855f7)',
      'linear-gradient(135deg, #14b8a6, #84cc16)',
      'linear-gradient(135deg, #d946ef, #0284c7)'
    ];
    const pickedGrad = vibrantGradients[Math.floor(Math.random() * vibrantGradients.length)];
    genAgainBtn.style.background = pickedGrad;
  }
}

function updateSingleMixFavState(hex) {
  const btn = $('#mix-fav-single-btn');
  if (!btn || !hex) return;
  const upperHex = hex.toUpperCase();
  const list = typeof getSavedMixes === 'function' ? getSavedMixes() : [];
  const isFav = list.some((item) => (item.hex || '').toUpperCase() === upperHex);
  btn.classList.toggle('is-fav', isFav);
  btn.title = isFav ? 'Remove from saved mixes' : 'Save mixed color';
  btn.setAttribute('aria-label', isFav ? `Remove ${hex} from saved mixes` : `Save ${hex} to saved mixes`);
  btn.innerHTML = getHeartSvg(isFav, 20);
}

function toggleSingleMixFavorite() {
  const mix = colorMixState.currentMix || colorMixState.history[colorMixState.historyIndex];
  if (!mix || !mix.hex) {
    showToast('Generate a color mix first');
    return;
  }

  const hex = mix.hex.toUpperCase();
  const list = getSavedMixes();
  const existingIdx = list.findIndex((item) => (item.hex || '').toUpperCase() === hex);
  const isCurrentlyFav = existingIdx >= 0;
  const btn = $('#mix-fav-single-btn');

  if (isCurrentlyFav) {
    // Remove from Color Mix saved list
    list.splice(existingIdx, 1);
    saveSavedMixes(list);
    updateSavedMixesCountBadge();
    updateSingleMixFavState(mix.hex);

    if (btn) {
      btn.classList.remove('animating');
      void btn.offsetWidth;
      btn.classList.add('animating');
    }
    showToast(`Removed "${mix.name || hex}" from saved mixes`);
  } else {
    // Save to Color Mix saved list in localStorage (independent from normal catalog favorites)
    const colorName = mix.name || (typeof findClosestColorName === 'function' ? findClosestColorName(mix.hex) : 'Custom Mix') || 'Custom Mix';
    const savedItem = {
      id: mix.id || 'mix_' + Date.now(),
      hex: mix.hex,
      name: colorName,
      rgb: mix.rgb || hexToRgb(mix.hex) || [0, 0, 0],
      rgbStr: mix.rgbStr || (mix.rgb ? mix.rgb.join(', ') : ''),
      hsl: mix.hsl || (hexToRgb(mix.hex) ? rgbToHsl(hexToRgb(mix.hex)) : [0, 0, 50]),
      hslStr: mix.hslStr || '',
      inputHexFlow: mix.inputHexFlow || (mix.baseColors ? mix.baseColors.map(c => c.hex).join(' + ') : mix.hex),
      gradientCss: mix.gradientCss || `linear-gradient(135deg, ${mix.hex}, ${mix.hex})`,
      baseColors: mix.baseColors || (colorMixState.selectedColors ? colorMixState.selectedColors.slice(0, colorMixState.count) : []),
      date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    };

    list.unshift(savedItem);
    saveSavedMixes(list);
    updateSavedMixesCountBadge();
    updateSingleMixFavState(mix.hex);

    if (btn) {
      btn.classList.remove('animating');
      void btn.offsetWidth;
      btn.classList.add('animating');
    }
    showToast(`♥ Saved "${colorName}" (${mix.hex}) to Color Mix!`);
  }
}

let copyHexTimer = null;
let copyHexInterval = null;
let copyHexHideTimer = null;

function copyCurrentMixHex() {
  const mix = colorMixState.currentMix || colorMixState.history[colorMixState.historyIndex];
  if (!mix) {
    showToast('Generate a mix first');
    return;
  }

  const btn = $('#mix-copy-hex-btn');
  const progressEl = $('#mix-copy-progress');

  copyText(mix.hex).then(() => {
    showToast(`✓ ${mix.hex} copied`);
  });

  if (!btn) return;

  // Clear any existing active animation loops
  if (copyHexTimer) clearTimeout(copyHexTimer);
  if (copyHexInterval) clearInterval(copyHexInterval);
  if (copyHexHideTimer) clearTimeout(copyHexHideTimer);

  // Set copied state (blurs out original content)
  btn.classList.add('is-copied');
  btn.classList.remove('show-confirmation');
  if (progressEl) progressEl.style.width = '0%';

  // Delay showing confirmation to allow smooth blur-out animation
  copyHexTimer = setTimeout(() => {
    btn.classList.add('show-confirmation');
  }, 400);

  const duration = 2800;
  const startTime = Date.now();

  copyHexInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min((elapsed / duration) * 100, 100);
    if (progressEl) {
      progressEl.style.width = `${progress}%`;
    }

    if (elapsed >= duration) {
      clearInterval(copyHexInterval);
      btn.classList.remove('show-confirmation');
      copyHexHideTimer = setTimeout(() => {
        btn.classList.remove('is-copied');
        if (progressEl) progressEl.style.width = '0%';
      }, 400);
    }
  }, 16);
}

/* Color Picker Modal (Slots & Gradient Stops) */
function openMixPicker(targetIndex = null, mode = 'slot') {
  colorMixState.pickerMode = mode;
  colorMixState.activeSlotIndex = mode === 'slot' ? targetIndex : null;
  colorMixState.activeStopIndex = mode === 'edit-stop' ? targetIndex : null;
  colorMixState.pickerSearch = '';
  colorMixState.pickerCategory = 'All';

  const overlay = $('#mix-picker-overlay');
  const searchInput = $('#mix-picker-search');
  const modalTitle = $('#mix-picker-modal-title');
  const modalSub = overlay ? overlay.querySelector('.mix-picker-sub') : null;

  if (modalTitle) {
    if (mode === 'add-stop') {
      modalTitle.textContent = 'Add Color Stop';
      if (modalSub) modalSub.textContent = 'Search by color name or enter any color code (HEX)';
    } else if (mode === 'edit-stop') {
      modalTitle.textContent = `Edit Color Stop ${targetIndex !== null ? targetIndex + 1 : 1}`;
      if (modalSub) modalSub.textContent = 'Search by color name or enter any color code (HEX)';
    } else {
      modalTitle.textContent = `Select Color ${targetIndex !== null ? targetIndex + 1 : 1}`;
      if (modalSub) modalSub.textContent = 'Choose from the Color Library';
    }
  }

  if (searchInput) {
    searchInput.value = '';
    searchInput.placeholder = 'Search by color name or HEX (e.g. Blue, #3B82F6)...';
  }

  renderMixPickerCategories();
  renderMixPickerGrid();

  if (overlay) {
    overlay.classList.add('active');
    setTimeout(() => { if (searchInput) searchInput.focus(); }, 100);
  }
}

function handleMixPickerSelect(hex, name) {
  const normHex = hex.toUpperCase();
  const normName = name || findClosestColorName(normHex) || 'Custom Color';

  if (colorMixState.pickerMode === 'add-stop') {
    addGradientStopWithColor({ hex: normHex, name: normName });
    closeMixPicker();
    return;
  }

  if (colorMixState.pickerMode === 'edit-stop') {
    const idx = colorMixState.activeStopIndex;
    if (idx !== null && colorMixState.stops[idx]) {
      colorMixState.stops[idx].hex = normHex;
      colorMixState.stops[idx].name = normName;
      renderColorStops();
      updateGradientDisplay();
      closeMixPicker();
      showToast(`✓ Updated stop to ${normName}`);
    }
    return;
  }

  // Legacy slot mode
  if (colorMixState.activeSlotIndex !== null) {
    colorMixState.selectedColors[colorMixState.activeSlotIndex] = { name: normName, hex: normHex };
    renderMixSlots();
    if (colorMixState.currentMix) {
      generateColorMix(false);
    }
    closeMixPicker();
    showToast(`Selected ${normName}`);
  }
}

function closeMixPicker() {
  const overlay = $('#mix-picker-overlay');
  if (overlay) overlay.classList.remove('active');
}

function renderMixPickerCategories() {
  const catWrap = $('#mix-picker-categories');
  if (!catWrap) return;

  const cats = ['All', 'Red', 'Pink', 'Purple', 'Indigo', 'Blue', 'Cyan', 'Teal', 'Green', 'Yellow', 'Orange', 'Brown', 'Gray'];
  catWrap.innerHTML = cats.map((cat) => `
    <button type="button" class="mix-picker-cat-btn ${cat === colorMixState.pickerCategory ? 'active' : ''}" data-picker-cat="${cat}">${cat}</button>
  `).join('');

  catWrap.querySelectorAll('.mix-picker-cat-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      colorMixState.pickerCategory = btn.getAttribute('data-picker-cat');
      renderMixPickerCategories();
      renderMixPickerGrid();
    });
  });
}

function renderMixPickerGrid() {
  const grid = $('#mix-picker-grid');
  if (!grid) return;

  const rawQuery = (colorMixState.pickerSearch || '').trim();
  const lowerQuery = rawQuery.toLowerCase();
  const cat = colorMixState.pickerCategory;

  const filtered = colors.filter((color) => {
    const matchesQuery = !lowerQuery || color.name.toLowerCase().includes(lowerQuery) || color.hex.toLowerCase().includes(lowerQuery);
    if (!matchesQuery) return false;
    if (cat === 'All') return true;
    return classify(color.hex) === cat;
  });

  // Check if rawQuery is a valid 3-char or 6-char hex code (with or without #)
  let customHexCard = '';
  let cleanHex = rawQuery;
  if (!cleanHex.startsWith('#') && (/^[0-9a-f]{3}$/i.test(cleanHex) || /^[0-9a-f]{6}$/i.test(cleanHex))) {
    cleanHex = '#' + cleanHex;
  }
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(cleanHex)) {
    const fullHex = cleanHex.length === 4
      ? '#' + cleanHex[1] + cleanHex[1] + cleanHex[2] + cleanHex[2] + cleanHex[3] + cleanHex[3]
      : cleanHex;
    const normHex = fullHex.toUpperCase();
    const customName = findClosestColorName(normHex) || 'Custom Color';
    customHexCard = `
      <div class="mix-picker-item mix-picker-custom-hex" data-select-hex="${normHex}" data-select-name="${escapeHtml(customName)}" role="button" tabindex="0" style="border: 2px solid #0066ff; background: #eff6ff; grid-column: 1 / -1; display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 12px; margin-bottom: 6px; cursor: pointer;">
        <span class="mix-picker-swatch" style="background-color: ${normHex}; width: 36px; height: 36px; min-width: 36px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.15); box-shadow: 0 1px 3px rgba(0,0,0,0.1);"></span>
        <div class="mix-picker-info" style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="mix-picker-name" style="color: #0066ff; font-weight: 700; font-size: 14px;">Add Code: ${normHex}</span>
            <span style="background: #0066ff; color: #fff; font-size: 11px; font-weight: 700; padding: 2px 6px; border-radius: 4px;">Custom HEX</span>
          </div>
          <span class="mix-picker-hex" style="color: #475569; font-size: 12px;">Closest match: ${escapeHtml(customName)} — Click to add</span>
        </div>
      </div>
    `;
  }

  if (!filtered.length && !customHexCard) {
    grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 32px 16px; color: #64748b; font-size: 14px;">
      <p style="margin: 0 0 6px 0; font-weight: 600; color: #334155;">No matching colors found</p>
      <p style="margin: 0; font-size: 12px; color: #94a3b8;">Type a color name (e.g. "Emerald", "Cyan") or enter a HEX code (e.g. "#FF5733")</p>
    </div>`;
    return;
  }

  const itemsHtml = filtered.map((color) => `
    <div class="mix-picker-item" data-select-hex="${color.hex.toUpperCase()}" data-select-name="${escapeHtml(color.name)}" role="button" tabindex="0">
      <span class="mix-picker-swatch" style="background-color: ${color.hex};"></span>
      <div class="mix-picker-info">
        <span class="mix-picker-name">${escapeHtml(color.name)}</span>
        <span class="mix-picker-hex">${color.hex.toUpperCase()}</span>
      </div>
    </div>
  `).join('');

  grid.innerHTML = customHexCard + itemsHtml;

  grid.querySelectorAll('.mix-picker-item').forEach((item) => {
    item.addEventListener('click', () => {
      const hex = item.getAttribute('data-select-hex');
      const name = item.getAttribute('data-select-name');
      handleMixPickerSelect(hex, name);
    });
  });
}

/* Saved Palettes Modal */
function openMixSaved() {
  const overlay = $('#mix-saved-overlay');
  if (overlay) {
    overlay.classList.add('active');
    renderMixSavedList();
  }
}

function closeMixSaved() {
  const overlay = $('#mix-saved-overlay');
  if (overlay) overlay.classList.remove('active');
}

function renderMixSavedList() {
  const container = $('#mix-saved-list');
  if (!container) return;

  const list = getSavedMixes();

  if (!list.length) {
    container.innerHTML = `
      <div class="mix-saved-empty">
        <div style="font-size: 32px; margin-bottom: 8px;">🎨</div>
        <p style="font-weight: 700; color: #1e293b; font-size: 15px;">No saved colors yet</p>
        <p style="font-size: 13px; color: #64748b; margin-top: 4px; max-width: 320px; margin-left: auto; margin-right: auto; line-height: 1.5;">
          Generate a color in Color Mix and tap the heart (♥) button to store its code, preview, and name in your browser localStorage.
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map((item, idx) => {
    const hex = item.hex || (item.hexes && item.hexes[0]) || '#333333';
    const name = item.name || (typeof findClosestColorName === 'function' ? findClosestColorName(hex) : 'Custom Color') || 'Custom Color';
    const flow = item.inputHexFlow || (item.hexes ? item.hexes.join(' → ') : hex);
    const baseColorsDots = (item.baseColors && Array.isArray(item.baseColors) && item.baseColors.length)
      ? `<div style="display: flex; align-items: center; gap: 5px; margin-top: 6px;">
          <span style="font-size: 11px; color: #94a3b8; font-weight: 500;">Mix from:</span>
          ${item.baseColors.map(c => `<span title="${escapeHtml(c.name || c.hex)}: ${c.hex}" style="display: inline-block; width: 14px; height: 14px; border-radius: 50%; background: ${c.hex}; border: 1px solid rgba(0,0,0,0.15); box-shadow: 0 1px 2px rgba(0,0,0,0.1);"></span>`).join('')}
         </div>`
      : '';

    return `
      <div class="mix-saved-card-item" data-mix-id="${item.id}">
        <div class="mix-saved-card-top">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="color: #e11d48; font-size: 13px;">♥</span>
            <span class="mix-saved-date">${item.date || 'Saved'}</span>
          </div>
          <div class="mix-saved-card-actions">
            <button type="button" class="mix-saved-btn mix-saved-load-btn" data-load-index="${idx}" title="Load this color into mix">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
              Load
            </button>
            <button type="button" class="mix-saved-btn mix-saved-copy-btn" data-copy-index="${idx}" title="Copy HEX code">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Copy
            </button>
            <button type="button" class="mix-saved-btn mix-saved-del-btn" data-del-index="${idx}" title="Delete from saved" aria-label="Delete">✕</button>
          </div>
        </div>
        <div class="mix-saved-strips" style="background: ${item.gradientCss || hex}; height: 52px; border-radius: 9px; display: flex; align-items: center; justify-content: center; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.12);">
          <span style="background: rgba(15,23,42,0.8); color: #ffffff; padding: 4px 14px; border-radius: 999px; font-family: monospace; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; box-shadow: 0 2px 5px rgba(0,0,0,0.25);">${hex}</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <div class="mix-saved-hexes" style="display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: #475569;">
            <span style="font-weight: 700; color: #0f172a; font-size: 14px;">${escapeHtml(name)}</span>
            <span style="font-family: monospace; font-size: 11px; color: #64748b;">${escapeHtml(flow)}</span>
          </div>
          ${baseColorsDots}
        </div>
      </div>
    `;
  }).join('');

  // Bind Saved Modal Actions
  container.querySelectorAll('[data-load-index]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-load-index'), 10);
      const item = list[idx];
      if (item) {
        if (item.stops && Array.isArray(item.stops) && item.stops.length) {
          colorMixState.stops = item.stops.map(s => ({ ...s }));
          colorMixState.angle = item.angle || 135;
        } else if (item.baseColors && Array.isArray(item.baseColors) && item.baseColors.length) {
          const step = 100 / Math.max(1, item.baseColors.length - 1);
          colorMixState.stops = item.baseColors.map((c, i) => ({
            hex: c.hex.toUpperCase(),
            pos: Math.round(i * step),
            name: c.name
          }));
          colorMixState.angle = item.angle || 135;
        } else if (item.hex) {
          colorMixState.stops = [
            { hex: item.hex.toUpperCase(), pos: 0, name: item.name || 'Color 1' },
            { hex: '#EC4899', pos: 100, name: 'Pink' }
          ];
          colorMixState.angle = 135;
        }
        renderColorStops();
        updateGradientDisplay();
        closeMixSaved();
        showToast(`Loaded "${item.name || 'Gradient'}"`);
      }
    });
  });

  container.querySelectorAll('[data-copy-index]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-copy-index'), 10);
      const item = list[idx];
      const hexToCopy = item?.hex || (item?.hexes && item.hexes[0]);
      if (hexToCopy) {
        copyText(hexToCopy).then(() => showToast(`✓ ${hexToCopy} copied`));
      }
    });
  });

  container.querySelectorAll('[data-del-index]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute('data-del-index'), 10);
      const item = list[idx];
      if (item) {
        const deletedHex = (item.hex || '').toUpperCase();
        list.splice(idx, 1);
        saveSavedMixes(list);
        updateSavedMixesCountBadge();
        const currentMix = colorMixState.currentMix || colorMixState.history[colorMixState.historyIndex];
        if (currentMix && currentMix.hex && currentMix.hex.toUpperCase() === deletedHex) {
          updateSingleMixFavState(currentMix.hex);
        }
        renderMixSavedList();
        showToast(`Removed "${item.name || deletedHex}" from saved mixes`);
      }
    });
  });
}

/* Smoky Button WebGL Shader Animation for Generate Mix Button */
const SMOKE_VERTEX_SHADER = `
  attribute vec2 aPosition;
  void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

const SMOKE_FRAGMENT_SHADER = `
  precision mediump float;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uSpeed;
  uniform vec3 uPrimary;
  uniform vec3 uSecondary;
  uniform vec3 uShadow;

  float random(vec2 position) {
    return fract(sin(dot(position, vec2(12.9898, 78.233))) * 43758.5453);
  }

  float noise(vec2 position) {
    vec2 cell = floor(position);
    vec2 offset = fract(position);
    float a = random(cell);
    float b = random(cell + vec2(1.0, 0.0));
    float c = random(cell + vec2(0.0, 1.0));
    float d = random(cell + vec2(1.0, 1.0));
    vec2 blend = offset * offset * (3.0 - 2.0 * offset);
    return mix(a, b, blend.x)
      + (c - a) * blend.y * (1.0 - blend.x)
      + (d - b) * blend.x * blend.y;
  }

  float fbm(vec2 position) {
    float value = 0.0;
    float amplitude = 0.5;
    mat2 rotation = mat2(0.8776, 0.4794, -0.4794, 0.8776);
    for (int i = 0; i < 6; i++) {
      value += amplitude * noise(position);
      position = rotation * position * 2.04 + vec2(13.7, 9.2);
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    vec2 position = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;
    float time = uTime * uSpeed * 0.58;

    vec2 silkPosition = position;
    silkPosition.y += 0.20 * sin(position.x * 1.55 - time * 1.8)
      + 0.11 * sin(position.x * 3.2 + time * 1.35);
    silkPosition.x += 0.06 * sin(position.y * 4.2 - time * 1.1);

    vec2 warp = vec2(
      fbm(silkPosition * 1.15 + vec2(time * 0.28, -time * 0.17)),
      fbm(silkPosition * 1.05 + vec2(4.8, 1.3) - vec2(time * 0.18, time * 0.22))
    );
    vec2 current = silkPosition + (warp - 0.5) * 0.82;
    float body = fbm(current * 1.35 + vec2(-time * 0.24, time * 0.14));
    float detail = fbm(current * 2.7 + vec2(time * 0.31, -time * 0.27));
    float primaryPlume = fbm(current * 1.20 + vec2(-time * 0.38, time * 0.18));
    float secondaryPlume = fbm(
      current * 1.10 + vec2(time * 0.26, -time * 0.32) + vec2(7.2, 3.6)
    );
    float shadowPlume = fbm(
      current * 1.45 + vec2(-time * 0.18, time * 0.42) + vec2(2.4, 8.1)
    );
    float bottomPlume = fbm(
      vec2(current.x * 0.92 - time * 0.34, current.y * 0.76 + time * 0.16)
        + vec2(6.4, 2.3)
    );

    float sharedFlow = current.y * 6.8 + current.x * 1.35 + (warp.x - warp.y) * 5.2;
    float crossFlow = current.y * 5.4 - current.x * 2.1 + (warp.x + warp.y) * 3.5;
    float primaryRibbon = 0.5 + 0.5 * sin(sharedFlow - time * 2.75);
    float secondaryRibbon = 0.5 + 0.5 * sin(crossFlow + time * 2.35 + 2.1);
    float shadowRibbon = 0.5 + 0.5 * sin(
      sharedFlow * 0.78 - crossFlow * 0.22 - time * 3.25 + 4.2
    );
    primaryRibbon = smoothstep(0.08, 0.92, primaryRibbon);
    secondaryRibbon = smoothstep(0.08, 0.92, secondaryRibbon);
    shadowRibbon = smoothstep(0.12, 0.88, shadowRibbon);

    float primaryWeight = smoothstep(0.27, 0.76, primaryPlume + 0.24 * body)
      * (0.20 + 1.08 * primaryRibbon);
    float secondaryWeight = smoothstep(0.26, 0.74, secondaryPlume + 0.22 * body)
      * (0.22 + 1.04 * secondaryRibbon + 0.12 * detail);
    float shadowWeight = 0.16 + smoothstep(0.32, 0.80, shadowPlume + 0.14 * body)
      * (0.22 + 0.86 * shadowRibbon);
    float totalWeight = max(primaryWeight + secondaryWeight + shadowWeight, 0.001);
    vec3 color = (
      uPrimary * primaryWeight
      + uSecondary * secondaryWeight
      + uShadow * shadowWeight
    ) / totalWeight;

    float depth = smoothstep(0.15, 0.88, body * 0.78 + detail * 0.30);
    color *= 0.65 + depth * 0.62;
    float shadowVein = smoothstep(
      0.46,
      0.80,
      shadowPlume + 0.10 * body + 0.16 * shadowRibbon
    );
    color = mix(color, uShadow, shadowVein * (0.12 + 0.42 * shadowRibbon));

    float sheenWave = 0.5 + 0.5 * sin(sharedFlow * 1.22 - time * 3.2 + detail * 2.0);
    float sheen = pow(sheenWave, 6.0);
    color += mix(uSecondary, uPrimary, primaryRibbon) * sheen * (0.10 + 0.16 * depth);

    float bottomRidge = 0.26 + 0.24 * bottomPlume
      + 0.08 * sin(current.x * 2.35 - time * 2.6 + warp.x * 3.0);
    float bottomEnvelope = 1.0 - smoothstep(bottomRidge, bottomRidge + 0.24, uv.y);
    float bottomCloud = smoothstep(0.18, 0.72, bottomPlume + 0.22 * detail);
    float bottomMask = bottomEnvelope * (0.48 + 0.52 * bottomCloud);
    float bottomFlow = 0.5 + 0.5 * sin(current.x * 2.1 - time * 2.4 + warp.y * 4.0);
    vec3 bottomColor = mix(uPrimary, uSecondary, smoothstep(0.12, 0.88, bottomFlow));
    float bottomShadow = smoothstep(0.48, 0.78, shadowPlume + 0.18 * bottomPlume);
    bottomColor = mix(bottomColor, uShadow, bottomShadow * 0.72);
    float bottomSheen = pow(0.5 + 0.5 * sin(bottomFlow * 5.0 + time * 2.2), 5.0);
    bottomColor += mix(uSecondary, uPrimary, bottomFlow) * bottomSheen * 0.12;
    color = mix(color, bottomColor, bottomMask * 0.72);

    float feather = uv.x
      + 0.12 * (body - 0.5)
      + 0.08 * (bottomPlume - 0.5)
      + 0.04 * sin(current.y * 3.0 - time * 1.4);
    float alpha = smoothstep(0.24, 0.72, feather);

    gl_FragColor = vec4(clamp(color, 0.0, 1.0), alpha);
  }
`;

let smokyRendererInstance = null;

function initSmokyGenerateButton() {
  const canvas = $('#mix-generate-canvas');
  if (!canvas || smokyRendererInstance) return;

  try {
    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      premultipliedAlpha: true
    });
    if (!gl) return;

    function compileShader(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const err = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(err);
      }
      return shader;
    }

    const vs = compileShader(gl.VERTEX_SHADER, SMOKE_VERTEX_SHADER);
    const fs = compileShader(gl.FRAGMENT_SHADER, SMOKE_FRAGMENT_SHADER);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(prog, 'aPosition');
    const resLoc = gl.getUniformLocation(prog, 'uResolution');
    const timeLoc = gl.getUniformLocation(prog, 'uTime');
    const speedLoc = gl.getUniformLocation(prog, 'uSpeed');
    const primaryLoc = gl.getUniformLocation(prog, 'uPrimary');
    const secondaryLoc = gl.getUniformLocation(prog, 'uSecondary');
    const shadowLoc = gl.getUniformLocation(prog, 'uShadow');

    function parseColorToNormalizedRgb(hex, fallback) {
      const v = (hex || '').replace('#', '').trim();
      const norm = v.length === 3 ? v.split('').map(c => c + c).join('') : v;
      const num = parseInt(norm, 16);
      if (norm.length !== 6 || isNaN(num)) return fallback;
      return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
    }

    let currentColors = {
      primary: parseColorToNormalizedRgb('#7c3aed', [0.48, 0.22, 0.93]),
      secondary: parseColorToNormalizedRgb('#6366f1', [0.38, 0.40, 0.94]),
      shadow: parseColorToNormalizedRgb('#090d16', [0.03, 0.05, 0.08])
    };

    function resize() {
      const pr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * pr));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * pr));
    }

    let animId = 0;
    const start = performance.now();

    function renderFrame(now) {
      if (!document.body.contains(canvas)) return;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

      gl.uniform2f(resLoc, canvas.width, canvas.height);
      gl.uniform1f(timeLoc, (now - start) / 1000);
      gl.uniform1f(speedLoc, 1.25);
      gl.uniform3f(primaryLoc, ...currentColors.primary);
      gl.uniform3f(secondaryLoc, ...currentColors.secondary);
      gl.uniform3f(shadowLoc, ...currentColors.shadow);

      gl.drawArrays(gl.TRIANGLES, 0, 3);
      animId = requestAnimationFrame(renderFrame);
    }

    const observer = new ResizeObserver(resize);
    observer.observe(canvas.parentElement || canvas);
    resize();
    animId = requestAnimationFrame(renderFrame);

    smokyRendererInstance = {
      updateColors: (hex1, hex2) => {
        if (hex1) currentColors.primary = parseColorToNormalizedRgb(hex1, currentColors.primary);
        if (hex2) currentColors.secondary = parseColorToNormalizedRgb(hex2, currentColors.secondary);
      }
    };
  } catch (e) {
    console.warn('Smoky WebGL button fallback active:', e);
  }
}

/* Event listeners initialization for Color Mix */
function initColorMix() {
  // Feature strip card
  const featureCard = $('#feature-color-mix');
  if (featureCard) {
    featureCard.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.location.pathname !== '/color-mix') {
        history.pushState(null, '', '/color-mix');
      }
      handleRoute();
    });
  }

  // Back & Close buttons
  const backBtn = $('#color-mix-back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      closeColorMix();
    });
  }

  const closeBtn = $('#color-mix-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      closeColorMix();
    });
  }

  // Counter +/- buttons
  const decBtn = $('#mix-dec-btn');
  const incBtn = $('#mix-inc-btn');
  if (decBtn) decBtn.addEventListener('click', () => updateMixCount(colorMixState.count - 1));
  if (incBtn) incBtn.addEventListener('click', () => updateMixCount(colorMixState.count + 1));

  // Random button: picks random colors and updates gradient
  const randomBaseBtn = $('#mix-random-base-btn');
  if (randomBaseBtn) randomBaseBtn.addEventListener('click', randomizeGradient);

  // Add Stop button
  const addStopBtn = $('#mix-add-stop-btn');
  if (addStopBtn) addStopBtn.addEventListener('click', addGradientStop);

  // Color count mode select (2 to 7 colors)
  const countSelect = $('#mix-colors-count-select');
  if (countSelect) {
    countSelect.addEventListener('change', (e) => {
      setGradientColorCount(e.target.value);
    });
  }

  // Copy CSS Code buttons
  const cssCopyBtn = $('#mix-css-copy-btn');
  if (cssCopyBtn) cssCopyBtn.addEventListener('click', copyGradientCss);

  const codeOverlayCopy = $('#mix-code-overlay-copy');
  if (codeOverlayCopy) codeOverlayCopy.addEventListener('click', copyGradientCss);

  // Save Gradient button
  const saveGradientBtn = $('#mix-save-gradient-btn');
  if (saveGradientBtn) saveGradientBtn.addEventListener('click', saveCurrentGradient);

  // Angle chips
  document.querySelectorAll('.mix-angle-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const a = parseInt(chip.getAttribute('data-angle'), 10);
      if (!isNaN(a)) {
        colorMixState.angle = a;
        updateGradientDisplay();
      }
    });
  });

  // Fallback triggers for legacy mix buttons if present
  const generateBtn = $('#mix-generate-btn');
  if (generateBtn) generateBtn.addEventListener('click', randomizeGradient);

  const generateAgainBtn = $('#mix-generate-again-btn');
  if (generateAgainBtn) generateAgainBtn.addEventListener('click', randomizeGradient);

  // Copy HEX button
  const copyHexBtn = $('#mix-copy-hex-btn');
  if (copyHexBtn) copyHexBtn.addEventListener('click', copyCurrentMixHex);

  // Favorite button on single mixed color
  const favSingleBtn = $('#mix-fav-single-btn');
  if (favSingleBtn) favSingleBtn.addEventListener('click', toggleSingleMixFavorite);

  // Navigation arrows for cycling through generated single results
  const prevBtn = $('#mix-nav-prev');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (colorMixState.historyIndex > 0) {
        colorMixState.historyIndex--;
        colorMixState.currentMix = colorMixState.history[colorMixState.historyIndex];
        renderCurrentMixResult();
      }
    });
  }

  const nextBtn = $('#mix-nav-next');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (colorMixState.historyIndex < colorMixState.history.length - 1) {
        colorMixState.historyIndex++;
        colorMixState.currentMix = colorMixState.history[colorMixState.historyIndex];
        renderCurrentMixResult();
      }
    });
  }

  // Copy buttons in specs grid (HEX, RGB, HSL)
  const copySpecHex = $('#mix-copy-spec-hex');
  if (copySpecHex) {
    copySpecHex.addEventListener('click', () => {
      const mix = colorMixState.currentMix || colorMixState.history[colorMixState.historyIndex];
      if (mix) {
        copyText(mix.hex).then(() => showToast(`✓ ${mix.hex} copied`));
      }
    });
  }

  const copySpecRgb = $('#mix-copy-spec-rgb');
  if (copySpecRgb) {
    copySpecRgb.addEventListener('click', () => {
      const mix = colorMixState.currentMix || colorMixState.history[colorMixState.historyIndex];
      if (mix) {
        copyText(`rgb(${mix.rgbStr})`).then(() => showToast(`✓ rgb(${mix.rgbStr}) copied`));
      }
    });
  }

  const copySpecHsl = $('#mix-copy-spec-hsl');
  if (copySpecHsl) {
    copySpecHsl.addEventListener('click', () => {
      const mix = colorMixState.currentMix || colorMixState.history[colorMixState.historyIndex];
      if (mix) {
        copyText(`hsl(${mix.hslStr})`).then(() => showToast(`✓ hsl(${mix.hslStr}) copied`));
      }
    });
  }

  // Saved mixes trigger & modal
  const savedTrigger = $('#color-mix-saved-trigger');
  if (savedTrigger) savedTrigger.addEventListener('click', openMixSaved);

  const savedClose = $('#mix-saved-close-btn');
  if (savedClose) savedClose.addEventListener('click', closeMixSaved);

  const savedOverlay = $('#mix-saved-overlay');
  if (savedOverlay) {
    savedOverlay.addEventListener('click', (e) => {
      if (e.target === savedOverlay) closeMixSaved();
    });
  }

  // Color picker sheet modal
  const pickerClose = $('#mix-picker-close-btn');
  if (pickerClose) pickerClose.addEventListener('click', closeMixPicker);

  const pickerOverlay = $('#mix-picker-overlay');
  if (pickerOverlay) {
    pickerOverlay.addEventListener('click', (e) => {
      if (e.target === pickerOverlay) closeMixPicker();
    });
  }

  const pickerSearch = $('#mix-picker-search');
  if (pickerSearch) {
    pickerSearch.addEventListener('input', (e) => {
      colorMixState.pickerSearch = e.target.value;
      renderMixPickerGrid();
    });
    pickerSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const firstItem = document.querySelector('#mix-picker-grid .mix-picker-item');
        if (firstItem) firstItem.click();
      }
    });
  }

  // Initial render of gradient, stops, slots, and badge
  renderColorStops();
  updateGradientDisplay();
  updateMixCount(colorMixState.count);
  updateSavedMixesCountBadge();
  initSmokyGenerateButton();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initColorMix);
} else {
  initColorMix();
}

// Google Ads conversion helper (safe fallback when gtag is loaded)
function trackAdConversion(conversionLabel, conversionValue = 0) {
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'conversion', {
      send_to: conversionLabel,
      value: conversionValue,
      currency: 'USD'
    });
  }
}
window.trackAdConversion = trackAdConversion;


