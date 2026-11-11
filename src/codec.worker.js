import encodeJpeg, { init as initJpeg } from '@jsquash/jpeg/encode.js';
import encodeWebp, { init as initWebp } from '@jsquash/webp/encode.js';
import initPng, { optimise_raw } from '@jsquash/oxipng/codec/pkg/squoosh_oxipng.js';
import jpegWasm from '@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm?url';
import webpWasm from '@jsquash/webp/codec/enc/webp_enc.wasm?url';
import webpSimdWasm from '@jsquash/webp/codec/enc/webp_enc_simd.wasm?url';
import pngWasm from '@jsquash/oxipng/codec/pkg/squoosh_oxipng_bg.wasm?url';
import avifEncoder from '@jsquash/avif/codec/enc/avif_enc.js';
import { initEmscriptenModule } from '@jsquash/avif/utils.js';
import { defaultOptions as avifOptions } from '@jsquash/avif/meta.js';
import avifWasm from '@jsquash/avif/codec/enc/avif_enc.wasm?url';
import { fitImage } from './fit-size.js';
const initialized = {};
async function init(format) {
  if (initialized[format]) return initialized[format];
  initialized[format] = format === 'jpg' ? initJpeg({ locateFile: () => jpegWasm }) : format === 'webp' ? initWebp({ locateFile: name => name.includes('simd') ? webpSimdWasm : webpWasm }) : format === 'avif' ? initEmscriptenModule(avifEncoder, undefined, { locateFile: () => avifWasm }) : initPng(pngWasm);
  return initialized[format];
}
self.onmessage = async ({ data: { bytes, format, quality, maxSize, maxBytes } }) => {
  let bitmap;
  try {
    if (!['jpg', 'png', 'webp', 'avif'].includes(format)) throw new Error('Unsupported output format.');
    // ImageDecoder exposes animation metadata before flattening a file.
    const signature = new Uint8Array(bytes.buffer, bytes.byteOffset, Math.min(32, bytes.byteLength));
    const type = signature[0] === 0xff && signature[1] === 0xd8 ? 'image/jpeg' : signature[0] === 0x89 && signature[1] === 0x50 ? 'image/png' : String.fromCharCode(...signature.slice(0, 4)) === 'RIFF' ? 'image/webp' : 'image/avif';
    if (typeof ImageDecoder !== 'undefined' && await ImageDecoder.isTypeSupported(type)) {
      const decoder = new ImageDecoder({ data: bytes, type });
      try { await decoder.tracks.ready; if (decoder.tracks.selectedTrack?.animated) throw new Error('Animated images are not supported. Choose a still image.'); }
      finally { decoder.close(); }
    }
    bitmap = await createImageBitmap(new Blob([bytes]), { imageOrientation: 'from-image' });
    if (bitmap.width * bitmap.height > 160_000_000) throw new Error('Image exceeds the 160 megapixel limit. Resize it before adding.');
    const scale = maxSize ? Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height)) : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale)), height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: format !== 'jpg' });
    if (format === 'jpg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height); }
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(bitmap, 0, 0, width, height); bitmap.close(); bitmap = null;
    await init(format);
    let currentCanvas = canvas, pixels = ctx.getImageData(0, 0, width, height);
    const fitted = await fitImage({ width, height, quality, maxBytes, lossless: format === 'png' }, async (w, h, q) => {
      if (currentCanvas.width !== w || currentCanvas.height !== h) {
        currentCanvas = new OffscreenCanvas(w, h); const context = currentCanvas.getContext('2d', { willReadFrequently: true });
        context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high'; context.drawImage(canvas, 0, 0, w, h); pixels = context.getImageData(0, 0, w, h);
      }
      if (format === 'jpg') return encodeJpeg(pixels, { quality: q });
      if (format === 'webp') return encodeWebp(pixels, { quality: q, method: 4 });
      if (format === 'avif') {
        const result = (await initialized.avif).encode(new Uint8Array(pixels.data.buffer), w, h, { ...avifOptions, quality: q, speed: 8 });
        if (!result) throw new Error('AVIF encoding failed.'); return result.buffer;
      }
      return optimise_raw(pixels.data, w, h, 2, false, false).buffer;
    });
    const small = new OffscreenCanvas(80, 80); const preview = small.getContext('2d');
    preview.drawImage(currentCanvas, 0, 0, 80, 80);
    const thumbnail = await (await small.convertToBlob({ type: 'image/webp', quality: .7 })).arrayBuffer();
    const result = new Uint8Array(fitted.buffer);
    self.postMessage({ bytes: result, thumbnail, width: fitted.width, height: fitted.height, quality: fitted.quality }, [result.buffer, thumbnail]);
  } catch (error) { self.postMessage({ error: error.message || 'Could not decode this image.' }); }
  finally { if (bitmap) bitmap.close(); }
};
