const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { scanFolder, prepareBatch, saveFolderImage, fingerprint } = require('../electron/folders.cjs');
async function fixture(run) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'chomp-folder-'));
  const source = path.join(directory, 'site'), output = path.join(directory, 'output');
  await fs.mkdir(path.join(source, 'photos', 'deep'), { recursive: true });
  await fs.mkdir(path.join(source, 'empty')); await fs.mkdir(output);
  await fs.writeFile(path.join(source, 'index.html'), '<img src="photos/one.JPG">');
  await fs.writeFile(path.join(source, 'photos', 'one.JPG'), 'original-jpeg');
  await fs.writeFile(path.join(source, 'photos', 'deep', 'two.png'), 'original-png');
  await fs.writeFile(path.join(source, 'photos', 'deep', 'document.bin'), Buffer.from([0, 255, 90, 1]));
  try { await run({ source, output, directory }); }
  finally { await fs.rm(directory, { recursive: true, force: true }); }
}
test('recursive scan selects images and retains a manifest of non-images and empty directories', () => fixture(async ({ source }) => {
  const root = await scanFolder(source);
  assert.equal(root.images, 2); assert.equal(root.ignored, 2);
  assert.ok(root.entries.some(e => e.relative === path.join('photos', 'deep', 'two.png') && e.image));
  assert.ok(root.entries.some(e => e.relative === 'empty' && e.directory));
}));
test('duplicate mode preserves every non-image, empty directories, and failed images', () => fixture(async ({ source, output }) => {
  const root = await scanFolder(source), batch = await prepareBatch([root], output, 'copy');
  const image = root.entries.find(e => e.path.endsWith('one.JPG'));
  const saved = await saveFolderImage(batch, root, image, 'jpg', Buffer.from('compressed'));
  const destination = batch.paths[0];
  assert.equal(saved.filename, path.join('photos', 'one.JPG'));
  assert.equal(await fs.readFile(path.join(destination, saved.filename), 'utf8'), 'compressed');
  assert.equal(await fs.readFile(path.join(source, image.relative), 'utf8'), 'original-jpeg');
  assert.deepEqual(await fs.readFile(path.join(source, 'index.html')), await fs.readFile(path.join(destination, 'index.html')));
  assert.deepEqual(await fs.readFile(path.join(source, 'photos', 'deep', 'document.bin')), await fs.readFile(path.join(destination, 'photos', 'deep', 'document.bin')));
  assert.equal(await fs.readFile(path.join(destination, 'photos', 'deep', 'two.png'), 'utf8'), 'original-png');
  assert.ok((await fs.stat(path.join(destination, 'empty'))).isDirectory());
  const again = await prepareBatch([root], output, 'copy'); assert.notEqual(again.paths[0], destination);
}));
test('image-only mode preserves relative paths, excludes non-images, and resolves converted filename collisions', () => fixture(async ({ source, output }) => {
  await fs.writeFile(path.join(source, 'photos', 'one.png'), 'second-image');
  const root = await scanFolder(source), batch = await prepareBatch([root], output, 'images');
  const images = root.entries.filter(e => e.image && path.basename(e.path).startsWith('one.'));
  const results = [];
  for (const image of images) results.push(await saveFolderImage(batch, root, image, 'webp', Buffer.from(image.relative)));
  assert.notEqual(results[0].path, results[1].path);
  assert.ok(results.every(r => path.dirname(r.path) === path.join(batch.paths[0], 'photos')));
  await assert.rejects(fs.stat(path.join(batch.paths[0], 'index.html')), { code: 'ENOENT' });
  await assert.rejects(fs.stat(path.join(batch.paths[0], 'empty')), { code: 'ENOENT' });
  assert.equal(await fs.readFile(path.join(source, 'photos', 'one.JPG'), 'utf8'), 'original-jpeg');
}));
test('in-place replacement keeps names and non-images and can run again', () => fixture(async ({ source }) => {
  const root = await scanFolder(source), batch = await prepareBatch([root], null, 'replace');
  const image = root.entries.find(e => e.path.endsWith('one.JPG'));
  await saveFolderImage(batch, root, image, 'jpg', Buffer.from('first'));
  await saveFolderImage(batch, root, image, 'jpg', Buffer.from('second'));
  assert.equal(await fs.readFile(image.path, 'utf8'), 'second');
  assert.equal(await fs.readFile(path.join(source, 'index.html'), 'utf8'), '<img src="photos/one.JPG">');
  assert.deepEqual((await fs.readdir(path.dirname(image.path))).sort(), ['deep', 'one.JPG']);
  await assert.rejects(saveFolderImage(batch, root, image, 'webp', Buffer.from('bad')), /keep the original format/);
  assert.equal(await fs.readFile(image.path, 'utf8'), 'second');
}));
test('changed sources are never overwritten, and stale copies are not replaced', () => fixture(async ({ source, output }) => {
  const root = await scanFolder(source), image = root.entries.find(e => e.image);
  const batch = await prepareBatch([root], null, 'replace'); image.readSnapshot = { ...image.snapshot };
  await fs.writeFile(image.path, 'changed by someone else');
  await assert.rejects(saveFolderImage(batch, root, image, 'jpg', Buffer.from('replacement')), /Source changed/);
  assert.equal(await fs.readFile(image.path, 'utf8'), 'changed by someone else');
  const fresh = await scanFolder(source), copy = await prepareBatch([fresh], output, 'copy');
  const second = fresh.entries.find(e => e.path.endsWith('two.png'));
  await fs.writeFile(path.join(copy.paths[0], second.relative), 'edited output');
  await assert.rejects(saveFolderImage(copy, fresh, second, 'png', Buffer.from('new')), /changed while compressing/);
  assert.equal(await fs.readFile(path.join(copy.paths[0], second.relative), 'utf8'), 'edited output');
  assert.ok(!(await fs.readdir(path.dirname(second.path))).some(name => name.endsWith('.tmp')));
}));
test('rejects output inside source and stops preparation without modifying sources', () => fixture(async ({ source }) => {
  const root = await scanFolder(source);
  await assert.rejects(prepareBatch([root], path.join(source, 'photos'), 'copy'), /outside the source/);
  const output = path.dirname(source);
  await assert.rejects(prepareBatch([root], output, 'copy', () => true), /Preparation stopped/);
  assert.equal(await fs.readFile(path.join(source, 'photos', 'one.JPG'), 'utf8'), 'original-jpeg');
}));
test('directory links are skipped instead of traversed', () => fixture(async ({ source, directory }) => {
  const external = path.join(directory, 'external'); await fs.mkdir(external); await fs.writeFile(path.join(external, 'hidden.png'), 'external');
  await fs.symlink(external, path.join(source, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  const root = await scanFolder(source); assert.equal(root.images, 2); assert.equal(root.skipped, 1);
  assert.ok(!root.entries.some(entry => entry.path.includes('hidden.png')));
}));
