import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const { version } = JSON.parse(await fs.readFile('package.json', 'utf8'));
const releaseDir = path.resolve('release');
const filename = `Chomp-${version}-win-x64-Setup.exe`;
const exePath = path.join(releaseDir, filename);
let bytes;
try { bytes = await fs.readFile(exePath); }
catch { throw new Error('Windows NSIS installer missing: ' + filename); }
if (bytes.length < 1024 * 1024) throw new Error('NSIS installer unexpectedly small');

const hash = crypto.createHash('sha512').update(bytes).digest('base64');
const manifest = {
  version,
  files: [{ url: filename, sha512: hash, size: bytes.length }],
  path: filename,
  sha512: hash,
  releaseDate: new Date().toISOString()
};
// JSON is a valid YAML document and is read by electron-updater's js-yaml parser.
// The checksum is calculated from the *same installer* the release uploads.
await fs.writeFile(path.join(releaseDir, 'latest.yml'), JSON.stringify(manifest, null, 2) + '\n');
console.log('Generated latest.yml for ' + filename + ' (' + bytes.length + ' bytes).');

const files = (await fs.readdir(releaseDir)).filter(name => name.endsWith('-Setup.exe'));
if (files.length !== 1 || files[0] !== filename) throw new Error('Unexpected competing Windows installers');
