import './style.css';
const icons = {
  layers: '<rect x="4" y="4" width="11" height="11" rx="3"/><path d="M9 19h8a3 3 0 0 0 3-3V9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1"/><path d="m3 16 6-5 4 4 3-3 5 5"/>',
  x: '<path d="m6 6 12 12M6 18 18 6"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
document.querySelector('#app').innerHTML = `
<header class="topbar"><a class="brand" href="#" aria-label="GatorSqoosh home"><span class="brand-mark">${icon('layers')}</span>Gator<span class="brand-light">Sqoosh</span></a><span class="local-badge"><span></span> Local processing</span></header>
<main><section class="intro"><div><h1>Bulk image compression</h1><p>Compress images and save them to a folder.</p></div></section>
<div class="workspace"><section class="queue-panel"><div class="panel-heading"><div><h2>Your images <span id="count" class="count">0</span></h2><p>JPEG, PNG, WebP & AVIF · up to 150 MB each</p></div><button id="add" class="button secondary">${icon('plus')}Add images</button></div>
<button id="drop" class="dropzone"><span class="upload-icon">${icon('upload')}</span><strong>Drop your images here</strong><span>or <b>browse files</b> to get started</span><span class="drop-note">Select multiple files at once.</span></button>
<div id="queue" class="queue" aria-label="Image queue"></div>
<div id="empty-note" class="empty-note"><span class="mini-art">${icon('image')}${icon('image')}${icon('image')}</span><strong>No images added</strong><p>Drop images above or click Add images.</p></div>
<div class="queue-footer"><span id="total">No images added yet</span><button id="clear" class="text-button" disabled>Clear all</button></div>
</section>
<aside class="settings-panel"><div class="settings-title"><span class="tiny-icon">${icon('spark')}</span><h2>Compression settings</h2></div><fieldset id="settings"><label class="field-label" for="format">Output format</label><div class="select-wrap"><select id="format"><option value="webp">WebP</option><option value="jpg">JPEG</option><option value="png">PNG (lossless)</option></select></div><p id="format-hint" class="hint">Supports transparency.</p>
<div class="label-row"><label class="field-label" for="quality">Quality</label><output id="quality-value">80<span>%</span></output></div><input id="quality" type="range" min="1" max="100" value="80"><div class="range-labels"><span>Smaller file</span><span>More detail</span></div>
<div class="presets" aria-label="Quality presets"><button data-quality="60">Smallest</button><button data-quality="80" class="selected">Balanced</button><button data-quality="92">Best quality</button></div>
<div class="divider"></div><label class="toggle-row"><span><strong>Resize large images</strong><small>Keep proportions. Never upscale.</small></span><input id="resize" type="checkbox" role="switch"><span class="switch"></span></label><div id="resize-options" hidden><label class="field-label" for="max-size">Maximum long edge</label><div class="number-wrap"><input id="max-size" type="number" min="64" max="16384" value="2400" step="1"><span>px</span></div></div>
<div class="divider"></div><label class="field-label">Save to</label><button id="folder" class="folder-button">${icon('folder')}<span id="folder-label">Choose output folder</span><span class="folder-arrow">↗</span></button><p class="hint">Originals stay untouched. Existing files are never replaced.</p></fieldset>
<div class="action-area"><div id="progress-wrap" hidden><div class="progress-label"><span id="progress-text">Preparing…</span><span id="progress-count"></span></div><progress id="progress" max="100" value="0"></progress></div><button id="compress" class="button primary" disabled>Compress batch ${icon('arrow')}</button><button id="cancel" class="button cancel" hidden>Stop after this image</button><p class="action-note" id="action-note">Add images and choose a folder to begin.</p></div></aside></div>
<section id="summary" class="summary" hidden aria-live="polite"></section><div id="notice" role="status" aria-live="polite"></div>
<footer><span>${icon('shield')} Images are processed on this computer.</span><span>MozJPEG <span class="footer-dot">·</span> WebP <span class="footer-dot">·</span> OxiPNG</span></footer></main>`;
const $ = id => document.getElementById(id);
const api = window.desktop;
let items = [], output = null, running = false, stopped = false, worker = null;
const urls = new Set();
const bytes = n => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;
function notice(message) { $('notice').textContent = message; }
function buttonState() {
  $('compress').disabled = running || !output || !items.length;
  $('compress').innerHTML = `${items.length && items.every(i => i.status === 'done') ? 'Compress again' : 'Compress batch'} ${icon('arrow')}`;
  $('clear').disabled = running || !items.length;
  $('add').disabled = running;
  $('drop').disabled = running;
  $('settings').disabled = running;
  $('total').textContent = items.length ? `${items.length} image${items.length === 1 ? '' : 's'} · ${bytes(items.reduce((s, i) => s + i.size, 0))} total` : 'No images added yet';
  $('count').textContent = items.length;
  $('empty-note').hidden = items.length > 0;
  $('drop').classList.toggle('compact', items.length > 0);
  $('action-note').textContent = running ? 'Compressing locally. You can stop after the current image.' : !items.length ? 'Add images and choose a folder to begin.' : !output ? 'Choose where to save your compressed images.' : 'Ready to compress.';
}
function row(item) {
  const el = document.createElement('div'); el.className = 'image-row'; el.dataset.id = item.id;
  const thumb = document.createElement('div'); thumb.className = 'thumbnail'; thumb.innerHTML = icon('image');
  const info = document.createElement('div'); info.className = 'image-info';
  const name = document.createElement('strong'); name.textContent = item.name; name.title = item.name;
  const detail = document.createElement('span'); detail.className = 'detail'; detail.textContent = bytes(item.size);
  info.append(name, detail);
  const status = document.createElement('span'); status.className = 'status'; status.textContent = 'Ready';
  const remove = document.createElement('button'); remove.className = 'remove'; remove.innerHTML = icon('x'); remove.setAttribute('aria-label', `Remove ${item.name}`);
  remove.onclick = async () => { if (running) return; items = items.filter(i => i !== item); api.forgetImages([item.id]); if (item.url) { URL.revokeObjectURL(item.url); urls.delete(item.url); } el.remove(); buttonState(); };
  el.append(thumb, info, status, remove); item.el = el;
  return el;
}
async function add(result) {
  let duplicates = 0;
  for (const file of result.files) {
    if (items.some(i => i.key === file.key)) { duplicates++; api.forgetImages([file.id]); continue; }
    const item = { ...file, status: 'ready' }; items.push(item); $('queue').append(row(item));
  }
  $('summary').hidden = true; buttonState();
  notice(result.skipped ? `${result.skipped} file(s) skipped. Use JPEG, PNG, WebP, or AVIF under 150 MB.` : duplicates ? `${duplicates} duplicate image(s) skipped.` : '');
}
async function pick() { if (!api) { notice('Open the desktop app to select images and output folders.'); return; } try { await add(await api.pickImages()); } catch (e) { notice(e.message); } }
$('add').onclick = pick; $('drop').onclick = pick;
window.addEventListener('dragover', e => { e.preventDefault(); if (!running) $('drop').classList.add('dragging'); });
window.addEventListener('dragleave', e => { if (!e.relatedTarget) $('drop').classList.remove('dragging'); });
window.addEventListener('drop', async e => { e.preventDefault(); $('drop').classList.remove('dragging'); if (running || !api) return; try { await add(await api.dropImages([...e.dataTransfer.files])); } catch (error) { notice(error.message); } });
$('clear').onclick = () => { api.forgetImages(items.map(i => i.id)); for (const url of urls) URL.revokeObjectURL(url); urls.clear(); items = []; $('queue').replaceChildren(); $('summary').hidden = true; notice(''); buttonState(); };
$('folder').onclick = async () => { if (!api) return; try { const folder = await api.pickOutput(); if (folder) { output = folder; $('folder-label').textContent = folder.split(/[\\/]/).filter(Boolean).pop() || folder; $('folder').title = folder; buttonState(); } } catch (e) { notice(e.message); } };
function quality() { $('quality-value').innerHTML = `${$('quality').value}<span>%</span>`; document.querySelectorAll('[data-quality]').forEach(el => el.classList.toggle('selected', el.dataset.quality === $('quality').value)); }
$('quality').oninput = quality;
document.querySelectorAll('[data-quality]').forEach(el => el.onclick = () => { $('quality').value = el.dataset.quality; quality(); });
$('resize').onchange = () => { $('resize-options').hidden = !$('resize').checked; };
$('format').onchange = () => {
  const format = $('format').value, lossless = format === 'png';
  $('quality').disabled = lossless;
  document.querySelectorAll('[data-quality]').forEach(el => el.disabled = lossless);
  $('quality-value').innerHTML = lossless ? '<span>Lossless</span>' : `${$('quality').value}<span>%</span>`;
  $('format-hint').textContent = lossless ? 'Keeps every pixel. Size savings vary by image.' : format === 'jpg' ? 'Universal compatibility. Transparency becomes white.' : 'Supports transparency.';
};
function encode(data, settings) {
  if (!worker) worker = new Worker(new URL('./codec.worker.js', import.meta.url), { type: 'module' });
  return new Promise((resolve, reject) => {
    worker.onmessage = event => event.data.error ? reject(new Error(event.data.error)) : resolve(event.data);
    worker.onerror = () => { worker.terminate(); worker = null; reject(new Error('The image worker stopped. Try a smaller image.')); };
    worker.postMessage({ bytes: data, ...settings }, [data.buffer]);
  });
}
function updateItem(item, text, state) { item.status = state; item.el.querySelector('.status').textContent = text; item.el.querySelector('.status').className = `status ${state}`; }
$('cancel').onclick = () => { stopped = true; $('cancel').disabled = true; $('cancel').textContent = 'Finishing current image…'; };
$('compress').onclick = async () => {
  const maxSize = Number($('max-size').value);
  if ($('resize').checked && (!Number.isInteger(maxSize) || maxSize < 64 || maxSize > 16384)) { notice('Enter a maximum edge between 64 and 16,384 pixels.'); $('max-size').focus(); return; }
  const settings = { format: $('format').value, quality: Number($('quality').value), maxSize: $('resize').checked ? maxSize : null };
  running = true; stopped = false; buttonState(); notice(''); $('summary').hidden = true;
  $('compress').hidden = true; $('cancel').hidden = false; $('cancel').disabled = false; $('cancel').textContent = 'Stop after this image'; $('progress-wrap').hidden = false;
  document.querySelectorAll('.remove').forEach(el => el.disabled = true);
  const pending = items.every(i => i.status === 'done') ? [...items] : items.filter(i => i.status !== 'done'); let completed = 0, failed = 0, original = 0, compressed = 0;
  $('progress').value = 0;
  try {
    for (const item of pending) {
      if (stopped) break;
      updateItem(item, 'Compressing…', 'working');
      $('progress-text').textContent = 'Compressing images'; $('progress-count').textContent = `${completed + failed + 1} / ${pending.length}`;
      try {
        const data = await api.readImage(item.id);
        const inputSize = data.byteLength;
        const result = await encode(data, settings);
        const saved = await api.saveImage({ id: item.id, format: settings.format, bytes: result.bytes });
        item.outputSize = result.bytes.byteLength;
        const saving = Math.round((1 - item.outputSize / inputSize) * 100);
        updateItem(item, saving >= 0 ? `−${saving}%` : `+${Math.abs(saving)}% larger`, 'done');
        item.el.querySelector('.detail').textContent = `${bytes(inputSize)} → ${bytes(item.outputSize)} · ${result.width} × ${result.height}`;
        item.el.title = `Saved as ${saved.filename}`;
        if (result.thumbnail) { if (item.url) { URL.revokeObjectURL(item.url); urls.delete(item.url); } const url = URL.createObjectURL(new Blob([result.thumbnail], { type: 'image/webp' })); urls.add(url); item.url = url; const img = document.createElement('img'); img.src = url; img.alt = ''; item.el.querySelector('.thumbnail').replaceChildren(img); }
        completed++; original += inputSize; compressed += item.outputSize;
      } catch (error) { failed++; updateItem(item, 'Failed · retry', 'error'); item.el.title = error.message; item.el.querySelector('.detail').textContent = error.message; }
      $('progress').value = (completed + failed) / pending.length * 100;
    }
  } finally {
    running = false; if (worker) { worker.terminate(); worker = null; }
    $('compress').hidden = false; $('cancel').hidden = true; $('progress-wrap').hidden = true;
    document.querySelectorAll('.remove').forEach(el => el.disabled = false); buttonState(); $('format').onchange();
    const delta = original - compressed;
    $('summary').replaceChildren();
    const mark = document.createElement('span'); mark.className = 'summary-icon'; mark.innerHTML = icon('check');
    const text = document.createElement('div'); const title = document.createElement('strong'); title.textContent = stopped ? 'Batch stopped' : failed ? 'Compression finished with errors' : 'Compression complete';
    const detail = document.createElement('p'); detail.textContent = `${completed} saved${failed ? ` · ${failed} failed (click Compress batch to retry)` : ''}${completed ? ` · ${delta >= 0 ? bytes(delta) + ' saved' : bytes(-delta) + ' larger'} · ${bytes(original)} → ${bytes(compressed)}` : ''}${stopped ? ' · Remaining images stay in the queue.' : ''}`;
    text.append(title, detail); const open = document.createElement('button'); open.className = 'button secondary'; open.innerHTML = `${icon('folder')}Open folder`; open.onclick = () => api.showOutput().catch(e => notice(e.message));
    $('summary').append(mark, text, open); $('summary').hidden = false;
  }
};
buttonState();
