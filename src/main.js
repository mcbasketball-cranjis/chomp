import { decodeSvgBitmap } from './svg-input.js';
import { normalizeTraceOptions } from './trace-options.js';
import { vectorPathBounds, vectorPathPoints, moveVectorPathPoint,
  nearestVectorPathSegment, insertVectorPathPoint, deleteVectorPathPoint,
  setVectorPathSegmentType } from './vector-path.js';
import { openVectorDocument, modifyVectorShape, modifyVectorShapes,
  matchingShapeIds, vectorPalette, undoVectorEdit, redoVectorEdit,
  resetVectorEdits, optimizeVectorDocument, hasVectorEdits, serializeVectorDocument } from './vector-editor.js';
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
    <div class="sidebar-updates"><button id="updates-open" type="button" aria-haspopup="dialog">${icon('refresh')}<span>Updates</span><span id="update-indicator" hidden></span></button><span id="app-version">v2.1.4</span></div>
  </aside>
  <main class="main-content">
    <header class="intro"><h1 id="workspace-title">Compress</h1><div class="header-actions"><button type="button" class="button secondary" id="new-batch" hidden>Clear all</button><button type="button" class="button secondary" id="add">${icon('upload')} Add images</button></div></header>
    <div class="workspace">
      <div class="center-column">
        <section class="preview-panel" aria-label="Image comparison">
          <header class="preview-heading"><div><strong>Preview</strong><span id="selected-name" class="selected-filename"></span></div><div class="preview-heading-right"><span id="preview-badge" class="format-badge">SVG · transparent</span><span id="preview-status">Ready</span></div></header>
          <div class="preview-stage" id="preview-stage">
            <div class="preview-image-wrap result-image" id="result-layer"><img id="result-img" alt="Processed image preview" hidden><img id="vector-source-overlay" class="vector-source-overlay" alt="" aria-hidden="true" hidden></div>
            <div class="preview-image-wrap original-image" id="original-layer"><img id="original-img" alt="Original image preview" hidden></div>
            <div id="comparison-line" class="comparison-line"></div><div id="comparison-handle" class="comparison-handle" aria-hidden="true">‹ ›</div>
            <span class="preview-chip before-chip">ORIGINAL</span><span class="preview-chip after-chip" id="preview-after-label">VECTOR</span>
            <input type="range" min="0" max="100" value="40" id="compare-slider" class="compare-slider" aria-label="Compare original and processed image">
            <button id="drop" class="dropzone" type="button"><span class="upload-icon">${icon('upload')}</span><strong>Drop images or folders here</strong><span><b>Browse files</b></span><span class="drop-note">JPEG, PNG, WebP, AVIF, SVG</span></button>
            <div id="empty-note" class="empty-note"><span>Drop an image to get started</span></div>
          </div>
          <footer class="preview-footer"><span class="image-metadata">${icon('image')}<span id="stage-caption">Select an image to see its preview</span></span><div class="preview-actions"><button type="button" id="vector-edit-open" class="vector-edit-open" hidden>Edit shapes</button><div class="preview-zoom" aria-label="Preview zoom"><button type="button" id="zoom-out" aria-label="Zoom out">−</button><button type="button" id="zoom-fit" title="Fit preview"><span id="zoom-value">100%</span></button><button type="button" id="zoom-in" aria-label="Zoom in">+</button><button type="button" id="zoom-pan" aria-pressed="false" title="Drag image to pan">Pan</button></div><div class="preview-switch"><button type="button" id="compare-view" class="selected">Compare</button><button type="button" id="result-view">Result only</button></div></div></footer>
          <div id="vector-edit-toolbar" class="vector-edit-toolbar" hidden>
            <span id="vector-edit-label" class="vector-edit-label">Select a shape</span>
            <label for="vector-shape-color">Fill</label>
            <input type="color" id="vector-shape-color" aria-label="Selected shape color" value="#000000" disabled>
            <input type="text" id="vector-shape-hex" class="vector-shape-hex" aria-label="Exact fill hex color" maxlength="7" autocomplete="off" spellcheck="false" value="#000000" disabled>
            <button type="button" id="vector-delete-shape" disabled>Remove</button>
            <button type="button" id="vector-point-mode" aria-pressed="false" disabled>Points</button>
            <button type="button" id="vector-add-point" aria-pressed="false" disabled>Insert point</button>
            <button type="button" id="vector-remove-point" disabled>Delete point</button>
            <button type="button" id="vector-straight" disabled>Straight</button>
            <button type="button" id="vector-curve" disabled>Curve</button>
            <label class="vector-match-option" for="vector-match-colors"><input id="vector-match-colors" type="checkbox"> All matching colors</label>
            <div class="vector-edit-spacer"></div>
            <button type="button" id="vector-undo" disabled>Undo</button>
            <button type="button" id="vector-redo" disabled>Redo</button>
            <button type="button" id="vector-reset" disabled>Reset</button>
            <button type="button" id="vector-optimize" disabled>Optimize</button>
            <button type="button" id="vector-eyedropper" aria-pressed="false" disabled>Pick color</button>
            <button type="button" id="vector-done" class="vector-edit-done">Done</button>
          </div>
          <div id="vector-palette" class="vector-palette" hidden>
            <span class="vector-palette-title">Colors</span>
            <div id="vector-palette-swatches" class="vector-palette-swatches" aria-label="Vector artwork colors"></div>
          </div>
          <div id="vector-inspector" class="vector-inspector" hidden>
            <div class="vector-inspector-header">
              <strong>Shapes</strong>
              <label><input type="checkbox" id="vector-only-small"> Small only</label>
              <span id="vector-inspector-count">0</span>
              <button type="button" id="vector-shape-prev" title="Previous shape" aria-label="Previous shape">‹</button>
              <button type="button" id="vector-shape-next" title="Next shape" aria-label="Next shape">›</button>
              <button type="button" id="vector-shape-focus" disabled>Zoom to</button>
            </div>
            <div id="vector-inspector-list" class="vector-inspector-list" role="listbox" aria-label="Editable vector shapes"></div>
            <div class="vector-inspector-footer">
              <span id="vector-inspector-page">1 / 1</span>
              <button type="button" id="vector-inspector-back" aria-label="Previous page">Previous</button>
              <button type="button" id="vector-inspector-forward" aria-label="Next page">Next</button>
              <span id="vector-point-help" hidden>Drag points or curve handles to refine the selected path.</span>
              <label class="vector-overlay-label"><input id="vector-overlay-toggle" type="checkbox"> Source overlay</label>
              <input id="vector-overlay-opacity" type="range" min="0" max="80" step="5" value="30" aria-label="Source overlay opacity" disabled>
              <output id="vector-overlay-percent">30%</output>
            </div>
          </div>
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
              <details id="trace-advanced" class="trace-advanced">
                <summary>Advanced tracing</summary>
                <div class="advanced-fields">
                  <label class="field-label" for="trace-mode">Artwork type</label>
                  <select id="trace-mode"><option value="auto">Auto detect</option><option value="logo">Logo &amp; text</option><option value="artwork">Illustration</option></select>
                  <label class="field-label" for="trace-colors">Colors</label>
                  <select id="trace-colors"><option value="0">Auto</option><option value="2">2</option><option value="4">4</option><option value="8">8</option><option value="12">12</option><option value="16">16</option><option value="24">24</option><option value="32">32</option></select>
                  <div class="label-row"><label class="field-label" for="trace-smoothing">Curve smoothing</label><output id="trace-smoothing-value">50</output></div>
                  <input type="range" id="trace-smoothing" min="0" max="100" value="50">
                  <div class="range-labels"><span>Precise</span><span>Smoother</span></div>
                  <div class="label-row"><label class="field-label" for="trace-corners">Sharp corners</label><output id="trace-corners-value">50</output></div>
                  <input type="range" id="trace-corners" min="0" max="100" value="50">
                  <div class="range-labels"><span>Softer</span><span>Sharper</span></div>
                  <div class="label-row"><label class="field-label" for="trace-cleanup">Noise cleanup</label><output id="trace-cleanup-value">50</output></div>
                  <input type="range" id="trace-cleanup" min="0" max="100" value="50">
                  <div class="range-labels"><span>Keep small details</span><span>Remove specks</span></div>
                  <label class="field-label" for="trace-resolution">Tracing resolution</label>
                  <select id="trace-resolution"><option value="standard">Standard</option><option value="high">High fidelity (slower)</option></select>
                  <button type="button" id="trace-reset" class="text-button trace-reset">Reset advanced settings</button>
                </div>
              </details>
              
            </section>
            <div class="settings-section" id="background-section">
              <label class="toggle-row"><span><strong>Remove background</strong></span><input id="remove-bg" type="checkbox" role="switch"><span class="switch"></span></label>
              <div id="background-controls" hidden>
                <fieldset class="bg-scope"><legend class="field-label">Removal area</legend>
                  <label class="bg-mode-option"><input type="radio" name="bg-mode" value="edges" checked><span>Edges only</span></label>
                  <label class="bg-mode-option"><input type="radio" name="bg-mode" value="all"><span>Everywhere</span></label>
                </fieldset>
                <p id="bg-mode-hint" class="hint">Outside edges only</p>
                <div class="background-picker">
                  <label class="field-label" for="bg-color-source">Background color</label>
                  <select id="bg-color-source"><option value="auto">Auto detect</option><option value="manual">Choose color</option></select>
                  <div id="bg-manual-controls" hidden>
                    <input type="color" id="bg-color" value="#ffffff" aria-label="Background color to remove"><button type="button" id="bg-pick-source" class="bg-pick-source">Pick from image</button>
                    <span>Selected color</span>
                  </div>
                </div>
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
              <div id="limit-section"><label class="toggle-row"><span><strong>Maximum file size</strong></span><input id="limit-size" type="checkbox" role="switch"><span class="switch"></span></label>
              <div id="limit-options" hidden><label class="field-label" for="max-bytes">Maximum per image</label><div class="size-input"><input id="max-bytes" type="number" min="0.001" step="any" value="500"><select id="size-unit" aria-label="File size unit"><option value="1024">KB</option><option value="1048576">MB</option></select></div></div></div>
              <div class="mini-divider"></div><label class="toggle-row"><span><strong>Resize large images</strong></span><input id="resize" type="checkbox" role="switch"><span class="switch"></span></label>
              <div id="resize-options" hidden><label class="field-label" for="max-size">Maximum long edge</label><div class="number-wrap"><input id="max-size" type="number" min="64" max="32768" value="2400" step="1"><span>px</span></div></div>
            </section>
            <section id="quick-panel" class="settings-section quick-panel" hidden><div class="quick-heading"><h3>Folder processing</h3><span id="folder-count"></span></div><p id="source-folders"></p><fieldset id="folder-modes"><label class="mode-option"><input type="radio" name="folder-mode" value="copy" checked><span><strong>Duplicate folder</strong><small>Keep non-image files</small></span></label><label class="mode-option"><input type="radio" name="folder-mode" value="images"><span><strong>Images only</strong><small>Keep subfolders</small></span></label><label class="mode-option"><input type="radio" name="folder-mode" value="replace"><span><strong>Replace originals</strong><small>Overwrites source images</small></span></label></fieldset></section>
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
        <div class="updates-version" id="updates-version">Chomp 2.1.4</div>
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
// Folder actions only apply when every queued item came from a folder import.
const isFolderBatch = () => !!items.length && !!folderRoots.length && items.every(item => !!item.rootId);
const mode = () => isFolderBatch() ? document.querySelector('[name="folder-mode"]:checked').value : 'files';
const urls = new Set();
let workspaceMode='compress',selectedId=null,previewTimer=null,previewVersion=0,previewWorker=null,previewOriginalUrl=null,previewResultUrl=null;
let previewZoom=1,previewX=0,previewY=0,previewPanMode=false,previewPointer=null;
let editorActive=false,editorPending=false,editorSelection=null,editorSvg=null;
let editorPointMode=false,editorPointSelection=null,editorPointDrag=null,inspectorPage=0;
let editorInsertMode=false,editorColorPick=false,backgroundColorPick=false;
let sampleCanvas=null,sampleContext=null,sampleImageId=null;
const inspectorBoundsCache=new Map();
const INSPECTOR_PAGE_SIZE=48;
const SVG_NS='http://www.w3.org/2000/svg';
const traceControls = () => normalizeTraceOptions({
  mode:$('trace-mode').value, colors:$('trace-colors').value,
  smoothing:$('trace-smoothing').value,corners:$('trace-corners').value,
  cleanup:$('trace-cleanup').value,resolution:$('trace-resolution').value
});
function renderZoom(){
  const transform='translate('+previewX+'px, '+previewY+'px) scale('+previewZoom+')';
  $('original-img').style.transform=transform;
  $('result-img').style.transform=transform;
  $('vector-source-overlay').style.transform=transform;
  if(editorSvg){
    editorSvg.style.transform=transform;
    const doc=currentVectorEditor();
    if(doc){
      const stage=$('preview-stage');
      const scale=Math.min(Math.max(1,stage.clientWidth-84)/Math.max(1,doc.boxWidth),
        Math.max(1,stage.clientHeight-76)/Math.max(1,doc.boxHeight))*previewZoom;
      editorSvg.querySelectorAll('.vector-point-handle').forEach(circle=>{
        const size=circle.classList.contains('anchor')?4.25:3.1;
        circle.setAttribute('r',String(Math.min(80,size/Math.max(.0001,scale))));
      });
    }
  }
  $('zoom-value').textContent=Math.round(previewZoom*100)+'%';
  const enabled=previewPanMode&&previewZoom>1;
  $('zoom-pan').disabled=previewZoom===1;
  $('zoom-pan').classList.toggle('selected',enabled);
  $('zoom-pan').setAttribute('aria-pressed',String(enabled));
  $('preview-stage').classList.toggle('pan-mode',enabled);
}
function setZoom(value){
  previewZoom=Math.max(1,Math.min(8,Math.round(value*4)/4));
  if(previewZoom===1){previewX=0;previewY=0;previewPanMode=false;}
  renderZoom();
}
function limitPan(){
  const stage=$('preview-stage');
  const maxX=stage.clientWidth*(previewZoom-1)/2;
  const maxY=stage.clientHeight*(previewZoom-1)/2;
  previewX=Math.max(-maxX,Math.min(maxX,previewX));
  previewY=Math.max(-maxY,Math.min(maxY,previewY));
}
const MIME={jpg:'image/jpeg',png:'image/png',svg:'image/svg+xml',webp:'image/webp',avif:'image/avif'};
const workspaceCopy={compress:['Compress','Compression'],convert:['Convert','Conversion'],vectorize:['Vectorize','Vectorization']};
const preferredFormats={compress:'webp',convert:'png',vectorize:'svg'};
// The input formats are intentionally shared, including SVG. These lists only
// restrict OUTPUT choices, so SVG -> PNG/JPEG/WebP/AVIF remains possible in Convert.
const outputFormats={
  compress:['original','webp','jpg','png','avif'],
  convert:['webp','jpg','png','avif'],
  vectorize:['svg']
};
const optionLabels=new Map([...$('format').options].map(option=>[option.value,option.textContent]));
function syncOutputFormats(){
  const values=mode()==='replace'?['original']:outputFormats[workspaceMode];
  const requested=mode()==='replace'?'original':preferredFormats[workspaceMode];
  $('format').replaceChildren(...values.map(value=>new Option(optionLabels.get(value),value)));
  $('format').value=values.includes(requested)?requested:values[0];
  $('format').disabled=mode()==='replace';
  $('format').onchange();
}
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

