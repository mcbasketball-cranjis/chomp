'use strict';

// Ad-hoc macOS builds cannot use Squirrel.Mac's Team ID-based update path.
// This installer uses a pinned GitHub Release ZIP, verifies GitHub's SHA-256
// digest and the extracted code signature, then swaps the app with rollback.
const { app } = require('electron');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const https = require('node:https');
const crypto = require('node:crypto');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { pipeline } = require('node:stream/promises');
const exec = promisify(execFile);
const BUNDLE_ID = 'io.github.mcbasketballcranjis.chomp';
const MAX_DOWNLOAD = 512 * 1024 * 1024;
const ALLOWED_HOSTS = new Set(['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com']);

function installedBundle(executable = process.execPath) {
  if (process.platform !== 'darwin') return null;
  const macOS = path.dirname(executable);
  const contents = path.dirname(macOS);
  const bundle = path.dirname(contents);
  if (path.basename(macOS) !== 'MacOS' || path.basename(contents) !== 'Contents' ||
      path.basename(bundle) !== 'Chomp.app') return null;
  return bundle;
}

function macInstallMode() {
  if (!app.isPackaged) return 'unavailable';
  const bundle = installedBundle();
  if (!bundle) return 'unavailable';
  // An app launched directly from a mounted DMG cannot be replaced. Electron
  // can offer a one-click move to Applications, then restart the app.
  return bundle.startsWith('/Volumes/') ? 'mac-move' : 'mac';
}

async function command(program, args, timeout = 100000) {
  const result = await exec(program, args, { timeout, maxBuffer: 256 * 1024 });
  return result.stdout.trim();
}

async function plist(appBundle, key) {
  return command('/usr/bin/plutil', ['-extract', key, 'raw', '-o', '-', path.join(appBundle, 'Contents', 'Info.plist')]);
}

async function verifyMacBundle(appBundle, version, arch) {
  const stat = await fsp.lstat(appBundle);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Invalid macOS application bundle.');
  const entries = await Promise.all([plist(appBundle, 'CFBundleIdentifier'), plist(appBundle, 'CFBundleShortVersionString')]);
  if (entries[0] !== BUNDLE_ID || entries[1] !== version) throw new Error('The update has the wrong application identity or version.');
  const binary = path.join(appBundle, 'Contents', 'MacOS', 'Chomp');
  const arches = (await command('/usr/bin/lipo', ['-archs', binary])).split(/\s+/);
  if (!arches.includes(arch === 'arm64' ? 'arm64' : 'x86_64')) throw new Error('The update has the wrong CPU architecture.');
  await command('/usr/bin/codesign', ['--verify', '--deep', '--strict', appBundle], 150000);
}

async function openVerifiedUrl(url, redirects = 0) {
  const target = new URL(url);
  if (target.protocol !== 'https:' || !ALLOWED_HOSTS.has(target.hostname) || target.port || target.username || target.password) {
    throw new Error('Untrusted update download location.');
  }
  if (redirects > 6) throw new Error('Too many update redirects.');
  const response = await new Promise((resolve, reject) => {
    const request = https.get(target, { headers: { 'User-Agent': 'Chomp-Mac-Updater/' + app.getVersion(), Accept: 'application/octet-stream' } }, resolve);
    request.setTimeout(30000, () => request.destroy(new Error('Update download timed out.')));
    request.on('error', reject);
  });
  if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
    const location = response.headers.location;
    response.resume();
    if (!location) throw new Error('Update redirect missing location.');
    return openVerifiedUrl(new URL(location, target).toString(), redirects + 1);
  }
  if (response.statusCode !== 200) {
    response.resume();
    throw new Error('Update download failed (HTTP ' + response.statusCode + ').');
  }
  return response;
}

