import sharp from 'sharp';
import fs from 'node:fs/promises';
await fs.mkdir('build', { recursive: true });
await fs.mkdir('public', { recursive: true });
const source = 'assets/icon-source.png';
const png = size => sharp(source).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ compressionLevel: 9 }).toBuffer();
await fs.writeFile('build/icon.png', await png(1024));
await fs.writeFile('public/icon.png', await png(256));
const sizes = [16, 24, 32, 48, 64, 128, 256];
const images = await Promise.all(sizes.map(png));
const header = Buffer.alloc(6 + 16 * sizes.length); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
images.forEach((image, i) => { const at = 6 + i * 16; header[at] = sizes[i] % 256; header[at + 1] = sizes[i] % 256; header.writeUInt16LE(1, at + 4); header.writeUInt16LE(32, at + 6); header.writeUInt32LE(image.length, at + 8); header.writeUInt32LE(offset, at + 12); offset += image.length; });
await fs.writeFile('build/icon.ico', Buffer.concat([header, ...images]));
const chunks = [];
for (const [type, size] of [['icp4', 16], ['icp5', 32], ['icp6', 64], ['ic07', 128], ['ic08', 256], ['ic09', 512], ['ic10', 1024]]) {
  const image = await png(size), chunk = Buffer.alloc(8); chunk.write(type); chunk.writeUInt32BE(image.length + 8, 4); chunks.push(chunk, image);
}
const icns = Buffer.alloc(8); icns.write('icns'); icns.writeUInt32BE(8 + chunks.reduce((n, chunk) => n + chunk.length, 0), 4);
await fs.writeFile('build/icon.icns', Buffer.concat([icns, ...chunks]));
console.log('Generated PNG, Windows ICO, and macOS ICNS icons.');
