const { contextBridge, ipcRenderer, process: proc } = require('electron');

// Extract the API base URL passed as a command-line argument
const apiBase = (() => {
  const arg = (proc.argv || []).find((a) => a.startsWith('--api-base='));
  return arg ? arg.replace('--api-base=', '') : 'http://localhost:8000';
})();

contextBridge.exposeInMainWorld('__API_BASE__', apiBase);
contextBridge.exposeInMainWorld('__ELECTRON__', true);

contextBridge.exposeInMainWorld('electronAPI', {
  getServerUrl: () => ipcRenderer.invoke('get-server-url'),
  changeServerUrl: () => ipcRenderer.invoke('change-server-url'),
});
