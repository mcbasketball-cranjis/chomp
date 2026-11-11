const { contextBridge, ipcRenderer, webUtils } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  pickImages: () => ipcRenderer.invoke('pick-images'),
  dropImages: files => ipcRenderer.invoke('drop-images', files.map(file => webUtils.getPathForFile(file))),
  readImage: id => ipcRenderer.invoke('read-image', id),
  forgetImages: ids => ipcRenderer.invoke('forget-images', ids),
  pickOutput: () => ipcRenderer.invoke('pick-output'),
  saveImage: payload => ipcRenderer.invoke('save-image', payload),
  showOutput: () => ipcRenderer.invoke('show-output')
});
