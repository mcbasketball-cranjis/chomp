const { contextBridge, ipcRenderer, webUtils } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  getUpdateState: () => ipcRenderer.invoke('get-update-state'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateStatus: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('update-status', listener);
    return () => ipcRenderer.removeListener('update-status', listener);
  },
  getAppearance: () => ipcRenderer.invoke('get-appearance'),
  setAppearance: theme => ipcRenderer.invoke('set-appearance', theme),
  onAppearance: callback => { const listener = (_event, state) => callback(state); ipcRenderer.on('theme-changed', listener); return () => ipcRenderer.removeListener('theme-changed', listener); },
  pickImages: () => ipcRenderer.invoke('pick-images'),
  pickFolders: () => ipcRenderer.invoke('pick-folders'),
  dropImages: files => ipcRenderer.invoke('drop-images', files.map(file => webUtils.getPathForFile(file))),
  readImage: id => ipcRenderer.invoke('read-image', id),
  forgetImages: ids => ipcRenderer.invoke('forget-images', ids),
  clearInputs: () => ipcRenderer.invoke('clear-inputs'),
  beginBatch: options => ipcRenderer.invoke('begin-batch', options),
  endBatch: id => ipcRenderer.invoke('end-batch', id),
  stopPreparation: () => ipcRenderer.invoke('stop-preparation'),
  pickOutput: () => ipcRenderer.invoke('pick-output'),
  saveImage: payload => ipcRenderer.invoke('save-image', payload),
  showOutput: () => ipcRenderer.invoke('show-output')
});