async function sourceSha256(data){
  const digest=await crypto.subtle.digest('SHA-256',data);
  return [...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
}
function vectorSignature(){
  return JSON.stringify({
    detail:$('trace-detail').value, options:traceControls(),
    removeBackground:$('remove-bg').checked, tolerance:$('bg-tolerance').value,
    area:document.querySelector('[name="bg-mode"]:checked').value,
    background:$('bg-color-source').value==='manual' ? $('bg-color').value : null,
    resize:$('resize').checked ? $('max-size').value : null
  });
}
function currentVectorEditor(item=selectedItem()){
  if (!item || !item.vectorEditor || item.vectorEditor.signature!==vectorSignature()) return null;
  return item.vectorEditor.doc;
}
function closeVectorEditor(){
  editorActive=false;editorPending=false;editorSelection=null;
  editorPointMode=false;editorPointSelection=null;editorPointDrag=null;inspectorPage=0;
  backgroundColorPick=false;$('preview-stage').classList.remove('source-color-picker');
  editorInsertMode=false;editorColorPick=false;
  sampleCanvas=null;sampleContext=null;sampleImageId=null;
  $('vector-source-overlay').hidden=true;
  $('vector-source-overlay').removeAttribute('src');
  $('vector-overlay-toggle').checked=false;
  $('vector-overlay-opacity').disabled=true;
  $('vector-overlay-opacity').value='30';
  $('vector-overlay-percent').textContent='30%';
  inspectorBoundsCache.clear();
  // Bulk actions are opt-in per editing session; never carry them to a new file.
  $('vector-match-colors').checked=false;
  $('vector-only-small').checked=false;
  if(editorSvg){editorSvg.remove();editorSvg=null;}
  $('vector-edit-toolbar').hidden=true;
  $('vector-palette').hidden=true;
  $('vector-inspector').hidden=true;
  $('vector-point-help').hidden=true;
  $('vector-point-mode').setAttribute('aria-pressed','false');
  $('preview-stage').classList.remove('editing-vector');
  $('preview-stage').classList.toggle('result-only', $('result-view').classList.contains('selected'));
  $('result-img').hidden=!previewResultUrl;
}
function renderVectorPalette() {
  const doc=currentVectorEditor();
  const target=$('vector-palette-swatches');
  target.replaceChildren();
  if(!doc || !editorActive)return;
  const selectedFill=doc.shapes.find(shape=>shape.id===editorSelection)?.fill;
  for(const {fill,count,shapeId} of vectorPalette(doc)){
    const button=document.createElement('button');
    button.type='button';button.className='vector-palette-swatch';
    button.title=fill+' · '+count+' shape'+(count===1?'':'s');
    button.setAttribute('aria-label',button.title);
    button.setAttribute('aria-pressed',String(selectedFill===fill));
    button.classList.toggle('active',selectedFill===fill);
    const swatch=document.createElement('span');
    swatch.className='vector-swatch-dot';
    swatch.style.backgroundColor=fill;
    const label=document.createElement('span');
    label.textContent=fill;
    const number=document.createElement('small');
    number.textContent=String(count);
    button.append(swatch,label,number);
    button.onclick=()=>selectEditorShape(shapeId);
    target.append(button);
  }
}
function editorToolbar(){
  const doc=currentVectorEditor();
  const shape=doc?.shapes.find(s=>s.id===editorSelection && !s.hidden);
  const visible=doc?.shapes.filter(s=>!s.hidden)||[];
  const position=shape ? visible.indexOf(shape)+1 : 0;
  $('vector-edit-label').textContent=shape ? 'Shape '+position+' of '+visible.length
    : visible.length ? 'Select a shape · '+visible.length+' available' : 'No visible shapes';
  $('vector-shape-color').disabled=!shape;
  $('vector-shape-hex').disabled=!shape;
  if(shape){
    $('vector-shape-color').value=shape.fill;
    $('vector-shape-hex').value=shape.fill;
  }
  $('vector-delete-shape').disabled=!shape;
  $('vector-undo').disabled=!doc?.undoStack.length;
  $('vector-redo').disabled=!doc?.redoStack.length;
  $('vector-reset').disabled=!doc || !hasVectorEdits(doc);
  $('vector-match-colors').disabled=!shape;
  $('vector-point-mode').disabled=!shape;
  $('vector-point-mode').classList.toggle('selected',editorPointMode);
  $('vector-point-mode').setAttribute('aria-pressed',String(editorPointMode));
  $('vector-point-help').hidden=!editorPointMode;
  $('vector-add-point').disabled=!shape||!editorPointMode;
  $('vector-add-point').classList.toggle('selected',editorInsertMode);
  $('vector-add-point').setAttribute('aria-pressed',String(editorInsertMode));
  $('vector-remove-point').disabled=!shape||!editorPointMode||!editorPointSelection||
    editorPointSelection.role!=='anchor'||editorPointSelection.index===0;
  const segmentSelected=!!shape&&editorPointMode&&editorPointSelection?.role==='anchor'&&
    editorPointSelection.index>0;
  $('vector-straight').disabled=!segmentSelected;
  $('vector-curve').disabled=!segmentSelected;
  $('vector-optimize').disabled=!doc||!doc.shapes.some(s=>!s.hidden);
  $('vector-eyedropper').disabled=!shape;
  $('vector-eyedropper').classList.toggle('selected',editorColorPick);
  $('vector-eyedropper').setAttribute('aria-pressed',String(editorColorPick));
}

function shapeInspectorBounds(shape) {
  const cached=inspectorBoundsCache.get(shape.id);
  if(cached?.d===shape.d)return cached.bounds;
  let bounds;
  try{bounds=vectorPathBounds(shape.d);}
  catch{
    const doc=currentVectorEditor();
    bounds={x:0,y:0,width:doc?.boxWidth||0,height:doc?.boxHeight||0};
  }
  inspectorBoundsCache.set(shape.id,{d:shape.d,bounds});
  return bounds;
}
function inspectorShapes(){
  const doc=currentVectorEditor();
  if(!doc)return [];
  const small=$('vector-only-small').checked;
  // Relative thresholds keep tiny glyphs discoverable even in large wordmarks.
  const threshold=Math.max(4,Math.max(doc.boxWidth,doc.boxHeight)*.075);
  return doc.shapes.filter(shape=>{
    if(shape.hidden)return false;
    if(!small)return true;
    const b=shapeInspectorBounds(shape);
    return Math.max(b.width,b.height)<=threshold;
  });
}
function selectEditorShape(id,focus=false){
  const doc=currentVectorEditor();
  if(!doc || (id && !doc.shapes.some(s=>s.id===id&&!s.hidden)))return;
  if(editorSelection!==id)editorPointSelection=null;
  editorSelection=id;
  const entries=inspectorShapes();
  const index=entries.findIndex(shape=>shape.id===id);
  if(index>=0)inspectorPage=Math.floor(index/INSPECTOR_PAGE_SIZE);
  renderShapeOverlay();
  if(focus)focusEditorShape();
}
function nextEditorShape(direction){
  const entries=inspectorShapes();
  if(!entries.length)return;
  const i=entries.findIndex(shape=>shape.id===editorSelection);
  const next=i<0?(direction>0?0:entries.length-1):(i+direction+entries.length)%entries.length;
  selectEditorShape(entries[next].id,true);
}
function focusEditorShape(){
  if(!editorSvg || !editorSelection)return;
  const path=editorSvg.querySelector('path[data-chomp-shape="'+editorSelection+'"]');
  if(!path)return;
  setZoom(1);
  const bounds=path.getBBox();
  const matrix=editorSvg.getScreenCTM();
  const stage=$('preview-stage').getBoundingClientRect();
  if(!matrix || !stage.width || !stage.height)return;
  const pixelScale=Math.hypot(matrix.a,matrix.b);
  if(!pixelScale)return;
  const zoom=Math.max(1.5,Math.min(8,.65*Math.min(
    stage.width/(Math.max(1,bounds.width)*pixelScale),
    stage.height/(Math.max(1,bounds.height)*pixelScale)
  )));
  const midpoint=editorSvg.createSVGPoint();
  midpoint.x=bounds.x+bounds.width/2;
  midpoint.y=bounds.y+bounds.height/2;
  const center=midpoint.matrixTransform(matrix);
  setZoom(zoom);
  previewX=(stage.left+stage.width/2-center.x)*previewZoom;
  previewY=(stage.top+stage.height/2-center.y)*previewZoom;
  limitPan();renderZoom();
}
function renderShapeInspector(){
  const target=$('vector-inspector-list');
  target.replaceChildren();
  if(!editorActive)return;
  const entries=inspectorShapes();
  const pageCount=Math.max(1,Math.ceil(entries.length/INSPECTOR_PAGE_SIZE));
  inspectorPage=Math.max(0,Math.min(inspectorPage,pageCount-1));
  $('vector-inspector-count').textContent=entries.length+' shapes';
  $('vector-inspector-page').textContent=(inspectorPage+1)+' / '+pageCount;
  $('vector-inspector-back').disabled=inspectorPage===0;
  $('vector-inspector-forward').disabled=inspectorPage===pageCount-1;
  $('vector-shape-prev').disabled=!entries.length;
  $('vector-shape-next').disabled=!entries.length;
  $('vector-shape-focus').disabled=!editorSelection;
  const from=inspectorPage*INSPECTOR_PAGE_SIZE;
  for(let i=from;i<Math.min(entries.length,from+INSPECTOR_PAGE_SIZE);i++){
    const shape=entries[i];
    const bounds=shapeInspectorBounds(shape);
    const item=document.createElement('button');
    item.type='button';
    item.className='vector-inspector-item';
    item.setAttribute('role','option');
    item.setAttribute('aria-selected',String(shape.id===editorSelection));
    item.classList.toggle('selected',shape.id===editorSelection);
    const swatch=document.createElement('span');
    swatch.className='vector-swatch-dot';
    swatch.style.backgroundColor=shape.fill;
    const name=document.createElement('strong');
    name.textContent='Shape '+(Number(shape.id.slice(1))+1);
    const dimensions=document.createElement('small');
    dimensions.textContent=Math.round(bounds.width)+' × '+Math.round(bounds.height);
    item.append(swatch,name,dimensions);
    item.title='Select and zoom to shape '+(Number(shape.id.slice(1))+1);
    item.onclick=()=>selectEditorShape(shape.id,true);
    target.append(item);
  }
}


function updateSourceOverlay(){
  const visible=editorActive && $('vector-overlay-toggle').checked && !!previewOriginalUrl;
  const img=$('vector-source-overlay');
  if(visible && img.src!==previewOriginalUrl)img.src=previewOriginalUrl;
  img.hidden=!visible;
  img.style.opacity=String(Number($('vector-overlay-opacity').value)/100);
  $('vector-overlay-opacity').disabled=!editorActive || !$('vector-overlay-toggle').checked;
  $('vector-overlay-percent').textContent=$('vector-overlay-opacity').value+'%';
}
function getLocalPoint(svg,clientX,clientY){
  const matrix=svg.getScreenCTM();
  if(!matrix)throw new Error('Preview coordinates unavailable.');
  const p=svg.createSVGPoint();
  p.x=clientX;p.y=clientY;
  return p.matrixTransform(matrix.inverse());
}
async function ensureSourceCanvas(){
  const item=selectedItem(),image=$('original-img');
  if(!item || !image.src)throw new Error('Choose an image before sampling colors.');
  if(sampleContext && sampleImageId===item.id)return {canvas:sampleCanvas,ctx:sampleContext};
  if(!image.complete || !image.naturalWidth)await image.decode();
  const factor=Math.min(1,Math.sqrt(3_000_000/(image.naturalWidth*image.naturalHeight)));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(image.naturalWidth*factor));
  canvas.height=Math.max(1,Math.round(image.naturalHeight*factor));
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)throw new Error('Unable to sample source image colors.');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(image,0,0,canvas.width,canvas.height);
  sampleCanvas=canvas;sampleContext=ctx;sampleImageId=item.id;
  return {canvas,ctx};
}
async function sampleSourcePixel(fractionX,fractionY){
  const {canvas,ctx}=await ensureSourceCanvas();
  if(!Number.isFinite(fractionX)||!Number.isFinite(fractionY)||
     fractionX<0||fractionY<0||fractionX>=1||fractionY>=1)
    throw new Error('Click within the source image to sample a color.');
  const x=Math.max(0,Math.min(canvas.width-1,Math.floor(fractionX*canvas.width)));
  const y=Math.max(0,Math.min(canvas.height-1,Math.floor(fractionY*canvas.height)));
  const [r,g,b,a]=ctx.getImageData(x,y,1,1).data;
  if(a<8)throw new Error('That source pixel is transparent.');
  return '#'+[r,g,b].map(n=>n.toString(16).padStart(2,'0')).join('');
}
function stageImageFractions(x,y){
  // The original preview uses object-fit: contain with fixed inner padding.
  const img=$('original-img');
  const rect=img.getBoundingClientRect();
  const style=getComputedStyle(img);
  const pl=parseFloat(style.paddingLeft)||0,pr=parseFloat(style.paddingRight)||0;
  const pt=parseFloat(style.paddingTop)||0,pb=parseFloat(style.paddingBottom)||0;
  const width=Math.max(1,rect.width-pl-pr),height=Math.max(1,rect.height-pt-pb);
  const naturalW=img.naturalWidth,naturalH=img.naturalHeight;
  const factor=Math.min(width/naturalW,height/naturalH);
  const scaledW=naturalW*factor,scaledH=naturalH*factor;
  const left=rect.left+pl+(width-scaledW)/2;
  const top=rect.top+pt+(height-scaledH)/2;
  return [(x-left)/scaledW,(y-top)/scaledH];
}
async function sampleEditorColor(event,svg){
  const doc=currentVectorEditor();
  if(!doc)return;
  const local=getLocalPoint(svg,event.clientX,event.clientY);
  const fractionX=local.x/doc.boxWidth,fractionY=local.y/doc.boxHeight;
  const color=await sampleSourcePixel(fractionX,fractionY);
  editorColorPick=false;
  applySelectedFill(color);
  editorToolbar();
  notice('Sampled '+color+' from the original image.');
}
function refreshPointButtons(){
  const node=editorPointSelection;
  const doc=currentVectorEditor();
  const shape=doc?.shapes.find(s=>s.id===editorSelection && !s.hidden);
  const anchor=!!shape && editorPointMode && node?.role==='anchor';
  $('vector-remove-point').disabled=!anchor || node.index===0;
  $('vector-straight').disabled=!anchor || node.index===0;
  $('vector-curve').disabled=!anchor || node.index===0;
}

