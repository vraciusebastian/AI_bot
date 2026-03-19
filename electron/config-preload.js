const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('configAPI', {
  saveUrl: (url) => ipcRenderer.send('save-server-url', url),
  onCurrentUrl: (cb) => ipcRenderer.on('current-url', (_e, url) => cb(url)),
});
