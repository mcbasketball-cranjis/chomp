import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
if (process.platform !== 'darwin') throw new Error('DMG checks require macOS.');
const arch = process.argv[2] || process.arch;
if (!['x64', 'arm64'].includes(arch)) throw new Error('Expected macOS architecture x64 or arm64.');
const release = path.resolve('release');
const names = await fs.readdir(release);
const dmg = names.find(name => name.endsWith(`-mac-${arch}.dmg`));
if (!dmg) throw new Error(`macOS ${arch} DMG is missing.`);
const archive = dmg.slice(0, -4) + '.zip';
if (!names.includes(archive)) throw new Error(`macOS ${arch} ZIP is missing: ${archive}`);
const mount = await fs.mkdtemp(path.join(os.tmpdir(), `chomp-dmg-${arch}-`));
function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr || result.stdout || result.error}`);
  }
  return [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
}
run('hdiutil', ['attach', path.join(release, dmg), '-nobrowse', '-readonly', '-mountpoint', mount]);
try {
  if (await fs.readlink(path.join(mount, 'Applications')) !== '/Applications') throw new Error('Applications shortcut is missing from DMG.');
  const binary = path.join(mount, 'Chomp.app', 'Contents', 'MacOS', 'Chomp');
  await fs.access(binary);
  const arches = run('/usr/bin/lipo', ['-archs', binary]).split(/\s+/);
  const binaryArch = arch === 'x64' ? 'x86_64' : 'arm64';
  if (!arches.includes(binaryArch)) throw new Error(`Packaged ${dmg} executable is not ${binaryArch}: ${arches.join(', ')}`);
  // An unsigned Electron bundle can appear "damaged" on a downloaded Mac.
  // Enforce an internally coherent ad-hoc code signature for every distributed DMG.
  // This does NOT establish a trusted developer identity or Apple notarization.
  const app = path.join(mount, 'Chomp.app');
  run('/usr/bin/codesign', ['--verify', '--deep', '--strict', '--verbose=2', app]);
  const signature = run('/usr/bin/codesign', ['-dv', '--verbose=4', app]);
  if (!/Signature=adhoc/i.test(signature)) throw new Error(`Expected ad-hoc signed Chomp app in ${dmg}: ${signature}`);
  const resources = path.join(mount, 'Chomp.app', 'Contents', 'Resources');
  // Icon Composer projects compile into an Assets.car instead of the legacy ICNS.
  // Check the asset catalog and Info.plist so packaging cannot silently ship the old icon.
  const assetCatalog = path.join(resources, 'Assets.car');
  const catalogStat = await fs.stat(assetCatalog);
  if (!catalogStat.isFile() || catalogStat.size < 1024) throw new Error(`Packaged ${arch} Icon Composer asset catalog missing or empty.`);
  const iconName = run('/usr/bin/plutil', ['-extract', 'CFBundleIconName', 'raw', '-o', '-', path.join(app, 'Contents', 'Info.plist')]);
  if (!iconName || !/chomp/i.test(iconName)) throw new Error(`Native Icon Composer name missing from ${arch} Info.plist: ${iconName}`);
  console.log(`PASS: ${arch} DMG and ZIP present, ad-hoc code signature valid, architecture and Icon Composer asset catalog verified.`);
  if (process.arch !== arch) console.log(`NOTE: ${arch} build statically verified only; runtime testing requires ${arch} hardware.`);
} finally {
  run('hdiutil', ['detach', mount]);
  await fs.rmdir(mount);
}
