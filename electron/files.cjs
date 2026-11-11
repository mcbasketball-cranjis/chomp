const fs = require('node:fs/promises');
const path = require('node:path');
const supported = /\.(jpe?g|png|webp|avif|svg)$/i;
function safeStem(name) {
  return path.parse(path.basename(name)).name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '').slice(0, 120) || 'image';
}
async function saveUnique(folder, name, extension, bytes) {
  if (!['jpg', 'png', 'webp', 'avif', 'svg'].includes(extension)) throw new Error('Unsupported output format.');
  const stem = safeStem(name) + '-compressed';
  for (let n = 0; n < 10000; n++) {
    const filename = `${stem}${n ? ` (${n})` : ''}.${extension}`;
    const target = path.join(folder, filename);
    try { await fs.writeFile(target, bytes, { flag: 'wx' }); return { filename, path: target }; }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  throw new Error('Too many files with the same name in this folder.');
}
module.exports = { supported, safeStem, saveUnique };
