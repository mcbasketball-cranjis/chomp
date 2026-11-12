import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const { version } = JSON.parse(await fs.readFile('package.json', 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid release version.');
const tag = `v${version}`;

function gh(...args) {
  const result = spawnSync('gh', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`gh ${args[0]} failed: ${result.stderr || result.stdout || result.error?.message}`);
  return result.stdout.trim();
}

const state = JSON.parse(gh('release', 'view', tag, '--json', 'assets,isDraft,tagName'));
if (state.tagName !== tag) throw new Error('Unexpected release tag.');
if (!state.isDraft) {
  console.log(`Release ${tag} is already published.`);
  process.exit(0);
}

const required = [
  `Chomp-${version}-mac-x64.dmg`,
  `Chomp-${version}-mac-x64.zip`,
  `Chomp-${version}-mac-arm64.dmg`,
  `Chomp-${version}-mac-arm64.zip`,
  `Chomp-${version}-win-x64-Setup.exe`,
  `Chomp-${version}-win-x64-Portable.exe`,
  `Chomp-${version}-win-x64-Setup.zip`,
  `Chomp-${version}-win-x64-Portable.zip`,
  `Chomp-${version}-win-x64.zip`,
  'Chomp-Windows-Signing-Kit.zip',
  'latest.yml',
];
// A configured Partner Center identity makes the MSIX an expected asset on
// every future release. Without that identity, omit it rather than upload an
// unusable package with a fabricated publisher.
if (process.env.CHOMP_STORE_PACKAGE_NAME) {
  required.push('Chomp-' + version + '-win-x64-Store-unsigned.msix');
}
const assets = new Map((state.assets || []).map(asset => [asset.name, asset]));
const missing = required.filter(name => !assets.has(name) || (typeof assets.get(name).size === 'number' && assets.get(name).size < 1));
if (missing.length) throw new Error('Refusing to publish incomplete release. Missing or empty assets: ' + missing.join(', '));

console.log(`Validated ${required.length} required Windows/macOS files (${assets.size} uploaded assets total).`);
gh('release', 'edit', tag, '--draft=false', '--title', `Chomp ${version}`, '--notes-file', 'RELEASE_NOTES.md');
const confirmed = JSON.parse(gh('release', 'view', tag, '--json', 'isDraft,url'));
if (confirmed.isDraft) throw new Error('Release remains a draft after publishing request.');
console.log(`Published Chomp ${version}: ${confirmed.url}`);
