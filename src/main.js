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
<div class="workspace"><section class="queue-panel"><div class="panel-heading"><div><h2>Your images <span id="count" class="count">0</span></h2><p>JPEG, PNG, WebP & AVIF · up to 150 MB each</p></div><div class="add-actions"><button id="add-folder" class="button secondary">${icon('folder')}Add folder</button><button id="add" class="button secondary">${icon('plus')}Add images</button></div></div>
<button id="drop" class="dropzone"><span class="upload-icon">${icon('upload')}</span><strong>Drop images or folders here</strong><span>or <b>browse files</b> to get started</span><span class="drop-note">Folders include images in all subfolders.</span></button>
<section id="quick-panel" class="quick-panel" hidden><div class="quick-heading"><h2>Quick compress</h2><span id="folder-count"></span></div><p id="source-folders"></p><fieldset id="folder-modes"><label class="mode-option"><input type="radio" name="folder-mode" value="copy" checked><span><strong>Duplicate folder</strong><small>Copy the folder and replace its images. Keep all other files.</small></span></label><label class="mode-option"><input type="radio" name="folder-mode" value="images"><span><strong>Images only</strong><small>Export compressed images with the same subfolder structure.</small></span></label><label class="mode-option"><input type="radio" name="folder-mode" value="replace"><span><strong>Replace originals</strong><small>Overwrite images in the source folders. Other files stay unchanged.</small></span></label></fieldset><p id="mode-note" class="mode-note"></p></section>
<div id="queue" class="queue" aria-label="Image queue"></div>
<div id="empty-note" class="empty-note"><span class="mini-art">${icon('image')}${icon('image')}${icon('image')}</span><strong>No images added</strong><p>Drop images above or click Add images.</p></div>
<div class="queue-footer"><span id="total">No images added yet</span><button id="clear" class="text-button" disabled>Clear all</button></div>
</section>
<aside class="settings-panel"><div class="settings-title"><span class="tiny-icon">${icon('spark')}</span><h2>Compression settings</h2></div><fieldset id="settings"><label class="field-label" for="format">Output format</label><div class="select-wrap"><select id="format"><option value="original">Keep original format</option><option value="webp" selected>WebP</option><option value="jpg">JPEG</option><option value="png">PNG (lossless)</option><option value="avif">AVIF</option></select></div><p id="format-hint" class="hint">Supports transparency.</p>
<div class="label-row"><label class="field-label" for="quality">Quality</label><output id="quality-value">80<span>%</span></output></div><input id="quality" type="range" min="1" max="100" value="80"><div class="range-labels"><span>Smaller file</span><span>More detail</span></div>
<div class="presets" aria-label="Quality presets"><button data-quality="60">Smallest</button><button data-quality="80" class="selected">Balanced</button><button data-quality="92">Best quality</button></div>
<div class="divider"></div><label class="toggle-row"><span><strong>Resize large images</strong><small>Keep proportions. Never upscale.</small></span><input id="resize" type="checkbox" role="switch"><span class="switch"></span></label><div id="resize-options" hidden><label class="field-label" for="max-size">Maximum long edge</label><div class="number-wrap"><input id="max-size" type="number" min="64" max="16384" value="2400" step="1"><span>px</span></div></div>
<div class="divider"></div><div id="output-controls"><label class="field-label">Save to</label><button id="folder" class="folder-button">${icon('folder')}<span id="folder-label">Choose output folder</span><span class="folder-arrow">↗</span></button><p class="hint" id="output-hint">Originals stay untouched. Existing files are never replaced.</p></div><p id="replace-warning" class="replace-warning" hidden>Original images will be overwritten. Keep a backup if you need the source files.</p></fieldset>
<div class="action-area"><div id="progress-wrap" hidden><div class="progress-label"><span id="progress-text">Preparing…</span><span id="progress-count"></span></div><progress id="progress" max="100" value="0"></progress></div><button id="compress" class="button primary" disabled>Compress batch ${icon('arrow')}</button><button id="cancel" class="button cancel" hidden>Stop after this image</button><p class="action-note" id="action-note">Add images and choose a folder to begin.</p></div></aside></div>
<section id="summary" class="summary" hidden aria-live="polite"></section><div id="notice" role="status" aria-live="polite"></div>
<footer><span>${icon('shield')} Images are processed on this computer.</span><span>MozJPEG <span class="footer-dot">·</span> WebP <span class="footer-dot">·</span> OxiPNG</span></footer></main>`;
const $ = id => document.getElementById(id);
const api = window.desktop;
let items = [], folderRoots = [], output = null, running = false, stopped = false, worker = null, scanning = false;
const mode = () => folderRoots.length ? document.querySelector('[name="folder-mode"]:checked').value : 'files';
const urls = new Set();
const bytes = n => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;
function notice(message) { $('notice').textContent = message; }
function buttonState() {
  const replacing = mode() === 'replace';
  $('compress').disabled = running || scanning || (!replacing && !output) || !items.length;
  $('compress').innerHTML = `${replacing ? 'Replace original images' : items.length && items.every(i => i.status === 'done') ? 'Compress again' : 'Compress batch'} ${icon('arrow')}`;
  $('clear').disabled = running || scanning || (!items.length && !folderRoots.length);
  $('add').disabled = running || scanning;
  $('add-folder').disabled = running || scanning;
  $('drop').disabled = running || scanning;
  $('folder-modes').disabled = running || scanning;
  $('settings').disabled = running;
  $('total').textContent = items.length ? `${items.length} image${items.length === 1 ? '' : 's'} · ${bytes(items.reduce((s, i) => s + i.size, 0))} total` : 'No images added yet';
  $('count').textContent = items.length;
  $('empty-note').hidden = items.length > 0;
  $('drop').classList.toggle('compact', items.length > 0);
  $('quick-panel').hidden = !folderRoots.length;
  $('folder-count').textContent = `${folderRoots.length} folder${folderRoots.length === 1 ? '' : 's'}`;
  $('source-folders').textContent = folderRoots.map(root => root.name).join(' · ');
  $('output-controls').hidden = replacing;
  $('replace-warning').hidden = !replacing;
  $('format').disabled = replacing;
  $('mode-note').textContent = replacing ? 'Keeps formats, filenames, and subfolders. This cannot be undone by the app.' : mode() === 'copy' ? 'Creates a new folder. Source files stay unchanged. Failed images keep their original copies.' : 'Creates a new folder containing only successful image exports.';
  $('mode-note').classList.toggle('warning', replacing);
  $('action-note').textContent = scanning ? 'Scanning subfolders…' : running ? 'Compressing locally. You can stop after the current image.' : !items.length ? 'Add images or a folder to begin.' : replacing ? 'Only successfully encoded images will be replaced.' : !output ? 'Choose where to save your compressed images.' : 'Ready to compress.';
}
function row(item) {
  const el = document.createElement('div'); el.className = 'image-row'; el.dataset.id = item.id;
  const thumb = document.createElement('div'); thumb.className = 'thumbnail'; thumb.innerHTML = icon('image');
  const info = document.createElement('div'); info.className = 'image-info';
  const name = document.createElement('strong'); name.textContent = item.rootId ? item.relative : item.name; name.title = item.relative || item.name;
  const detail = document.createElement('span'); detail.className = 'detail'; detail.textContent = bytes(item.size);
  info.append(name, detail);
  const status = document.createElement('span'); status.className = 'status'; status.textContent = 'Ready';
  const remove = document.createElement('button'); remove.className = 'remove'; remove.innerHTML = icon('x'); remove.setAttribute('aria-label', `Remove ${item.name}`);
  remove.onclick = async () => { if (running) return; items = items.filter(i => i !== item); api.forgetImages([item.id]); if (item.url) { URL.revokeObjectURL(item.url); urls.delete(item.url); } el.remove(); buttonState(); };
  el.append(thumb, info, status, remove); item.el = el;
  return el;
}
async function add(result) {
  const firstFolder = !folderRoots.length && result.roots?.length;
  folderRoots.push(...(result.roots || []));
  if (firstFolder) { $('format').value = 'original'; $('format').onchange(); }
  let duplicates = 0;
  for (const file of result.files) {
    const existing = items.find(i => i.key === file.key);
    if (existing && !existing.rootId && file.rootId) {
      api.forgetImages([existing.id]); existing.el.remove(); items = items.filter(item => item !== existing);
      if (existing.url) { URL.revokeObjectURL(existing.url); urls.delete(existing.url); }
    } else if (existing) { duplicates++; api.forgetImages([file.id]); continue; }
    const item = { ...file, status: 'ready' }; items.push(item); $('queue').append(row(item));
  }
  $('summary').hidden = true; buttonState();
  notice([result.ignored ? `${result.ignored} non-image or oversized file(s) excluded from compression.` : '', result.skipped ? `${result.skipped} symbolic links or special files skipped.` : '', duplicates ? `${duplicates} duplicate image(s) skipped.` : '', ...(result.warnings || []), !items.length && folderRoots.length ? 'No supported images found in the selected folders.' : ''].filter(Boolean).join(' '));
}
async function importFiles(load) { if (running || scanning) return; scanning = true; buttonState(); try { await add(await load()); } catch (e) { notice(e.message); } finally { scanning = false; buttonState(); } }
async function pick() { if (!api) { notice('Open the desktop app to select images and output folders.'); return; } await importFiles(() => api.pickImages()); }
$('add').onclick = pick; $('drop').onclick = pick;
$('add-folder').onclick = () => api ? importFiles(() => api.pickFolders()) : notice('Open the desktop app to select folders.');
document.querySelectorAll('[name="folder-mode"]').forEach(el => el.onchange = () => { if (mode() === 'replace') $('format').value = 'original'; $('format').onchange(); buttonState(); });
window.addEventListener('dragover', e => { e.preventDefault(); if (!running) $('drop').classList.add('dragging'); });
window.addEventListener('dragleave', e => { if (!e.relatedTarget) $('drop').classList.remove('dragging'); });
window.addEventListener('drop', async e => { e.preventDefault(); $('drop').classList.remove('dragging'); if (running || !api) return; const files = [...e.dataTransfer.files]; await importFiles(() => api.dropImages(files)); });
$('clear').onclick = async () => { try { await api.clearInputs(); for (const url of urls) URL.revokeObjectURL(url); urls.clear(); items = []; folderRoots = []; $('queue').replaceChildren(); $('summary').hidden = true; notice(''); buttonState(); } catch (e) { notice(e.message); } };
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
  $('format-hint').textContent = lossless ? 'Keeps every pixel. Size savings vary by image.' : format === 'original' ? 'Keeps filenames and formats. PNG compression is lossless.' : format === 'jpg' ? 'Transparency becomes white.' : format === 'avif' ? 'Supports transparency. Slower to encode.' : 'Supports transparency.';
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
$('cancel').onclick = () => { stopped = true; api.stopPreparation(); $('cancel').disabled = true; $('cancel').textContent = 'Stopping…'; };
$('compress').onclick = async () => {
  const maxSize = Number($('max-size').value);
  if ($('resize').checked && (!Number.isInteger(maxSize) || maxSize < 64 || maxSize > 16384)) { notice('Enter a maximum edge between 64 and 16,384 pixels.'); $('max-size').focus(); return; }
  const settings = { format: $('format').value, quality: Number($('quality').value), maxSize: $('resize').checked ? maxSize : null };
  const outputMode = mode();
  if (outputMode === 'replace' && items.some(item => !item.rootId)) { notice('Clear individual image files from the queue before replacing a folder in place.'); return; }
  running = true; stopped = false; buttonState(); notice(''); $('summary').hidden = true;
  $('compress').hidden = true; $('cancel').hidden = false; $('cancel').disabled = false; $('cancel').textContent = 'Stop after this image'; $('progress-wrap').hidden = false;
  document.querySelectorAll('.remove').forEach(el => el.disabled = true);
  const pending = folderRoots.length || items.every(i => i.status === 'done') ? [...items] : items.filter(i => i.status !== 'done'); let completed = 0, failed = 0, original = 0, compressed = 0, batch = null, startupError = null;
  $('progress').value = 0;
  try {
    $('progress-text').textContent = outputMode === 'copy' ? 'Copying folder contents…' : 'Preparing output…'; $('progress-count').textContent = '';
    batch = await api.beginBatch({ ids: pending.map(item => item.id), mode: outputMode });
    for (const item of pending) {
      if (stopped) break;
      updateItem(item, 'Compressing…', 'working');
      $('progress-text').textContent = 'Compressing images'; $('progress-count').textContent = `${completed + failed + 1} / ${pending.length}`;
      try {
        const data = await api.readImage(item.id);
        const inputSize = data.byteLength;
        const format = settings.format === 'original' ? item.format : settings.format;
        const result = await encode(data, { ...settings, format });
        const saved = await api.saveImage({ id: item.id, batchId: batch.id, format, bytes: result.bytes });
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
  } catch (error) { startupError = error.message; notice(error.message); }
  finally {
    if (batch) await api.endBatch(batch.id);
    running = false; if (worker) { worker.terminate(); worker = null; }
    $('compress').hidden = false; $('cancel').hidden = true; $('progress-wrap').hidden = true;
    document.querySelectorAll('.remove').forEach(el => el.disabled = false); buttonState(); $('format').onchange();
    const delta = original - compressed;
    $('summary').replaceChildren();
    const mark = document.createElement('span'); mark.className = 'summary-icon'; mark.innerHTML = icon('check');
    const text = document.createElement('div'); const title = document.createElement('strong'); title.textContent = startupError ? stopped ? 'Batch stopped' : 'Batch could not start' : stopped ? 'Batch stopped' : failed ? 'Compression finished with errors' : 'Compression complete';
    const detail = document.createElement('p'); detail.textContent = `${completed} ${outputMode === 'replace' ? 'replaced' : 'saved'}${failed ? ` · ${failed} failed` : ''}${completed ? ` · ${delta >= 0 ? bytes(delta) + ' saved' : bytes(-delta) + ' larger'} · ${bytes(original)} → ${bytes(compressed)}` : ''}${stopped ? ' · Remaining images stay in the queue.' : ''}`;
    text.append(title, detail); const open = document.createElement('button'); open.className = 'button secondary'; open.innerHTML = `${icon('folder')}Open folder`; open.onclick = () => api.showOutput().catch(e => notice(e.message));
    $('summary').append(mark, text); if (batch) $('summary').append(open); $('summary').hidden = false;
  }
};
buttonState();
