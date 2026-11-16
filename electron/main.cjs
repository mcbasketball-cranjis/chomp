const { app, BrowserWindow, dialog, ipcMain, protocol, net, shell, session, nativeTheme, Menu } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');
const { createUpdateService } = require('./updater.cjs');
const { supported, videoSupported, saveUnique } = require('./files.cjs');
const { VIDEO_LIMIT, processVideo } = require('./video.cjs');
const { bundledPaths, detectFFmpeg, transcodeFFmpeg, durationOf } = require('./ffmpeg.cjs');
const { scanFolder, prepareBatch, saveFolderImage, verifyFile, fingerprint, formatFor, contained } = require('./folders.cjs');
protocol.registerSchemesAsPrivileged([{ scheme: 'chomp', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
let win;
let updates;
const inputs = new Map();
const roots = new Map();
let outputFolder = null;
let activeWrites = 0;
let activeBatch = null;
let preparing = false;
let cancelPreparation = false;
let lastPaths = [];
let videoEnginePromise = null;
async function videoEngine() {
  if (!videoEnginePromise) videoEnginePromise=(async()=>{
    const candidate=app.isPackaged ? bundledPaths(process.resourcesPath) : {
      executable:process.env.CHOMP_FFMPEG_BINARY || (process.platform==='win32'?'ffmpeg.exe':'ffmpeg'),
      probe:process.env.CHOMP_FFPROBE_BINARY || (process.platform==='win32'?'ffprobe.exe':'ffprobe')
    };
    return detectFFmpeg(candidate,{requireLGPL:app.isPackaged});
  })();
  return videoEnginePromise;
}
let activeVideoJob = null;
let themePreference = 'system';
const themeState = () => ({ preference: themePreference, dark: nativeTheme.shouldUseDarkColors, platform: process.platform });
function updateTheme() {
  if (!win || win.isDestroyed()) return;
  const dark = nativeTheme.shouldUseDarkColors;
  win.setBackgroundColor(dark ? '#101e25' : '#f1f8f7');
  if (process.platform === 'win32') win.setTitleBarOverlay({ color: dark ? '#10242c' : '#e9f6f2', symbolColor: dark ? '#d8f6ed' : '#164e4d', height: 40 });
  win.webContents.send('theme-changed', themeState());
}
async function register(paths) {
  if (activeBatch || preparing) throw new Error('Finish the current batch first.');
  const result = [];
  let skipped = 0, ignored = 0;
  const addedRoots = [], warnings = [];
  function addEntry(entry, root) {
    const id = randomUUID();
    const input = Object.assign(entry, { rootId: root?.id, format: formatFor(entry.path), kind: entry.video ? 'video' : 'image' });
    inputs.set(id, input);
    result.push({ id, name: path.basename(entry.path), size: entry.snapshot.size, key: entry.path, relative: entry.relative, rootId: root?.id, format: input.format, kind: input.kind });
  }
  for (const file of paths) {
    try {
      const stat = await fs.lstat(file);
      if (stat.isSymbolicLink()) { skipped++; continue; }
      if (stat.isDirectory()) {
        const canonical = await fs.realpath(file);
        if ([...roots.values()].some(root => contained(root.path, canonical) || contained(canonical, root.path))) { warnings.push(`${path.basename(file)} overlaps a folder already in the queue. Clear the queue to select a different root.`); continue; }
        const root = await scanFolder(file);
        roots.set(root.id, root); addedRoots.push({ id: root.id, name: root.name, images: root.images, videos: root.videos });
        for (const entry of root.entries) if (entry.image || entry.video) addEntry(entry, root);
        skipped += root.skipped; ignored += root.ignored;
      } else if (stat.isFile() && ((supported.test(file) && stat.size <= 512 * 1024 * 1024) ||
        (videoSupported.test(file) && stat.size <= VIDEO_LIMIT))) {
        addEntry({ path: await fs.realpath(file), relative: path.basename(file), snapshot: fingerprint(stat), video: videoSupported.test(file) });
      } else ignored++;
    } catch (error) { warnings.push(`Could not add ${path.basename(file)}: ${error.message}`); }
  }
  return { files: result, skipped, ignored, roots: addedRoots, warnings };
}
function handle(name, fn) {
  ipcMain.handle(name, async (event, ...args) => {
    if (event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame || !event.senderFrame.url.startsWith('chomp://app/')) throw new Error('Unauthorized request.');
    return fn(...args);
  });
}
app.whenReady().then(async () => {
  try { const saved = JSON.parse(await fs.readFile(path.join(app.getPath('userData'), 'preferences.json'), 'utf8')); if (['system', 'light', 'dark'].includes(saved.theme)) themePreference = saved.theme; } catch {}
  if (process.platform !== 'darwin') themePreference = 'system';
  nativeTheme.themeSource = themePreference;
  nativeTheme.on('updated', updateTheme);
  protocol.handle('chomp', request => {
    const url = new URL(request.url);
    if (url.host !== 'app') return new Response('', { status: 403 });
    const base = path.join(app.getAppPath(), 'dist');
    const file = path.resolve(base, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(base + path.sep)) return new Response('', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  updates = createUpdateService({
    send: state => {
      if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send('update-status', state);
    },
    canRestart: () => !activeBatch && !preparing && activeWrites === 0
  });
  handle('get-update-state', () => updates.getState());
  handle('check-for-updates', () => updates.check());
  handle('download-update', () => updates.download());
  handle('install-update', () => updates.install());
  handle('get-appearance', () => themeState());
  handle('set-appearance', async theme => {
    if (!['system', 'light', 'dark'].includes(theme)) throw new Error('Invalid theme.');
    themePreference = theme; nativeTheme.themeSource = theme;
    await fs.writeFile(path.join(app.getPath('userData'), 'preferences.json'), JSON.stringify({ theme }));
    updateTheme(); return themeState();
  });
  handle('pick-images', async () => {
    const pick = await dialog.showOpenDialog(win, { title: 'Add media', properties: ['openFile', 'multiSelections'], filters: [{ name: 'Images and videos', extensions: ['jpg','jpeg','png','webp','avif','svg','mp4','m4v','mov','mkv','webm','avi','mpg','mpeg','m2v','ts','mts','m2ts','3gp','3g2','ogv','flv','wmv','asf','vob','mxf','gif'] }] });
    return register(pick.canceled ? [] : pick.filePaths);
  });
  handle('pick-folders', async () => {
    const pick = await dialog.showOpenDialog(win, { title: 'Add folders', properties: ['openDirectory', 'multiSelections'] });
    return register(pick.canceled ? [] : pick.filePaths);
  });
  handle('drop-images', paths => {
    if (!Array.isArray(paths) || paths.length > 10000 || paths.some(p => typeof p !== 'string')) throw new Error('Invalid file list.');
    return register(paths);
  });
  handle('read-image', async id => {
    if (!inputs.has(id) || inputs.get(id).kind !== 'image') throw new Error('Please add this image again.');
    const entry = inputs.get(id);
    await verifyFile(entry);
    const data = new Uint8Array(await fs.readFile(entry.path));
    await verifyFile(entry); entry.readSnapshot = { ...entry.snapshot };
    return data;
  });
  handle('forget-images', ids => {
    if (activeBatch || preparing) return;
    for (const id of ids) inputs.delete(id);
    // Removing the final image in a folder must also release its folder root,
    // otherwise importing that folder again incorrectly reports an overlap.
    const referenced = new Set([...inputs.values()].map(input => input.rootId).filter(Boolean));
    for (const id of roots.keys()) if (!referenced.has(id)) roots.delete(id);
  });
  handle('clear-inputs', () => { if (activeBatch || preparing) throw new Error('Finish the batch first.'); inputs.clear(); roots.clear(); });
  handle('begin-batch', async ({ ids, mode, maxBytes }) => {
    if (activeBatch || preparing) throw new Error('A batch is already running.');
    if (!Array.isArray(ids) || !ids.length || ids.some(id => !inputs.has(id))) throw new Error('Invalid image selection.');
    const selected = new Set(ids.map(id => inputs.get(id).rootId).filter(Boolean));
    if (!['copy', 'images', 'replace', 'files'].includes(mode)) throw new Error('Invalid output mode.');
    if (maxBytes != null && (!Number.isInteger(maxBytes) || maxBytes < 1024 || maxBytes > 512 * 1024 * 1024)) throw new Error('Size limit must be between 1 KB and 512 MB.');
    if (mode === 'replace' && ids.some(id => !inputs.get(id).rootId || inputs.get(id).kind === 'video')) throw new Error('In-place video compression is disabled to protect the source. Use Duplicate folder or Media only.');
    if (mode !== 'replace' && !outputFolder) throw new Error('Choose an output folder first.');
    preparing = true; cancelPreparation = false;
    try {
      const selectedRoots = [...selected].map(id => roots.get(id));
      const plan = mode === 'files' ? { mode, destinations: new Map(), paths: [outputFolder] } : await prepareBatch(selectedRoots, outputFolder, mode, () => cancelPreparation);
      activeBatch = { ...plan, id: randomUUID(), ids: new Set(ids), maxBytes };
      lastPaths = plan.paths.length ? plan.paths : [outputFolder];
      return { id: activeBatch.id, paths: lastPaths };
    } finally { preparing = false; }
  });
  handle('stop-preparation', () => { cancelPreparation = true; });
  handle('end-batch', id => { if (activeBatch?.id === id) activeBatch = null; });
  handle('pick-output', async () => {
    if (activeWrites || activeBatch || preparing) throw new Error('Finish the current batch first.');
    const pick = await dialog.showOpenDialog(win, { title: 'Choose output folder', properties: ['openDirectory', 'createDirectory'] });
    if (!pick.canceled) outputFolder = pick.filePaths[0];
    return outputFolder;
  });
  handle('save-image', async ({ id, batchId, format, bytes }) => {
    if (!activeBatch || activeBatch.id !== batchId || !activeBatch.ids.has(id) || !inputs.has(id)) throw new Error('Invalid batch.');
    if (!(bytes instanceof Uint8Array) || bytes.length > 600 * 1024 * 1024) throw new Error('Invalid image data.');
    if (activeBatch.maxBytes && bytes.length > activeBatch.maxBytes) throw new Error('Image exceeds the selected size limit. Original was not replaced.');
    activeWrites++;
    try {
      const entry = inputs.get(id);
      if (entry.rootId && activeBatch.mode !== 'files') return await saveFolderImage(activeBatch, roots.get(entry.rootId), entry, format, bytes);
      await verifyFile(entry, entry.readSnapshot || entry.snapshot);
      return await saveUnique(outputFolder, path.basename(entry.path), format, bytes);
    }
    finally { activeWrites--; }
  });
  handle('get-video-engine', async () => {
    const engine=await videoEngine();
    return engine ? { available:true,version:engine.version,codecs:engine.codecs,formats:engine.formats,
      bundled:app.isPackaged } :
      {available:false,codecs:{},formats:[],message:'This build does not include a working video engine.'};
  });
  handle('compress-video', async ({ id, batchId, format, preset, codec }) => {
    if (!activeBatch || activeBatch.id !== batchId || !activeBatch.ids.has(id) ||
        !inputs.has(id) || inputs.get(id).kind !== 'video')
      throw new Error('Invalid video batch.');
    const engine=await videoEngine();
    if(!engine)throw new Error('Chomp could not start its bundled video engine.');
    if(activeVideoJob)throw new Error('Another video is already compressing.');
    if(activeBatch.mode==='replace')throw new Error('Videos cannot be replaced in place.');
    const entry=inputs.get(id),root=entry.rootId && roots.get(entry.rootId);
    let directory=outputFolder,copiedOriginal=null,copySnapshot=null;
    if(root && activeBatch.mode!=='files'){
      const destination=activeBatch.destinations.get(root.id);
      if(!destination)throw new Error('Video source folder is not in this batch.');
      directory=path.join(destination,path.dirname(entry.relative));
      await fs.mkdir(directory,{recursive:true});
      if(!contained(destination,await fs.realpath(directory)))throw new Error('Invalid output directory.');
      if(activeBatch.mode==='copy'){
        copiedOriginal=path.join(destination,entry.relative);
        copySnapshot=activeBatch.copySnapshots.get(copiedOriginal);
      }
    }
    activeWrites++;
    try{
      const duration=await durationOf(engine.probe,entry.path);
      return await processVideo({
        executable:engine.executable,entry,directory,format,preset,codec,
        copiedOriginal,copySnapshot,verifySource:()=>verifyFile(entry),
        encodeVideo:(source,target,options,onProgress)=>
          transcodeFFmpeg({...engine,duration},source,target,options,onProgress),
        onJob:job=>{activeVideoJob=job;},
        onProgress:percent=>{
          if(win && !win.isDestroyed() && !win.webContents.isDestroyed())
            win.webContents.send('video-progress',{id,percent});
        }
      });
    }finally{activeVideoJob=null;activeWrites--;}
  });
  handle('stop-video',()=>{if(activeVideoJob)activeVideoJob.cancel();});
  handle('show-output', async () => { for (const folder of lastPaths.length ? lastPaths : [outputFolder].filter(Boolean)) { const error = await shell.openPath(folder); if (error) throw new Error(error); } });
  function createWindow() {
    const dark = nativeTheme.shouldUseDarkColors;
    win = new BrowserWindow({ width: 1240, height: 940, minWidth: 960, minHeight: 720, backgroundColor: dark ? '#101e25' : '#f1f8f7', title: 'Chomp', icon: path.join(app.getAppPath(), 'dist', 'icon.png'), titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden', ...(process.platform !== 'darwin' ? { titleBarOverlay: { color: dark ? '#10242c' : '#e9f6f2', symbolColor: dark ? '#d8f6ed' : '#164e4d', height: 40 } } : {}), autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true } });
    // Let macOS use the native Icon Composer asset in the packaged app.
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', event => event.preventDefault());
    win.on('close', event => { if (activeWrites || preparing || activeBatch) event.preventDefault(); });
    win.loadURL('chomp://app/index.html');
    win.webContents.once('did-finish-load', () => win.webContents.send('update-status', updates.getState()));
  }
  if (process.platform === 'darwin') Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { label: 'Appearance', submenu: ['system','light','dark'].map(theme => ({ label: theme[0].toUpperCase()+theme.slice(1), type: 'radio', checked: themePreference === theme, click: async () => { themePreference=theme; nativeTheme.themeSource=theme; await fs.writeFile(path.join(app.getPath('userData'),'preferences.json'),JSON.stringify({theme})); updateTheme(); } })) }, { role: 'windowMenu' }]));
  else Menu.setApplicationMenu(null);
  createWindow();
  updates.start();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('before-quit', () => updates?.dispose());
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
