const { _electron: electron, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const work = path.join(root, 'test-results');
(async () => {
  await fs.mkdir(work, { recursive: true });
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const executablePath = process.env.GATORSQOOSH_TEST_EXECUTABLE;
  const app = await electron.launch({ ...(executablePath ? { executablePath } : {}), args: [...(executablePath ? [] : [root]), `--user-data-dir=${path.join(work, 'profile')}`], env });
  try {
    const page = await app.firstWindow(); await page.waitForSelector('#compress');
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.screenshot({ path: path.join(root, 'test-results', 'GatorSqoosh-preview.png') });
    const fixture = await page.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 600; c.height = 400; const ctx = c.getContext('2d');
      const gradient = ctx.createLinearGradient(0, 0, 600, 400); gradient.addColorStop(0, '#f2cb78'); gradient.addColorStop(1, '#176953'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 600, 400);
      ctx.fillStyle = '#ffffffaa'; ctx.fillRect(100, 100, 250, 150);
      return c.toDataURL('image/png').split(',')[1];
    });
    const source = path.join(work, 'landscape.png'); await fs.writeFile(source, Buffer.from(fixture, 'base64'));
    const broken = path.join(work, 'broken.png'); await fs.writeFile(broken, 'not an image');
    const sourceBefore = await fs.readFile(source);
    const select = async paths => {
      await app.evaluate(({ dialog }, paths) => { dialog.showOpenDialog = async (_win, options) => ({ canceled: false, filePaths: options.properties.includes('openDirectory') ? [paths.output] : paths.files }); }, { files: paths, output: work });
    };
    await select([source, broken]); await page.click('#add'); await expect(page.locator('.image-row')).toHaveCount(2);
    await page.click('#folder'); await page.click('#resize'); await page.fill('#max-size', '300'); await page.click('#compress');
    await expect(page.locator('#summary')).toBeVisible({ timeout: 60000 });
    await expect(page.locator('#summary')).toContainText('1 saved'); await expect(page.locator('#summary')).toContainText('1 failed');
    await expect(page.locator('.status.done')).toHaveCount(1); await expect(page.locator('.status.error')).toHaveCount(1);
    const filename = await page.locator('.image-row').first().getAttribute('title');
    const webp = await fs.readFile(path.join(work, filename.replace('Saved as ', ''))); assert.equal(webp.subarray(0, 4).toString(), 'RIFF');
    const dimensions = await page.evaluate(async data => { const b = await createImageBitmap(new Blob([new Uint8Array(data)])); return [b.width, b.height]; }, [...webp]); assert.deepEqual(dimensions, [300, 200]);
    for (const [format, extension] of [['jpg', 'jpg'], ['png', 'png'], ['webp', 'webp']]) {
      await page.click('#clear'); await select([source]); await page.click('#add'); await page.selectOption('#format', format); await page.click('#compress');
      await expect(page.locator('#summary')).toBeVisible({ timeout: 60000 }); await expect(page.locator('#summary')).toContainText('1 saved');
      const savedName = (await page.locator('.image-row').first().getAttribute('title')).replace('Saved as ', '');
      assert.equal(path.extname(savedName), `.${extension}`);
      assert.ok((await fs.readFile(path.join(work, savedName))).length > 50);
    }
    assert.deepEqual(await fs.readFile(source), sourceBefore);
    await page.click('#compress'); await expect(page.locator('#summary')).toBeVisible({ timeout: 60000 }); await expect(page.locator('#summary')).toContainText('1 saved');
    const beforeStop = await page.locator('.image-row').first().getAttribute('title'); assert.ok(beforeStop.includes('('), 'Recompression receives a unique filename');
    await page.click('#clear'); await select([source, broken]); await page.click('#add');
    await page.click('#compress'); await page.click('#cancel'); await expect(page.locator('#summary')).toBeVisible({ timeout: 60000 }); await expect(page.locator('#summary')).toContainText('Batch stopped');
    await page.screenshot({ path: path.join(work, 'completed.png') });
    assert.deepEqual(errors, []); console.log('PASS: Native dialogs, sandbox bridge, real WASM exports (WebP/JPEG/PNG), resize, corrupt image recovery, filename collisions, source preservation, and cancellation.');
  } finally { await app.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
