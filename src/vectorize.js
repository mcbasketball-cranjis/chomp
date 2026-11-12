import { smoothColorContours, smoothCoverageContours } from './smooth-contours.js';
import { flatLogoLayers } from './logo-trace.js';
import { normalizeTraceOptions, contourSettings } from './trace-options.js';

/**
 * Dependency-free, local raster tracing for logos and illustrations.
 * Transparent pixels are never assigned a fill; the generated SVG has no backdrop.
 * Each palette color is represented by actual, editable paths (no embedded bitmap).
 */

const TRACE_PRESETS = {
  simple: { colors: 8, edge: 640, tolerance: 1.8, minArea: 2 },
  balanced: { colors: 16, edge: 1200, tolerance: 1.15, minArea: 1 },
  detailed: { colors: 32, edge: 4096, tolerance: 0.72, minArea: 0.5 }
};

export function tracePreset(name = 'balanced') {
  return TRACE_PRESETS[name] || TRACE_PRESETS.balanced;
}

function distanceSquared(data, p, color) {
  const dr = data[p] - color[0], dg = data[p + 1] - color[1], db = data[p + 2] - color[2];
  return dr * dr + dg * dg + db * db;
}

/**
 * Remove a color sampled from agreeing opaque image corners (never assume white).
 * 'edges' removes only connected exterior pixels; 'all' also clears enclosed
 * background-colored holes in letterforms such as O, e, and p.
 * This intentionally cannot distinguish other matching-colored logo details.
 */
export function removeBackgroundColor(image, tolerance = 28, mode = 'edges', chosenColor = null) {
  if (!['edges', 'all'].includes(mode)) throw new Error('Invalid background removal mode.');
  const { width, height, data } = image;
  if (!width || !height || data.length < width * height * 4) throw new Error('Invalid image data.');
  const limit = Math.max(0, Math.min(100, Number(tolerance) || 0));
  let background = null;
  if (chosenColor !== null) {
    if (typeof chosenColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(chosenColor))
      throw new Error('Invalid selected background color.');
    background = [1, 3, 5].map(index => parseInt(chosenColor.slice(index, index + 2), 16));
  } else {
    const corners = [0, width - 1, (height - 1) * width, height * width - 1].filter(i => data[i * 4 + 3] >= 240);
    if (corners.length < 2) return 0;
    let seed = -1, matches = 0;
    for (const i of corners) {
      const other = corners.filter(j => distanceSquared(data, j * 4, [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]) <= limit * limit * 3).length;
      if (other > matches) { seed = i; matches = other; }
    }
    if (matches < 2) return 0;
    background = [data[seed * 4], data[seed * 4 + 1], data[seed * 4 + 2]];
  }
  const maxDistance = limit * limit * 3;
  if (mode === 'all') {
    let removed = 0;
    for (let index = 0; index < width * height; index++) {
      const p = index * 4;
      if (data[p + 3] >= 8 && distanceSquared(data, p, background) <= maxDistance) {
        data[p + 3] = 0;
        removed++;
      }
    }
    return removed;
  }
  const visited = new Uint8Array(width * height);
  const queue = new Uint32Array(width * height);
  let head = 0, tail = 0, removed = 0;
  function enqueue(index) {
    if (visited[index]) return;
    visited[index] = 1;
    const p = index * 4;
    if (data[p + 3] < 8 || distanceSquared(data, p, background) > limit * limit * 3) return;
    queue[tail++] = index;
  }
  for (let x = 0; x < width; x++) { enqueue(x); enqueue((height - 1) * width + x); }
  for (let y = 1; y < height - 1; y++) { enqueue(y * width); enqueue(y * width + width - 1); }
  while (head < tail) {
    const index = queue[head++], p = index * 4;
    data[p + 3] = 0; removed++;
    const x = index % width, y = Math.floor(index / width);
    if (x) enqueue(index - 1);
    if (x + 1 < width) enqueue(index + 1);
    if (y) enqueue(index - width);
    if (y + 1 < height) enqueue(index + width);
  }
  return removed;
}

// Preserve the original public helper and its edge-only behavior for callers.
export function removeConnectedBackground(image, tolerance = 28) {
  return removeBackgroundColor(image, tolerance, 'edges');
}

