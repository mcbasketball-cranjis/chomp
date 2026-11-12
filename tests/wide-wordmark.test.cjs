const { test } = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');

const vector = import('../src/vectorize.js');

function overlap(original, result, width, height, minX, maxX) {
  let union = 0, intersection = 0;
  for (let y = 0; y < height; y++) {
    for (let x = minX; x < maxX; x++) {
      const i = (y * width + x) * 4;
      const present = pixels => Math.hypot(
        255 - pixels[i], 255 - pixels[i + 1], 255 - pixels[i + 2]
      ) > 65;
      const a = present(original), b = present(result);
      if (a && b) intersection++;
      if (a || b) union++;
    }
  }
  return union ? intersection / union : 0;
}

test('Detailed preserves native resolution for 2048x467 wide wordmarks within the pixel budget', async () => {
  const { tracePreset } = await vector;
  assert.ok(tracePreset('detailed').edge >= 2048);
  const w = 2048, h = 467;
  const factor = Math.min(1, tracePreset('detailed').edge / Math.max(w, h),
    Math.sqrt(1_100_000 / (w * h)));
  assert.equal(factor, 1, 'no premature downsampling of thin lettering');
});

test('realistic wide gray wordmark preserves glyph contours independent of its orange logo block', async () => {
  const { traceImageData } = await vector;
  const width = 2048, height = 467;
  // Match the real supplied failure case in dimensions, color and geometry,
  // without publishing a third party's actual corporate logo as a fixture.
  const artwork = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="467">' +
    '<rect width="2048" height="467" fill="white"/>' +
    '<path d="M62 58H412V114H119V405H62Z M153 148H412V405H153Z" fill="#f6a000"/>' +
    '<text x="466" y="253" font-family="Arial,sans-serif" font-size="132" ' +
      'font-weight="400" fill="#797979">schnetzler liegenschaften</text>' +
    '</svg>'
  );
  const { data: source, info } = await sharp(artwork)
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, width);
  assert.equal(info.height, height);
  const svg = traceImageData({ width, height, data: source }, { detail: 'detailed' });
  assert.ok(!/<image\b|<text\b/i.test(svg), 'SVG output must contain editable paths, not embedded image or font');
  assert.ok(Buffer.byteLength(svg) < 90_000, 'full-resolution wordmark paths must remain reasonably compact');
  const { data: preview } = await sharp(Buffer.from(svg)).ensureAlpha()
    .raw().toBuffer({ resolveWithObject: true });
  const textIou = overlap(source, preview, width, height, 450, 2048);
  const symbolIou = overlap(source, preview, width, height, 0, 440);
  assert.ok(textIou > .84, 'lettering should match independently (IoU ' + textIou.toFixed(3) + ')');
  assert.ok(symbolIou > .95, 'hard-edged symbol should remain intact (IoU ' + symbolIou.toFixed(3) + ')');
});
