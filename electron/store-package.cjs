'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Unlike NSIS, Store apps must never offer to replace themselves with the
// unsigned GitHub setup EXE. The marker also covers manual MSIX packages on
// Electron builds that do not set process.windowsStore automatically.
function isStorePackage(platform = process.platform, executable = process.execPath, windowsStore = process.windowsStore) {
  return platform === 'win32' && (
    windowsStore === true || fs.existsSync(path.join(path.dirname(executable), 'chomp-store-package.json'))
  );
}

module.exports = { isStorePackage };
