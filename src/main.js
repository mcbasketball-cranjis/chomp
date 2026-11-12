import { decodeSvgBitmap } from './svg-input.js';
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
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.2 5.5M20 4v7h-7"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;

document.querySelector('#app').innerHTML = `
<div class="titlebar"><img src="./icon.png" alt=""><span>Chomp</span></div>
<div class="app-shell">
  <aside class="sidebar">
    <div class="sidebar-brand brand"><img src="./icon.png" class="brand-mark" alt=""><strong>Chomp</strong></div>
    <div class="sidebar-caption">TOOLS</div>
    <nav class="tool-nav" aria-label="Image tools">
      <button type="button" data-workspace="compress">${icon('layers')}<span>Compress</span></button>
      <button type="button" data-workspace="convert">${icon('arrow')}<span>Convert</span></button>
      <button type="button" class="active" data-workspace="vectorize">${icon('spark')}<span>Vectorize</span></button>
    </nav>
    <div class="sidebar-divider"></div>
    <div class="files-heading"><span class="sidebar-caption">YOUR FILES</span><span id="count" class="files-count">0</span></div>
    <div id="queue" class="queue" aria-label="Image queue"></div>
    <div class="sidebar-buttons">
      <button type="button" id="add-sidebar" class="add-more">${icon('upload')} Add more images</button>
      <button type="button" id="add-folder" class="add-folder">${icon('folder')} Add folder</button>
    </div>
    <div class="queue-footer"><span id="total">No images added yet</span><button id="clear" class="text-button" disabled>Clear all</button></div>
    <div class="sidebar-updates"><button id="updates-open" type="button" aria-haspopup="dialog">${icon('refresh')}<span>Updates</span><span id="update-indicator" hidden></span></button><span id="app-version">v2.1.0</span></div>
  </aside>
  <main class="main-content">
    <header class="intro"><h1 id="workspace-title">Compress</h1><div class="header-actions"><button type="button" class="button secondary" id="add">${icon('upload')} Add images</button></div></header>
    <div class="workspace">
      <div class="center-column">
        <section class="preview-panel" aria-label="Image comparison">
          <header class="preview-heading"><div><strong>Preview</strong><span id="selected-name" class="selected-filename"></span></div><div class="preview-heading-right"><span id="preview-badge" class="format-badge">SVG · transparent</span><span id="preview-status">Ready</span></div></header>
          <div class="preview-stage" id="preview-stage">
            <div class="preview-image-wrap result-image" id="result-layer"><img id="result-img" alt="Processed image preview" hidden></div>
            <div class="preview-image-wrap original-image" id="original-layer"><img id="original-img" alt="Original image preview" hidden></div>
            <div id="comparison-line" class="comparison-line"></div><div id="comparison-handle" class="comparison-handle" aria-hidden="true">‹ ›</div>
            <span class="preview-chip before-chip">ORIGINAL</span><span class="preview-chip after-chip" id="preview-after-label">VECTOR</span>
            <input type="range" min="0" max="100" value="40" id="compare-slider" class="compare-slider" aria-label="Compare original and processed image">
            <button id="drop" class="dropzone" type="button"><span class="upload-icon">${icon('upload')}</span><strong>Drop images or folders here</strong><span><b>Browse files</b></span><span class="drop-note">JPEG, PNG, WebP, AVIF, SVG</span></button>
            <div id="empty-note" class="empty-note"><span>Drop an image to get started</span></div>
          </div>
          <footer class="preview-footer"><span class="image-metadata">${icon('image')}<span id="stage-caption">Select an image to see its preview</span></span><div class="preview-switch"><button type="button" id="compare-view" class="selected">Compare</button><button type="button" id="result-view">Result only</button></div></footer>
        </section>
        <div class="metrics"><div class="metric"><span>Original</span><strong id="metric-original">—</strong>${icon('image')}</div><div class="metric"><span>Output</span><strong id="metric-output">—</strong>${icon('folder')}</div><div class="metric"><span>Difference</span><strong id="metric-savings">—</strong>${icon('layers')}</div></div>
      </div>
      <aside class="settings-panel">
        <div class="settings-scroll"><h2 id="settings-title">Vector settings</h2>
          <fieldset id="settings">
            <label class="field-label" for="format">Output format</label>
            <div class="format-control"><span class="format-icon">${icon('spark')}</span><select id="format"><option value="original">Keep original format</option><option value="webp">WebP</option><option value="jpg">JPEG</option><option value="png">PNG (lossless)</option><option value="avif">AVIF</option><option value="svg" selected>SVG — editable paths</option></select></div>
            <p id="format-hint" class="hint" hidden></p>
            <section id="trace-controls" class="settings-section">
              <label class="field-label" for="trace-detail">Tracing detail</label>
              <select id="trace-detail" class="visually-hidden"><option value="simple">Simple</option><option value="balanced" selected>Balanced</option><option value="detailed">Detailed</option></select>
              <div class="presets trace-presets" aria-label="Tracing detail"><button type="button" data-trace="simple">Simple</button><button type="button" class="selected" data-trace="balanced">Balanced</button><button type="button" data-trace="detailed">Detailed</button></div>
              
            </section>
            <div class="settings-section">
              <label class="toggle-row"><span><strong>Remove background</strong></span><input id="remove-bg" type="checkbox" role="switch"><span class="switch"></span></label>
              <div id="background-controls" hidden>
                <fieldset class="bg-scope"><legend class="field-label">Removal area</legend>
                  <label class="bg-mode-option"><input type="radio" name="bg-mode" value="edges" checked><span>Edges only</span></label>
                  <label class="bg-mode-option"><input type="radio" name="bg-mode" value="all"><span>Everywhere</span></label>
                </fieldset>
                <p id="bg-mode-hint" class="hint">Outside edges only</p>
                <div class="label-row"><label for="bg-tolerance" class="field-label">Color tolerance</label><output id="bg-value">28</output></div>
                <input id="bg-tolerance" type="range" min="0" max="100" value="28"><div class="range-labels"><span>Precise</span><span>More aggressive</span></div>
              </div>
            </div>
            <section class="settings-section" id="compression-controls">
              <div class="label-row"><label class="field-label" for="quality">Quality</label><output id="quality-value">80<span>%</span></output></div>
              <input id="quality" type="range" min="1" max="100" value="80"><div class="range-labels"><span>Smaller file</span><span>More detail</span></div>
              <div class="presets"><button type="button" data-quality="60">Smallest</button><button type="button" class="selected" data-quality="80">Balanced</button><button type="button" data-quality="92">Best quality</button></div>
            </section>
            <section class="settings-section" id="advanced-settings"><h3>Options</h3>
              <label class="toggle-row"><span><strong>Maximum file size</strong></span><input id="limit-size" type="checkbox" role="switch"><span class="switch"></span></label>
              <div id="limit-options" hidden><label class="field-label" for="max-bytes">Maximum per image</label><div class="size-input"><input id="max-bytes" type="number" min="0.001" step="any" value="500"><select id="size-unit" aria-label="File size unit"><option value="1024">KB</option><option value="1048576">MB</option></select></div></div>
              <div class="mini-divider"></div><label class="toggle-row"><span><strong>Resize large images</strong></span><input id="resize" type="checkbox" role="switch"><span class="switch"></span></label>
              <div id="resize-options" hidden><label class="field-label" for="max-size">Maximum long edge</label><div class="number-wrap"><input id="max-size" type="number" min="64" max="32768" value="2400" step="1"><span>px</span></div></div>
            </section>
            <section id="quick-panel" class="settings-section quick-panel" hidden><div class="quick-heading"><h3>Folder processing</h3><span id="folder-count"></span></div><p id="source-folders"></p><fieldset id="folder-modes"><label class="mode-option"><input type="radio" name="folder-mode" value="copy" checked><span><strong>Duplicate folder</strong><small>Keep non-image files</small></span></label><label class="mode-option"><input type="radio" name="folder-mode" value="images"><span><strong>Images only</strong><small>Keep subfolders</small></span></label><label class="mode-option"><input type="radio" name="folder-mode" value="replace"><span><strong>Replace originals</strong><small>Overwrites source images</small></span></label></fieldset><p id="mode-note" class="mode-note"></p></section>
          </fieldset>
        </div>
        <div class="settings-footer">
          <div id="output-controls"><span class="destination-label">Save files to</span><button id="folder" class="folder-button">${icon('folder')}<span id="folder-label">Choose output folder</span><span class="folder-arrow">⌄</span></button><p class="hint" id="output-hint" hidden></p></div>
          <p id="replace-warning" class="replace-warning" hidden>Original images will be overwritten. Keep a backup if you need the source files.</p>
          <div class="action-area"><div id="progress-wrap" hidden><div class="progress-label"><span id="progress-text">Preparing…</span><span id="progress-count"></span></div><progress id="progress" max="100" value="0"></progress></div>
            <button id="compress" class="button primary" disabled>Export SVGs ${icon('arrow')}</button><button id="cancel" class="button cancel" hidden>Stop after this image</button><p class="action-note" id="action-note"></p></div>
        </div>
      </aside>
    </div>
    <section id="summary" class="summary" hidden aria-live="polite"></section>
    <div id="notice" role="status" aria-live="polite"></div>
  </main>
  <div id="updates-modal" class="updates-backdrop" hidden>
    <section class="updates-dialog" role="dialog" aria-modal="true" aria-labelledby="updates-heading">
      <header class="updates-dialog-header"><h2 id="updates-heading">Software Update</h2><button id="updates-close" type="button" aria-label="Close">×</button></header>
      <div class="updates-dialog-body">
        <div class="updates-version" id="updates-version">Chomp 2.1.0</div>
        <p id="updates-message">Check for updates.</p>
        <div class="updates-progress" id="updates-progress-wrap" hidden><progress max="100" value="0" id="updates-progress"></progress><span id="updates-percent"></span></div>
        <p id="updates-warning" class="updates-warning" hidden></p>
      </div>
      <footer class="updates-actions"><button type="button" id="updates-check" class="button secondary">Check now</button><button type="button" id="updates-action" class="button primary" hidden>Download update</button></footer>
    </section>
  </div>
  <div id="updates-toast" class="updates-toast" role="status" hidden><span id="updates-toast-message">Update available</span><button id="updates-toast-open" type="button">View</button><button id="updates-toast-dismiss" type="button" aria-label="Dismiss update notice">×</button></div>
</div>`;

