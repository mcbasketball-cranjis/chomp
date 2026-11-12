const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { isStorePackage } = require('../electron/store-package.cjs');

test('Store builds are detected independently of normal NSIS downloads', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chomp-store-test-'));
  const executable = path.join(root, 'Chomp.exe');
  try {
    assert.equal(isStorePackage('win32', executable, false), false);
    assert.equal(isStorePackage('win32', executable, true), true);
    assert.equal(isStorePackage('darwin', executable, true), false);
    fs.writeFileSync(path.join(root, 'chomp-store-package.json'), '{"store":true}');
    assert.equal(isStorePackage('win32', executable, false), true);
  } finally { fs.rmSync(root, { recursive:true, force:true }); }
});

test('reserved Microsoft Store identity is complete and unchanged', () => {
  const identity = JSON.parse(fs.readFileSync(path.join(__dirname, '../store/identity.json'), 'utf8'));
  assert.deepEqual(identity, {
    name: 'CranjisMcBasketball.ChompImageConverter',
    publisher: 'CN=5CADBE67-B82C-4702-A7DC-41355D6CC8AF',
    publisherDisplayName: 'Cranjis McBasketball'
  });
});
