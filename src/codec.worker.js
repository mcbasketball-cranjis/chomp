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
import { removeBackgroundColor, traceImageData, tracePreset } from './vectorize.js';
const initialized = {};
async function init(format) {
  if (initialized[format]) return initialized[format];
  initialized[format] = format === 'jpg' ? initJpeg({ locateFile: () => jpegWasm }) : format === 'webp' ? initWebp({ locateFile: name => name.includes('simd') ? webpSimdWasm : webpWasm }) : format === 'avif' ? initEmscriptenModule(avifEncoder, undefined, { locateFile: () => avifWasm }) : initPng(pngWasm);
  return initialized[format];
}

function validateSvg(bytes) {
  const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (!/<svg[\s>]/i.test(source)) throw new Error('Not a valid SVG image.');
  if (/<!DOCTYPE|<!ENTITY|<script\b|<foreignObject\b|<iframe\b|\bon[a-z]+\s*=/i.test(source) ||
      /\b(?:href|xlink:href)\s*=\s*["']\s*(?!#|data:image\/)/i.test(source) ||
      /url\(\s*["']?\s*(?!#)/i.test(source)) {
    throw new Error('This SVG contains external resources or active content and cannot be opened safely.');
  }
  return source;
}

self.onmessage = async ({ data: { bytes, format, sourceFormat, quality, maxSize, maxBytes, traceDetail, removeBackground, bgTolerance, bgMode, bitmap: decodedBitmap } }) => {
  let bitmap;
  try {
    if (!['jpg', 'png', 'webp', 'avif', 'svg'].includes(format)) throw new Error('Unsupported output format.');
    if (removeBackground && format === 'jpg') throw new Error('JPEG cannot preserve transparency. Choose PNG, WebP, AVIF, or SVG.');
    const svgSource = sourceFormat === 'svg';
    if (svgSource) validateSvg(bytes);
    const signature = new Uint8Array(bytes.buffer, bytes.byteOffset, Math.min(32, bytes.byteLength));
    const type = svgSource ? 'image/svg+xml' : signature[0] === 0xff && signature[1] === 0xd8 ? 'image/jpeg' : signature[0] === 0x89 && signature[1] === 0x50 ? 'image/png' : String.fromCharCode(...signature.slice(0, 4)) === 'RIFF' ? 'image/webp' : 'image/avif';
    if (!svgSource && typeof ImageDecoder !== 'undefined' && await ImageDecoder.isTypeSupported(type)) {
      const decoder = new ImageDecoder({ data: bytes, type });
      try { await decoder.tracks.ready; if (decoder.tracks.selectedTrack?.animated) throw new Error('Animated images are not supported. Choose a still image.'); }
      finally { decoder.close(); }
    }
    if (svgSource && !decodedBitmap) throw new Error('SVG needs document-side image decoding.');
    bitmap = decodedBitmap || await createImageBitmap(new Blob([bytes], { type }), { imageOrientation: 'from-image' });
    if (bitmap.width * bitmap.height > 160_000_000) throw new Error('Image exceeds the 160 megapixel limit. Resize it before adding.');
    const scale = maxSize ? Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height)) : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale)), height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: true });
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(bitmap, 0, 0, width, height); bitmap.close(); bitmap = null;
    if (removeBackground && (!svgSource || format !== 'svg')) {
      const pixels = ctx.getImageData(0, 0, width, height);
      removeBackgroundColor(pixels, bgTolerance, bgMode || 'edges');
      ctx.putImageData(pixels, 0, 0);
    }

    let result, resultWidth = width, resultHeight = height, resultQuality = quality, previewCanvas = canvas;
    if (format === 'svg') {
      if (svgSource) {
        // Preserve original SVG geometry instead of retracing an already vector image.
        result = bytes;
      } else {
        const edge = tracePreset(traceDetail).edge;
        const factor = Math.min(1, edge / Math.max(width, height));
        const tw = Math.max(1, Math.round(width * factor)), th = Math.max(1, Math.round(height * factor));
        const traceCanvas = new OffscreenCanvas(tw, th);
        const traceContext = traceCanvas.getContext('2d', { willReadFrequently: true, alpha: true });
        traceContext.imageSmoothingEnabled = true;
        traceContext.imageSmoothingQuality = 'high';
        traceContext.drawImage(canvas, 0, 0, tw, th);
        const text = traceImageData(traceContext.getImageData(0, 0, tw, th), { detail: traceDetail, outputWidth: width, outputHeight: height });
        result = new TextEncoder().encode(text);
      }
    } else {
      if (format === 'jpg') {
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'source-over';
      }
      await init(format);
      let currentCanvas = canvas, pixels = ctx.getImageData(0, 0, width, height);
      const fitted = await fitImage({ width, height, quality, maxBytes, lossless: format === 'png' }, async (w, h, q) => {
        if (currentCanvas.width !== w || currentCanvas.height !== h) {
          currentCanvas = new OffscreenCanvas(w, h);
          const context = currentCanvas.getContext('2d', { willReadFrequently: true });
          context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
          context.drawImage(canvas, 0, 0, w, h);
          pixels = context.getImageData(0, 0, w, h);
        }
        if (format === 'jpg') return encodeJpeg(pixels, { quality: q });
        if (format === 'webp') return encodeWebp(pixels, { quality: q, method: 4 });
        if (format === 'avif') {
          const encoded = (await initialized.avif).encode(new Uint8Array(pixels.data.buffer), w, h, { ...avifOptions, quality: q, speed: 8 });
          if (!encoded) throw new Error('AVIF encoding failed.');
          return encoded.buffer;
        }
        return optimise_raw(pixels.data, w, h, 2, false, false).buffer;
      });
      result = new Uint8Array(fitted.buffer);
      resultWidth = fitted.width; resultHeight = fitted.height; resultQuality = fitted.quality;
      previewCanvas = currentCanvas;
    }
    const small = new OffscreenCanvas(80, 80), preview = small.getContext('2d');
    preview.drawImage(previewCanvas, 0, 0, 80, 80);
    const thumbnail = await (await small.convertToBlob({ type: 'image/webp', quality: .7 })).arrayBuffer();
    self.postMessage({ bytes: result, thumbnail, width: resultWidth, height: resultHeight, quality: resultQuality }, [result.buffer, thumbnail]);
  } catch (error) { self.postMessage({ error: error.message || 'Could not decode this image.' }); }
  finally { if (bitmap) bitmap.close(); }
};
