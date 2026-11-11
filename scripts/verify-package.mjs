import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const release = path.resolve('release');
const executable = process.env.CHOMP_TEST_EXECUTABLE || (process.platform === 'win32' ? path.join(release, 'win-unpacked', 'Chomp.exe') : path.join(release, process.arch === 'arm64' ? 'mac-arm64' : 'mac', 'Chomp.app', 'Contents', 'MacOS', 'Chomp'));
await fs.access(executable);
if (process.platform === 'darwin') {
  const resources = path.join(path.dirname(path.dirname(executable)), 'Resources');
  const icons = (await fs.readdir(resources)).filter(name => name.endsWith('.icns'));
  if (!icons.length) throw new Error('Packaged macOS icon is missing.');
  const icon = await fs.readFile(path.join(resources, icons[0])); if (icon.toString('ascii', 0, 4) !== 'icns') throw new Error('Invalid macOS icon.');
}
for (const test of ['tests/desktop.cjs', 'tests/folder-desktop.cjs', 'tests/appearance-size.cjs']) {
  const result = spawnSync(process.execPath, [test], { stdio: 'inherit', env: { ...process.env, CHOMP_TEST_EXECUTABLE: executable } });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`Packaged ${process.platform}/${process.arch} app verified.`);
