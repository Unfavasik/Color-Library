(() => {
  const library = Array.isArray(window.MIX_LIBRARY) ? window.MIX_LIBRARY : [];
  const $ = (s) => document.querySelector(s);
  const savedKey = 'colorLibraryMixSaved';
  let current = library[0] || { name: 'Cobalt Studio', style: 'Vibrant', score: 92, colors: ['#3455D1','#5E67E8','#A15CE2','#FF8FB8','#FFC76B'] };
  let saved = JSON.parse(localStorage.getItem(savedKey) || '[]');
  const hex = (v) => String(v).toUpperCase();
  function render() {
    $('#palette-name').textContent = current.name;
    $('#palette-style').textContent = current.style;
    $('#palette-score').textContent = Number(current.score).toFixed(1);
    $('#swatches').innerHTML = current.colors.map((color) => `<button class="swatch" style="background:${color}" data-color="${hex(color)}" aria-label="Copy ${hex(color)}"><small>${hex(color)}</small></button>`).join('');
    $('#save-btn').textContent = saved.some((x) => x.id === current.id) ? '♥' : '♡';
    $('#save-btn').setAttribute('aria-label', saved.some((x) => x.id === current.id) ? 'Remove saved palette' : 'Save palette');
    $('#saved-count').textContent = `${saved.length} saved`;
  }
  function next() {
    if (!library.length) return;
    let candidate = library[Math.floor(Math.random() * library.length)];
    if (candidate.id === current.id && library.length > 1) candidate = library[(candidate.id || 0) % library.length];
    current = candidate; render();
  }
  function save() {
    const index = saved.findIndex((x) => x.id === current.id);
    if (index >= 0) saved.splice(index, 1); else saved.unshift(current);
    localStorage.setItem(savedKey, JSON.stringify(saved.slice(0, 50))); render();
  }
  async function share() {
    const text = `${current.name} — ${current.colors.join(' · ')}`;
    try { if (navigator.share) await navigator.share({ title: 'Color Mix', text }); else { await navigator.clipboard.writeText(text); alert('Palette copied to clipboard'); } } catch (_) {}
  }
  $('#random-btn').addEventListener('click', next); $('#another-btn').addEventListener('click', next); $('#save-btn').addEventListener('click', save); $('#share-btn').addEventListener('click', share);
  $('#swatches').addEventListener('click', async (e) => { const button = e.target.closest('[data-color]'); if (!button) return; try { await navigator.clipboard.writeText(button.dataset.color); button.querySelector('small').textContent = 'COPIED'; setTimeout(() => button.querySelector('small').textContent = button.dataset.color, 900); } catch (_) {} });
  $('#view-saved-btn').addEventListener('click', () => { if (!saved.length) return alert('Save a palette first to see it here.'); current = saved[0]; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  document.addEventListener('keydown', (e) => { if (e.code === 'Space' && !['INPUT','TEXTAREA','BUTTON'].includes(document.activeElement.tagName)) { e.preventDefault(); next(); } });
  $('#theme-toggle').addEventListener('click', () => document.body.classList.toggle('light-mode'));
  render();
})();
