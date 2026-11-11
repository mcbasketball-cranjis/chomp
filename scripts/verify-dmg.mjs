import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
if (process.platform !== 'darwin') throw new Error('DMG checks require macOS.');
const dmg = (await fs.readdir('release')).find(name => name.endsWith('.dmg'));
if (!dmg) throw new Error('DMG is missing.');
const mount = await fs.mkdtemp(path.join(os.tmpdir(), 'gator-dmg-'));
const run = (command, args) => { const result = spawnSync(command, args, { stdio: 'inherit' }); if (result.status !== 0) throw new Error(`${command} failed.`); };
run('hdiutil', ['attach', path.resolve('release', dmg), '-nobrowse', '-readonly', '-mountpoint', mount]);
try {
  if (await fs.readlink(path.join(mount, 'Applications')) !== '/Applications') throw new Error('Applications shortcut is missing from DMG.');
  await fs.access(path.join(mount, 'GatorSqoosh.app', 'Contents', 'MacOS', 'GatorSqoosh'));
  console.log('PASS: DMG contains the app and drag-to-Applications shortcut.');
} finally { run('hdiutil', ['detach', mount]); await fs.rmdir(mount); }
