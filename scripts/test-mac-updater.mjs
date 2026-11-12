import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

if (process.platform !== 'darwin') throw new Error('Mac replacement test must run on macOS.');
const version = JSON.parse(await fs.readFile('package.json','utf8')).version;
const builtApp = path.resolve('release/mac/Chomp.app');
const helper = path.join(builtApp, 'Contents/Resources/mac-replace.sh');
await fs.access(helper);

function run(program, args, options = {}) {
  const result = spawnSync(program, args, { encoding: 'utf8', timeout: 200000, ...options });
  if (result.status !== 0) throw new Error([program, result.status, result.stderr, result.stdout, result.error?.message].filter(Boolean).join(': '));
  return result;
}

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'chomp-update-swap-test-'));
try {
  const apps = path.join(root, 'Applications'), staged = path.join(root, 'staged');
  await fs.mkdir(apps); await fs.mkdir(staged);
  const target = path.join(apps, 'Chomp.app');
  const candidate = path.join(staged, 'Chomp.app');
  run('/usr/bin/ditto', [builtApp, target]);
  run('/usr/bin/ditto', [builtApp, candidate]);
  const ready = path.join(root,'ready');
  // The disposable test verifies the signed bundle, copies it to the final
  // directory, renames the current app to a recoverable backup, and swaps.
  // It deliberately skips relaunching a GUI app in CI.
  run('/bin/sh', [helper, target, candidate, '99999999', ready, version, 'x64', String(process.getuid())], {
    env: { ...process.env, CHOMP_UPDATE_SKIP_RELAUNCH: '1' }
  });
  await fs.access(ready);
  await fs.access(target);
  const backup = path.join(apps,'.Chomp-previous.app');
  await fs.access(backup);
  run('/usr/bin/codesign', ['--verify','--deep','--strict',target]);
  run('/usr/bin/codesign', ['--verify','--deep','--strict',backup]);

  // An invalid signed app must fail BEFORE any replacement.
  const invalid = path.join(staged, 'Chomp.app');
  run('/usr/bin/ditto', [builtApp, invalid]);
  await fs.writeFile(path.join(invalid,'Contents','Info.plist'), 'invalid plist');
  const rejected = spawnSync('/bin/sh', [
    helper, target, invalid, '99999999', path.join(root,'invalid-ready'),
    version, 'x64', String(process.getuid())
  ], { encoding:'utf8', timeout:30000, env:{...process.env,CHOMP_UPDATE_SKIP_RELAUNCH:'1'} });
  assert.notEqual(rejected.status, 0, 'Invalid app should not replace Chomp');
  await assert.rejects(fs.access(path.join(root,'invalid-ready')), { code:'ENOENT' });
  run('/usr/bin/codesign', ['--verify','--deep','--strict',target]);
  console.log('PASS: Mac in-place replacement preserves a signed backup and rejects a tampered app.');
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
