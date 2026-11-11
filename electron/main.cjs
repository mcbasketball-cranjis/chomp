const { app, BrowserWindow, dialog, ipcMain, protocol, net, shell, session } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');
const { supported, saveUnique } = require('./files.cjs');
protocol.registerSchemesAsPrivileged([{ scheme: 'gatorsqoosh', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
let win;
const inputs = new Map();
let outputFolder = null;
let activeWrites = 0;
async function register(paths) {
  const result = [];
  let skipped = 0;
  for (const file of paths) {
    if (!supported.test(file)) { skipped++; continue; }
    try {
      const stat = await fs.stat(file);
      if (!stat.isFile() || stat.size > 150 * 1024 * 1024) { skipped++; continue; }
      const id = randomUUID();
      inputs.set(id, file);
      result.push({ id, name: path.basename(file), size: stat.size, key: file });
    } catch { skipped++; }
  }
  return { files: result, skipped };
}
function handle(name, fn) {
  ipcMain.handle(name, async (event, ...args) => {
    if (event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame || !event.senderFrame.url.startsWith('gatorsqoosh://app/')) throw new Error('Unauthorized request.');
    return fn(...args);
  });
}
app.whenReady().then(() => {
  protocol.handle('gatorsqoosh', request => {
    const url = new URL(request.url);
    if (url.host !== 'app') return new Response('', { status: 403 });
    const base = path.join(app.getAppPath(), 'dist');
    const file = path.resolve(base, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(base + path.sep)) return new Response('', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  handle('pick-images', async () => {
    const pick = await dialog.showOpenDialog(win, { title: 'Add images', properties: ['openFile', 'multiSelections'], filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'avif'] }] });
    return register(pick.canceled ? [] : pick.filePaths);
  });
  handle('drop-images', paths => {
    if (!Array.isArray(paths) || paths.length > 10000 || paths.some(p => typeof p !== 'string')) throw new Error('Invalid file list.');
    return register(paths);
  });
  handle('read-image', async id => {
    if (!inputs.has(id)) throw new Error('Please add this image again.');
    const file = inputs.get(id);
    if ((await fs.stat(file)).size > 150 * 1024 * 1024) throw new Error('Image exceeds the 150 MB limit.');
    return new Uint8Array(await fs.readFile(file));
  });
  handle('forget-images', ids => { for (const id of ids) inputs.delete(id); });
  handle('pick-output', async () => {
    if (activeWrites) throw new Error('Wait for the current file to finish saving.');
    const pick = await dialog.showOpenDialog(win, { title: 'Choose output folder', properties: ['openDirectory', 'createDirectory'] });
    if (!pick.canceled) outputFolder = pick.filePaths[0];
    return outputFolder;
  });
  handle('save-image', async ({ id, format, bytes }) => {
    if (!outputFolder || !inputs.has(id)) throw new Error('Select images and an output folder first.');
    if (!(bytes instanceof Uint8Array) || bytes.length > 600 * 1024 * 1024) throw new Error('Invalid image data.');
    activeWrites++;
    try { return await saveUnique(outputFolder, path.basename(inputs.get(id)), format, bytes); }
    finally { activeWrites--; }
  });
  handle('show-output', async () => { if (outputFolder) { const error = await shell.openPath(outputFolder); if (error) throw new Error(error); } });
  function createWindow() {
    win = new BrowserWindow({ width: 1240, height: 900, minWidth: 900, minHeight: 680, backgroundColor: '#f6f7f9', title: 'GatorSqoosh', autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true } });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', event => event.preventDefault());
    win.on('close', event => { if (activeWrites) event.preventDefault(); });
    win.loadURL('gatorsqoosh://app/index.html');
  }
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
