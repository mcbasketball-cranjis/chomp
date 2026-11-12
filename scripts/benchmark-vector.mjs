#!/usr/bin/env node
/**
 * Inspect vector fidelity using a real user-supplied raster image.
 *
 * Usage:
 *   node scripts/benchmark-vector.mjs /path/to/logo.png --text-start=450 --out=/tmp/logo.svg
 *
 * Source images are processed locally; nothing is fetched or uploaded.
 */
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { traceImageData, tracePreset } from '../src/vectorize.js';

const [filename, ...flags] = process.argv.slice(2);
if (!filename || filename.startsWith('--')) {
  console.error('Usage: node scripts/benchmark-vector.mjs input.png [--text-start=450] [--out=output.svg]');
  process.exit(2);
}
function flag(name) {
  return flags.find(v => v.startsWith('--' + name + '='))?.slice(name.length + 3);
}
const input = sharp(filename, { limitInputPixels: 80_000_000 }).ensureAlpha();
const { data: inputData, info } = await input.raw().toBuffer({ resolveWithObject: true });
const width = info.width, height = info.height;
const detail = 'detailed';
const edge = tracePreset(detail).edge;
const factor = Math.min(1, edge / Math.max(width, height), Math.sqrt(1_100_000 / (width * height)));
const tw = Math.max(1, Math.round(width * factor));
const th = Math.max(1, Math.round(height * factor));
const tracePixels = factor < 1
  ? await sharp(filename).resize(tw, th, { kernel: 'lanczos3' }).ensureAlpha().raw().toBuffer()
  : inputData;
const svg = traceImageData({ width: tw, height: th, data: tracePixels }, {
  detail, outputWidth: width, outputHeight: height
});
const output = flag('out');
if (output) await fs.writeFile(output, svg, 'utf8');
const { data: outputPixels, info: outputInfo } = await sharp(Buffer.from(svg))
  .resize(width, height).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
if (outputInfo.width !== width || outputInfo.height !== height) throw new Error('SVG output size mismatch.');

const start = Math.max(0, Math.min(width - 1, Number(flag('text-start') || 0)));
const white = [255, 255, 255];
let shared = 0, union = 0, sourceCount = 0, vectorCount = 0;
function foreground(data, index) {
  const alpha = data[index + 3] / 255;
  const r = white[0] * (1 - alpha) + data[index] * alpha;
  const g = white[1] * (1 - alpha) + data[index + 1] * alpha;
  const b = white[2] * (1 - alpha) + data[index + 2] * alpha;
  return Math.hypot(255 - r, 255 - g, 255 - b) > 65;
}
for (let y = 0; y < height; y++) {
  for (let x = start; x < width; x++) {
    const i = (y * width + x) * 4;
    const a = foreground(inputData, i), b = foreground(outputPixels, i);
    if (a) sourceCount++;
    if (b) vectorCount++;
    if (a && b) shared++;
    if (a || b) union++;
  }
}
console.log(JSON.stringify({
  source: filename, dimensions: width + 'x' + height,
  vector_bytes: Buffer.byteLength(svg), trace_dimensions: tw + 'x' + th,
  analyzed_region: start ? 'x >= ' + start : 'whole image',
  foreground_iou: union ? Number((shared / union).toFixed(4)) : null,
  foreground_source_pixels: sourceCount, foreground_vector_pixels: vectorCount,
  output: output || null
}, null, 2));
