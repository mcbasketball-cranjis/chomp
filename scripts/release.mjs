import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const { version } = JSON.parse(await fs.readFile('package.json', 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid release version.');
const tag = `v${version}`;
const existing = spawnSync('gh', ['release', 'view', tag], { stdio: 'pipe' });
if (existing.status === 0) { console.log(`Release ${tag} already exists.`); process.exit(0); }
const files = (await fs.readdir('release-assets')).filter(file => /\.(zip|dmg)$/.test(file));
if (!files.some(file => file.includes('win-x64')) || !files.some(file => file.includes('mac-x64')) || !files.some(file => file.includes('mac-arm64'))) throw new Error('Windows or macOS packages are missing.');
const result = spawnSync('gh', ['release', 'create', tag, ...files.map(file => `release-assets/${file}`), '--target', process.env.GITHUB_SHA, '--title', `GatorSqoosh ${version}`, '--notes-file', 'RELEASE_NOTES.md'], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status || 1);
