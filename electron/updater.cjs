'use strict';

const { app, shell } = require('electron');
const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');
const { API_URL, verifiedRelease } = require('./update-utils.cjs');

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
const START_DELAY_MS = 15 * 1000;

function installedWindowsBuild() {
  if (process.platform !== 'win32' || !app.isPackaged || process.env.PORTABLE_EXECUTABLE_FILE || process.env.PORTABLE_EXECUTABLE_DIR) return false;
  // NSIS places an uninstaller next to Chomp.exe; ZIP and portable builds do not.
  return fs.existsSync(path.join(path.dirname(process.execPath), 'Uninstall Chomp.exe'));
}

function latestRelease() {
  return new Promise((resolve, reject) => {
    const request = https.get(API_URL, {
      headers: {
        'User-Agent': 'Chomp-Updater/' + app.getVersion(),
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      timeout: 12000
    }, response => {
      let data = '';
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error('GitHub returned ' + response.statusCode));
        return;
      }
      response.setEncoding('utf8');
      response.on('data', chunk => {
        data += chunk;
        if (data.length > 1024 * 1024) response.destroy(new Error('Unexpected update response size'));
      });
      response.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Invalid GitHub release response')); }
      });
      response.on('error', reject);
    });
    request.on('timeout', () => request.destroy(new Error('Update request timed out')));
    request.on('error', reject);
  });
}

function createUpdateService({ send, canRestart }) {
  const mode = !app.isPackaged ? 'unavailable' : installedWindowsBuild() ? 'automatic' : 'manual';
  let state = {
    version: app.getVersion(),
    mode,
    status: 'idle',
    availableVersion: null,
    progress: 0,
    error: null,
    downloadUrl: null
  };
  let checking = null;
  let updater = null;
  let interval = null;
  let startup = null;

  function snapshot() { return { ...state, downloadUrl: undefined }; }
  function change(fields) {
    state = { ...state, ...fields };
    send(snapshot());
    return snapshot();
  }

  if (mode === 'automatic') {
    // Only installed NSIS builds can install in-place. Portable apps and Macs
    // are deliberately restricted to notification / manual download.
    try {
      updater = require('electron-updater').autoUpdater;
      updater.autoDownload = false;
      updater.autoInstallOnAppQuit = false;
      updater.allowPrerelease = false;
      updater.on('checking-for-update', () => change({ status: 'checking', error: null }));
      updater.on('update-available', info => change({ status: 'available', availableVersion: info.version, progress: 0, error: null }));
      updater.on('update-not-available', () => change({ status: 'current', error: null, availableVersion: null }));
      updater.on('download-progress', progress => change({ status: 'downloading', progress: Math.min(100, Math.max(0, Math.round(progress.percent || 0))) }));
      updater.on('update-downloaded', info => change({ status: 'ready', progress: 100, availableVersion: info.version }));
      updater.on('error', error => {
        console.error('Chomp update error:', error);
        change({ status: 'error', error: 'Update check failed. Try again.' });
      });
    } catch (error) {
      console.error('Could not initialize Windows updater:', error);
      change({ status: 'error', error: 'Updater unavailable.' });
    }
  }

  async function check() {
    if (mode === 'unavailable') return change({ status: 'unavailable' });
    if (state.status === 'downloading' || state.status === 'ready') return snapshot();
    if (checking) return checking;
    checking = (async () => {
      change({ status: 'checking', error: null });
      try {
        if (mode === 'automatic') {
          if (!updater) throw new Error('Windows updater not available');
          await updater.checkForUpdates();
        } else {
          const release = await latestRelease();
          const available = verifiedRelease(release, process.platform, process.arch, app.getVersion());
          change(available
            ? { status: 'available', availableVersion: available.version, downloadUrl: available.url, error: null }
            : { status: 'current', availableVersion: null, downloadUrl: null, error: null });
        }
      } catch (error) {
        console.error('Chomp update check:', error);
        change({ status: 'error', error: 'Could not check for updates.' });
      } finally {
        checking = null;
      }
      return snapshot();
    })();
    return checking;
  }

  async function download() {
    if (state.status !== 'available') return snapshot();
    if (mode === 'automatic') {
      if (!updater) throw new Error('Updater unavailable');
      change({ status: 'downloading', progress: 0 });
      try { await updater.downloadUpdate(); }
      catch (error) {
        console.error('Chomp update download:', error);
        change({ status: 'error', error: 'Download failed. Try again.' });
      }
    } else if (mode === 'manual') {
      if (!state.downloadUrl) throw new Error('No verified update download');
      await shell.openExternal(state.downloadUrl);
    }
    return snapshot();
  }

  function install() {
    if (mode !== 'automatic' || state.status !== 'ready' || !updater) throw new Error('No update is ready to install.');
    if (!canRestart()) throw new Error('Finish the current batch before restarting.');
    // Never replace the app while image writes or batch preparations are active.
    // The user explicitly approved "Restart & install"; apply the per-user
    // NSIS upgrade quietly instead of opening another installer wizard.
    updater.quitAndInstall(true, true);
    return { started: true };
  }

  function start() {
    if (process.env.CI || mode === 'unavailable') return;
    startup = setTimeout(() => { check().catch(error => console.error(error)); }, START_DELAY_MS);
    startup.unref?.();
    interval = setInterval(() => { check().catch(error => console.error(error)); }, CHECK_EVERY_MS);
    interval.unref?.();
  }

  function dispose() {
    if (startup) clearTimeout(startup);
    if (interval) clearInterval(interval);
  }

  return { getState: snapshot, check, download, install, start, dispose };
}

module.exports = { createUpdateService, installedWindowsBuild };