function renderSelectedPathPoints(svg,shape){
  if(!editorPointMode || !shape)return;
  let points;
  try{points=vectorPathPoints(shape.d,480);}
  catch{points={nodes:[],tooMany:true};}
  const group=document.createElementNS(SVG_NS,'g');
  group.classList.add('vector-points');
  if(points.tooMany){
    $('vector-point-help').textContent='This path has too many points to display. Try less detail or higher cleanup.';
    svg.append(group);return;
  }
  $('vector-point-help').textContent='Drag anchors or Bézier handles to reshape this path. Arrow keys nudge the selected point.';
  const doc=currentVectorEditor();
  const stage=$('preview-stage');
  const scale=Math.min(Math.max(1,stage.clientWidth-84)/Math.max(1,doc.boxWidth),
    Math.max(1,stage.clientHeight-76)/Math.max(1,doc.boxHeight))*previewZoom;
  const guides=document.createElementNS(SVG_NS,'g');
  guides.classList.add('vector-point-guides');
  const nodes=points.nodes;
  for(let i=0;i<nodes.length;i++){
    const node=nodes[i];
    if(node.role==='anchor')continue;
    const target=node.role==='control1'
      ? [...nodes.slice(0,i)].reverse().find(candidate=>candidate.role==='anchor')
      : nodes.slice(i+1).find(candidate=>candidate.role==='anchor');
    if(!target)continue;
    const guide=document.createElementNS(SVG_NS,'line');
    guide.setAttribute('x1',target.x);guide.setAttribute('y1',target.y);
    guide.setAttribute('x2',node.x);guide.setAttribute('y2',node.y);
    guides.append(guide);
  }
  group.append(guides);
  for(const node of points.nodes){
    const circle=document.createElementNS(SVG_NS,'circle');
    circle.classList.add('vector-point-handle',node.role==='anchor'?'anchor':'control');
    circle.setAttribute('cx',node.x);circle.setAttribute('cy',node.y);
    circle.setAttribute('r',String(Math.min(80,(node.role==='anchor'?4.25:3.1)/Math.max(.0001,scale))));
    circle.setAttribute('data-node-index',String(node.index));
    circle.setAttribute('data-node-role',node.role);
    circle.setAttribute('aria-label',node.role+' '+node.index);
    if(editorPointSelection && node.index===editorPointSelection.index &&
       node.role===editorPointSelection.role)circle.classList.add('active');
    circle.addEventListener('pointerdown',event=>{
      if(event.button!==0)return;
      event.stopPropagation();event.preventDefault();
      editorPointSelection={index:node.index,role:node.role};
      refreshPointButtons();
      editorPointDrag={
        pointerId:event.pointerId,shapeId:shape.id,original:shape.d,
        current:shape.d,index:node.index,role:node.role,circle,
        path:svg.querySelector('path[data-chomp-shape="'+shape.id+'"]')
      };
      svg.setPointerCapture(event.pointerId);
      circle.classList.add('active');
    });
    group.append(circle);
  }
  svg.append(group);
}

