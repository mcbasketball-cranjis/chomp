'use strict';
// Optional local integration. Chomp never downloads, embeds or runs a shell.
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { safeStem } = require('./files.cjs');

const videoSupported = /\.(mp4|m4v|mov|mkv|webm|avi)$/i;
const PRESETS = Object.freeze({
  small: 'Very Fast 720p30',
  balanced: 'Fast 1080p30',
  quality: 'HQ 1080p30'
});
const FORMATS = Object.freeze({ mp4: 'av_mp4', mkv: 'av_mkv' });
const VIDEO_LIMIT = 16 * 1024 * 1024 * 1024;

function videoOptions(options) {
  if (!options || !Object.hasOwn(PRESETS, options.preset) ||
      !Object.hasOwn(FORMATS, options.format))
    throw new Error('Invalid video compression settings.');
  return { preset: PRESETS[options.preset], format: FORMATS[options.format],
    extension: options.format };
}
function handBrakeArgs(input, output, options) {
  const selected = videoOptions(options);
  return ['--input', input, '--output', output, '--min-duration', '0',
    '--preset', selected.preset, '--format', selected.format];
}
function progressFromText(value) {
  const matches = [...String(value).matchAll(/Encoding:\s*task\s+\d+\s+of\s+\d+,\s*([\d.]+)\s*%/gi)];
  if (!matches.length) return null;
  const number = Number(matches.at(-1)[1]);
  return Number.isFinite(number) ? Math.min(100, Math.max(0, number)) : null;
}
function defaultCandidates() {
  const paths = [];
  if (process.env.CHOMP_HANDBRAKE_CLI) paths.push(process.env.CHOMP_HANDBRAKE_CLI);
  if (process.platform === 'darwin') paths.push('/opt/homebrew/bin/HandBrakeCLI', '/usr/local/bin/HandBrakeCLI');
  if (process.platform === 'win32') {
    for (const root of [process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean))
      paths.push(path.join(root, 'HandBrake', 'HandBrakeCLI.exe'));
  }
  paths.push(process.platform === 'win32' ? 'HandBrakeCLI.exe' : 'HandBrakeCLI');
  return [...new Set(paths)];
}
function checkExecutable(executable, timeoutMs = 6000) {
  return new Promise(resolve => {
    let child, output = '', settled = false;
    const finish = value => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => {
      child?.kill(); finish(null);
    }, timeoutMs);
    try {
      child = spawn(executable, ['--version'], { shell: false, windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'] });
      for (const stream of [child.stdout, child.stderr])
        stream.on('data', data => {
          output = (output + data.toString()).slice(0, 12000);
        });
      child.on('error', () => finish(null));
      child.on('close', code => {
        const version = output.match(/HandBrake\s*(?:CLI)?\s*(?:version\s*)?(\d+\.\d+(?:\.\d+)?)/i);
        finish(code === 0 && version ? { executable, version: version[1] } : null);
      });
    } catch { finish(null); }
  });
}
async function findHandBrake(selectedPath = null) {
  for (const candidate of selectedPath ? [selectedPath] : defaultCandidates()) {
    const result = await checkExecutable(candidate);
    if (result) return result;
  }
  return null;
}
async function uniqueVideoTarget(directory, sourceName, extension, replaceStem = false) {
  const stem = replaceStem ? safeStem(sourceName) : safeStem(sourceName) + '-compressed';
  for (let number = 0; number < 10000; number++) {
    const name = stem + (number ? ' (' + number + ')' : '') + '.' + extension;
    const target = path.join(directory, name);
    try {
      await fs.lstat(target);
    } catch (error) {
      if (error.code === 'ENOENT') return target;
      throw error;
    }
  }
  throw new Error('Too many videos with the same name.');
}
function transcode(executable, input, output, options, onProgress = () => {}, spawnProcess = spawn) {
  const args = handBrakeArgs(input, output, options);
  let child, canceled = false, tail = '', outputLog = '';
  const promise = new Promise((resolve, reject) => {
    try {
      child = spawnProcess(executable, args, { shell: false, windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) { reject(error); return; }
    const read = chunk => {
      const content = String(chunk);
      tail = (tail + content).slice(-2400);
      outputLog = (outputLog + content).slice(-6000);
      const percent = progressFromText(tail);
      if (percent !== null) onProgress(percent);
    };
    child.stdout.on('data', read);
    child.stderr.on('data', read);
    child.on('error', reject);
    child.on('close', code => {
      if (canceled) return reject(new Error('Video compression canceled.'));
      if (code !== 0) return reject(new Error('HandBrake could not encode this video. ' +
        outputLog.replace(/[\r\n]+/g, ' ').slice(-350)));
      resolve();
    });
  });
  return {
    promise,
    cancel() { canceled = true; child?.kill(); }
  };
}
async function processVideo({ executable, entry, directory, format, preset,
  copiedOriginal = null, copySnapshot = null, verifySource, onProgress = () => {},
  onJob = () => {}, spawnProcess = spawn }) {
  const settings = { format, preset };
  videoOptions(settings);
  const source = entry.path;
  if (!videoSupported.test(source)) throw new Error('Unsupported video format.');
  await verifySource();
  const destination = await fs.realpath(directory);
  const target = copiedOriginal && path.extname(copiedOriginal).slice(1).toLowerCase() === format
    ? copiedOriginal
    : await uniqueVideoTarget(destination, copiedOriginal ? path.basename(copiedOriginal) : path.basename(source), format, !!copiedOriginal);
  // Encode into a fresh private directory, using a filename that does not exist.
  // HandBrake can create its output normally; the final publication is no-clobber.
  const tempDirectory=await fs.mkdtemp(path.join(destination,'.chomp-video-'));
  const temporary=path.join(tempDirectory,'encoded.'+format);
  try {
    const job = transcode(executable, source, temporary, settings, onProgress, spawnProcess);
    onJob(job);
    await job.promise;
    const result = await fs.lstat(temporary);
    if (!result.isFile() || result.isSymbolicLink() || result.size <= 0)
      throw new Error('HandBrake produced no video output.');
    await verifySource();
    if (copiedOriginal && target === copiedOriginal) {
      const stat = await fs.lstat(copiedOriginal);
      if (!stat.isFile() || stat.isSymbolicLink() || !copySnapshot ||
          ['size','mtimeMs','ino','dev'].some(key => stat[key] !== copySnapshot[key]))
        throw new Error('Copied video changed while encoding; it was not replaced.');
      await fs.rename(temporary, target);
    } else {
      // Hard-link publication is atomic and fails rather than overwriting a collision.
      let final = target, done = false;
      for (let attempt = 0; attempt < 10000; attempt++) {
        try { await fs.link(temporary, final); done = true; break; }
        catch (error) {
          if (error.code !== 'EEXIST') throw error;
          final = await uniqueVideoTarget(destination,
            copiedOriginal ? path.basename(copiedOriginal) : path.basename(source), format, !!copiedOriginal);
        }
      }
      if (!done) throw new Error('Could not reserve a unique output filename.');
      if (copiedOriginal) {
        // Existing untouched copy can be removed only after final video exists.
        const stat = await fs.lstat(copiedOriginal);
        if (!stat.isFile() || stat.isSymbolicLink() || !copySnapshot ||
            ['size','mtimeMs','ino','dev'].some(key => stat[key] !== copySnapshot[key]))
          throw new Error('Copied source video changed; the completed output was kept.');
        await fs.unlink(copiedOriginal);
      }
      return { filename: path.basename(final), path: final, size: result.size };
    }
    return { filename: path.basename(target), path: target, size: result.size };
  } finally {
    onJob(null);
    await fs.rm(tempDirectory,{recursive:true,force:true}).catch(() => {});
  }
}
module.exports = { videoSupported, VIDEO_LIMIT, PRESETS, FORMATS, videoOptions,
  handBrakeArgs, progressFromText, defaultCandidates, checkExecutable, findHandBrake,
  transcode, uniqueVideoTarget, processVideo };
