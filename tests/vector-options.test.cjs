const { test } = require('node:test');
const assert = require('node:assert/strict');

const options = import('../src/trace-options.js');
const vector = import('../src/vectorize.js');

function image(width, height) {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}
function fillRect(img, left, top, width, height, color) {
  for (let y = top; y < top + height; y++)
    for (let x = left; x < left + width; x++)
      img.data.set(color, (y * img.width + x) * 4);
}

test('advanced tracing defaults retain the existing processing path', async () => {
  const { TRACE_DEFAULTS, normalizeTraceOptions, tracePixelBudget, contourSettings } = await options;
  assert.deepEqual(normalizeTraceOptions(), TRACE_DEFAULTS);
  assert.equal(tracePixelBudget(), 1_100_000);
  assert.equal(tracePixelBudget({ resolution: 'high' }), 2_400_000);
  const neutral = contourSettings('detailed', TRACE_DEFAULTS);
  assert.equal(neutral.toleranceFactor, 1);
  assert.equal(neutral.coverageTolerance, .45);
  assert.equal(neutral.coverageMinArea, .35);
  assert.equal(neutral.areaFactor, 1);
  const img = image(70, 40);
  fillRect(img, 8, 6, 55, 28, [20, 90, 150, 255]);
  fillRect(img, 23, 13, 12, 15, [0, 0, 0, 0]);
  const { traceImageData } = await vector;
  assert.equal(traceImageData(img, { detail:'detailed' }),
    traceImageData(img, { detail:'detailed', traceOptions:TRACE_DEFAULTS }));
});

test('malformed trace controls cannot produce unbounded settings', async () => {
  const { normalizeTraceOptions } = await options;
  assert.deepEqual(normalizeTraceOptions({
    mode: 'unknown', colors: 999999, smoothing: Infinity, corners: -200,
    cleanup: 'nope', resolution: 'unlimited'
  }), {
    mode: 'auto', colors: 32, smoothing: 50, corners: 0,
    cleanup: 50, resolution: 'standard'
  });
  assert.equal(normalizeTraceOptions({colors: 'auto'}).colors, 0);
  assert.equal(normalizeTraceOptions({colors: -5}).colors, 0);
  assert.equal(normalizeTraceOptions({colors: 1}).colors, 2);
  assert.equal(normalizeTraceOptions({smoothing: '100', corners: '80'}).corners, 80);
});

test('illustration palette limit controls real number of vector color paths', async () => {
  const { traceImageData } = await vector;
  const img = image(90, 36);
  for (let k=0;k<3;k++) {
    const color = [[240,30,30,255],[30,230,70,255],[30,50,235,255]][k];
    fillRect(img, 4 + k * 29, 3, 23, 29, color);
  }
  const small = traceImageData(img, {traceOptions:{mode:'artwork', colors:2}});
  const large = traceImageData(img, {traceOptions:{mode:'artwork', colors:8}});
  const count = svg => (svg.match(/<path /g)||[]).length;
  assert.ok(count(small) <= 2, 'palette=2 must not create more than 2 ink layers');
  assert.ok(count(large) >= 3, 'larger palette must preserve more distinct inks');
  assert.ok(!large.includes('<image'), 'tracing must keep editable vector paths');
});

test('cleanup can suppress tiny vector artifacts while keeping large shapes', async () => {
  const { traceImageData } = await vector;
  const img = image(50, 50);
  fillRect(img, 6, 6, 30, 30, [210,80,20,255]);
  fillRect(img, 42, 42, 1, 1, [210,80,20,255]);
  const fine = traceImageData(img, {detail:'detailed',traceOptions:{mode:'artwork', cleanup:0}});
  const clean = traceImageData(img, {detail:'detailed',traceOptions:{mode:'artwork', cleanup:100}});
  assert.match(fine, /<path fill=/);
  assert.match(clean, /<path fill=/);
  assert.ok(clean.length <= fine.length, 'higher cleanup must not increase the exported path data');
});

test('smoothing and corner fidelity affect vector geometry, not image data', async () => {
  const { traceImageData } = await vector;
  const img = image(110, 110);
  for (let y=0;y<110;y++)for(let x=0;x<110;x++) {
    const radius = Math.hypot(x-55,y-55);
    if(radius<38 && radius>17)img.data.set([30,130,240,255],(y*110+x)*4);
  }
  const precise = traceImageData(img, {traceOptions:{mode:'artwork',smoothing:0,corners:100}});
  const smooth = traceImageData(img, {traceOptions:{mode:'artwork',smoothing:100,corners:0}});
  assert.notEqual(precise, smooth);
  assert.ok(precise.includes('fill-rule="evenodd"') && smooth.includes('fill-rule="evenodd"'));
  assert.ok(!precise.includes('<image') && !smooth.includes('<image'));
});


test('manual background color removes a selected edge color even if corners disagree', async () => {
  const { removeBackgroundColor } = await vector;
  const img = image(12, 12);
  fillRect(img, 0, 0, 12, 12, [230,230,230,255]);
  img.data.set([255,0,0,255], 0);
  img.data.set([0,255,0,255], (12-1)*4);
  img.data.set([0,0,255,255], (11*12)*4);
  img.data.set([250,250,0,255], (12*12-1)*4);
  fillRect(img, 0, 5, 6, 2, [130,45,210,255]);
  const auto = { ...img, data:new Uint8ClampedArray(img.data) };
  assert.equal(removeBackgroundColor(auto, 8, 'edges'), 0,
    'automatic selection must not guess when all four corners differ');
  assert.equal(removeBackgroundColor(img, 8, 'edges', '#822dd2'), 12);
  assert.equal(img.data[(5*12+0)*4+3], 0);
  assert.equal(img.data[(2*12+2)*4+3], 255);
  assert.throws(() => removeBackgroundColor(img, 8, 'edges', 'white'), /Invalid selected/);
});
