const { _electron: electron, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
(async () => {
  await fs.mkdir(path.join(root, 'test-results'), { recursive: true });
  const work = await fs.mkdtemp(path.join(root, 'test-results', 'appearance-'));
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const executablePath = process.env.GATORSQOOSH_TEST_EXECUTABLE;
  const options = { ...(executablePath ? { executablePath } : {}), args: [...(executablePath ? [] : [root]), `--user-data-dir=${path.join(work, 'profile')}`], env };
  let app = await electron.launch(options);
  try {
    let page = await app.firstWindow(); await page.waitForSelector('#theme'); const errors = []; page.on('pageerror', e => errors.push(e.message));
    for (const theme of ['dark', 'light']) {
      await page.selectOption('#theme', theme); await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      assert.equal(await app.evaluate(({ nativeTheme }) => nativeTheme.themeSource), theme);
      assert.equal((await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBackgroundColor())).toLowerCase(), theme === 'dark' ? '#101e25' : '#f1f8f7');
      assert.ok(await page.locator('.brand-mark').evaluate(img => img.complete && img.naturalWidth > 0));
      await page.screenshot({ path: path.join(root, '..', `GatorSqoosh-${theme}.png`), fullPage: true });
    }
    const drag = await page.locator('.titlebar').evaluate(el => getComputedStyle(el).webkitAppRegion); assert.equal(drag, 'drag');
    if (process.platform === 'win32') assert.equal(await page.evaluate(() => navigator.windowControlsOverlay.visible), true);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].maximize());
    await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMaximized())).toBe(true);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].unmaximize());
    const fixture = await page.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 320; const ctx = c.getContext('2d'); const pixels = ctx.createImageData(c.width, c.height);
      let seed = 7; for (let i = 0; i < pixels.data.length; i += 4) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; pixels.data[i] = seed & 255; pixels.data[i+1] = seed >>> 8 & 255; pixels.data[i+2] = seed >>> 16 & 255; pixels.data[i+3] = 255; }
      ctx.putImageData(pixels, 0, 0); return c.toDataURL('image/png').split(',')[1];
    });
    const source = path.join(work, 'noise.png'); await fs.writeFile(source, Buffer.from(fixture, 'base64')); const before = await fs.readFile(source);
    await app.evaluate(({ dialog }, data) => { dialog.showOpenDialog = async (_win, options) => ({ canceled: false, filePaths: options.properties.includes('openDirectory') ? [data.work] : [data.source] }); }, { work, source });
    await page.click('#add'); await page.click('#folder'); await page.check('#limit-size'); await page.fill('#max-bytes', '1');
    for (const format of ['webp', 'jpg', 'png', 'avif']) {
      await page.selectOption('#format', format); await page.click('#compress');
      await expect(page.locator('#summary')).toBeVisible({ timeout: 120000 }); await expect(page.locator('#summary')).toContainText('1 saved');
      const name = (await page.locator('.image-row').getAttribute('title')).replace('Saved as ', ''); const data = await fs.readFile(path.join(work, name));
      assert.ok(data.byteLength <= 1024, `${format} exceeds cap: ${data.byteLength}`);
      const decoded = await page.evaluate(async bytes => { const b = await createImageBitmap(new Blob([new Uint8Array(bytes)])); const dimensions = [b.width, b.height]; b.close(); return dimensions; }, [...data]);
      assert.ok(decoded[0] > 0 && decoded[0] <= 512 && decoded[1] > 0 && decoded[1] <= 320);
    }
    await page.fill('#max-bytes', '0'); await page.click('#compress'); await expect(page.locator('#notice')).toContainText('between 1 KB and 150 MB');
    assert.deepEqual(await fs.readFile(source), before); assert.deepEqual(errors, []);
    await page.selectOption('#theme', 'dark'); await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await app.close(); app = await electron.launch(options); page = await app.firstWindow();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark'); await expect(page.locator('#theme')).toHaveValue('dark');
    await page.selectOption('#theme', 'system'); await expect(page.locator('#theme')).toHaveValue('system'); assert.equal(await app.evaluate(({ nativeTheme }) => nativeTheme.themeSource), 'system');
    console.log('PASS: Icon loading, light/dark/system themes, persisted appearance, native title-bar overlay, maximize/restore, strict size caps for all four formats, invalid limits, and original preservation.');
  } finally { await app.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
