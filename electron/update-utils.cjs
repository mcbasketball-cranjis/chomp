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

module.exports = { REPO, API_URL, newer, expectedAsset, verifiedRelease };
