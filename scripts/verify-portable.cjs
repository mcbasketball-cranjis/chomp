const fs = require('node:fs/promises');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { chromium, expect } = require('@playwright/test');
(async () => {
  const portable = (await fs.readdir('release')).find(name => name.endsWith('-Portable.exe'));
  if (!portable) throw new Error('Portable executable missing.');
  const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const port = server.address().port; await new Promise(resolve => server.close(resolve));
  const profile = await fs.mkdtemp(path.join(process.env.RUNNER_TEMP, 'chomp-portable-'));
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(path.resolve('release', portable), [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`], { env, windowsHide: true, stdio: 'ignore' });
  let browser;
  try {
    let ready = false;
    for (let i = 0; i < 120; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) { ready = true; break; } } catch {} await new Promise(resolve => setTimeout(resolve, 500)); }
    if (!ready) throw new Error('Portable app did not start.');
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    const page = browser.contexts()[0].pages()[0]; await expect(page.locator('.brand')).toContainText('Chomp'); await expect(page.locator('#add-folder')).toBeVisible();
    if (!await page.locator('.brand-mark').evaluate(image => image.complete && image.naturalWidth > 0)) throw new Error('Portable icon missing.');
    const session = await browser.newBrowserCDPSession(); await session.send('Browser.close'); browser = null;
    console.log('PASS: Single-file portable executable extracts and launches Chomp with working interface and branding.');
  } finally { if (browser) { const session = await browser.newBrowserCDPSession(); await session.send('Browser.close').catch(() => {}); } if (child.exitCode === null) await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 5000))]); }
})().catch(error => { console.error(error); process.exitCode = 1; });
