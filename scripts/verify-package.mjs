import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const release = path.resolve('release');
const executable = process.env.CHOMP_TEST_EXECUTABLE || (process.platform === 'win32' ? path.join(release, 'win-unpacked', 'Chomp.exe') : path.join(release, process.arch === 'arm64' ? 'mac-arm64' : 'mac', 'Chomp.app', 'Contents', 'MacOS', 'Chomp'));
await fs.access(executable);
if (process.platform === 'win32') {
  const resources = path.join(path.dirname(executable), 'resources');
  const config = await fs.readFile(path.join(resources, 'app-update.yml'), 'utf8');
  if (!/provider:\s*github/.test(config) || !/owner:\s*mcbasketball-cranjis/.test(config) || !/repo:\s*chomp/.test(config)) {
    throw new Error('Windows package is missing its GitHub auto-update feed');
  }
  const latest = JSON.parse(await fs.readFile(path.join(release, 'latest.yml'), 'utf8'));
  const current = JSON.parse(await fs.readFile('package.json', 'utf8')).version;
  if (latest.version !== current || !latest.files?.[0]?.sha512 || !latest.files?.[0]?.url?.endsWith('-Setup.exe')) {
    throw new Error('Windows release auto-update metadata is invalid');
  }
}
if (process.platform === 'darwin') {
  const resources = path.join(path.dirname(path.dirname(executable)), 'Resources');
  const macHelper = await fs.readFile(path.join(resources, 'mac-replace.sh'), 'utf8');
  if (!macHelper.startsWith('#!/bin/sh') || !macHelper.includes('codesign --verify')) {
    throw new Error('Packaged macOS in-place update helper is missing or invalid.');
  }
  const names = await fs.readdir(resources);
  if (names.includes('Assets.car')) {
    const catalog = await fs.stat(path.join(resources, 'Assets.car'));
    if (!catalog.isFile() || catalog.size < 1024) throw new Error('Invalid compiled Icon Composer catalog.');
    const plist = path.join(path.dirname(resources), 'Info.plist');
    const icon = spawnSync('/usr/bin/plutil', ['-extract', 'CFBundleIconName', 'raw', '-o', '-', plist], { encoding: 'utf8' });
    if (icon.status !== 0 || !icon.stdout.trim()) throw new Error('Native Icon Composer catalog is not registered in Info.plist.');
  } else {
    const icons = names.filter(name => name.endsWith('.icns'));
    if (!icons.length) throw new Error('Packaged macOS icon is missing.');
    const icon = await fs.readFile(path.join(resources, icons[0]));
    if (icon.toString('ascii', 0, 4) !== 'icns') throw new Error('Invalid macOS icon.');
  }
}
for (const test of ['tests/desktop.cjs', 'tests/vector-desktop.cjs', 'tests/folder-desktop.cjs', 'tests/appearance-size.cjs']) {
  const result = spawnSync(process.execPath, [test], { stdio: 'inherit', env: { ...process.env, CHOMP_TEST_EXECUTABLE: executable } });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`Packaged ${process.platform}/${process.arch} app verified.`);
