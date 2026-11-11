const { test } = require('node:test');
const assert = require('node:assert/strict');
test('file-size fitting keeps dimensions when lowering quality is sufficient', async () => {
  const { fitImage } = await import('../src/fit-size.js');
  const result = await fitImage({ width: 100, height: 50, quality: 80, maxBytes: 3000 }, async (w, h, q) => new ArrayBuffer(w * h * q / 100));
  assert.equal(result.width, 100); assert.equal(result.height, 50); assert.ok(result.quality <= 60); assert.ok(result.buffer.byteLength <= 3000);
});
test('lossless fitting resizes to meet the cap and never upscales', async () => {
  const { fitImage } = await import('../src/fit-size.js');
  const result = await fitImage({ width: 100, height: 50, quality: 80, maxBytes: 1024, lossless: true }, async (w, h) => new ArrayBuffer(w * h * 4));
  assert.ok(result.width < 100); assert.ok(result.height < 50); assert.ok(result.buffer.byteLength <= 1024);
});
test('unattainable limits fail instead of returning oversized files', async () => {
  const { fitImage } = await import('../src/fit-size.js');
  await assert.rejects(fitImage({ width: 4, height: 4, quality: 80, maxBytes: 1024 }, async () => new ArrayBuffer(2048)), /cannot fit/);
});