function updateVectorPointDrag(event){
  const drag=editorPointDrag,svg=editorSvg;
  if(!drag||drag.pointerId!==event.pointerId||!svg)return;
  try{
    const point=getLocalPoint(svg,event.clientX,event.clientY);
    const d=moveVectorPathPoint(drag.original,drag.index,drag.role,point.x,point.y);
    drag.current=d;drag.path?.setAttribute('d',d);
    drag.circle?.setAttribute('cx',String(point.x));
    drag.circle?.setAttribute('cy',String(point.y));
  }catch{ /* Invalid out-of-bounds positions are ignored. */ }
  event.preventDefault();
}
function finishVectorPointDrag(event,commit=true){
  const drag=editorPointDrag;
  if(!drag||drag.pointerId!==event.pointerId)return;
  editorPointDrag=null;
  const doc=currentVectorEditor();
  if(commit && doc && drag.current!==drag.original &&
      modifyVectorShape(doc,drag.shapeId,{d:drag.current})){
    afterShapeEdit();
  }else renderShapeOverlay();
  event.preventDefault();
}
window.addEventListener('pointermove',updateVectorPointDrag,true);
window.addEventListener('pointerup',event=>finishVectorPointDrag(event,true),true);
window.addEventListener('pointercancel',event=>finishVectorPointDrag(event,false),true);
function renderShapeOverlay(){
  if(editorSvg){editorSvg.remove();editorSvg=null;}
  if(!editorActive)return;
  const doc=currentVectorEditor();
  if(!doc)return;
  const svg=document.createElementNS(SVG_NS,'svg');
  svg.classList.add('vector-edit-svg');
  svg.setAttribute('viewBox','0 0 '+doc.boxWidth+' '+doc.boxHeight);
  svg.setAttribute('preserveAspectRatio','xMidYMid meet');
  svg.setAttribute('aria-label','Select a vector shape to change its color or remove it');
  for(const shape of doc.shapes){
    if(shape.hidden)continue;
    const path=document.createElementNS(SVG_NS,'path');
    path.setAttribute('d',shape.d);
    path.setAttribute('fill',shape.fill);
    path.setAttribute('fill-rule','evenodd');
    if(shape.opacity!==null)path.setAttribute('fill-opacity',String(shape.opacity));
    path.setAttribute('data-chomp-shape',shape.id);
    if(shape.id===editorSelection)path.classList.add('selected-vector-shape');
    svg.append(path);
  }
  const chosen=doc.shapes.find(shape=>shape.id===editorSelection && !shape.hidden);
  renderSelectedPathPoints(svg,chosen);
  svg.addEventListener('click',event=>{
    if(previewPanMode && previewZoom>1)return;
    if(event.target.closest('circle[data-node-index]'))return;
    if(editorColorPick){
      sampleEditorColor(event,svg).catch(e=>notice(e.message));
      return;
    }
    const path=event.target.closest('path[data-chomp-shape]');
    if(editorInsertMode){
      if(path && path.getAttribute('data-chomp-shape')!==editorSelection){
        notice('Select that shape first, then insert a point on its outline.');
        return;
      }
      // Permit clicks just outside a thin stroke: the nearest segment is
      // still checked against a small screen-pixel distance below.
      try{
        const local=getLocalPoint(svg,event.clientX,event.clientY);
        const selected=currentVectorEditor()?.shapes.find(s=>s.id===editorSelection);
        const nearest=nearestVectorPathSegment(selected.d,local.x,local.y);
        const matrix=svg.getScreenCTM();
        const screenDistance=nearest?.distance * (matrix?Math.hypot(matrix.a,matrix.b):1);
        if(!nearest || screenDistance>14)
          throw new Error('Click closer to the selected path outline.');
        const d=insertVectorPathPoint(selected.d,nearest.index,nearest.t);
        if(modifyVectorShape(currentVectorEditor(),selected.id,{d})){
          editorPointSelection={index:nearest.index,role:'anchor'};
          editorInsertMode=false;
          afterShapeEdit();
        }
      }catch(e){notice(e.message);}
      return;
    }
    if(editorPointMode && event.target===svg)return;
    selectEditorShape(path?.getAttribute('data-chomp-shape')||null);
  });
  editorSvg=svg;
  $('result-layer').append(svg);
  $('result-img').hidden=true;
  renderZoom();editorToolbar();renderVectorPalette();renderShapeInspector();
  updateSourceOverlay();
}
function editedSvgBytes(doc){
  return new TextEncoder().encode(serializeVectorDocument(doc));
}
function refreshEditedPreview(){
  const doc=currentVectorEditor();
  if(!doc)return;
  const data=editedSvgBytes(doc);
  if(previewResultUrl)URL.revokeObjectURL(previewResultUrl);
  previewResultUrl=URL.createObjectURL(new Blob([data],{type:'image/svg+xml'}));
  $('result-img').src=previewResultUrl;
  $('result-img').hidden=editorActive;
  $('metric-output').textContent=bytes(data.byteLength);
  const item=selectedItem();
  const percent=Math.round((1-data.byteLength/item.size)*100);
  $('metric-savings').textContent=percent>=0 ? percent+'% smaller' : Math.abs(percent)+'% larger';
  $('preview-status').textContent=hasVectorEdits(doc) ? 'Edited · ready' : 'Editable preview ready';
  if(editorActive)renderShapeOverlay();
}
function openShapeEditor(){
  const item=selectedItem();
  if(!item || running || scanning || editorPending || workspaceMode!=='vectorize' ||
     $('format').value!=='svg' || (item.format==='svg' && !item.canEditSvg) ||
     item.size>32*1024*1024)return;
  if(!currentVectorEditor(item)){
    editorPending=true;buttonState();queuePreview();return;
  }
  editorActive=true;editorPending=false;editorSelection=null;
  $('preview-stage').classList.add('editing-vector');
  $('preview-stage').classList.add('result-only');
  $('vector-edit-toolbar').hidden=false;
  $('vector-palette').hidden=false;
  $('vector-inspector').hidden=false;
  updateSourceOverlay();
  refreshEditedPreview();
  buttonState();
}
function afterShapeEdit(){
  const doc=currentVectorEditor();
  if(editorSelection && doc?.shapes.find(s=>s.id===editorSelection)?.hidden){
    editorSelection=null;editorPointMode=false;editorPointSelection=null;
  }
  inspectorBoundsCache.clear();
  refreshEditedPreview();
}

