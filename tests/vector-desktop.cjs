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
    const values = () => page.locator('#format option').evaluateAll(options => options.map(option => option.value));
    assert.deepEqual(await values(), ['original','webp','jpg','png','avif'], 'Compress must not expose vectorization');
    await page.selectOption('#format', 'avif');
    await page.click('[data-workspace="convert"]');
    assert.deepEqual(await values(), ['webp','jpg','png','avif'], 'Convert must export raster images only');
    await page.selectOption('#format', 'jpg');
    await page.click('[data-workspace="vectorize"]');
    assert.deepEqual(await values(), ['svg'], 'Vectorize must only export editable SVG');
    await expect(page.locator('#trace-controls')).toBeVisible();
    await page.click('[data-workspace="compress"]');
    await expect(page.locator('#format')).toHaveValue('avif');
    await page.click('[data-workspace="convert"]');
    await expect(page.locator('#format')).toHaveValue('jpg');

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
    const jpegSamples = await page.evaluate(() => {
      return ['white', 'black'].map(background => {
        const canvas = document.createElement('canvas'); canvas.width = 96; canvas.height = 96;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = background; ctx.fillRect(0, 0, 96, 96);
        ctx.fillStyle = '#ee3322'; ctx.fillRect(24, 24, 48, 48);
        return canvas.toDataURL('image/jpeg', .88).split(',')[1];
      });
    });
    const whiteJpeg = path.join(work, 'white-logo.jpg'), blackJpeg = path.join(work, 'black-logo.jpg');
    await fs.writeFile(whiteJpeg, Buffer.from(jpegSamples[0], 'base64'));
    await fs.writeFile(blackJpeg, Buffer.from(jpegSamples[1], 'base64'));
    const before = await fs.readFile(transparent);
    async function choose(files) {
      await app.evaluate(({ dialog }, data) => {
        dialog.showOpenDialog = async (_win, options) => ({
          canceled: false, filePaths: options.properties.includes('openDirectory') ? [data.output] : data.files
        });
      }, { output: work, files });
    }
    // SVG output belongs to Vectorize; raster outputs (including SVG inputs)
    // belong to Convert. Verify both real conversion paths.
    async function selectFormat(format) {
      await page.click(`[data-workspace="${format === 'svg' ? 'vectorize' : 'convert'}"]`);
      await page.selectOption('#format', format);
    }
    async function saved() {
      await expect(page.locator('#summary')).toBeVisible({ timeout: 60000 });
      await expect(page.locator('#summary')).toContainText('1 saved');
      const filename = (await page.locator('.image-row').first().getAttribute('title')).replace('Saved as ', '');
      return path.join(work, filename);
    }
    await choose([transparent]); await page.click('#add'); await page.click('#folder');
    await selectFormat('svg'); await expect(page.locator('#trace-controls')).toBeVisible();
    await page.click('#compress');
    const svgFile = await saved(), xml = await fs.readFile(svgFile, 'utf8');
    assert.match(xml, /<svg\b/); assert.match(xml, /<path\b/);
    assert.ok(!xml.includes('<image'), 'vector output must not embed a bitmap');
    assert.ok(!xml.includes('fill="#ffffff"'), 'transparent PNG must not gain a white background');

    // SVG -> PNG round trip: both a transparent corner and an opaque subject survive.
    await page.click('#clear'); await choose([svgFile]); await page.click('#add');
    await selectFormat('png'); await page.click('#compress');
    const pngFile = await saved();
    const rgba = await page.evaluate(async numbers => {
      const bitmap = await createImageBitmap(new Blob([new Uint8Array(numbers)], { type: 'image/png' }));
      const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0); bitmap.close();
      return [ctx.getImageData(0, 0, 1, 1).data[3], ctx.getImageData(48, 48, 1, 1).data[3]];
    }, [...await fs.readFile(pngFile)]);
    assert.equal(rgba[0], 0, 'SVG export must keep transparent corners');
    assert.equal(rgba[1], 255, 'SVG export must keep solid artwork');

    // Rasterizing a real SVG input is still supported by Convert for every format.
    for (const [format, mime] of [['jpg','image/jpeg'], ['webp','image/webp'], ['avif','image/avif']]) {
      await page.click('#clear'); await choose([svgFile]); await page.click('#add');
      await selectFormat(format);
      assert.equal(await page.locator('#format option[value="svg"]').count(), 0);
      await page.click('#compress');
      const convertedFile = await saved();
      const convertedBytes = await fs.readFile(convertedFile);
      const alpha = await page.evaluate(async ({bytes,type}) => {
        const bmp=await createImageBitmap(new Blob([new Uint8Array(bytes)], {type}));
        const c=document.createElement('canvas');c.width=bmp.width;c.height=bmp.height;
        const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(bmp,0,0);bmp.close();
        return [ctx.getImageData(0,0,1,1).data[3], ctx.getImageData(48,48,1,1).data[3]];
      }, {bytes:[...convertedBytes],type:mime});
      assert.equal(alpha[0],format==='jpg'?255:0, `SVG -> ${format}: background alpha`);
      assert.equal(alpha[1],255, `SVG -> ${format}: artwork must remain opaque`);
    }

    // Background removal only when explicitly enabled.
    await page.click('#clear'); await choose([white]); await page.click('#add');
    await selectFormat('svg'); await page.check('#remove-bg');
    await page.click('#compress'); const removedXml = await fs.readFile(await saved(), 'utf8');
    assert.ok(!removedXml.includes('fill="#ffffff"'), 'background removal must not trace the white exterior');
    assert.match(removedXml, /<path\b/);

    // JPEG has no alpha channel, so remove its plain white/black background on export.
    // Test both true vector output and an ordinary transparent PNG output.
    for (const [input, outputFormat] of [[whiteJpeg, 'svg'], [blackJpeg, 'png']]) {
      await page.click('#clear'); await choose([input]); await page.click('#add');
      await selectFormat(outputFormat);
      await page.check('#remove-bg'); await page.click('#compress');
      const destination = await saved();
      const rgba = await page.evaluate(async ({ bytes, type }) => {
        const blob = new Blob([new Uint8Array(bytes)], { type });
        let bitmap;
        if (type === 'image/svg+xml') {
          const url = URL.createObjectURL(blob);
          try {
            const image = new Image();
            image.src = url;
            await image.decode();
            bitmap = await createImageBitmap(image);
          } finally { URL.revokeObjectURL(url); }
        } else {
          bitmap = await createImageBitmap(blob);
        }
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width; canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0); bitmap.close();
        return {
          corner: ctx.getImageData(0, 0, 1, 1).data[3],
          logo: [...ctx.getImageData(48, 48, 1, 1).data]
        };
      }, {
        bytes: [...await fs.readFile(destination)],
        type: outputFormat === 'svg' ? 'image/svg+xml' : 'image/png'
      });
      assert.equal(rgba.corner, 0, `${path.basename(input)} must not retain the background`);
      assert.equal(rgba.logo[3], 255, `${path.basename(input)} must preserve the logo`);
      assert.ok(rgba.logo[0] > rgba.logo[1], `${path.basename(input)} must retain the red logo fill`);
    }

    // Letterform counters: edge-only keeps enclosed background, everywhere clears them.
    // Use JPEG fixtures to cover the real logo-on-a-solid-background workflow.
    const counterSamples = await page.evaluate(() => {
      return ['white', 'black'].map(background => {
        const canvas = document.createElement('canvas'); canvas.width = 96; canvas.height = 96;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = background; ctx.fillRect(0, 0, 96, 96);
        ctx.fillStyle = '#ee3322'; ctx.fillRect(24, 24, 48, 48);
        ctx.fillStyle = background; ctx.fillRect(40, 40, 16, 16);
        return canvas.toDataURL('image/jpeg', .95).split(',')[1];
      });
    });
    const counterWhite = path.join(work, 'white-letter-O.jpg');
    const counterBlack = path.join(work, 'black-letter-O.jpg');
    await fs.writeFile(counterWhite, Buffer.from(counterSamples[0], 'base64'));
    await fs.writeFile(counterBlack, Buffer.from(counterSamples[1], 'base64'));
    for (const [input, outputFormat] of [[counterWhite, 'svg'], [counterBlack, 'png']]) {
      for (const [bgMode, expectedCounterAlpha] of [['edges', 255], ['all', 0]]) {
        await page.click('#clear'); await choose([input]); await page.click('#add');
        await selectFormat(outputFormat);
        await page.check('#remove-bg');
        await expect(page.locator('#background-controls')).toBeVisible();
        await page.check(`[name="bg-mode"][value="${bgMode}"]`);
        await page.click('#compress');
        const bytes = [...await fs.readFile(await saved())];
        const sampled = await page.evaluate(async ({ bytes, type }) => {
          const blob = new Blob([new Uint8Array(bytes)], { type });
          const url = URL.createObjectURL(blob);
          try {
            const img = new Image(); img.src = url; await img.decode();
            const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
            return {
              outside: ctx.getImageData(0, 0, 1, 1).data[3],
              hole: ctx.getImageData(48, 48, 1, 1).data[3],
              shape: [...ctx.getImageData(30, 30, 1, 1).data]
            };
          } finally { URL.revokeObjectURL(url); }
        }, { bytes, type: outputFormat === 'svg' ? 'image/svg+xml' : 'image/png' });
        assert.equal(sampled.outside, 0, `${input}: exterior should be clear (${bgMode})`);
        assert.equal(sampled.hole, expectedCounterAlpha, `${input}: enclosed O counter (${bgMode})`);
        assert.ok(sampled.shape[3] >= 200, `${input}: O shape must remain visible (${bgMode})`);
        assert.ok(sampled.shape[0] > sampled.shape[1], `${input}: O shape must keep its red fill`);
      }
    }

    assert.deepEqual(await fs.readFile(transparent), before);
    assert.deepEqual(await fs.readFile(whiteJpeg), Buffer.from(jpegSamples[0], 'base64'));
    assert.deepEqual(await fs.readFile(blackJpeg), Buffer.from(jpegSamples[1], 'base64'));
    assert.deepEqual(errors, []);
    console.log('PASS: transparent PNG -> actual SVG paths -> transparent PNG, white/black JPEG removal scopes, lettering counters, source preservation.');
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
