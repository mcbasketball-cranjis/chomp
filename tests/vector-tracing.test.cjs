const { test } = require('node:test');
const assert = require('node:assert/strict');

const vector = import('../src/vectorize.js');

function image(width, height, fill = [0, 0, 0, 0]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set(fill, i * 4);
  return { width, height, data };
}
function pixel(img, x, y, rgba) { img.data.set(rgba, (y * img.width + x) * 4); }
function alpha(img, x, y) { return img.data[(y * img.width + x) * 4 + 3]; }

test('traces transparent PNG pixels into paths without a backdrop or embedded raster', async () => {
  const { traceImageData } = await vector;
  const img = image(10, 10);
  for (let y = 2; y < 8; y++) for (let x = 2; x < 8; x++) pixel(img, x, y, [240, 40, 20, 255]);
  const svg = traceImageData(img, { detail: 'balanced', outputWidth: 100, outputHeight: 100 });
  assert.match(svg, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="100" height="100" viewBox="0 0 10 10">/);
  assert.match(svg, /<path fill="#f02814"/);
  assert.ok(!/<image\b|<rect\b|<filter\b|fill="#ffffff"/i.test(svg));
  assert.match(svg, /fill-rule="evenodd"/);
  assert.ok(svg.endsWith('</svg>'));
});

test('fully transparent images produce empty transparent SVG artwork', async () => {
  const { traceImageData } = await vector;
  const svg = traceImageData(image(8, 8));
  assert.ok(svg.startsWith('<svg '));
  assert.ok(svg.endsWith('></svg>'));
  assert.ok(!svg.includes('<path'));
});

test('semi-transparent artwork keeps opacity when traced', async () => {
  const { traceImageData } = await vector;
  const img = image(8, 8);
  for (let y = 1; y < 7; y++) for (let x = 1; x < 7; x++) pixel(img, x, y, [20, 60, 210, 128]);
  const svg = traceImageData(img);
  assert.match(svg, /fill-opacity="0\.502"/);
  assert.ok(!svg.includes('fill="#ffffff"'));
});

test('background removal removes only matching edge-connected pixels', async () => {
  const { removeConnectedBackground } = await vector;
  const img = image(10, 10, [255, 255, 255, 255]);
  // Enclosed white center must survive removal of a white exterior.
  for (let y = 3; y <= 6; y++) for (let x = 3; x <= 6; x++) {
    if (x === 3 || x === 6 || y === 3 || y === 6) pixel(img, x, y, [10, 60, 200, 255]);
  }
  assert.equal(removeConnectedBackground(img, 28), 84);
  assert.equal(alpha(img, 0, 0), 0);
  assert.equal(alpha(img, 4, 4), 255);
  assert.equal(alpha(img, 3, 3), 255);
  const { traceImageData } = await vector;
  const svg = traceImageData(img);
  assert.ok(svg.includes('#0a3cc8'));
  assert.match(svg, /<path fill="#ffffff"/, 'the enclosed white center remains a vector shape');
});

test('already-transparent edges and unrelated corner colors are left alone', async () => {
  const { removeConnectedBackground } = await vector;
  const transparent = image(8, 8);
  pixel(transparent, 3, 3, [12, 30, 200, 255]);
  assert.equal(removeConnectedBackground(transparent), 0);
  assert.equal(alpha(transparent, 3, 3), 255);
  const mixed = image(2, 2);
  [[255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255], [255, 255, 0, 255]]
    .forEach((p, i) => mixed.data.set(p, i * 4));
  assert.equal(removeConnectedBackground(mixed, 20), 0);
});

test('everywhere mode clears enclosed O-shaped holes on white or black backgrounds', async () => {
  const { removeBackgroundColor } = await vector;
  for (const shade of [255, 0]) {
    const background = [shade, shade, shade, 255];
    const original = image(12, 12, background);
    // Simulate a solid red O with a 4x4 background-colored counter (letter hole).
    for (let y = 2; y < 10; y++) for (let x = 2; x < 10; x++) {
      if (x < 4 || x >= 8 || y < 4 || y >= 8) pixel(original, x, y, [240, 60, 20, 255]);
    }
    const outside = { ...original, data: new Uint8ClampedArray(original.data) };
    const everywhere = { ...original, data: new Uint8ClampedArray(original.data) };
    assert.equal(removeBackgroundColor(outside, 28, 'edges'), 80);
    assert.equal(alpha(outside, 0, 0), 0);
    assert.equal(alpha(outside, 5, 5), 255, 'edge-only mode must protect enclosed pixels');
    assert.equal(alpha(outside, 3, 3), 255, 'edge-only mode must preserve the red O');
    assert.equal(removeBackgroundColor(everywhere, 28, 'all'), 96);
    assert.equal(alpha(everywhere, 0, 0), 0);
    assert.equal(alpha(everywhere, 5, 5), 0, 'everywhere mode must clear the letter hole');
    assert.equal(alpha(everywhere, 3, 3), 255, 'everywhere mode must preserve the red O');
    assert.equal(alpha(original, 5, 5), 255, 'source image is unchanged');
  }
});

test('everywhere mode preserves different-colored details and existing transparency', async () => {
  const { removeBackgroundColor } = await vector;
  const img = image(8, 8, [255, 255, 255, 255]);
  pixel(img, 3, 3, [0, 0, 0, 255]);
  pixel(img, 4, 4, [255, 255, 255, 0]);
  assert.equal(removeBackgroundColor(img, 28, 'all'), 62);
  assert.equal(alpha(img, 3, 3), 255);
  assert.equal(alpha(img, 4, 4), 0);
  assert.throws(() => removeBackgroundColor(img, 28, 'unexpected'), /Invalid background removal mode/);
});