const $ = id => document.getElementById(id);
const api = window.desktop;
function applyAppearance(state) { document.documentElement.dataset.theme = state.dark ? 'dark' : 'light'; document.documentElement.dataset.platform = state.platform;  }
if (api) { api.getAppearance().then(applyAppearance).catch(error => notice(error.message)); api.onAppearance(applyAppearance); }
else { applyAppearance({ dark: matchMedia('(prefers-color-scheme: dark)').matches, platform: 'browser', preference: 'system' }); }
let items = [], folderRoots = [], output = null, running = false, stopped = false, worker = null, scanning = false;
const mode = () => folderRoots.length ? document.querySelector('[name="folder-mode"]:checked').value : 'files';
const urls = new Set();
let workspaceMode='compress',selectedId=null,previewTimer=null,previewVersion=0,previewWorker=null,previewOriginalUrl=null,previewResultUrl=null;
const MIME={jpg:'image/jpeg',png:'image/png',svg:'image/svg+xml',webp:'image/webp',avif:'image/avif'};
const workspaceCopy={compress:['Compress','Compression'],convert:['Convert','Conversion'],vectorize:['Vectorize','Vectorization']};
const preferredFormats={compress:'webp',convert:'png',vectorize:'svg'};
function selectedItem(){return items.find(item=>item.id===selectedId)||null;}
function releasePreviewUrls(){
  if(previewOriginalUrl)URL.revokeObjectURL(previewOriginalUrl);
  if(previewResultUrl)URL.revokeObjectURL(previewResultUrl);
  previewOriginalUrl=previewResultUrl=null;
}
function stopPreview(){
  ++previewVersion;clearTimeout(previewTimer);
  if(previewWorker){previewWorker.terminate();previewWorker=null;}
}
function selectItem(item){
  selectedId=item?.id??null;
  document.querySelectorAll('.image-row').forEach(el=>el.classList.toggle('selected',el.dataset.id===String(selectedId)));
  $('selected-name').textContent=item?(item.relative||item.name):'No image selected';
  $('metric-original').textContent=item?bytes(item.size):'—';
  $('metric-output').textContent='—';$('metric-savings').textContent='—';
  $('stage-caption').textContent=item?item.name+' · '+item.format.toUpperCase():'Select an image to see its preview';
  $('preview-stage').classList.toggle('is-empty',!item);
  $('original-img').hidden=true;$('result-img').hidden=true;
  releasePreviewUrls();stopPreview();buttonState();
  if(item)queuePreview();
}
function queuePreview(){
  if(!selectedItem()||!api||running||scanning)return;
  stopPreview();$('preview-status').textContent='Rendering…';
  $('metric-output').textContent='—';$('metric-savings').textContent='—';
  previewTimer=setTimeout(renderPreview,350);
}
async function renderPreview(){
  const item=selectedItem(),token=++previewVersion;
  if(!item||!api||running)return;
  if(item.size>32*1024*1024){$('preview-status').textContent='Large image · export supported';return;}
  try{
    const data=await api.readImage(item.id);
    if(token!==previewVersion||selectedId!==item.id||running)return;
    releasePreviewUrls();
    previewOriginalUrl=URL.createObjectURL(new Blob([data],{type:MIME[item.format]||'application/octet-stream'}));
    $('original-img').src=previewOriginalUrl;$('original-img').hidden=false;
    const target=$('format').value==='original'?item.format:$('format').value;
    if(target==='jpg'&&$('remove-bg').checked){$('preview-status').textContent='JPEG cannot keep transparency';return;}
    const bitmap=item.format==='svg'?await decodeSvgBitmap(data):null;
    if(token!==previewVersion||running){bitmap?.close();return;}
    const local=new Worker(new URL('./codec.worker.js',import.meta.url),{type:'module'});
    previewWorker=local;
    local.onmessage=({data:result})=>{
      if(token!==previewVersion)return;
      previewWorker=null;local.terminate();
      if(result.error){$('preview-status').textContent='Preview unavailable';return;}
      previewResultUrl=URL.createObjectURL(new Blob([result.bytes],{type:MIME[target]}));
      $('result-img').src=previewResultUrl;$('result-img').hidden=false;
      $('metric-output').textContent=bytes(result.bytes.byteLength);
      const percent=Math.round((1-result.bytes.byteLength/item.size)*100);
      $('metric-savings').textContent=percent>=0?percent+'% smaller':Math.abs(percent)+'% larger';
      $('preview-status').textContent='Preview ready';
      $('stage-caption').textContent=item.format.toUpperCase()+' · '+result.width+' × '+result.height;
      if(result.thumbnail&&!item.url){
        const url=URL.createObjectURL(new Blob([result.thumbnail],{type:'image/webp'}));
        urls.add(url);item.url=url;
        const img=document.createElement('img');img.src=url;img.alt='';
        item.el.querySelector('.thumbnail').replaceChildren(img);
      }
    };
    local.onerror=()=>{
      if(token!==previewVersion)return;
      previewWorker=null;local.terminate();$('preview-status').textContent='Preview unavailable';
    };
    const payload={
      bytes:data,bitmap,format:target,sourceFormat:item.format,
      quality:Number($('quality').value),maxSize:$('resize').checked?Number($('max-size').value):null,
      maxBytes:$('limit-size').checked?Math.floor(Number($('max-bytes').value)*Number($('size-unit').value)):null,
      traceDetail:$('trace-detail').value,removeBackground:$('remove-bg').checked,
      bgTolerance:Number($('bg-tolerance').value),bgMode:document.querySelector('[name="bg-mode"]:checked').value
    };
    local.postMessage(payload,bitmap?[data.buffer,bitmap]:[data.buffer]);
  }catch(error){if(token===previewVersion)$('preview-status').textContent='Preview unavailable';}
}
function setWorkspace(next){
  if(running||!workspaceCopy[next])return;
  if(workspaceMode!==next&&!$('format').disabled)preferredFormats[workspaceMode]=$('format').value;
  workspaceMode=next;
  const [title,settingsTitle]=workspaceCopy[next];
  $('workspace-title').textContent=title;$('settings-title').textContent=settingsTitle;
  document.querySelectorAll('[data-workspace]').forEach(el=>{
    el.classList.toggle('active',el.dataset.workspace===next);
    el.setAttribute('aria-current',el.dataset.workspace===next?'page':'false');
  });
  $('format').value=mode()==='replace'?'original':preferredFormats[next];
  $('format').onchange();buttonState();
}
function updatePreviewSplit(){
  const value=$('compare-slider').value;
  $('original-layer').style.clipPath='inset(0 '+(100-value)+'% 0 0)';
  $('comparison-line').style.left=value+'%';$('comparison-handle').style.left=value+'%';
}
const bytes = n => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;
function notice(message) { $('notice').textContent = message; }
function buttonState() {
  const replacing = mode() === 'replace';
  $('compress').disabled = running || scanning || (!replacing && !output) || !items.length;
  const converting = $('format').value === 'svg' || items.some(item => item.format === 'svg');
  const amount=items.length+' image'+(items.length===1?'':'s');
  const label=replacing?'Replace original images':items.length&&items.every(i=>i.status==='done')?'Export again':workspaceMode==='vectorize'&&$('format').value==='svg'?'Export '+items.length+' SVG'+(items.length===1?'':'s'):workspaceMode==='convert'?'Convert '+amount:'Compress '+amount;
  $('compress').innerHTML=icon('upload')+' '+label;
  $('clear').disabled = running || scanning || (!items.length && !folderRoots.length);
  $('add').disabled = running || scanning;
  $('add-folder').disabled = running || scanning;
  $('drop').disabled = running || scanning;
  $('add-sidebar').disabled=running||scanning;
  document.querySelectorAll('[data-workspace]').forEach(el=>el.disabled=running);
  $('folder-modes').disabled = running || scanning;
  $('settings').disabled = running;
  $('total').textContent = items.length ? `${items.length} image${items.length === 1 ? '' : 's'} · ${bytes(items.reduce((s, i) => s + i.size, 0))} total` : 'No images added yet';
  $('count').textContent = items.length;
  $('empty-note').hidden = items.length > 0;
  $('drop').hidden=items.length>0;
  $('preview-stage').classList.toggle('is-empty',!items.length);
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
  const el=document.createElement('div');el.className='image-row';el.dataset.id=item.id;
  el.tabIndex=0;el.setAttribute('role','button');el.setAttribute('aria-label','Preview '+item.name);
  el.onclick=()=>{if(!running)selectItem(item);};
  el.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&e.target===el){e.preventDefault();if(!running)selectItem(item);}};
  const thumb = document.createElement('div'); thumb.className = 'thumbnail'; thumb.innerHTML = icon('image');
  const info = document.createElement('div'); info.className = 'image-info';
  const name = document.createElement('strong'); name.textContent = item.rootId ? item.relative : item.name; name.title = item.relative || item.name;
  const detail = document.createElement('span'); detail.className = 'detail'; detail.textContent = bytes(item.size);
  info.append(name, detail);
  const status = document.createElement('span'); status.className = 'status'; status.textContent = 'Ready';
  const remove = document.createElement('button'); remove.className = 'remove'; remove.innerHTML = icon('x'); remove.setAttribute('aria-label', `Remove ${item.name}`);
  remove.onclick=async e=>{e.stopPropagation();if(running)return;
    items=items.filter(i=>i!==item);await api.forgetImages([item.id]);
    if(item.url){URL.revokeObjectURL(item.url);urls.delete(item.url);}
    el.remove();if(selectedId===item.id)selectItem(items[0]||null);else buttonState();
  };
  el.append(thumb, info, status, remove); item.el = el;
  return el;
}
async function add(result) {
  const firstFolder = !folderRoots.length && result.roots?.length;
  folderRoots.push(...(result.roots || []));
  if(firstFolder){setWorkspace('compress');$('format').value='original';$('format').onchange();}
  let duplicates = 0;
  for (const file of result.files) {
    const existing = items.find(i => i.key === file.key);
    if (existing && !existing.rootId && file.rootId) {
      api.forgetImages([existing.id]); existing.el.remove(); items = items.filter(item => item !== existing);
      if (existing.url) { URL.revokeObjectURL(existing.url); urls.delete(existing.url); }
    } else if (existing) { duplicates++; api.forgetImages([file.id]); continue; }
    const item = { ...file, status: 'ready' }; items.push(item); $('queue').append(row(item));
  }
  $('summary').hidden=true;buttonState();
  if(!selectedItem()&&items.length)selectItem(items[0]);
  notice([result.ignored ? `${result.ignored} non-image or oversized file(s) excluded from compression.` : '', result.skipped ? `${result.skipped} symbolic links or special files skipped.` : '', duplicates ? `${duplicates} duplicate image(s) skipped.` : '', ...(result.warnings || []), !items.length && folderRoots.length ? 'No supported images found in the selected folders.' : ''].filter(Boolean).join(' '));
}
async function importFiles(load) { if (running || scanning) return; scanning = true; buttonState(); try { await add(await load()); } catch (e) { notice(e.message); } finally { scanning = false; buttonState(); if(selectedItem()) queuePreview(); } }
async function pick() { if (!api) { notice('Open the desktop app to select images and output folders.'); return; } await importFiles(() => api.pickImages()); }
$('add').onclick=pick;$('add-sidebar').onclick=pick;$('drop').onclick=pick;
document.querySelectorAll('[data-workspace]').forEach(el=>el.onclick=()=>setWorkspace(el.dataset.workspace));
$('compare-slider').oninput=updatePreviewSplit;
$('compare-view').onclick=()=>{
  $('preview-stage').classList.remove('result-only');
  $('compare-view').classList.add('selected');$('result-view').classList.remove('selected');
};
$('result-view').onclick=()=>{
  $('preview-stage').classList.add('result-only');
  $('result-view').classList.add('selected');$('compare-view').classList.remove('selected');
};
document.querySelectorAll('[data-trace]').forEach(el=>el.onclick=()=>{
  $('trace-detail').value=el.dataset.trace;
  document.querySelectorAll('[data-trace]').forEach(button=>button.classList.toggle('selected',button===el));
  queuePreview();
});
$('add-folder').onclick = () => api ? importFiles(() => api.pickFolders()) : notice('Open the desktop app to select folders.');
document.querySelectorAll('[name="folder-mode"]').forEach(el => el.onchange = () => { if(mode()==='replace'){$('format').value='original';workspaceMode='compress';}else if($('format').value==='original')$('format').value=preferredFormats[workspaceMode];$('format').onchange();buttonState(); });
window.addEventListener('dragover', e => { e.preventDefault(); if (!running) $('drop').classList.add('dragging'); });
window.addEventListener('dragleave', e => { if (!e.relatedTarget) $('drop').classList.remove('dragging'); });
window.addEventListener('drop', async e => { e.preventDefault(); $('drop').classList.remove('dragging'); if (running || !api) return; const files = [...e.dataTransfer.files]; await importFiles(() => api.dropImages(files)); });
$('clear').onclick = async () => { try { await api.clearInputs(); for (const url of urls) URL.revokeObjectURL(url); urls.clear(); items = []; folderRoots = []; $('queue').replaceChildren(); $('summary').hidden = true; notice(''); selectItem(null); buttonState(); } catch (e) { notice(e.message); } };
$('folder').onclick = async () => { if (!api) return; try { const folder = await api.pickOutput(); if (folder) { output = folder; $('folder-label').textContent = folder.split(/[\\/]/).filter(Boolean).pop() || folder; $('folder').title = folder; buttonState(); } } catch (e) { notice(e.message); } };
function quality() { $('quality-value').innerHTML = `${$('quality').value}<span>%</span>`; document.querySelectorAll('[data-quality]').forEach(el => el.classList.toggle('selected', el.dataset.quality === $('quality').value));queuePreview(); }
$('quality').oninput = quality;
document.querySelectorAll('[data-quality]').forEach(el => el.onclick = () => { $('quality').value = el.dataset.quality; quality(); });
$('resize').onchange=()=>{$('resize-options').hidden=!$('resize').checked;queuePreview();};
$('limit-size').onchange=()=>{$('limit-options').hidden=!$('limit-size').checked;queuePreview();};
$('remove-bg').onchange=()=>{$('background-controls').hidden=!$('remove-bg').checked;queuePreview();};
document.querySelectorAll('[name="bg-mode"]').forEach(el => el.onchange = () => {
  const all = document.querySelector('[name="bg-mode"]:checked').value === 'all';
  $('bg-mode-hint').textContent = all
    ? 'Includes enclosed areas; may remove matching logo details.'
    : 'Outside edges only.';
  queuePreview();
});
$('bg-tolerance').oninput=()=>{$('bg-value').textContent=$('bg-tolerance').value;queuePreview();};
['max-size','max-bytes','size-unit'].forEach(id=>{$(id).onchange=queuePreview;});
$('trace-detail').onchange=queuePreview;
$('format').onchange = () => {
  const format = $('format').value, lossless = format === 'png' || format === 'svg';
  $('quality').disabled = lossless;
  document.querySelectorAll('[data-quality]').forEach(el => el.disabled = lossless);
  $('quality-value').innerHTML = format === 'svg' ? '<span>Vector</span>' : lossless ? '<span>Lossless</span>' : `${$('quality').value}<span>%</span>`;
  $('trace-controls').hidden=format!=='svg';
  $('compression-controls').hidden=lossless;
  $('preview-after-label').textContent=format==='svg'?'VECTOR':'RESULT';
  $('preview-badge').textContent=format==='svg'?'SVG · transparent':format==='original'?'Original format':format.toUpperCase()+(format==='jpg'?' · opaque':' · transparency');
  $('remove-bg').disabled = format === 'jpg';
  if (format === 'jpg' && $('remove-bg').checked) { $('remove-bg').checked = false; $('remove-bg').onchange(); }
  $('format-hint').textContent = format === 'jpg' ? 'JPEG does not support transparency.' : '';
  $('format-hint').hidden = format !== 'jpg';
  queuePreview();buttonState();
};
async function encode(data, settings) {
  if (!worker) worker = new Worker(new URL('./codec.worker.js', import.meta.url), { type: 'module' });
  // SVG files must be decoded with an HTMLImageElement on the document thread.
  const bitmap = settings.sourceFormat === 'svg' ? await decodeSvgBitmap(data) : null;
  return new Promise((resolve, reject) => {
    worker.onmessage = event => event.data.error ? reject(new Error(event.data.error)) : resolve(event.data);
    worker.onerror = () => { worker.terminate(); worker = null; reject(new Error('The image worker stopped. Try a smaller image.')); };
    worker.postMessage({ bytes: data, bitmap, ...settings }, bitmap ? [data.buffer, bitmap] : [data.buffer]);
  });
}
function updateItem(item, text, state) { item.status = state; item.el.querySelector('.status').textContent = text; item.el.querySelector('.status').className = `status ${state}`; }
$('cancel').onclick = () => { stopped = true; api.stopPreparation(); $('cancel').disabled = true; $('cancel').textContent = 'Stopping…'; };
$('compress').onclick = async () => {
  const maxSize = Number($('max-size').value);
  if ($('resize').checked && (!Number.isInteger(maxSize) || maxSize < 64 || maxSize > 32768)) { notice('Enter a maximum edge between 64 and 32,768 pixels.'); $('max-size').focus(); return; }
  const maxBytes = $('limit-size').checked ? Math.floor(Number($('max-bytes').value) * Number($('size-unit').value)) : null;
  if (maxBytes !== null && (!Number.isInteger(maxBytes) || maxBytes < 1024 || maxBytes > 512 * 1024 * 1024)) { notice('Set a file size between 1 KB and 512 MB.'); $('max-bytes').focus(); return; }
  const settings = { format: $('format').value, quality: Number($('quality').value), maxSize: $('resize').checked ? maxSize : null, maxBytes, traceDetail: $('trace-detail').value, removeBackground: $('remove-bg').checked, bgTolerance: Number($('bg-tolerance').value), bgMode: document.querySelector('[name="bg-mode"]:checked').value };
  if (settings.removeBackground && settings.format === 'original' && items.some(item => item.format === 'jpg')) { notice('JPEG cannot save transparency. Choose PNG, WebP, AVIF or SVG to remove the background.'); return; }
  const outputMode = mode();
  if (outputMode === 'replace' && items.some(item => !item.rootId)) { notice('Clear individual image files from the queue before replacing a folder in place.'); return; }
  stopPreview();running=true;stopped=false;buttonState();notice('');$('summary').hidden=true;$('preview-status').textContent='Exporting…';
  $('compress').hidden = true; $('cancel').hidden = false; $('cancel').disabled = false; $('cancel').textContent = 'Stop after this image'; $('progress-wrap').hidden = false;
  document.querySelectorAll('.remove').forEach(el => el.disabled = true);
  const pending = folderRoots.length || items.every(i => i.status === 'done') ? [...items] : items.filter(i => i.status !== 'done'); let completed = 0, failed = 0, original = 0, compressed = 0, batch = null, startupError = null;
  $('progress').value = 0;
  try {
    $('progress-text').textContent = outputMode === 'copy' ? 'Copying folder contents…' : 'Preparing output…'; $('progress-count').textContent = '';
    batch = await api.beginBatch({ ids: pending.map(item => item.id), mode: outputMode, maxBytes });
    for (const item of pending) {
      if (stopped) break;
      updateItem(item, 'Processing…', 'working');
      $('progress-text').textContent = 'Processing images'; $('progress-count').textContent = `${completed + failed + 1} / ${pending.length}`;
      try {
        const data = await api.readImage(item.id);
        const inputSize = data.byteLength;
        const format = settings.format === 'original' ? item.format : settings.format;
        const result = await encode(data, { ...settings, format, sourceFormat: item.format });
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
    const text = document.createElement('div'); const title = document.createElement('strong'); title.textContent = startupError ? stopped ? 'Batch stopped' : 'Batch could not start' : stopped ? 'Batch stopped' : failed ? 'Processing finished with errors' : 'Processing complete';
    const detail = document.createElement('p'); detail.textContent = `${completed} ${outputMode === 'replace' ? 'replaced' : 'saved'}${failed ? ` · ${failed} failed` : ''}${completed ? ` · ${delta >= 0 ? bytes(delta) + ' saved' : bytes(-delta) + ' larger'} · ${bytes(original)} → ${bytes(compressed)}` : ''}${stopped ? ' · Remaining images stay in the queue.' : ''}`;
    text.append(title, detail); const open = document.createElement('button'); open.className = 'button secondary'; open.innerHTML = `${icon('folder')}Open folder`; open.onclick = () => api.showOutput().catch(e => notice(e.message));
    $('summary').append(mark,text);if(batch)$('summary').append(open);$('summary').hidden=false;
    if(selectedItem())queuePreview();
  }
};
let updateState = { version: '2.1.0', mode: 'unavailable', status: 'idle', availableVersion: null, progress: 0 };
let lastUpdateNotice = '';
let updateDialogOpen = false;
let updateReturnFocus = null;

function renderUpdateState(state) {
  if (!state || typeof state !== 'object') return;
  updateState = state;
  $('app-version').textContent = 'v' + state.version;
  $('updates-version').textContent = 'Chomp ' + state.version;
  const available = ['available', 'downloading', 'ready'].includes(state.status);
  $('update-indicator').hidden = !available;
  const messages = {
    idle: 'Check for updates.',
    checking: 'Checking…',
    current: 'Up to date.',
    available: 'Version ' + state.availableVersion + ' is available.',
    downloading: 'Downloading…',
    ready: 'Update downloaded.',
    error: state.error || 'Update check failed.',
    unavailable: 'Update checks are available in the installed app.'
  };
  $('updates-message').textContent = messages[state.status] || 'Check for updates.';
  $('updates-progress-wrap').hidden = state.status !== 'downloading';
  $('updates-progress').value = state.progress || 0;
  $('updates-percent').textContent = (state.progress || 0) + '%';
  $('updates-check').disabled = ['checking', 'downloading', 'ready'].includes(state.status) || state.mode === 'unavailable';
  $('updates-action').hidden = state.status !== 'available' && state.status !== 'ready';
  $('updates-action').disabled = state.status === 'downloading' || running;
  $('updates-action').textContent = state.status === 'ready' ? 'Restart & install' :
    state.mode === 'automatic' ? 'Download update' : 'Get update';
  $('updates-warning').hidden = state.mode !== 'manual';
  $('updates-warning').textContent = state.mode === 'manual'
    ? 'Manual installation is required on macOS and portable builds.'
    : '';
  if ((state.status === 'available' || state.status === 'ready') &&
      !updateDialogOpen && state.availableVersion && lastUpdateNotice !== state.availableVersion + ':' + state.status) {
    lastUpdateNotice = state.availableVersion + ':' + state.status;
    $('updates-toast-message').textContent = state.status === 'ready' ? 'Update ready to install' : 'Chomp ' + state.availableVersion + ' available';
    $('updates-toast').hidden = false;
  }
  if (state.status === 'current') $('updates-toast').hidden = true;
}

function openUpdateDialog() {
  updateReturnFocus = document.activeElement;
  updateDialogOpen = true;
  $('updates-toast').hidden = true;
  $('updates-modal').hidden = false;
  $('updates-close').focus();
}
function closeUpdateDialog() {
  updateDialogOpen = false;
  $('updates-modal').hidden = true;
  if (updateReturnFocus && updateReturnFocus.isConnected) updateReturnFocus.focus();
}
$('updates-open').onclick = openUpdateDialog;
$('updates-toast-open').onclick = openUpdateDialog;
$('updates-toast-dismiss').onclick = () => { $('updates-toast').hidden = true; };
$('updates-close').onclick = closeUpdateDialog;
$('updates-modal').onclick = e => { if (e.target === $('updates-modal')) closeUpdateDialog(); };
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && updateDialogOpen) closeUpdateDialog();
});
$('updates-check').onclick = async () => {
  if (!api?.checkForUpdates) return;
  try { renderUpdateState(await api.checkForUpdates()); }
  catch (error) { $('updates-message').textContent = error.message; }
};
$('updates-action').onclick = async () => {
  if (!api) return;
  try {
    if (updateState.status === 'ready') await api.installUpdate();
    else if (updateState.status === 'available') renderUpdateState(await api.downloadUpdate());
  } catch (error) { $('updates-message').textContent = error.message; }
};
if (api?.getUpdateState && api?.onUpdateStatus) {
  api.onUpdateStatus(renderUpdateState);
  api.getUpdateState().then(renderUpdateState).catch(error => {
    $('updates-message').textContent = error.message;
  });
} else {
  renderUpdateState(updateState);
}

setWorkspace('compress');updatePreviewSplit();buttonState();
