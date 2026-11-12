'use strict';

const REPO = 'mcbasketball-cranjis/chomp';
const API_URL = 'https://api.github.com/repos/' + REPO + '/releases/latest';
const RELEASE_BASE = 'https://github.com/' + REPO + '/releases/download/';

function parts(value) {
  const match = /^(?:v)?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(String(value));
  if (!match) return null;
  return match.slice(1).map(Number);
}

function newer(remote, local) {
  const a = parts(remote), b = parts(local);
  if (!a || !b || a.some(n => !Number.isSafeInteger(n)) || b.some(n => !Number.isSafeInteger(n))) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

function expectedAsset(platform, arch, version) {
  const v = parts(version);
  if (!v || !['arm64', 'x64'].includes(arch)) return null;
  const label = v.join('.');
  if (platform === 'darwin') return `Chomp-${label}-mac-${arch}.dmg`;
  if (platform === 'win32' && arch === 'x64') return `Chomp-${label}-win-x64-Setup.exe`;
  return null;
}

function verifiedRelease(release, platform, arch, currentVersion) {
  if (!release || release.draft || release.prerelease || !newer(release.tag_name, currentVersion)) return null;
  const version = release.tag_name.replace(/^v/, '');
  const filename = expectedAsset(platform, arch, version);
  if (!filename) return null;
  const asset = Array.isArray(release.assets) ? release.assets.find(item => item.name === filename) : null;
  const url = RELEASE_BASE + encodeURIComponent(release.tag_name) + '/' + encodeURIComponent(filename);
  if (!asset || asset.browser_download_url !== url || !(asset.size > 0)) return null;
  return { version, url, filename };
}

// macOS currently uses a custom verified ZIP installer instead of Squirrel.Mac:
// ad-hoc signatures cannot establish a stable Apple Team ID for Squirrel updates.
function verifiedMacRelease(release, arch, currentVersion) {
  if (!release || release.draft || release.prerelease || !newer(release.tag_name, currentVersion)) return null;
  if (!['x64','arm64'].includes(arch)) return null;
  const version = release.tag_name.replace(/^v/, '');
  const filename = `Chomp-${version}-mac-${arch}.zip`;
  const url = RELEASE_BASE + encodeURIComponent(release.tag_name) + '/' + encodeURIComponent(filename);
  const asset = Array.isArray(release.assets) ? release.assets.find(x => x.name === filename) : null;
  const hash = /^sha256:([0-9a-f]{64})$/i.exec(asset?.digest || '');
  if (!asset || !hash || asset.browser_download_url !== url ||
      !Number.isSafeInteger(asset.size) || asset.size < 1024*1024 || asset.size > 512*1024*1024) return null;
  return { version, filename, url, sha256: hash[1].toLowerCase(), size: asset.size, arch };
}
module.exports = { REPO, API_URL, newer, expectedAsset, verifiedRelease, verifiedMacRelease };
