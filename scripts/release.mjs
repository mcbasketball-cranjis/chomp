import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const { version } = JSON.parse(await fs.readFile('package.json', 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid release version.');
const tag = `v${version}`;
const existing = spawnSync('gh', ['release', 'view', tag], { stdio: 'pipe' });
if (existing.status === 0) { console.log(`Release ${tag} already exists.`); process.exit(0); }
const files = (await fs.readdir('release-assets')).filter(file => /\.(zip|dmg|exe|json|txt)$/.test(file));
if (!files.some(file => file.includes('win-x64')) || !files.some(file => file.includes('mac-x64')) || !files.some(file => file.includes('mac-arm64'))) throw new Error('Windows or macOS packages are missing.');
if (!files.some(file => file.endsWith('-Setup.exe'))) throw new Error('Windows installer is missing.');
for (const required of [`Chomp-${version}-win-x64-Setup.zip`, `Chomp-${version}-win-x64-Portable.zip`, `Chomp-${version}-win-x64.zip`, 'Chomp-Windows-Signing-Kit.zip']) {
  if (!files.includes(required)) throw new Error(`Windows download with signing instructions is missing: ${required}`);
}
const result = spawnSync('gh', ['release', 'create', tag, ...files.map(file => `release-assets/${file}`), '--target', process.env.GITHUB_SHA, '--title', `Chomp ${version}`, '--notes-file', 'RELEASE_NOTES.md'], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status || 1);
const list = spawnSync('gh', ['release', 'list', '--limit', '100', '--json', 'name,tagName'], { encoding: 'utf8' });
if (list.status !== 0) throw new Error('Could not list old releases for cleanup.');
for (const old of JSON.parse(list.stdout)) {
  if (old.tagName !== tag && /gatorsqoosh/i.test(old.name)) {
    const removed = spawnSync('gh', ['release', 'delete', old.tagName, '--yes'], { stdio: 'inherit' });
    if (removed.status !== 0) throw new Error(`Could not remove old release ${old.tagName}`);
  }
}
