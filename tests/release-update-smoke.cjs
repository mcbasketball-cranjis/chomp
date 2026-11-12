// Post-release smoke test: run the ACTUAL published Chomp 2.1.0 Windows
// installer and ask its in-app updater for the new public 2.1.1 release.
// This checks GitHub update discovery, SHA-512-verified download and UI state.
// It intentionally does not launch the interactive NSIS installer.
const { _electron: electron, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

const exe = process.env.CHOMP_PREVIOUS_EXE;
if (!process.env.GITHUB_ACTIONS || process.platform !== 'win32' || !exe) {
  throw new Error('Run the updater smoke test only on the disposable Windows CI runner.');
}
const previousVersion = '2.1.0';
const nextVersion = require('../package.json').version;
if (nextVersion === previousVersion) throw new Error('Smoke test needs a newer release');
const work = path.join(process.env.RUNNER_TEMP, 'chomp-updater-smoke');

(async () => {
  await fs.mkdir(work, { recursive: true });
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({
    executablePath: exe,
    args: ['--user-data-dir=' + path.join(work, 'profile')],
    env
  });
  try {
    const page = await app.firstWindow();
    await page.waitForSelector('#updates-open');
    page.on('pageerror', error => console.error('App page error:', error.message));
    const original = await page.evaluate(() => window.desktop.getUpdateState());
    assert.equal(original.version, previousVersion);
    assert.equal(original.mode, 'automatic', 'Test requires a real installed NSIS app, not Portable/ZIP');
    console.log('PASS: installed NSIS Chomp ' + previousVersion + ' updater initialized');

    let last = original;
    for (let attempt = 1; attempt <= 8; attempt++) {
      last = await page.evaluate(() => window.desktop.checkForUpdates());
      if (last.status === 'available' && last.availableVersion === nextVersion) break;
      console.log('Update discovery attempt', attempt, last.status, last.availableVersion || '', last.error || '');
      if (attempt < 8) await new Promise(resolve => setTimeout(resolve, 12000));
    }
    assert.equal(last.status, 'available', 'Published GitHub update not detected: ' + JSON.stringify(last));
    assert.equal(last.availableVersion, nextVersion);
    await page.click('#updates-open');
    await expect(page.locator('#updates-message')).toContainText(nextVersion);
    console.log('PASS: Chomp ' + previousVersion + ' detects published ' + nextVersion + ' in-app');

    const after = await page.evaluate(() => window.desktop.downloadUpdate());
    if (after.status !== 'ready') {
      await expect.poll(
        () => page.evaluate(() => window.desktop.getUpdateState()).then(state => state.status),
        { timeout: 180000, intervals: [1500, 3000, 3000, 5000] }
      ).toBe('ready');
    }
    const downloaded = await page.evaluate(() => window.desktop.getUpdateState());
    assert.equal(downloaded.availableVersion, nextVersion);
    assert.equal(downloaded.progress, 100);
    await expect(page.locator('#updates-message')).toContainText('Update downloaded');
    await expect(page.locator('#updates-action')).toHaveText('Restart & install');
    console.log('PASS: Chomp ' + previousVersion + ' downloaded and checksum-verified ' + nextVersion + ' update, and offers restart/install');
  } finally {
    await app.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
