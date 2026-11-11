const { contextBridge, ipcRenderer, webUtils } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
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
