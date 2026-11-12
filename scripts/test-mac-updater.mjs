import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

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
  const archive = path.join(root, 'verified.zip');
  run('/usr/bin/ditto', ['-c','-k','--sequesterRsrc','--keepParent', candidate, archive]);
  const digest = crypto.createHash('sha256').update(await fs.readFile(archive)).digest('hex');
  const ready = path.join(root,'ready');
  // The disposable test verifies the pinned ZIP again in a protected
  // directory, then swaps the app and leaves a signed rollback backup.
  run('/bin/sh', [helper, target, archive, digest, '99999999', ready, version, 'x64', String(process.getuid())], {
    env: { ...process.env, CHOMP_UPDATE_SKIP_RELAUNCH: '1' }
  });
  await fs.access(ready);
  await fs.access(target);
  const backup = path.join(apps,'.Chomp-previous.app');
  await fs.access(backup);
  run('/usr/bin/codesign', ['--verify','--deep','--strict',target]);
  run('/usr/bin/codesign', ['--verify','--deep','--strict',backup]);

  // An invalid signed app must fail BEFORE any replacement.
  const altered = path.join(root, 'altered.zip');
  await fs.copyFile(archive, altered);
  await fs.appendFile(altered, 'tampered ZIP bytes');
  const rejected = spawnSync('/bin/sh', [
    helper, target, altered, digest, '99999999', path.join(root,'invalid-ready'),
    version, 'x64', String(process.getuid())
  ], { encoding:'utf8', timeout:60000, env:{...process.env,CHOMP_UPDATE_SKIP_RELAUNCH:'1'} });
  assert.notEqual(rejected.status, 0, 'Invalid app should not replace Chomp');
  await assert.rejects(fs.access(path.join(root,'invalid-ready')), { code:'ENOENT' });
  run('/usr/bin/codesign', ['--verify','--deep','--strict',target]);
  console.log('PASS: Mac in-place replacement preserves a signed backup and rejects a tampered app.');
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
