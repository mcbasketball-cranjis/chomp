/**
 * SVGs must be decoded in a document with an HTMLImageElement.
 * createImageBitmap(SVG Blob) is not reliably implemented in workers.
 * Validate untrusted content before using it as an image source.
 */
export async function decodeSvgBitmap(bytes) {
  const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error('SVG document types and entities are not supported.');
  const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
  const svg = doc.documentElement;
  if (svg.localName !== 'svg' || doc.querySelector('parsererror')) throw new Error('Invalid SVG document.');
  for (const el of doc.querySelectorAll('*')) {
    const tag = el.localName.toLowerCase();
    if (['script', 'foreignobject', 'iframe', 'object', 'embed'].includes(tag)) throw new Error('This SVG contains unsupported active content.');
    if (tag === 'style' && /@import|@font-face/i.test(el.textContent || '')) throw new Error('External styles or fonts are not supported in SVG files.');
    for (const attribute of el.attributes) {
      const name = attribute.name.toLowerCase(), value = attribute.value.trim();
      if (/^on[a-z]+/.test(name)) throw new Error('Event handlers are not allowed in SVG images.');
      if (name === 'href' || name === 'xlink:href') {
        if (!/^#/.test(value) && !/^data:image\/(?:png|jpeg|webp|avif);base64,/i.test(value)) throw new Error('External SVG resources are not supported.');
      }
      for (const match of value.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)) {
        if (!match[2].startsWith('#')) throw new Error('External SVG resources are not supported.');
      }
    }
  }
  const viewBox = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  const hasViewBox = viewBox.length === 4 && viewBox.every(Number.isFinite) && viewBox[2] > 0 && viewBox[3] > 0;
  const numeric = value => /^\d+(?:\.\d+)?(?:px)?$/i.test(value || '') ? parseFloat(value) : 0;
  let width = numeric(svg.getAttribute('width')) || (hasViewBox ? viewBox[2] : 512);
  let height = numeric(svg.getAttribute('height')) || (hasViewBox ? viewBox[3] : 512);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) throw new Error('Invalid SVG dimensions.');
  const factor = Math.min(1, 8192 / Math.max(width, height), Math.sqrt(32_000_000 / (width * height)));
  width = Math.max(1, Math.round(width * factor));
  height = Math.max(1, Math.round(height * factor));
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  if (!svg.hasAttribute('xmlns')) svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return await createImageBitmap(image);
  } finally { URL.revokeObjectURL(url); }
}