function medianCutPalette(data, colorCount) {
  const count = data.length / 4, stride = Math.max(1, Math.ceil(count / 16000));
  let maxAlpha = 0;
  for (let i = 3; i < data.length; i += 4) maxAlpha = Math.max(maxAlpha, data[i]);
  // Antialiased fringe pixels must not create a separate palette for every
  // alpha level. Sample the interiors, then use alpha as contour coverage.
  const sampleThreshold = Math.max(8, Math.round(maxAlpha * .7));
  const samples = [];
  for (let i = 0; i < count; i += stride) {
    const p = i * 4;
    if (data[p + 3] >= sampleThreshold) samples.push([data[p], data[p + 1], data[p + 2], data[p + 3]]);
  }
  if (!samples.length) return [];
  const boxes = [samples];
  while (boxes.length < colorCount) {
    let selected = -1, axis = 0, score = -1;
    for (let b = 0; b < boxes.length; b++) {
      const box = boxes[b];
      if (box.length < 2) continue;
      for (let channel = 0; channel < 3; channel++) {
        let low = 255, high = 0;
        for (const pixel of box) { low = Math.min(low, pixel[channel]); high = Math.max(high, pixel[channel]); }
        const range = high - low;
        const priority = range * Math.sqrt(box.length);
        if (range && priority > score) { score = priority; selected = b; axis = channel; }
      }
    }
    if (selected < 0) break;
    const box = boxes[selected].sort((a, b) => a[axis] - b[axis]);
    const middle = Math.floor(box.length / 2);
    boxes.splice(selected, 1, box.slice(0, middle), box.slice(middle));
  }
  return boxes.map(box => {
    const total = [0, 0, 0, 0];
    for (const p of box) for (let k = 0; k < 4; k++) total[k] += p[k];
    return total.map(v => Math.round(v / box.length));
  });
}

/**
 * Generate genuine SVG paths from an RGBA ImageData-like object.
 * Call on a downsampled canvas for predictable performance; preserve the desired
 * document dimensions via width/height while viewBox uses the trace raster.
 */
export function traceImageData(image, options = {}) {
  const { width, height, data } = image;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || data.length !== width * height * 4) throw new Error('Invalid RGBA image for tracing.');
  if (width * height > 2_400_000) throw new Error('Image is too large to trace. Reduce the trace resolution.');
  const preset = tracePreset(options.detail);
  const advanced = normalizeTraceOptions(options.traceOptions);
  const geometry = contourSettings(options.detail, advanced);
  const logo = advanced.mode === 'artwork' ? null : flatLogoLayers(image, options.detail, options.matteColor, {
    force: advanced.mode === 'logo', colors: advanced.colors
  });
  const palette = logo ? logo.colors : medianCutPalette(data, advanced.colors || preset.colors);
  const indices = logo ? logo.indices : new Int16Array(width * height).fill(-1);
  let maxAlpha = 0;
  for (let p = 3; p < data.length; p += 4) maxAlpha = Math.max(maxAlpha, data[p]);
  const alphaThreshold = Math.max(8, Math.round(maxAlpha * 0.22));
  if (!logo) for (let i = 0; i < indices.length; i++) {
    const p = i * 4, alpha = data[p + 3];
    if (alpha < alphaThreshold) continue;
    let closest = 0, best = Infinity;
    for (let c = 0; c < palette.length; c++) {
      const color = palette[c];
      const dr = data[p] - color[0], dg = data[p + 1] - color[1], db = data[p + 2] - color[2];
      const error = dr * dr + dg * dg + db * db;
      if (error < best) { best = error; closest = c; }
    }
    indices[i] = closest;
  }
  const docWidth = Math.max(1, Math.round(options.outputWidth || width));
  const docHeight = Math.max(1, Math.round(options.outputHeight || height));
  let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + docWidth + '" height="' + docHeight +
    '" viewBox="0 0 ' + width + ' ' + height + '">';
  if (logo?.background) {
    const hex = '#' + logo.background.map(n => n.toString(16).padStart(2, '0')).join('');
    svg += '<path fill="' + hex + '" d="M0 0H' + width + 'V' + height + 'H0Z"/>';
  }
  for (let c = 0; c < palette.length; c++) {
    // When the flat-artwork detector can recover ink coverage, retain the
    // half-pixel geometry of small letters instead of tracing a binary mask.
    // Geometric, transparent and photographic artwork keep the existing tracer.
    const path = logo?.coverage?.[c]
      ? smoothCoverageContours(logo.coverage[c], width, height,
          geometry.coverageTolerance, geometry.coverageMinArea,
          options.detail === 'detailed' ? .24 : Infinity, geometry.corners)
      : smoothColorContours(indices, width, height, c,
          (logo ? Math.min(.65, preset.tolerance) : preset.tolerance) * geometry.toleranceFactor,
          preset.minArea * geometry.areaFactor, geometry.corners);
    if (!path) continue;
    const color = palette[c];
    const hex = '#' + color.slice(0, 3).map(n => n.toString(16).padStart(2, '0')).join('');
    const opacity = color[3] < 255 ? ' fill-opacity="' + (color[3] / 255).toFixed(3) + '"' : '';
    svg += '<path fill="' + hex + '"' + opacity + ' fill-rule="evenodd" d="' + path + '"/>';
    if (svg.length > 12_000_000) throw new Error('Too many vector paths. Try Simple tracing or resize your image.');
  }
  return svg + '</svg>';
}
