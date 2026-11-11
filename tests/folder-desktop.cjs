const { _electron: electron, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
(async () => {
  const work = await fs.mkdtemp(path.join(root, 'test-results', 'folders-'));
  const output = path.join(work, 'output'), source = path.join(work, 'project');
  await fs.mkdir(path.join(source, 'assets', 'nested'), { recursive: true }); await fs.mkdir(output); await fs.mkdir(path.join(source, 'empty'));
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const executablePath = process.env.GATORSQOOSH_TEST_EXECUTABLE;
  const app = await electron.launch({ ...(executablePath ? { executablePath } : {}), args: [...(executablePath ? [] : [root]), `--user-data-dir=${path.join(work, 'profile')}`], env });
  try {
    const page = await app.firstWindow(); await page.waitForSelector('#compress'); const errors = []; page.on('pageerror', error => errors.push(error.message));
    const fixtures = await page.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 128; c.height = 80; const ctx = c.getContext('2d');
      const gradient = ctx.createLinearGradient(0, 0, 128, 80); gradient.addColorStop(0, '#eab16e'); gradient.addColorStop(1, '#07665e'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 80);
      return ['png', 'jpeg', 'webp'].map(format => c.toDataURL(`image/${format}`).split(',')[1]);
    });
    const imagePaths = ['cover.png', 'assets/photo.jpeg', 'assets/nested/banner.webp'];
    for (let i = 0; i < imagePaths.length; i++) await fs.writeFile(path.join(source, imagePaths[i]), Buffer.from(fixtures[i], 'base64'));
    const seed = path.join(work, 'avif-seed.png'); await fs.writeFile(seed, Buffer.from(fixtures[0], 'base64'));
    await app.evaluate(({ dialog }, data) => { dialog.showOpenDialog = async (_win, options) => ({ canceled: false, filePaths: options.properties.includes('openDirectory') ? [data.output] : [data.seed] }); }, { output, seed });
    await page.click('#add'); await page.click('#folder'); await page.selectOption('#format', 'avif'); await page.click('#compress');
    await expect(page.locator('#summary')).toBeVisible({ timeout: 60000 }); await expect(page.locator('#summary')).toContainText('1 saved');
    await fs.copyFile(path.join(output, 'avif-seed-compressed.avif'), path.join(source, 'assets', 'nested', 'four.avif')); imagePaths.push('assets/nested/four.avif');
    const corrupt = path.join(source, 'broken.png'); await fs.writeFile(corrupt, 'invalid image');
    await fs.writeFile(path.join(source, 'index.html'), '<img src="assets/photo.jpeg">'); await fs.writeFile(path.join(source, 'assets', 'data.bin'), Buffer.from([0, 255, 1, 99]));
    const originals = new Map(); for (const relative of [...imagePaths, 'broken.png', 'index.html', 'assets/data.bin']) originals.set(relative, await fs.readFile(path.join(source, relative)));
    const cdp = await page.context().newCDPSession(page);
    async function dropFolder() {
      await page.click('#clear');
      const bounds = await page.locator('#drop').boundingBox();
      const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
      const data = { items: [], files: [source], dragOperationsMask: 1 };
      await cdp.send('Input.dispatchDragEvent', { type: 'dragEnter', x, y, data });
      await cdp.send('Input.dispatchDragEvent', { type: 'dragOver', x, y, data });
      await cdp.send('Input.dispatchDragEvent', { type: 'drop', x, y, data });
      await expect(page.locator('.image-row')).toHaveCount(5); await expect(page.locator('#quick-panel')).toBeVisible();
      await expect(page.locator('#format')).toHaveValue('original');
    }
    async function dimensions(file) {
      const data = [...await fs.readFile(file)];
      return page.evaluate(async bytes => { const image = await createImageBitmap(new Blob([new Uint8Array(bytes)])); const result = [image.width, image.height]; image.close(); return result; }, data);
    }
    await dropFolder(); await page.click('#resize'); await page.fill('#max-size', '64'); await page.click('#compress');
    await expect(page.locator('#summary')).toBeVisible({ timeout: 60000 }); await expect(page.locator('#summary')).toContainText('4 saved'); await expect(page.locator('#summary')).toContainText('1 failed');
    const copied = path.join(output, 'project-compressed');
    for (const relative of imagePaths) { assert.deepEqual(await dimensions(path.join(copied, relative)), [64, 40]); assert.deepEqual(await fs.readFile(path.join(source, relative)), originals.get(relative)); }
    for (const relative of ['broken.png', 'index.html', 'assets/data.bin']) assert.deepEqual(await fs.readFile(path.join(copied, relative)), originals.get(relative));
    assert.ok((await fs.stat(path.join(copied, 'empty'))).isDirectory());
    await dropFolder(); await page.check('[name="folder-mode"][value="images"]'); await page.selectOption('#format', 'webp'); await page.click('#compress');
    await expect(page.locator('#summary')).toBeVisible({ timeout: 60000 }); await expect(page.locator('#summary')).toContainText('4 saved');
    const imagesOnly = path.join(output, 'project-compressed (1)');
    const exported = await fs.readdir(imagesOnly, { recursive: true, withFileTypes: true });
    assert.equal(exported.filter(entry => entry.isFile()).length, 4); assert.ok(exported.filter(entry => entry.isFile()).every(entry => entry.name.endsWith('.webp')));
    await assert.rejects(fs.stat(path.join(imagesOnly, 'index.html')), { code: 'ENOENT' }); await assert.rejects(fs.stat(path.join(imagesOnly, 'empty')), { code: 'ENOENT' });
    await dropFolder(); await page.check('[name="folder-mode"][value="replace"]');
    await expect(page.locator('#format')).toBeDisabled(); await expect(page.locator('#output-controls')).toBeHidden();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(root, 'test-results', 'GatorSqoosh-folders-preview.png'), fullPage: true });
    await page.click('#compress'); await expect(page.locator('#summary')).toBeVisible({ timeout: 60000 }); await expect(page.locator('#summary')).toContainText('4 replaced'); await expect(page.locator('#summary')).toContainText('1 failed');
    for (const relative of imagePaths) assert.deepEqual(await dimensions(path.join(source, relative)), [64, 40]);
    for (const relative of ['broken.png', 'index.html', 'assets/data.bin']) assert.deepEqual(await fs.readFile(path.join(source, relative)), originals.get(relative));
    await page.click('#compress'); await expect(page.locator('#summary')).toBeVisible({ timeout: 60000 }); await expect(page.locator('#summary')).toContainText('4 replaced');
    assert.deepEqual(errors, []);
    console.log('PASS: Actual directory drag-and-drop, recursive mixed folder export, all four codecs, copy/ images-only/ in-place modes, relative paths, failed-image preservation, repeat in-place runs, and unchanged non-image files.');
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
