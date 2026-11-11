import encodeJpeg, { init as initJpeg } from '@jsquash/jpeg/encode.js';
import encodeWebp, { init as initWebp } from '@jsquash/webp/encode.js';
import initPng, { optimise_raw } from '@jsquash/oxipng/codec/pkg/squoosh_oxipng.js';
import jpegWasm from '@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm?url';
import webpWasm from '@jsquash/webp/codec/enc/webp_enc.wasm?url';
import webpSimdWasm from '@jsquash/webp/codec/enc/webp_enc_simd.wasm?url';
import pngWasm from '@jsquash/oxipng/codec/pkg/squoosh_oxipng_bg.wasm?url';
const initialized = {};
async function init(format) {
  if (initialized[format]) return initialized[format];
  initialized[format] = format === 'jpg' ? initJpeg({ locateFile: () => jpegWasm }) : format === 'webp' ? initWebp({ locateFile: name => name.includes('simd') ? webpSimdWasm : webpWasm }) : initPng(pngWasm);
  return initialized[format];
}
self.onmessage = async ({ data: { bytes, format, quality, maxSize } }) => {
  let bitmap;
  try {
    if (!['jpg', 'png', 'webp'].includes(format)) throw new Error('Unsupported output format.');
    // ImageDecoder exposes animation metadata before flattening a file.
    const signature = new Uint8Array(bytes.buffer, bytes.byteOffset, Math.min(32, bytes.byteLength));
    const type = signature[0] === 0xff && signature[1] === 0xd8 ? 'image/jpeg' : signature[0] === 0x89 && signature[1] === 0x50 ? 'image/png' : String.fromCharCode(...signature.slice(0, 4)) === 'RIFF' ? 'image/webp' : 'image/avif';
    if (typeof ImageDecoder !== 'undefined' && await ImageDecoder.isTypeSupported(type)) {
      const decoder = new ImageDecoder({ data: bytes, type });
      try { await decoder.tracks.ready; if (decoder.tracks.selectedTrack?.animated) throw new Error('Animated images are not supported. Choose a still image.'); }
      finally { decoder.close(); }
    }
    bitmap = await createImageBitmap(new Blob([bytes]), { imageOrientation: 'from-image' });
    if (bitmap.width * bitmap.height > 48_000_000) throw new Error('Image exceeds the 48 megapixel limit. Resize it before adding.');
    const scale = maxSize ? Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height)) : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale)), height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: format !== 'jpg' });
    if (format === 'jpg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height); }
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(bitmap, 0, 0, width, height); bitmap.close(); bitmap = null;
    const pixels = ctx.getImageData(0, 0, width, height);
    await init(format);
    const buffer = format === 'jpg' ? await encodeJpeg(pixels, { quality }) : format === 'webp' ? await encodeWebp(pixels, { quality, method: 4 }) : optimise_raw(pixels.data, width, height, 2, false, false).buffer;
    const small = new OffscreenCanvas(80, 80); const preview = small.getContext('2d');
    preview.drawImage(canvas, 0, 0, 80, 80);
    const thumbnail = await (await small.convertToBlob({ type: 'image/webp', quality: .7 })).arrayBuffer();
    const result = new Uint8Array(buffer);
    self.postMessage({ bytes: result, thumbnail, width, height }, [result.buffer, thumbnail]);
  } catch (error) { self.postMessage({ error: error.message || 'Could not decode this image.' }); }
  finally { if (bitmap) bitmap.close(); }
};
