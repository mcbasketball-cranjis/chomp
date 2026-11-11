const fs = require('node:fs/promises');
const { constants } = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { supported } = require('./files.cjs');
const formats = new Set(['jpg', 'png', 'webp', 'avif', 'svg']);
const fingerprint = s => ({ size: s.size, mtimeMs: s.mtimeMs, ino: s.ino, dev: s.dev });
const unchanged = (s, before) => Object.keys(before).every(key => s[key] === before[key]);
const formatFor = file => path.extname(file).slice(1).toLowerCase().replace('jpeg', 'jpg');
function contained(parent, child) { const relative = path.relative(parent, child); return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)); }
async function verifyFile(entry, snapshot = entry.snapshot) {
  const stat = await fs.lstat(entry.path);
  if (!stat.isFile() || stat.isSymbolicLink() || await fs.realpath(entry.path) !== entry.path || !unchanged(stat, snapshot)) throw new Error('Source changed since it was added. Clear the queue and add it again.');
  return stat;
}
async function scanFolder(source) {
  const sourceStat = await fs.lstat(source);
  if (!sourceStat.isDirectory() || sourceStat.isSymbolicLink()) throw new Error('Select a regular folder, not a symbolic link.');
  const root = { id: randomUUID(), path: await fs.realpath(source), name: path.basename(source), entries: [], ignored: 0, skipped: 0, images: 0 };
  const directories = [root.path]; let visited = 0;
  while (directories.length) {
    const directory = directories.pop();
    if (await fs.realpath(directory) !== directory) throw new Error('A folder changed during scanning. Add the folder again.');
    for (const dirent of await fs.readdir(directory, { withFileTypes: true })) {
      if (++visited > 100000) throw new Error('Folder exceeds the 100,000-entry limit. Add smaller folders separately.');
      const full = path.join(directory, dirent.name);
      const stat = await fs.lstat(full);
      if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())) { root.skipped++; continue; }
      const entry = { path: full, relative: path.relative(root.path, full), directory: stat.isDirectory(), snapshot: fingerprint(stat) };
      root.entries.push(entry);
      if (entry.directory) directories.push(full);
      else if (supported.test(full) && stat.size <= 512 * 1024 * 1024) { entry.image = true; root.images++; }
      else { root.ignored++; }
    }
  }
  return root;
}
async function uniqueDirectory(parent, name) {
  for (let n = 0; n < 10000; n++) {
    const dir = path.join(parent, `${name}-compressed${n ? ` (${n})` : ''}`);
    try { await fs.mkdir(dir); return dir; } catch (e) { if (e.code !== 'EEXIST') throw e; }
  }
  throw new Error('Too many output folders with the same name.');
}
async function verifyParent(file) {
  const parent = path.dirname(file);
  if (await fs.realpath(parent) !== parent) throw new Error('Destination folder changed. Choose the output again.');
}
async function atomicReplace(target, bytes, expected, mode) {
  await verifyParent(target);
  const temporary = path.join(path.dirname(target), `.chomp-${randomUUID()}.tmp`);
  let handle;
  try {
    handle = await fs.open(temporary, 'wx', mode);
    await handle.writeFile(bytes); await handle.sync(); await handle.close(); handle = null;
    await verifyParent(target);
    const current = await fs.lstat(target);
    if (!current.isFile() || current.isSymbolicLink() || !unchanged(current, expected)) throw new Error('Image changed while compressing. The original was not replaced.');
    await fs.rename(temporary, target);
  } finally { if (handle) await handle.close(); await fs.unlink(temporary).catch(() => {}); }
}
async function writeUnique(target, bytes) {
  await verifyParent(target);
  const { name, ext, dir } = path.parse(target);
  for (let n = 0; n < 10000; n++) {
    const candidate = path.join(dir, `${name}${n ? ` (${n})` : ''}${ext}`);
    let handle;
    try {
      handle = await fs.open(candidate, 'wx');
    } catch (e) { if (e.code === 'EEXIST') continue; throw e; }
    try { await handle.writeFile(bytes); await handle.sync(); await handle.close(); return candidate; }
    catch (e) { await handle.close().catch(() => {}); await fs.unlink(candidate).catch(() => {}); throw e; }
  }
  throw new Error('Too many output files with the same name.');
}
async function prepareBatch(roots, outputParent, mode, canceled = () => false) {
  if (!['copy', 'images', 'replace'].includes(mode)) throw new Error('Invalid folder mode.');
  const destinations = new Map(), copySnapshots = new Map();
  if (mode === 'replace') return { mode, destinations, paths: roots.map(root => root.path) };
  const parent = await fs.realpath(outputParent);
  if (roots.some(root => contained(root.path, parent))) throw new Error('Choose an output location outside the source folders.');
  for (const root of roots) {
    const destination = await uniqueDirectory(parent, root.name); destinations.set(root.id, destination);
    for (const entry of root.entries) {
      if (canceled()) throw new Error('Preparation stopped. Partial output folders may remain; source files were not changed.');
      const target = path.join(destination, entry.relative);
      if (!contained(destination, target)) throw new Error('Invalid relative path.');
      if (entry.directory && mode === 'copy') await fs.mkdir(target, { recursive: true });
      else if (mode === 'copy') {
        await verifyFile(entry); await fs.mkdir(path.dirname(target), { recursive: true }); await verifyParent(target);
        await fs.copyFile(entry.path, target, constants.COPYFILE_EXCL);
        copySnapshots.set(target, fingerprint(await fs.lstat(target)));
        await verifyFile(entry);
      }
    }
  }
  return { mode, destinations, copySnapshots, paths: [...destinations.values()] };
}
async function saveFolderImage(batch, root, entry, format, bytes) {
  if (!formats.has(format)) throw new Error('Invalid image format.');
  const stat = await verifyFile(entry, entry.readSnapshot || entry.snapshot);
  if (batch.mode === 'replace') {
    if (format !== formatFor(entry.path)) throw new Error('In-place replacement must keep the original format.');
    await atomicReplace(entry.path, bytes, entry.readSnapshot || entry.snapshot, stat.mode);
    entry.snapshot = fingerprint(await fs.lstat(entry.path)); entry.readSnapshot = null;
    return { filename: entry.relative, path: entry.path };
  }
  const destination = batch.destinations.get(root.id);
  if (!destination) throw new Error('Folder is not part of this batch.');
  const original = path.join(destination, entry.relative);
  const target = path.join(path.dirname(original), path.parse(original).name + '.' + (formatFor(entry.path) === format ? path.extname(entry.path).slice(1) : format));
  await fs.mkdir(path.dirname(target), { recursive: true });
  if (batch.mode === 'copy' && target === original) {
    const copied = await fs.lstat(original);
    await atomicReplace(original, bytes, batch.copySnapshots.get(original), copied.mode);
    return { filename: entry.relative, path: original };
  }
  const saved = await writeUnique(target, bytes);
  if (batch.mode === 'copy') { await verifyParent(original); await fs.unlink(original); }
  return { filename: path.relative(destination, saved), path: saved };
}
module.exports = { scanFolder, prepareBatch, saveFolderImage, verifyFile, fingerprint, formatFor, contained, atomicReplace };
