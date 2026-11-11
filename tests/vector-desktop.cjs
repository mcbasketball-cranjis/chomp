const { _electron: electron, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
(async () => {
  await fs.mkdir(path.join(root, 'test-results'), { recursive: true });
  const work = await fs.mkdtemp(path.join(root, 'test-results', 'vector-'));
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const executablePath = process.env.CHOMP_TEST_EXECUTABLE;
  const app = await electron.launch({
    ...(executablePath ? { executablePath } : {}),
    args: [...(executablePath ? [] : [root]), '--user-data-dir=' + path.join(work, 'profile')],
    env
  });
  try {
    const page = await app.firstWindow(); await page.waitForSelector('#compress');
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const samples = await page.evaluate(() => {
      function make(background) {
        const canvas = document.createElement('canvas'); canvas.width = 96; canvas.height = 96;
        const ctx = canvas.getContext('2d');
        if (background) { ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 96, 96); }
        ctx.fillStyle = '#ee3322'; ctx.fillRect(24, 24, 48, 48);
        return canvas.toDataURL('image/png').split(',')[1];
      }
      return [make(false), make(true)];
    });
    const transparent = path.join(work, 'transparent.png'), white = path.join(work, 'white.png');
    await fs.writeFile(transparent, Buffer.from(samples[0], 'base64'));
    await fs.writeFile(white, Buffer.from(samples[1], 'base64'));
    const before = await fs.readFile(transparent);
    async function choose(files) {
      await app.evaluate(({ dialog }, data) => {
        dialog.showOpenDialog = async (_win, options) => ({
          canceled: false, filePaths: options.properties.includes('openDirectory') ? [data.output] : data.files
        });
      }, { output: work, files });
    }
    async function saved() {
      await expect(page.locator('#summary')).toBeVisible({ timeout: 60000 });
      await expect(page.locator('#summary')).toContainText('1 saved');
      const filename = (await page.locator('.image-row').first().getAttribute('title')).replace('Saved as ', '');
      return path.join(work, filename);
    }
    await choose([transparent]); await page.click('#add'); await page.click('#folder');
    await page.selectOption('#format', 'svg'); await expect(page.locator('#trace-controls')).toBeVisible();
    await page.click('#compress');
    const svgFile = await saved(), xml = await fs.readFile(svgFile, 'utf8');
    assert.match(xml, /<svg\b/); assert.match(xml, /<path\b/);
    assert.ok(!xml.includes('<image'), 'vector output must not embed a bitmap');
    assert.ok(!xml.includes('fill="#ffffff"'), 'transparent PNG must not gain a white background');

    // SVG -> PNG round trip: both a transparent corner and an opaque subject survive.
    await page.click('#clear'); await choose([svgFile]); await page.click('#add');
    await page.selectOption('#format', 'png'); await page.click('#compress');
    const pngFile = await saved();
    const rgba = await page.evaluate(async numbers => {
      const bitmap = await createImageBitmap(new Blob([new Uint8Array(numbers)], { type: 'image/png' }));
      const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0); bitmap.close();
      return [ctx.getImageData(0, 0, 1, 1).data[3], ctx.getImageData(48, 48, 1, 1).data[3]];
    }, [...await fs.readFile(pngFile)]);
    assert.equal(rgba[0], 0, 'SVG export must keep transparent corners');
    assert.equal(rgba[1], 255, 'SVG export must keep solid artwork');

    // Background removal only when explicitly enabled.
    await page.click('#clear'); await choose([white]); await page.click('#add');
    await page.selectOption('#format', 'svg'); await page.check('#remove-bg');
    await page.click('#compress'); const removedXml = await fs.readFile(await saved(), 'utf8');
    assert.ok(!removedXml.includes('fill="#ffffff"'), 'background removal must not trace the white exterior');
    assert.match(removedXml, /<path\b/);

    assert.deepEqual(await fs.readFile(transparent), before);
    assert.deepEqual(errors, []);
    console.log('PASS: transparent PNG -> actual SVG paths -> transparent PNG, optional background removal, source preservation.');
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
