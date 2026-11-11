const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { saveUnique, safeStem } = require('../electron/files.cjs');
test('saving never overwrites existing files, even during concurrent writes', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gatorsqoosh-test-'));
  try {
    await fs.writeFile(path.join(dir, 'photo-compressed.webp'), 'original');
    const saved = await Promise.all(Array.from({ length: 8 }, (_, n) => saveUnique(dir, 'photo.png', 'webp', Buffer.from(`new-${n}`))));
    assert.equal(new Set(saved.map(s => s.filename)).size, 8);
    assert.equal(await fs.readFile(path.join(dir, 'photo-compressed.webp'), 'utf8'), 'original');
    assert.equal((await fs.readdir(dir)).length, 9);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
test('output names stay within the chosen folder and formats are restricted', async () => {
  assert.equal(safeStem('../../unsafe:name.png'), 'unsafe_name');
  await assert.rejects(saveUnique('.', 'file', 'exe', Buffer.from('data')), /Unsupported/);
});
