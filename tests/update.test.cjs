const test = require('node:test');
const assert = require('node:assert/strict');
const { newer, expectedAsset, verifiedRelease, verifiedMacRelease, REPO } = require('../electron/update-utils.cjs');

const release = (version, platform, arch) => {
  const name = expectedAsset(platform, arch, version);
  return {
    tag_name: 'v' + version,
    draft: false,
    prerelease: false,
    assets: [{
      name, size: 4000000,
      browser_download_url: `https://github.com/${REPO}/releases/download/v${version}/${name}`
    }]
  };
};

test('only newer stable semantic versions can update', () => {
  assert.equal(newer('v2.1.0', '2.0.0'), true);
  assert.equal(newer('2.1.0', '2.1.0'), false);
  assert.equal(newer('2.0.9', '2.1.0'), false);
  assert.equal(newer('v2.1.1', '2.1.0'), true);
  assert.equal(newer('2.1.0-rc.1', '2.0.0'), false);
  assert.equal(newer('not-a-version', '2.0.0'), false);
});

test('uses the correct architecture and distribution file', () => {
  assert.equal(expectedAsset('darwin', 'arm64', '2.1.0'), 'Chomp-2.1.0-mac-arm64.dmg');
  assert.equal(expectedAsset('darwin', 'x64', '2.1.0'), 'Chomp-2.1.0-mac-x64.dmg');
  assert.equal(expectedAsset('win32', 'x64', '2.1.0'), 'Chomp-2.1.0-win-x64-Setup.exe');
  assert.equal(expectedAsset('linux', 'x64', '2.1.0'), null);
});

test('only accepts published releases with exact trusted asset URLs', () => {
  const valid = release('2.1.0', 'darwin', 'arm64');
  assert.equal(verifiedRelease(valid, 'darwin', 'arm64', '2.0.0').version, '2.1.0');
  assert.equal(verifiedRelease(valid, 'darwin', 'arm64', '2.1.0'), null);
  assert.equal(verifiedRelease({ ...valid, draft: true }, 'darwin', 'arm64', '2.0.0'), null);
  assert.equal(verifiedRelease({ ...valid, prerelease: true }, 'darwin', 'arm64', '2.0.0'), null);
  assert.equal(verifiedRelease({ ...valid, assets: [] }, 'darwin', 'arm64', '2.0.0'), null);
  assert.equal(verifiedRelease({ ...valid, assets: [{ ...valid.assets[0], browser_download_url: 'https://evil.example/installer.dmg' }] }, 'darwin', 'arm64', '2.0.0'), null);
});

test('macOS update selects exact ZIP for the running CPU and requires GitHub SHA-256 digest', () => {
  for (const arch of ['arm64', 'x64']) {
    const version = '2.1.2';
    const name = `Chomp-${version}-mac-${arch}.zip`;
    const url = `https://github.com/${REPO}/releases/download/v${version}/${name}`;
    const valid = { tag_name: 'v' + version, draft: false, prerelease: false, assets: [
      { name, size: 123456789, digest: 'sha256:' + 'a'.repeat(64), browser_download_url: url }
    ] };
    const found = verifiedMacRelease(valid, arch, '2.1.1');
    assert.equal(found.filename, name);
    assert.equal(found.sha256, 'a'.repeat(64));
    assert.equal(found.size, 123456789);
    assert.equal(verifiedMacRelease(valid, arch === 'arm64' ? 'x64' : 'arm64', '2.1.1'), null);
    assert.equal(verifiedMacRelease(valid, arch, version), null);
    assert.equal(verifiedMacRelease({...valid, draft:true}, arch, '2.1.1'), null);
    assert.equal(verifiedMacRelease({...valid, prerelease:true}, arch, '2.1.1'), null);
    assert.equal(verifiedMacRelease({...valid, assets: [{...valid.assets[0], digest:null}]}, arch, '2.1.1'), null);
    assert.equal(verifiedMacRelease({...valid, assets: [{...valid.assets[0], browser_download_url:'https://evil.example.com/app.zip'}]}, arch, '2.1.1'), null);
  }
});
