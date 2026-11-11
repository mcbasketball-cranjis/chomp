// Unpack the user-designed Icon Composer project for macOS packaging.
// .icon is a directory bundle; the ZIP preserves its folder structure on GitHub.
// Leave assets/icon-source.png and the Windows icon generation untouched.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

if (process.platform !== 'darwin') throw new Error('Preparing the Icon Composer asset requires a macOS build host.');
const archive = path.resolve('assets/chomp.icon.zip');
const destination = path.resolve('build/chomp.icon');

function unzip(args) {
  const result = spawnSync('/usr/bin/unzip', args, { encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    throw new Error('Unable to unpack the Icon Composer archive: ' + (result.stderr || result.stdout || result.error?.message));
  }
  return result.stdout;
}

const entries = unzip(['-Z', '-1', archive]).split(/\r?\n/).filter(Boolean);
const expected = 'chomp.icon/';
const files = entries.filter(entry => entry.startsWith(expected) && !entry.endsWith('/'));
if (!files.includes('chomp.icon/icon.json') || !files.some(file => file.startsWith('chomp.icon/Assets/'))) {
  throw new Error('Icon Composer archive must contain chomp.icon/icon.json and layered Assets.');
}
for (const name of entries) {
  if (!name.startsWith('chomp.icon/') && !name.startsWith('__MACOSX/')) {
    throw new Error('Unexpected file in Icon Composer archive: ' + name);
  }
  if (name.startsWith('/') || name.includes('\\') || name.split('/').some(component => component === '..' || component === '.')) {
    throw new Error('Unsafe archive path: ' + name);
  }
}

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'chomp-icon-'));
try {
  unzip(['-q', archive, 'chomp.icon/*', '-d', temp]);
  const source = path.join(temp, 'chomp.icon');
  await fs.access(path.join(source, 'icon.json'));
  const manifest = JSON.parse(await fs.readFile(path.join(source, 'icon.json'), 'utf8'));
  if (!manifest || typeof manifest !== 'object') throw new Error('Invalid Icon Composer manifest.');
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.rm(destination, { recursive: true, force: true });
  await fs.cp(source, destination, { recursive: true, errorOnExist: true, force: false, verbatimSymlinks: true });
  console.log('Prepared layered Icon Composer asset:', destination);
} finally {
  await fs.rm(temp, { recursive: true, force: true });
}
