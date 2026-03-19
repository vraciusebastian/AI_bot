const { contextBridge, ipcRenderer } = require('electron');

// Read the saved URL fresh from config every time the preload runs (including reloads)
const apiBase = ipcRenderer.sendSync('get-server-url-sync');

contextBridge.exposeInMainWorld('__API_BASE__', apiBase);
contextBridge.exposeInMainWorld('__ELECTRON__', true);

contextBridge.exposeInMainWorld('electronAPI', {
  getServerUrl:    ()    => ipcRenderer.invoke('get-server-url'),
  changeServerUrl: ()    => ipcRenderer.invoke('change-server-url'),
  setServerUrl:    (url) => ipcRenderer.invoke('set-server-url', url),
});