async function stageMacUpdate(info, onProgress) {
  if (process.platform !== 'darwin') throw new Error('Mac updates can only run on macOS.');
  const current = installedBundle();
  if (!current || current.startsWith('/Volumes/')) throw new Error('Move Chomp to Applications before updating.');
  if (!info || !/^[a-f0-9]{64}$/.test(info.sha256) ||
      !Number.isSafeInteger(info.size) || info.size < 1024*1024 || info.size > MAX_DOWNLOAD) {
    throw new Error('This release is missing a verifiable update archive.');
  }
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'chomp-update-'));
  const archive = path.join(root, 'update.zip');
  const extracted = path.join(root, 'extracted');
  try {
    const response = await openVerifiedUrl(info.url);
    const declared = Number(response.headers['content-length']);
    if (Number.isSafeInteger(declared) && declared > MAX_DOWNLOAD) {
      response.destroy();
      throw new Error('Update exceeds maximum download size.');
    }
    const sha256 = crypto.createHash('sha256');
    let length = 0, lastPercent = -1;
    const writer = fs.createWriteStream(archive, { flags: 'wx', mode: 0o600 });
    response.on('data', chunk => {
      length += chunk.length;
      if (length > MAX_DOWNLOAD || length > info.size) {
        response.destroy(new Error('Update archive exceeds the expected size.'));
        return;
      }
      sha256.update(chunk);
      const percent = Math.round(length / info.size * 100);
      if (percent !== lastPercent) { lastPercent = percent; onProgress?.(percent); }
    });
    await pipeline(response, writer);
    if (length !== info.size || sha256.digest('hex') !== info.sha256) throw new Error('Update checksum does not match the published release.');
    await fsp.mkdir(extracted, { mode: 0o700 });
    await command('/usr/bin/ditto', ['-x', '-k', archive, extracted], 180000);
    const extractedEntries = await fsp.readdir(extracted);
    if (extractedEntries.some(entry => entry !== 'Chomp.app' && entry !== '__MACOSX') ||
        !extractedEntries.includes('Chomp.app')) throw new Error('Unexpected files in the Mac update.');
    const newBundle = path.join(extracted, 'Chomp.app');
    await verifyMacBundle(newBundle, info.version, info.arch);
    const oldId = await plist(current, 'CFBundleIdentifier');
    if (oldId !== BUNDLE_ID) throw new Error('The running app has a different bundle identifier.');
    return { root, newBundle, version: info.version, arch: info.arch, target: current };
  } catch (error) {
    await fsp.rm(root, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

const quoteShell = s => "'" + s.replace(/'/g, "'\\''") + "'";

function waitForReady(child, file, timeoutMs = 90000) {
  return new Promise((resolve, reject) => {
    let finished = false;
    const start = Date.now();
    const fail = error => { if (finished) return; finished = true; clearInterval(timer); reject(error); };
    const succeed = () => { if (finished) return; finished = true; clearInterval(timer); resolve(); };
    const timer = setInterval(async () => {
      if (finished) return;
      try {
        await fsp.access(file);
        succeed();
      } catch {
        if (Date.now() - start > timeoutMs) {
          child.kill();
          fail(new Error('Mac installation authorization or preparation timed out.'));
        }
      }
    }, 250);
    child.once('error', fail);
    child.once('exit', (code) => fail(new Error('Mac update installer stopped before preparation (code ' + code + ').')));
  });
}

async function installMacUpdate(stage) {
  if (!stage || process.platform !== 'darwin') throw new Error('No Mac update is ready.');
  await verifyMacBundle(stage.newBundle, stage.version, stage.arch);
  const resourcesHelper = path.join(process.resourcesPath, 'mac-replace.sh');
  await fsp.access(resourcesHelper);
  const ready = path.join(stage.root, 'prepared');
  const userId = process.getuid();
  const args = [
    stage.target, stage.newBundle, String(process.pid), ready, stage.version, stage.arch, String(userId)
  ];
  const parent = path.dirname(stage.target);
  const needsAdmin = !fs.existsSync(parent) || (() => {
    try { fs.accessSync(parent, fs.constants.W_OK); return false; } catch { return true; }
  })();
  let child;
  if (needsAdmin) {
    const commandLine = [ '/bin/sh', resourcesHelper, ...args ].map(quoteShell).join(' ');
    // Administrator authentication uses the macOS system prompt. No password
    // is passed to Chomp, and the helper is shipped inside the app bundle.
    child = spawn('/usr/bin/osascript', ['-e', 'do shell script ' + JSON.stringify(commandLine) + ' with administrator privileges'], { stdio: 'ignore', detached: true });
  } else {
    child = spawn('/bin/sh', [resourcesHelper, ...args], { stdio: 'ignore', detached: true });
  }
  try {
    // The helper copies and verifies the replacement BEFORE signalling ready.
    // The current app quits only after that succeeds, so cancellation or disk
    // errors leave the original version running unchanged.
    await waitForReady(child, ready);
    child.unref();
    return { started: true };
  } catch (error) {
    child.kill();
    throw error;
  }
}

module.exports = { installedBundle, macInstallMode, stageMacUpdate, installMacUpdate, verifyMacBundle };