function selectItem(item){
  closeVectorEditor();
  selectedId=item?.id??null;
  previewPanMode=false;previewPointer=null;setZoom(1);
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
  const item=selectedItem();
  if(item.vectorEditor && item.vectorEditor.signature!==vectorSignature()){
    delete item.vectorEditor;
    closeVectorEditor();
    notice('Tracing settings changed. Previous shape edits were cleared.');
  }
  sampleContext=null;sampleCanvas=null;sampleImageId=null;
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
    const signature=vectorSignature();
    let tracingForEditor=target==='svg' &&
      (editorPending || !!currentVectorEditor(item));
    let imageHash=null;
    if(tracingForEditor || (target==='svg' && item.format==='svg')){
      imageHash=await sourceSha256(data);
      if(token!==previewVersion)return;
      if(item.vectorEditor && item.vectorEditor.sourceHash!==imageHash){
        delete item.vectorEditor;item.canEditSvg=false;closeVectorEditor();
        tracingForEditor=false;
        notice('Source image changed. Shape edits were cleared.');
      }
    }
    if(target==='jpg'&&$('remove-bg').checked){$('preview-status').textContent='JPEG cannot keep transparency';return;}
    const bitmap=item.format==='svg'?await decodeSvgBitmap(data):null;
    if(token!==previewVersion||running){bitmap?.close();return;}
    const local=new Worker(new URL('./codec.worker.js',import.meta.url),{type:'module'});
    previewWorker=local;
    local.onmessage=({data:result})=>{
      if(token!==previewVersion)return;
      previewWorker=null;local.terminate();
      if(result.error){
        editorPending=false;
        $('preview-status').textContent=result.error;buttonState();return;
      }
      // Chomp-generated SVGs can be opened again for shape editing. Other SVGs
      // remain valid passthrough inputs, without exposing unsupported tools.
      if(item.format==='svg' && target==='svg' && !currentVectorEditor(item)){
        try{
          item.vectorEditor={
            signature, sourceHash:imageHash,
            doc:openVectorDocument(new TextDecoder().decode(result.bytes))
          };
          item.canEditSvg=true;
        }catch{
          item.canEditSvg=false;
        }
      }else if(editorPending && tracingForEditor){
        try {
          item.vectorEditor={
            signature, sourceHash:imageHash,
            doc:openVectorDocument(new TextDecoder().decode(result.bytes))
          };
        }catch(error){
          editorPending=false;
          $('preview-status').textContent=error.message;
          buttonState();return;
        }
      }
      previewResultUrl=URL.createObjectURL(new Blob([result.bytes],{type:MIME[target]}));
      $('result-img').src=previewResultUrl;$('result-img').hidden=false;
      $('metric-output').textContent=bytes(result.bytes.byteLength);
      const percent=Math.round((1-result.bytes.byteLength/item.size)*100);
      $('metric-savings').textContent=percent>=0?percent+'% smaller':Math.abs(percent)+'% larger';
      $('preview-status').textContent='Preview ready';
      $('stage-caption').textContent=item.format.toUpperCase()+' · '+result.width+' × '+result.height;
      if(editorPending && currentVectorEditor(item)){
        editorPending=false;
        openShapeEditor();
      }else if(currentVectorEditor(item)){
        refreshEditedPreview();
      }
      buttonState();
      if(result.thumbnail&&!item.url){
        const url=URL.createObjectURL(new Blob([result.thumbnail],{type:'image/webp'}));
        urls.add(url);item.url=url;
        const img=document.createElement('img');img.src=url;img.alt='';
        item.el.querySelector('.thumbnail').replaceChildren(img);
      }
    };
    local.onerror=()=>{
      if(token!==previewVersion)return;
      editorPending=false;
      previewWorker=null;local.terminate();$('preview-status').textContent='Preview unavailable';
      buttonState();
    };
    const payload={
      bytes:data,bitmap,format:target,sourceFormat:item.format,
      quality:Number($('quality').value),maxSize:$('resize').checked?Number($('max-size').value):null,
      maxBytes:$('limit-size').checked?Math.floor(Number($('max-bytes').value)*Number($('size-unit').value)):null,
      traceDetail:$('trace-detail').value,traceOptions:traceControls(),traceEditable:tracingForEditor,removeBackground:$('remove-bg').checked,
      bgTolerance:Number($('bg-tolerance').value),bgMode:document.querySelector('[name="bg-mode"]:checked').value,
      bgColor:$('bg-color-source').value==='manual'?$('bg-color').value:null
    };
    local.postMessage(payload,bitmap?[data.buffer,bitmap]:[data.buffer]);
  }catch(error){
    if(token===previewVersion){
      editorPending=false;
      $('preview-status').textContent=error.message||'Preview unavailable';
      buttonState();
    }
  }
}
function setWorkspace(next){
  if(running||!workspaceCopy[next])return;
  if(next!=='vectorize')closeVectorEditor();
  // Replacing in place must keep the original file format. Switching to a
  // conversion workspace uses images-only export instead of overwriting.
  if(next!=='compress'&&mode()==='replace')
    document.querySelector('[name="folder-mode"][value="images"]').checked=true;
  workspaceMode=next;
  const [title,settingsTitle]=workspaceCopy[next];
  $('workspace-title').textContent=title;$('settings-title').textContent=settingsTitle;
  document.querySelectorAll('[data-workspace]').forEach(el=>{
    el.classList.toggle('active',el.dataset.workspace===next);
    el.setAttribute('aria-current',el.dataset.workspace===next?'page':'false');
  });
  syncOutputFormats();buttonState();
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
  $('compress').disabled = running || scanning || editorPending || (!replacing && !output) || !items.length;
  const amount=items.length+' image'+(items.length===1?'':'s');
  const label=replacing?'Replace original images':items.length&&items.every(i=>i.status==='done')?'Export again':workspaceMode==='vectorize'&&$('format').value==='svg'?'Export '+items.length+' SVG'+(items.length===1?'':'s'):workspaceMode==='convert'?'Convert '+amount:'Compress '+amount;
  $('compress').innerHTML=icon('upload')+' '+label;
  $('clear').disabled = running || scanning || (!items.length && !folderRoots.length);
  $('new-batch').hidden = !items.length && !folderRoots.length;
  $('new-batch').disabled = running || scanning;
  $('new-batch').innerHTML = icon('refresh') + ' ' +
    (items.length && items.every(item => item.status === 'done') ? 'New batch' : 'Clear all');
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
  $('quick-panel').hidden = !isFolderBatch();
  $('folder-count').textContent = `${folderRoots.length} folder${folderRoots.length === 1 ? '' : 's'}`;
  $('source-folders').textContent = folderRoots.map(root => root.name).join(' · ');
  $('output-controls').hidden = replacing;
  $('replace-warning').hidden = !replacing;
  $('format').disabled = replacing;
  $('action-note').textContent = scanning ? 'Scanning…' : (!replacing && items.length && !output) ? 'Choose an output folder.' : '';
  $('action-note').hidden = !$('action-note').textContent;
  const editable=workspaceMode==='vectorize' && $('format').value==='svg' &&
    !!selectedItem() && (selectedItem().format!=='svg' || selectedItem().canEditSvg) &&
    selectedItem().size<=32*1024*1024 && !replacing;
  $('vector-edit-open').hidden=!editable || editorActive;
  $('vector-edit-open').disabled=!editable || scanning || running || editorPending;
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
    el.remove();
    folderRoots = folderRoots.filter(root => items.some(entry => entry.rootId === root.id));
    if (!isFolderBatch() && document.querySelector('[name="folder-mode"][value="replace"]').checked)
      document.querySelector('[name="folder-mode"][value="images"]').checked = true;
    syncOutputFormats();
    if(selectedId===item.id)selectItem(items[0]||null);else buttonState();
  };
  el.append(thumb, info, status, remove); item.el = el;
  return el;
}
async function add(result) {
  const firstFolder = !folderRoots.length && result.roots?.length;
  folderRoots.push(...(result.roots || []));
  let duplicates = 0;
  for (const file of result.files) {
    const existing = items.find(i => i.key === file.key);
    if (existing && !existing.rootId && file.rootId) {
      api.forgetImages([existing.id]); existing.el.remove(); items = items.filter(item => item !== existing);
      if (existing.url) { URL.revokeObjectURL(existing.url); urls.delete(existing.url); }
    } else if (existing) { duplicates++; api.forgetImages([file.id]); continue; }
    const item = { ...file, status: 'ready' }; items.push(item); $('queue').append(row(item));
  }
  if (firstFolder && isFolderBatch()) {
    document.querySelector('[name="folder-mode"][value="copy"]').checked = true;
    setWorkspace('compress');
    $('format').value = 'original';
    $('format').onchange();
  } else {
    if (!isFolderBatch() && document.querySelector('[name="folder-mode"][value="replace"]').checked)
      document.querySelector('[name="folder-mode"][value="images"]').checked = true;
    syncOutputFormats();
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
$('vector-point-mode').onclick=()=>{
  if(!editorSelection || !currentVectorEditor())return;
  editorPointMode=!editorPointMode;
  editorPointSelection=null;editorPointDrag=null;editorInsertMode=false;editorColorPick=false;
  if(editorPointMode){previewPanMode=false;renderZoom();}
  renderShapeOverlay();
};

$('vector-add-point').onclick=()=>{
  if(!editorActive||!editorPointMode||!editorSelection)return;
  editorInsertMode=!editorInsertMode;
  editorColorPick=false;
  renderShapeOverlay();
  $('preview-status').textContent=editorInsertMode
    ? 'Click near the selected path edge to insert an anchor'
    : 'Editable preview ready';
};
$('vector-remove-point').onclick=()=>{
  if(!editorActive || !editorPointMode || !editorPointSelection ||
     editorPointSelection.role!=='anchor')return;
  const doc=currentVectorEditor(),shape=doc?.shapes.find(s=>s.id===editorSelection);
  if(!shape)return;
  try{
    const d=deleteVectorPathPoint(shape.d,editorPointSelection.index);
    if(modifyVectorShape(doc,shape.id,{d})){
      editorPointSelection=null;afterShapeEdit();
    }
  }catch(e){notice(e.message);}
};
function changeSelectedSegment(style){
  if(!editorActive||!editorPointMode||editorPointSelection?.role!=='anchor')return;
  const doc=currentVectorEditor(),shape=doc?.shapes.find(s=>s.id===editorSelection);
  if(!shape)return;
  try{
    const d=setVectorPathSegmentType(shape.d,editorPointSelection.index,style);
    if(modifyVectorShape(doc,shape.id,{d}))afterShapeEdit();
  }catch(e){notice(e.message);}
}
$('vector-straight').onclick=()=>changeSelectedSegment('line');
$('vector-curve').onclick=()=>changeSelectedSegment('curve');
$('vector-optimize').onclick=()=>{
  const doc=currentVectorEditor();
  if(!doc)return;
  try{
    const result=optimizeVectorDocument(doc);
    if(result.changed){
      editorPointSelection=null;editorInsertMode=false;
      afterShapeEdit();
      notice('Optimized '+result.changed+' vector path'+(result.changed===1?'':'s')+
        ' · '+result.bytesSaved+' characters removed.');
    }else notice('No redundant points found.');
  }catch(e){notice(e.message);}
};
$('vector-eyedropper').onclick=()=>{
  if(!editorActive||!editorSelection)return;
  editorColorPick=!editorColorPick;
  editorInsertMode=false;
  if(editorColorPick){editorPointMode=false;editorPointSelection=null;}
  renderShapeOverlay();
  if(editorColorPick)$('preview-status').textContent='Click a source color in the preview';
};
$('vector-overlay-toggle').onchange=updateSourceOverlay;
$('vector-overlay-opacity').oninput=updateSourceOverlay;
$('vector-only-small').onchange=()=>{
  inspectorPage=0;renderShapeInspector();
};
$('vector-shape-prev').onclick=()=>nextEditorShape(-1);
$('vector-shape-next').onclick=()=>nextEditorShape(1);
$('vector-shape-focus').onclick=focusEditorShape;
$('vector-inspector-back').onclick=()=>{
  inspectorPage=Math.max(0,inspectorPage-1);renderShapeInspector();
};
$('vector-inspector-forward').onclick=()=>{
  inspectorPage++;renderShapeInspector();
};
$('vector-edit-open').onclick=openShapeEditor;
$('vector-done').onclick=()=>{
  closeVectorEditor();buttonState();
};
function applySelectedFill(hex){
  const doc=currentVectorEditor();
  if(!doc || !editorSelection)return;
  if(!/^#[0-9a-fA-F]{6}$/.test(hex)){
    notice('Enter a six-digit hex color, such as #123456.');
    editorToolbar();
    return;
  }
  const ids=$('vector-match-colors').checked
    ? matchingShapeIds(doc,editorSelection) : [editorSelection];
  if(modifyVectorShapes(doc,ids,{fill:hex}))afterShapeEdit();
  else editorToolbar();
}
$('vector-shape-color').onchange=()=>applySelectedFill($('vector-shape-color').value);
$('vector-shape-hex').onchange=()=>applySelectedFill($('vector-shape-hex').value.trim());
$('vector-delete-shape').onclick=()=>{
  const doc=currentVectorEditor();
  if(!doc || !editorSelection)return;
  const ids=$('vector-match-colors').checked
    ? matchingShapeIds(doc,editorSelection) : [editorSelection];
  if(modifyVectorShapes(doc,ids,{hidden:true}))afterShapeEdit();
};
$('vector-undo').onclick=()=>{
  const doc=currentVectorEditor();
  if(doc && undoVectorEdit(doc))afterShapeEdit();
};
$('vector-redo').onclick=()=>{
  const doc=currentVectorEditor();
  if(doc && redoVectorEdit(doc))afterShapeEdit();
};
$('vector-reset').onclick=()=>{
  const doc=currentVectorEditor();
  if(!doc)return;
  resetVectorEdits(doc);editorSelection=null;afterShapeEdit();
};
document.addEventListener('keydown',event=>{
  if(!editorActive || event.target.closest('input,select,textarea') || event.altKey)return;
  const key=event.key.toLowerCase();
  if(editorPointMode && editorPointSelection && !event.metaKey && !event.ctrlKey &&
     ['arrowleft','arrowright','arrowup','arrowdown'].includes(key)){
    const doc=currentVectorEditor();
    const shape=doc?.shapes.find(s=>s.id===editorSelection&&!s.hidden);
    let node=null;
    if(shape){
      try{
        node=vectorPathPoints(shape.d,480).nodes.find(candidate=>
          candidate.index===editorPointSelection.index &&
          candidate.role===editorPointSelection.role);
      }catch{ /* An oversized path cannot be nudged interactively. */ }
    }
    if(node){
      const delta=event.shiftKey ? .25 : 1;
      const dx=key==='arrowleft'?-delta:key==='arrowright'?delta:0;
      const dy=key==='arrowup'?-delta:key==='arrowdown'?delta:0;
      const d=moveVectorPathPoint(shape.d,node.index,node.role,node.x+dx,node.y+dy);
      if(modifyVectorShape(doc,shape.id,{d}))afterShapeEdit();
      event.preventDefault();
    }
  }else if(!event.metaKey && !event.ctrlKey && ['[',']'].includes(key)){
    event.preventDefault();nextEditorShape(key===']'?1:-1);
  }else if((event.metaKey||event.ctrlKey)&&key==='z'){
    event.preventDefault();
    if(event.shiftKey)$('vector-redo').click();
    else $('vector-undo').click();
  }else if(!event.metaKey && !event.ctrlKey && (key==='delete'||key==='backspace')){
    event.preventDefault();$('vector-delete-shape').click();
  }else if(key==='escape'&&!event.metaKey&&!event.ctrlKey){
    closeVectorEditor();buttonState();
  }
});
$('zoom-in').onclick=()=>setZoom(previewZoom+.5);
$('zoom-out').onclick=()=>setZoom(previewZoom-.5);
$('zoom-fit').onclick=()=>setZoom(1);
$('zoom-pan').onclick=()=>{previewPanMode=!previewPanMode;renderZoom();};
const previewStage=$('preview-stage');
previewStage.addEventListener('pointerdown',async event=>{
  if(!backgroundColorPick || event.button!==0)return;
  event.preventDefault();event.stopPropagation();
  backgroundColorPick=false;
  previewStage.classList.remove('source-color-picker');
  try{
    const [fx,fy]=stageImageFractions(event.clientX,event.clientY);
    const color=await sampleSourcePixel(fx,fy);
    $('bg-color-source').value='manual';
    $('bg-manual-controls').hidden=false;
    $('bg-color').value=color;
    notice('Selected background color: '+color);
    queuePreview();
  }catch(e){
    $('preview-status').textContent=e.message;
  }
},true);
previewStage.addEventListener('pointerdown',e=>{
  if(!previewPanMode||previewZoom<=1||!selectedItem()||e.button!==0)return;
  previewPointer={id:e.pointerId,x:e.clientX,y:e.clientY,startX:previewX,startY:previewY};
  previewStage.setPointerCapture(e.pointerId);
  previewStage.classList.add('dragging-pan');
  e.preventDefault();
});
previewStage.addEventListener('pointermove',e=>{
  if(!previewPointer||previewPointer.id!==e.pointerId)return;
  previewX=previewPointer.startX+e.clientX-previewPointer.x;
  previewY=previewPointer.startY+e.clientY-previewPointer.y;
  limitPan();renderZoom();
});
function endPan(e){
  if(!previewPointer||previewPointer.id!==e.pointerId)return;
  previewPointer=null;previewStage.classList.remove('dragging-pan');
}
previewStage.addEventListener('pointerup',endPan);
previewStage.addEventListener('pointercancel',endPan);
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
document.querySelectorAll('[name="folder-mode"]').forEach(el => el.onchange = () => { if(mode()==='replace')setWorkspace('compress');else{syncOutputFormats();buttonState();} });
window.addEventListener('dragover', e => { e.preventDefault(); if (!running) $('drop').classList.add('dragging'); });
window.addEventListener('dragleave', e => { if (!e.relatedTarget) $('drop').classList.remove('dragging'); });
window.addEventListener('drop', async e => { e.preventDefault(); $('drop').classList.remove('dragging'); if (running || !api) return; const files = [...e.dataTransfer.files]; await importFiles(() => api.dropImages(files)); });
async function clearBatch() {
  if (!api || running || scanning) return;
  try {
    await api.clearInputs();
    for (const url of urls) URL.revokeObjectURL(url);
    urls.clear(); items = []; folderRoots = [];
    $('queue').replaceChildren(); $('summary').hidden = true;
    notice(''); syncOutputFormats(); selectItem(null); buttonState();
  } catch (e) { notice(e.message); }
}
$('clear').onclick = clearBatch;
$('new-batch').onclick = clearBatch;
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
$('bg-color-source').onchange=()=>{
  $('bg-manual-controls').hidden=$('bg-color-source').value!=='manual';
  queuePreview();
};
$('bg-color').oninput=queuePreview;
$('bg-pick-source').onclick=()=>{
  if(!selectedItem()||running||scanning)return;
  backgroundColorPick=true;setZoom(1);
  $('preview-stage').classList.add('source-color-picker');
  $('preview-status').textContent='Click the original image to sample its background';
};
['max-size','max-bytes','size-unit'].forEach(id=>{$(id).onchange=queuePreview;});
$('trace-detail').onchange=queuePreview;
for(const id of ['trace-mode','trace-colors','trace-resolution']){
  $(id).onchange=queuePreview;
}
for(const id of ['trace-smoothing','trace-corners','trace-cleanup']){
  $(id).oninput=()=>{
    $(id+'-value').textContent=$(id).value;
    queuePreview();
  };
}
$('trace-reset').onclick=()=>{
  $('trace-mode').value='auto';$('trace-colors').value='0';
  $('trace-resolution').value='standard';
  for(const id of ['trace-smoothing','trace-corners','trace-cleanup']){
    $(id).value='50';$(id+'-value').textContent='50';
  }
  queuePreview();
};
$('format').onchange = () => {
  const format = $('format').value;
  const svgPassthrough = format === 'svg' && items.length > 0 && items.every(item => item.format === 'svg');
  const lossless = format === 'png' || format === 'svg' ||
    (format === 'original' && items.length > 0 && items.every(item => ['png','svg'].includes(item.format)));
  const opaque = format === 'jpg' || (format === 'original' && items.some(item => item.format === 'jpg'));
  // Preserve each workspace's last valid non-destructive output format.
  if(mode()!=='replace'&&outputFormats[workspaceMode].includes(format))
    preferredFormats[workspaceMode]=format;
  $('quality').disabled = lossless;
  document.querySelectorAll('[data-quality]').forEach(el => el.disabled = lossless);
  $('quality-value').innerHTML = format === 'svg' ? '<span>Vector</span>' : lossless ? '<span>Lossless</span>' : `${$('quality').value}<span>%</span>`;
  $('trace-controls').hidden = format !== 'svg' || svgPassthrough;
  $('compression-controls').hidden=lossless;
  $('limit-section').hidden = format === 'svg';
  $('advanced-settings').hidden = svgPassthrough;
  $('background-section').hidden = opaque || svgPassthrough;
  $('preview-after-label').textContent=format==='svg'?'VECTOR':'RESULT';
  $('preview-badge').textContent=format==='svg'?'SVG · transparent':format==='original'?'Original format':format.toUpperCase()+(format==='jpg'?' · opaque':' · transparency');
  $('remove-bg').disabled = opaque || svgPassthrough;
  if ($('remove-bg').disabled && $('remove-bg').checked) { $('remove-bg').checked = false; $('remove-bg').onchange(); }
  $('format-hint').textContent = svgPassthrough ? 'Original SVG paths preserved.' :
    opaque ? 'JPEG does not support transparency.' : '';
  $('format-hint').hidden = !svgPassthrough && !opaque;
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
  const maxBytes = $('format').value !== 'svg' && $('limit-size').checked ? Math.floor(Number($('max-bytes').value) * Number($('size-unit').value)) : null;
  if (maxBytes !== null && (!Number.isInteger(maxBytes) || maxBytes < 1024 || maxBytes > 512 * 1024 * 1024)) { notice('Set a file size between 1 KB and 512 MB.'); $('max-bytes').focus(); return; }
  const settings = { format: $('format').value, quality: Number($('quality').value), maxSize: $('resize').checked ? maxSize : null, maxBytes, traceDetail: $('trace-detail').value, traceOptions:traceControls(), removeBackground: $('remove-bg').checked, bgTolerance: Number($('bg-tolerance').value), bgMode: document.querySelector('[name="bg-mode"]:checked').value, bgColor:$('bg-color-source').value==='manual'?$('bg-color').value:null };
  if (settings.removeBackground && settings.format === 'original' && items.some(item => item.format === 'jpg')) { notice('JPEG cannot save transparency. Choose PNG, WebP, AVIF or SVG to remove the background.'); return; }
  const outputMode = mode();
  if (outputMode === 'replace' && items.some(item => !item.rootId)) { notice('Clear individual image files from the queue before replacing a folder in place.'); return; }
  closeVectorEditor();stopPreview();running=true;stopped=false;buttonState();notice('');$('summary').hidden=true;$('preview-status').textContent='Exporting…';
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
        const cache=item.vectorEditor;
        let result;
        if(cache && cache.signature===vectorSignature() && format==='svg'){
          const hash=await sourceSha256(data);
          if(hash!==cache.sourceHash)
            throw new Error('Source image changed since editing. Remove and add the image again.');
          result={bytes:editedSvgBytes(cache.doc),width:cache.doc.width,height:cache.doc.height};
        }else{
          result=await encode(data, { ...settings, format, sourceFormat: item.format });
        }
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
    $('summary').append(mark,text);
     if(batch)$('summary').append(open);
     const next = document.createElement('button');
     next.type = 'button'; next.className = 'button secondary';
     next.innerHTML = icon('refresh') + ' New batch';
     next.onclick = clearBatch;
     $('summary').append(next);
     $('summary').hidden=false;
    if(selectedItem())queuePreview();
  }
};
let updateState = { version: '2.1.4', mode: 'unavailable', status: 'idle', availableVersion: null, progress: 0 };
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
    installing: 'Preparing installation…',
    ready: 'Update downloaded.',
    error: state.error || 'Update check failed.',
    unavailable: 'Update checks are available in the installed app.',
    store: 'Updates are managed by Microsoft Store.',
    'move-required': 'Move Chomp to Applications to enable in-app updates.'
  };
  $('updates-message').textContent = messages[state.status] || 'Check for updates.';
  $('updates-progress-wrap').hidden = state.status !== 'downloading';
  $('updates-progress').value = state.progress || 0;
  $('updates-percent').textContent = (state.progress || 0) + '%';
  $('updates-check').disabled = ['checking', 'downloading', 'ready', 'installing'].includes(state.status) || ['unavailable', 'store'].includes(state.mode);
  $('updates-action').hidden = !['available', 'ready', 'move-required'].includes(state.status);
  $('updates-action').disabled = state.status === 'downloading' || running;
  $('updates-action').textContent = state.status === 'ready' ? 'Restart & install' :
    state.mode === 'mac-move' ? 'Move to Applications' :
    ['automatic', 'mac'].includes(state.mode) ? 'Download update' : 'Get update';
  $('updates-warning').hidden = state.mode !== 'manual' && state.mode !== 'mac-move';
  $('updates-warning').textContent = state.mode === 'mac-move'
    ? 'Move Chomp to Applications once to enable in-app updates.'
    : state.mode === 'manual' ? 'Portable builds require manual installation.' : '';
  if ((state.status === 'available' || state.status === 'ready') &&
      !updateDialogOpen && state.availableVersion && lastUpdateNotice !== state.availableVersion + ':' + state.status) {
    lastUpdateNotice = state.availableVersion + ':' + state.status;
    $('updates-toast-message').textContent = state.status === 'ready' ? 'Update ready to install' : 'Chomp ' + state.availableVersion + ' available';
    $('updates-toast').hidden = false;
  }
  if (state.status === 'move-required' && lastUpdateNotice !== 'move-required') {
    lastUpdateNotice = 'move-required';
    $('updates-toast-message').textContent = 'Move Chomp to Applications';
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
    else if (updateState.status === 'available' || updateState.status === 'move-required') renderUpdateState(await api.downloadUpdate());
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
